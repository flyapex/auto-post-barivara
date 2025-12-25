// ENHANCED DIAGNOSTIC VERSION - Comprehensive logging
console.log("[FB Downloader] 🔬 ENHANCED DIAGNOSTIC VERSION LOADING...");

const detectedPosts = new Map();
let requestCount = 0;

/**
 * Parse NDJSON response text into array of objects.
 */
function parseNdjson(text) {
  // Strip common anti-JSON prefixes
  if (text.startsWith("for (;;);")) text = text.slice("for (;;);".length);
  if (text.startsWith(")]}'")) {
    const firstNewline = text.indexOf("\n");
    text = firstNewline === -1 ? "" : text.slice(firstNewline + 1);
  }

  const result = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      result.push(JSON.parse(trimmed));
    } catch {
      // skip invalid JSON lines
    }
  }
  return result;
}

// Fetch interceptor
if (!window.__fbDownloaderFetchPatched) {
  window.__fbDownloaderFetchPatched = true;
  console.log("[FB Downloader] 🔧 Patching fetch...");

  const originalFetch = window.fetch;

  window.fetch = async function patchedFetch(input, init = {}) {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
          ? input.url
          : input instanceof URL
          ? input.href
          : undefined;

      if (
        init?.method === "POST" &&
        typeof url === "string" &&
        url.includes("/api/graphql")
      ) {
        requestCount++;
        console.log(
          `[FB Downloader] 📡 GraphQL Request #${requestCount}: ${url}`
        );

        const res = await originalFetch(input, init);
        const clone = res.clone();
        const text = await clone.text();

        console.log(`[FB Downloader] 📦 Response size: ${text.length} bytes`);

        const responseBody = parseNdjson(text);
        console.log(
          `[FB Downloader] 📋 Parsed ${responseBody.length} JSON objects`
        );

        // LOG THE ENTIRE RESPONSE (first 2 items only to save space)
        console.log(
          `[FB Downloader] 🔍 FULL RESPONSE (first 2 items):`,
          JSON.parse(JSON.stringify(responseBody.slice(0, 2)))
        );

        extractPostsFromGraphQL(responseBody, requestCount);

        return res;
      }
    } catch (err) {
      console.error("[FB Downloader] ❌ Fetch error:", err);
    }

    return originalFetch(input, init);
  };
}

// XHR interceptor
if (!window.__fbDownloaderXHRPatched) {
  window.__fbDownloaderXHRPatched = true;
  console.log("[FB Downloader] 🔧 Patching XMLHttpRequest...");

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._fbdl_url = url;
    this._fbdl_method = method;
    return originalXHROpen.call(this, method, url, ...args);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (this._fbdl_url && this._fbdl_url.includes("/api/graphql")) {
      this.addEventListener("load", function () {
        try {
          requestCount++;
          console.log(
            `[FB Downloader] 📡 XHR GraphQL Request #${requestCount}`
          );

          const responseBody = parseNdjson(this.responseText);
          console.log(
            `[FB Downloader] 📋 Parsed ${responseBody.length} JSON objects`
          );

          extractPostsFromGraphQL(responseBody, requestCount);
        } catch (e) {
          console.error("[FB Downloader] ❌ XHR error:", e);
        }
      });
    }
    return originalXHRSend.call(this, body);
  };
}

function extractPostsFromGraphQL(responseBody, reqNum) {
  try {
    console.log(`[FB Downloader] 🔍 Processing request #${reqNum}...`);

    // Search for ANY object with text content
    const objectsWithText = findObjectsWithText(responseBody);
    console.log(
      `[FB Downloader] 💬 Found ${objectsWithText.length} objects with text content`
    );

    if (objectsWithText.length > 0) {
      console.log(
        `[FB Downloader] 📝 Text samples:`,
        objectsWithText.slice(0, 5).map((obj) => {
          const getText = (val) => {
            if (typeof val === "string") return val.substring(0, 50);
            if (val?.text && typeof val.text === "string")
              return val.text.substring(0, 50);
            return "(complex object)";
          };
          return {
            id: obj.id,
            hasId: obj.hasId,
            text: getText(obj.text || obj.message || obj.body),
          };
        })
      );
    }

    const posts = findPosts(responseBody);
    console.log(
      `[FB Downloader] 🎯 Found ${posts.length} potential posts in request #${reqNum}`
    );

    let newPostsCount = 0;

    posts.forEach((post, index) => {
      if (post.id && !detectedPosts.has(post.id)) {
        const parsedPost = parsePost(post);

        // Skip posts with no text content
        if (!parsedPost.text || parsedPost.text.trim().length === 0) {
          console.log(
            `[FB Downloader] ⏭️ Skipped post (no text): ${parsedPost.id.substring(
              0,
              20
            )}`
          );
          return;
        }

        console.log(`[FB Downloader] 📄 Post #${index + 1}/${posts.length}:`, {
          id: parsedPost.id.substring(0, 20) + "...",
          author: parsedPost.author,
          mediaCount: parsedPost.media?.length || 0,
          hasText: !!parsedPost.text,
          textPreview: parsedPost.text?.substring(0, 40) || "(none)",
          __typename: post.__typename || "(not set)",
        });

        // Log media details for posts with media
        if (parsedPost.media && parsedPost.media.length > 0) {
          console.log(
            `[FB Downloader] 🖼️ Media in post ${parsedPost.id.substring(
              0,
              20
            )}:`,
            parsedPost.media.map((m) => ({
              type: m.type,
              url: m.url.substring(0, 60) + "...",
            }))
          );
        }

        detectedPosts.set(post.id, parsedPost);
        newPostsCount++;
      }
    });

    console.log(
      `[FB Downloader] ✅ Added ${newPostsCount} new posts. Total: ${detectedPosts.size}`
    );

    // Show detailed breakdown
    const allPosts = Array.from(detectedPosts.values());
    const withMedia = allPosts.filter((p) => p.media?.length > 0).length;
    const withText = allPosts.filter((p) => p.text).length;
    const textOnly = allPosts.filter((p) => !p.media?.length && p.text).length;
    const mediaOnly = allPosts.filter((p) => p.media?.length && !p.text).length;

    console.log(
      `[FB Downloader] 📊 BREAKDOWN: Total=${allPosts.length} | WithMedia=${withMedia} | WithText=${withText} | TextOnly=${textOnly} | MediaOnly=${mediaOnly}`
    );

    if (newPostsCount > 0) {
      notifyPosts();
    }
  } catch (e) {
    console.error("[FB Downloader] ❌ Extract error:", e, e.stack);
  }
}

