import { useState, useEffect, useRef } from "react";
import "./DownloaderApp.css";

export default function DownloaderApp() {
  const [show, setShow] = useState(false);
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });

  // Auto-scroll states
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollStatus, setScrollStatus] = useState("idle");
  const [scrollSpeed, setScrollSpeed] = useState(2000); // pixels per scroll

  // Filter states
  const [timeFilter, setTimeFilter] = useState(""); // e.g., "10m", "2h", "1d"
  const [keywordFilter, setKeywordFilter] = useState(
    "স্বাগতম, টিউশন,মাশাল্লাহ, বিক্রি, কেনা, সেল, বিক্রয়, মূল্য, দাম, বাসা লাগবে, একদাম, সিট লাগবে, প্রয়োজন, বাসা প্রয়োজন, প্রয়োজন, প্রয়োজান, ভারা লাগবে, ভারা লাগব, ভাড়া লাগব, কিনতে, বিক্রয়, Sell, welcome, নতুন সদস্য, মধু, সেলারি, Off topic, পার্ট টাইম, ভাইরাল_ভিডিও, রুম দরকার, দুধ, আমিন, অর্ডার, ডেইরি ফার্ম, ড্রেস, youtu.be, ওড়না, projon, নিয়োগ, সূরা, পড়াচ্ছি, কোচিং, সেকেন্ড হ্যান্ড, শুভ রাত্রি, ইনকাম, লাগবে, বিক্রয়, বাসা দরকার, সেল, ডেলিভারি, সোফা ক্লিনিং,সার্ভিস পেতে,follow back,𝙁𝙤𝙡𝙡𝙤𝙬 𝘽𝙖𝙘𝙠,দোয়া,জাতীয় পাখি,দেশের,room dorkar, bmw,সরকার,মিল্ক শেক,হারিয়ে গেছে,নির্বাচন,আল্লাহ,প্রমোশনাল ভিডিও সার্ভিসিং ,Offer,কাজ করে থাকি,বাংলাদেশে,Rent a car, RAM যুদ্ধ,ঈদের,Page,মেহেদী,ক্রিম,with a Facebook Post:, Sale, mAh ,বেতন ,teacher,পাইকারি, প্রাকটিকাল"
  );
  const [numberFilter, setNumberFilter] = useState(true);

  // Draggable states
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  const scrollIntervalRef = useRef(null);
  const panelRef = useRef(null);

  // Center the panel on first show
  useEffect(() => {
    if (show && !isInitialized && panelRef.current) {
      // Use setTimeout to ensure the panel is fully rendered
      setTimeout(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const rect = panel.getBoundingClientRect();

        setPosition({
          x: Math.max(0, (window.innerWidth - rect.width) / 2),
          y: Math.max(0, (window.innerHeight - rect.height) / 2),
        });
        setIsInitialized(true);
      }, 0);
    }
  }, [show, isInitialized]);

  // Parse time filter (e.g., "10m" -> 600 seconds)
  const parseTimeFilter = (filterStr) => {
    if (!filterStr || filterStr.trim() === "") return null;

    const match = filterStr.match(/^(\d+)([smhd])$/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (multipliers[unit] || 0);
  };

  const normalizePostTime = (rawTime) => {
    if (rawTime == null) return null;

    // number
    if (typeof rawTime === "number") {
      if (rawTime > 1e12) return Math.floor(rawTime / 1000); // ms → sec
      if (rawTime > 1e9) return rawTime; // sec
      return null;
    }

    // string
    if (typeof rawTime === "string") {
      const s = rawTime.trim();
      if (!s) return null;

      // numeric string
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        if (n > 1e12) return Math.floor(n / 1000);
        if (n > 1e9) return n;
        return null;
      }

      // ISO / GraphQL datetime
      let ms = Date.parse(s);
      if (!Number.isNaN(ms)) return Math.floor(ms / 1000);

      // handle +0000 timezone (FB GraphQL format)
      const fixed = s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
      ms = Date.parse(fixed);
      if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
    }

    return null;
  };

  // Check if post passes time filter
  const passesTimeFilter = (post) => {
    const filterSeconds = parseTimeFilter(timeFilter);
    if (!filterSeconds) return true;

    const postTime = normalizePostTime(post.createdTime);
    if (!postTime) return false;

    const now = Math.floor(Date.now() / 1000);
    const ageSeconds = now - postTime;

    // invalid or future timestamps
    if (ageSeconds < 0 || ageSeconds > 60 * 60 * 24 * 365) return false;

    return ageSeconds <= filterSeconds;
  };

  // Check if post passes keyword filter
  const passesKeywordFilter = (post) => {
    if (!keywordFilter.trim()) return true;

    const keywords = keywordFilter
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    if (keywords.length === 0) return true;

    const postText = (post.text || "").toLowerCase();

    // Return false if ANY keyword is found (filter out)
    return !keywords.some((keyword) => postText.includes(keyword));
  };

  // Check if post passes number filter
  const passesNumberFilter = (post) => {
    if (!numberFilter) return true;

    const text = post.text || "";
    if (typeof text !== "string") return true;

    // Remove hyphens and spaces
    const cleanedText = text.replace(/[- ]/g, "");

    // Check for Bangladeshi phone numbers (01 followed by 7-10 digits)
    const numberPattern = /01\d{7,10}/g;
    const matches = cleanedText.match(numberPattern);

    // Filter out posts that contain phone numbers
    return !matches || matches.length === 0;
  };

  // Apply all filters to posts
  const filterPosts = (postsArray) => {
    return postsArray.filter((post) => {
      // Must have text
      if (!post.text || post.text.trim().length === 0) return false;

      // Check time filter
      if (!passesTimeFilter(post)) {
        return false;
      }

      // Check keyword filter
      if (!passesKeywordFilter(post)) {
        return false;
      }

      // Check number filter
      if (!passesNumberFilter(post)) {
        return false;
      }

      return true;
    });
  };

  useEffect(() => {
    // Listen for messages from page script
    const handleMessage = (event) => {
      if (event.source !== window) return;
      const message = event.data;

      if (message && message.__EXT__ === true) {
        switch (message.type) {
          case "POSTS_DETECTED":
            const filteredPosts = filterPosts(message.payload.posts);
            console.log(
              `[DownloaderApp] Filtered ${message.payload.posts.length} posts down to ${filteredPosts.length} posts`
            );
            setPosts(filteredPosts);

            // Auto-stop scrolling if we encounter old posts beyond time filter
            if (isScrolling && timeFilter) {
              const filterSeconds = parseTimeFilter(timeFilter);
              if (filterSeconds) {
                // Check if any newly detected posts are older than the filter
                const hasOldPosts = message.payload.posts.some((post) => {
                  const postTime = normalizePostTime(post.createdTime);
                  if (!postTime) return false;

                  const now = Math.floor(Date.now() / 1000);
                  const ageSeconds = now - postTime;

                  return ageSeconds > filterSeconds;
                });

                if (hasOldPosts) {
                  console.log(
                    `[DownloaderApp] Found posts older than ${timeFilter}, stopping auto-scroll`
                  );
                  stopAutoScroll();
                }
              }
            }
            break;
          case "DOWNLOAD_STARTED":
            setDownloading(true);
            break;
          case "DOWNLOAD_COMPLETE":
            setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
            break;
          case "DOWNLOAD_FAILED":
            console.error("Download failed:", message.payload);
            break;
          case "ALL_DOWNLOADS_COMPLETE":
            setDownloading(false);
            setProgress({ completed: 0, total: 0 });
            setSelected(new Set());
            break;
          case "EXTENSION_INVALIDATED":
            alert(
              message.payload.message +
                "\n\nPress Ctrl+R (or Cmd+R on Mac) to refresh."
            );
            break;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [timeFilter, keywordFilter, numberFilter, isScrolling]);

  // Dragging functionality
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e) => {
    // Only allow dragging from the header, not from buttons or inputs
    const target = e.target;
    if (!target.closest(".fb-dl-header")) return;
    if (target.closest(".fb-dl-close")) return;
    if (target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT") return;

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection while dragging
  };

  // Auto-scroll functionality
  const startAutoScroll = () => {
    setScrollStatus("running");
    setIsScrolling(true);

    scrollIntervalRef.current = setInterval(() => {
      window.scrollBy({
        top: scrollSpeed,
        behavior: "smooth",
      });

      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 100
      ) {
        pauseAutoScroll();
      }
    }, 2000);
  };

  const pauseAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    setScrollStatus("paused");
    setIsScrolling(false);
  };

  const stopAutoScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    setScrollStatus("stopped");
    setIsScrolling(false);
  };

  const clearAllPosts = () => {
    if (window.confirm("Are you sure you want to clear all detected posts?")) {
      setPosts([]);
      setSelected(new Set());
    }
  };

  const togglePost = (postId) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selected.size === posts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(posts.map((p) => p.id)));
    }
  };

  const handleDownload = () => {
    const selectedPosts = posts.filter((p) => selected.has(p.id));
    if (selectedPosts.length === 0) return;

    const totalMedia = selectedPosts.reduce(
      (acc, p) => acc + (p.media?.length || 0),
      0
    );
    setProgress({ completed: 0, total: totalMedia });

    window.postMessage(
      {
        __EXT__: true,
        type: "DOWNLOAD",
        payload: { posts: selectedPosts },
      },
      "*"
    );
  };

  const exportToJSON = () => {
    const selectedPosts = posts.filter((p) => selected.has(p.id));
    const dataStr = JSON.stringify(selectedPosts, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `facebook_posts_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const selectedPosts = posts.filter((p) => selected.has(p.id));

    let csv = "ID,Author,Date,Text,Media Count,Media Types,Media URLs\n";

    selectedPosts.forEach((post) => {
      const date = post.createdTime
        ? new Date(post.createdTime * 1000).toISOString()
        : "Unknown";
      const text = (post.text || "").replace(/"/g, '""').replace(/\n/g, " ");
      const mediaCount = post.media?.length || 0;
      const mediaTypes = post.media?.map((m) => m.type).join("; ") || "";
      const mediaUrls = post.media?.map((m) => m.url).join("; ") || "";

      csv += `"${post.id}","${
        post.author || ""
      }","${date}","${text}",${mediaCount},"${mediaTypes}","${mediaUrls}"\n`;
    });

    const dataBlob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `facebook_posts_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Format relative time (e.g., "1m ago", "2h ago")
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return "Unknown";

    const now = Math.floor(Date.now() / 1000);
    const secondsAgo = now - timestamp;

    if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    return `${Math.floor(secondsAgo / 86400)}d ago`;
  };

  // Calculate time progress (how old is the post relative to the filter)
  const getTimeProgress = (timestamp) => {
    const filterSeconds = parseTimeFilter(timeFilter);
    const postTime = normalizePostTime(timestamp);
    if (!filterSeconds || !postTime) return null;

    const now = Math.floor(Date.now() / 1000);
    const postAge = now - postTime;

    // Calculate percentage (0% = filter limit ago, 100% = just posted)
    // Invert it so NEW posts = 100% (full bar), OLD posts = 0% (empty bar)
    const percentage = Math.max(0, 100 - (postAge / filterSeconds) * 100);

    return {
      percentage,
      age: postAge,
      ageText: formatTimeAge(postAge),
    };
  };

  // Format age in human-readable form
  const formatTimeAge = (seconds) => {
    if (seconds < 60) return `${Math.floor(seconds)}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (!show) {
    return (
      <div className="fb-dl-toggle" style={{ pointerEvents: "auto" }}>
        <button className="fb-dl-toggle-btn" onClick={() => setShow(true)}>
          📥 {posts.length > 0 && `(${posts.length})`}
        </button>
      </div>
    );
  }

  return (
    <div
      className="fb-dl-container"
      style={{
        pointerEvents: "auto",
        position: "fixed",
        left: isInitialized ? `${position.x}px` : "50%",
        top: isInitialized ? `${position.y}px` : "50%",
        transform: isInitialized ? "none" : "translate(-50%, -50%)",
        right: "auto",
        bottom: "auto",
      }}
    >
      <div
        className="fb-dl-panel"
        ref={panelRef}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? "grabbing" : "default" }}
      >
        <div
          className="fb-dl-header"
          style={{ cursor: "grab", userSelect: "none" }}
        >
          <h2 style={{ margin: 0, fontSize: "18px" }}>
            Facebook Post Downloader
          </h2>
          <button className="fb-dl-close" onClick={() => setShow(false)}>
            ✕
          </button>
        </div>

        {/* Auto-scroll controls */}
        <div className="fb-dl-autoscroll">
          <div className="fb-dl-section-title">🔄 Auto-Scroll</div>
          <div className="fb-dl-scroll-controls">
            <button
              onClick={startAutoScroll}
              disabled={isScrolling || scrollStatus === "running"}
              className="fb-dl-btn-start"
            >
              ▶️ Start
            </button>
            <button
              onClick={pauseAutoScroll}
              disabled={!isScrolling}
              className="fb-dl-btn-pause"
            >
              ⏸️ Pause
            </button>
            <button
              onClick={stopAutoScroll}
              disabled={scrollStatus === "idle"}
              className="fb-dl-btn-stop"
            >
              ⏹️ Stop
            </button>
            <span className="fb-dl-scroll-status">
              Status: <strong>{scrollStatus}</strong>
            </span>
          </div>
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <label
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              Speed:
              <input
                type="number"
                value={scrollSpeed}
                onChange={(e) =>
                  setScrollSpeed(
                    Math.max(100, parseInt(e.target.value) || 2000)
                  )
                }
                style={{ width: "70px" }}
                min="100"
                max="5000"
                step="100"
              />
              px
            </label>
          </div>
        </div>

        {/* Filters */}
        <div className="fb-dl-filters">
          <div className="fb-dl-section-title">🔍 Filters</div>

          <div className="fb-dl-filter-row">
            <label>
              Time Filter:
              <input
                type="text"
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                placeholder="e.g., 10m, 2h, 1d"
                style={{ width: "100px", marginLeft: "5px" }}
              />
            </label>
            <small style={{ marginLeft: "10px", color: "#666" }}>
              (m=minutes, h=hours, d=days) - Auto-scroll stops when older posts
              found
            </small>
          </div>

          <div className="fb-dl-filter-row">
            <label style={{ display: "block", marginBottom: "5px" }}>
              Keyword Filter (comma-separated):
            </label>
            <textarea
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              rows="3"
              style={{ width: "100%", fontSize: "12px" }}
              placeholder="Posts containing these keywords will be filtered out"
            />
          </div>

          <div className="fb-dl-filter-row">
            <label
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              <input
                type="checkbox"
                checked={numberFilter}
                onChange={(e) => setNumberFilter(e.target.checked)}
              />
              Filter out posts with phone numbers (01XXXXXXXXX)
            </label>
          </div>
        </div>

        <div className="fb-dl-stats">
          <span>Total posts: {posts.length}</span>
          <span>Selected: {selected.size}</span>
        </div>

        {downloading && (
          <div className="fb-dl-progress">
            <div className="fb-dl-progress-bar">
              <div
                className="fb-dl-progress-fill"
                style={{
                  width: `${(progress.completed / progress.total) * 100}%`,
                }}
              />
            </div>
            <span>
              {progress.completed} / {progress.total} files
            </span>
          </div>
        )}

        <div className="fb-dl-controls">
          <button onClick={selectAll} disabled={downloading}>
            {selected.size === posts.length ? "Deselect All" : "Select All"}
          </button>
          <button
            onClick={clearAllPosts}
            disabled={downloading || posts.length === 0}
            className="fb-dl-clear-btn"
            style={{ backgroundColor: "#dc3545" }}
          >
            🗑️ Clear All
          </button>
          <button
            onClick={handleDownload}
            disabled={selected.size === 0 || downloading}
            className="fb-dl-download-btn"
          >
            📥 Download Media ({selected.size})
          </button>
          <button
            onClick={exportToJSON}
            disabled={selected.size === 0}
            className="fb-dl-export-btn"
          >
            📄 Export JSON
          </button>
          <button
            onClick={exportToCSV}
            disabled={selected.size === 0}
            className="fb-dl-export-btn"
          >
            📊 Export CSV
          </button>
        </div>

        <div className="fb-dl-posts">
          {posts.length === 0 ? (
            <div className="fb-dl-empty">
              No posts detected yet. Scroll through Facebook to capture posts.
            </div>
          ) : (
            <table className="fb-dl-table">
              <thead>
                <tr>
                  <th style={{ width: "40px" }}>Select</th>
                  <th>Author</th>
                  <th>Date</th>
                  {timeFilter && <th style={{ width: "120px" }}>Age</th>}
                  <th>Media</th>
                  <th>Text Preview</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const timeProgress = getTimeProgress(post.createdTime);

                  return (
                    <tr
                      key={post.id}
                      className={selected.has(post.id) ? "selected" : ""}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(post.id)}
                          onChange={() => togglePost(post.id)}
                          disabled={downloading}
                        />
                      </td>
                      <td>{post.author || "Unknown"}</td>
                      <td>
                        <div style={{ fontSize: "12px" }}>
                          <div>{formatDate(post.createdTime)}</div>
                          <div
                            style={{
                              color: "#666",
                              fontSize: "11px",
                              marginTop: "2px",
                            }}
                          >
                            {formatRelativeTime(post.createdTime)}
                          </div>
                        </div>
                      </td>
                      {timeFilter && (
                        <td>
                          {timeProgress ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                              }}
                            >
                              <small
                                style={{ fontSize: "11px", fontWeight: "bold" }}
                              >
                                {timeProgress.ageText}
                              </small>
                              <div
                                style={{
                                  width: "100%",
                                  height: "6px",
                                  backgroundColor: "#e0e0e0",
                                  borderRadius: "3px",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${timeProgress.percentage}%`,
                                    height: "100%",
                                    backgroundColor:
                                      timeProgress.percentage > 80
                                        ? "#28a745"
                                        : timeProgress.percentage > 50
                                        ? "#ffc107"
                                        : "#dc3545",
                                    transition: "width 0.3s ease",
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <small>-</small>
                          )}
                        </td>
                      )}
                      <td>
                        {post.media?.length || 0}
                        {post.media?.length > 0 && (
                          <span className="fb-dl-media-types">
                            (
                            {post.media
                              .map((m) => (m.type === "video" ? "🎥" : "🖼️"))
                              .join("")}
                            )
                          </span>
                        )}
                      </td>
                      <td className="fb-dl-text-preview">
                        {post.text.substring(0, 50) +
                          (post.text.length > 50 ? "..." : "")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
