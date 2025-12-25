// Background Service Worker
console.log("[Background] Service worker starting...");

const MAX_CONCURRENT_DOWNLOADS = 3;
const downloadQueue = [];
const activeDownloads = new Map();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log(
    "[Background] Received message:",
    message.type,
    "from tab:",
    sender.tab?.id
  );

  try {
    if (message.type === "DOWNLOAD") {
      handleDownload(message.payload, sender.tab.id);
      sendResponse({ success: true });
      return true;
    } else if (message.type === "UPDATE_BADGE") {
      updateBadge(message.payload);
      sendResponse({ success: true });
      return true;
    } else if (message.type === "GET_DOWNLOAD_STATUS") {
      sendResponse({
        queue: downloadQueue.length,
        active: activeDownloads.size,
      });
      return true;
    } else if (message.type === "POSTS_DETECTED") {
      console.log(
        "[Background] Posts detected:",
        message.payload?.posts?.length || 0
      );
      sendResponse({ success: true, received: true });
      return true;
    } else {
      console.log("[Background] Unknown message type:", message.type);
      sendResponse({ success: true, unknown: true });
      return true;
    }
  } catch (error) {
    console.error("[Background] Error handling message:", error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

// Handle download request
async function handleDownload(payload, tabId) {
  console.log(
    "[Background] Handling download for",
    payload.posts?.length || 0,
    "posts"
  );

  const { posts } = payload;

  for (const post of posts) {
    // ALWAYS create metadata file for every post
    const metadata = generateMetadata(post);
    const metadataBlob = new Blob([metadata], { type: "text/markdown" });
    const metadataUrl = URL.createObjectURL(metadataBlob);
    downloadQueue.push({
      url: metadataUrl,
      filename: generateFilename(post, { type: "metadata" }, 0),
      postId: post.id,
      tabId: tabId,
      retries: 0,
      isBlob: true,
    });
    console.log("[Background] Queued metadata file for post:", post.id);

    // Download media if post has any
    if (post.media && post.media.length > 0) {
      for (let i = 0; i < post.media.length; i++) {
        const media = post.media[i];
        const downloadTask = {
          url: media.url,
          filename: generateFilename(post, media, i),
          postId: post.id,
          tabId: tabId,
          retries: 0,
        };
        downloadQueue.push(downloadTask);
        console.log(
          "[Background] Queued media download:",
          downloadTask.filename
        );
      }
    } else {
      console.log(
        "[Background] Post has no media, only creating metadata file"
      );
    }
  }

  console.log("[Background] Total in queue:", downloadQueue.length);
  processQueue();
}

// Process download queue
async function processQueue() {
  console.log("[Background] Processing queue...", {
    queue: downloadQueue.length,
    active: activeDownloads.size,
    maxConcurrent: MAX_CONCURRENT_DOWNLOADS,
  });

  while (
    downloadQueue.length > 0 &&
    activeDownloads.size < MAX_CONCURRENT_DOWNLOADS
  ) {
    const task = downloadQueue.shift();
    startDownload(task);
  }
}

// Start individual download
async function startDownload(task) {
  console.log("[Background] Starting download:", task.filename);

  try {
    const downloadId = await chrome.downloads.download({
      url: task.url,
      filename: task.filename,
      conflictAction: "uniquify",
    });

    console.log("[Background] Download started with ID:", downloadId);
    activeDownloads.set(downloadId, task);

    // Notify content script
    chrome.tabs
      .sendMessage(task.tabId, {
        type: "DOWNLOAD_STARTED",
        payload: { postId: task.postId, downloadId },
      })
      .catch((err) => {
        console.log(
          "[Background] Could not notify tab (tab may be closed):",
          err.message
        );
      });
  } catch (error) {
    console.error("[Background] Download failed:", error);

    // Retry logic
    if (task.retries < 3) {
      task.retries++;
      console.log("[Background] Retrying download (attempt", task.retries, ")");
      downloadQueue.push(task);
      setTimeout(processQueue, 2000);
    } else {
      console.error(
        "[Background] Download failed after 3 retries:",
        task.filename
      );
      // Notify failure
      chrome.tabs
        .sendMessage(task.tabId, {
          type: "DOWNLOAD_FAILED",
          payload: { postId: task.postId, error: error.message },
        })
        .catch(() => {});
    }
  }
}

// Listen for download completion
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === "complete") {
    const task = activeDownloads.get(delta.id);
    if (task) {
      console.log("[Background] Download completed:", task.filename);
      activeDownloads.delete(delta.id);

      // Cleanup blob URLs
      if (task.isBlob) {
        URL.revokeObjectURL(task.url);
      }

      // Notify content script
      chrome.tabs
        .sendMessage(task.tabId, {
          type: "DOWNLOAD_COMPLETE",
          payload: { postId: task.postId, downloadId: delta.id },
        })
        .catch(() => {});

      // Process next in queue
      processQueue();
    }
  } else if (delta.state && delta.state.current === "interrupted") {
    const task = activeDownloads.get(delta.id);
    if (task) {
      console.error("[Background] Download interrupted:", task.filename);
      activeDownloads.delete(delta.id);

      // Retry
      if (task.retries < 3) {
        task.retries++;
        downloadQueue.push(task);
        setTimeout(processQueue, 2000);
      }
    }
  }
});

// Generate safe filename
function generateFilename(post, media, index) {
  const date = post.createdTime
    ? new Date(post.createdTime * 1000)
    : new Date();
  const dateStr = date.toISOString().split("T")[0];
  const author = sanitizeFilename(post.author || "unknown");
  const postIdShort = post.id ? post.id.slice(-8) : "unknown";

  if (media.type === "metadata") {
    return `facebook_downloads/${dateStr}_${author}_${postIdShort}/index.md`;
  }

  const ext = media.type === "video" ? "mp4" : "jpg";
  const suffix = index > 0 ? `_${index}` : "";

  return `facebook_downloads/${dateStr}_${author}_${postIdShort}/${media.type}${suffix}.${ext}`;
}

// Sanitize filename
function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .substring(0, 50)
    .toLowerCase();
}

// Generate metadata
function generateMetadata(post) {
  let md = `# Facebook Post\n\n`;
  md += `**Post ID:** ${post.id || "N/A"}\n`;
  md += `**Author:** ${post.author || "N/A"}\n`;
  md += `**Created:** ${
    post.createdTime ? new Date(post.createdTime * 1000).toISOString() : "N/A"
  }\n`;
  if (post.group) md += `**Group:** ${post.group}\n`;
  md += `\n## Content\n\n`;
  md += post.text || "(No text content)";
  md += `\n\n## Media\n\n`;
  if (post.media && post.media.length > 0) {
    post.media.forEach((m, i) => {
      md += `- ${m.type} ${i + 1}: ${m.url}\n`;
    });
  } else {
    md += "(No media attachments)\n";
  }
  return md;
}

// Update badge
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

console.log("[Background] Service worker initialized and ready!");

// Self-test on startup
setTimeout(() => {
  console.log("[Background] Self-test: Service worker is alive");
}, 1000);