// Find ANY object that has text content
function findObjectsWithText(obj, results = [], depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 20) return results;

  if (obj.message || obj.text || obj.body) {
    results.push({
      id: obj.id || "(no-id)",
      message: obj.message,
      text: obj.text,
      body: obj.body,
      hasId: !!obj.id,
    });
  }

  if (Array.isArray(obj)) {
    obj.forEach((item) => findObjectsWithText(item, results, depth + 1));
  } else {
    Object.values(obj).forEach((value) => {
      if (value && typeof value === "object") {
        findObjectsWithText(value, results, depth + 1);
      }
    });
  }

  return results;
}

// Recursively find post objects
function findPosts(obj, posts = [], depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 20) return posts;

  // Check wrappers first (common in Facebook GraphQL)
  if (
    obj.node?.id &&
    obj.node &&
    !isComment(obj.node) &&
    !isSharedPost(obj.node)
  ) {
    posts.push(obj.node);
  }

  if (
    obj.story?.id &&
    obj.story &&
    !isComment(obj.story) &&
    !isSharedPost(obj.story)
  ) {
    posts.push(obj.story);
  }

  if (
    obj.edge?.node?.id &&
    obj.edge.node &&
    !isComment(obj.edge.node) &&
    !isSharedPost(obj.edge.node)
  ) {
    posts.push(obj.edge.node);
  }

  // Capture if it has ID AND any content indicators AND is not a comment or shared post
  if (
    obj.id &&
    typeof obj.id === "string" &&
    !isComment(obj) &&
    !isSharedPost(obj)
  ) {
    const hasContent = !!(
      obj.message ||
      obj.text ||
      obj.body ||
      obj.attachments ||
      obj.media ||
      obj.comet_sections ||
      obj.attached_story
    );

    if (hasContent) {
      posts.push(obj);
    }
  }

  // Recurse through arrays and objects
  if (Array.isArray(obj)) {
    obj.forEach((item) => findPosts(item, posts, depth + 1));
  } else {
    Object.values(obj).forEach((value) => {
      if (value && typeof value === "object") {
        findPosts(value, posts, depth + 1);
      }
    });
  }

  return posts;
}

// Check if an object is a comment (not a post)
function isComment(obj) {
  if (!obj) return false;

  // Comments have __typename "Comment"
  if (obj.__typename === "Comment") return true;

  // Comments often have a "comment" field or are nested under "comment"
  if (obj.comment) return true;

  // Comments might have "parent_feedback" indicating they're replies
  if (obj.parent_feedback) return true;

  // Comments often have "feedback" with "comment_count" but no "share_count"
  // Posts typically have both or neither
  if (
    obj.feedback &&
    obj.feedback.comment_count &&
    !obj.feedback.share_count &&
    !obj.feedback.reactors
  ) {
    return true;
  }

  // If it has a very short ID (comments often have shorter IDs than posts)
  // This is a weak signal, so use carefully
  if (obj.id && typeof obj.id === "string" && obj.id.length < 10) {
    return true;
  }

  return false;
}

// Parse post object to extract relevant data
function parsePost(post) {
  return {
    id: post.id || generateId(),
    author: extractAuthor(post),
    createdTime: extractCreatedTime(post),
    text: extractText(post),
    group: extractGroup(post),
    media: extractMedia(post),
  };
}

// Extract author information
function extractAuthor(post) {
  const paths = [
    post.from?.name,
    post.actors?.[0]?.name,
    post.owner?.name,
    post.author?.name,
    post.author,
    post.comet_sections?.content?.story?.actors?.[0]?.name,
    post.node?.actors?.[0]?.name,
    post.story?.actors?.[0]?.name,
  ];

  for (const path of paths) {
    if (path && typeof path === "string") return path;
  }
  return "Unknown";
}

// Extract creation time
function extractCreatedTime(post) {
  const paths = [
    post.created_time,
    post.creation_time,
    post.publish_time,
    post.timestamp,
    post.comet_sections?.content?.story?.creation_time,
    post.node?.creation_time,
  ];

  for (const path of paths) {
    if (path) return typeof path === "number" ? path : parseInt(path);
  }
  return Math.floor(Date.now() / 1000);
}

// Extract text content
function extractText(post) {
  const paths = [
    post.message?.text,
    post.message,
    post.text,
    post.body,
    post.comet_sections?.content?.story?.message?.text,
    post.story_message?.text,
    post.node?.message?.text,
    post.node?.message,
    post.story?.message?.text,
    post.story?.message,
  ];

  for (const path of paths) {
    if (path && typeof path === "string" && path.trim().length > 0) {
      return path.trim();
    }
  }
  return null;
}

// Extract group information
function extractGroup(post) {
  const paths = [
    post.to?.data?.[0]?.name,
    post.to?.name,
    post.group?.name,
    post.feedback?.owning_group?.name,
  ];

  for (const path of paths) {
    if (path && typeof path === "string") return path;
  }
  return null;
}

// Extract media URLs from attachments
function extractMedia(post) {
  const media = [];

  function searchMedia(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 12) return;

    // Image URLs
    if (obj.image?.uri) media.push({ type: "image", url: obj.image.uri });
    if (obj.image?.url) media.push({ type: "image", url: obj.image.url });
    if (obj.photo?.image?.uri)
      media.push({ type: "image", url: obj.photo.image.uri });
    if (obj.full_width?.uri)
      media.push({ type: "image", url: obj.full_width.uri });
    if (obj.large_image?.uri)
      media.push({ type: "image", url: obj.large_image.uri });

    // Video URLs
    if (obj.video?.playable_url)
      media.push({ type: "video", url: obj.video.playable_url });
    if (obj.playable_url) media.push({ type: "video", url: obj.playable_url });
    if (obj.playable_url_quality_hd)
      media.push({ type: "video", url: obj.playable_url_quality_hd });
    if (obj.browser_native_hd_url)
      media.push({ type: "video", url: obj.browser_native_hd_url });
    if (obj.browser_native_sd_url)
      media.push({ type: "video", url: obj.browser_native_sd_url });

    // Generic URL that might be an image
    if (
      obj.url &&
      typeof obj.url === "string" &&
      (obj.url.includes("fbcdn.net") || obj.url.includes("facebook.com/photo"))
    ) {
      media.push({ type: "image", url: obj.url });
    }

    // Recursively search
    if (Array.isArray(obj)) {
      obj.forEach((item) => searchMedia(item, depth + 1));
    } else {
      Object.values(obj).forEach((value) => {
        if (value && typeof value === "object") {
          searchMedia(value, depth + 1);
        }
      });
    }
  }

  searchMedia(post);

  // Remove duplicates
  const uniqueMedia = [];
  const seen = new Set();
  media.forEach((m) => {
    if (!seen.has(m.url)) {
      seen.add(m.url);
      uniqueMedia.push(m);
    }
  });

  return uniqueMedia;
}

// Generate unique ID
function generateId() {
  return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Notify content script about detected posts
function notifyPosts() {
  const postsArray = Array.from(detectedPosts.values());

  console.log(
    `[FB Downloader] 📢 Notifying UI of ${postsArray.length} posts (${
      postsArray.filter((p) => p.media?.length).length
    } with media)`
  );

  window.postMessage(
    {
      __EXT__: true,
      type: "POSTS_DETECTED",
      payload: { posts: postsArray },
    },
    "*"
  );
}

// Listen for download requests from UI
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const message = event.data;
  if (message && message.__EXT__ === true && message.type === "DOWNLOAD") {
    console.log(
      "[FB Downloader] 📥 Download requested for",
      message.payload.posts.length,
      "posts"
    );
    window.postMessage(
      {
        __EXT__: true,
        type: "DOWNLOAD",
        payload: message.payload,
      },
      "*"
    );
  }
});

// Periodically notify UI (keep posts visible)
setInterval(() => {
  if (detectedPosts.size > 0) {
    notifyPosts();
  }
}, 5000);

console.log("[FB Downloader] 🔬 ENHANCED DIAGNOSTIC VERSION READY!");
console.log(
  "[FB Downloader] 📌 Now scroll Facebook and watch the console logs"
);
console.log("[FB Downloader] 💡 Look for posts with media counts > 0");
