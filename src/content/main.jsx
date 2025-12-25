import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import DownloaderApp from "./views/DownloaderApp";

// Check if extension context is valid
function isExtensionContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

// Inject page script
function injectPageScript() {
  if (!isExtensionContextValid()) {
    console.error("[Facebook Downloader] Extension context invalid");
    return;
  }

  try {
    const script = document.createElement("script");
    // Use the new GraphQL interceptor
    script.src = chrome.runtime.getURL("src/injected/graphql-interceptor.js");
    script.type = "module";
    script.onload = () => {
      console.log(
        "[Facebook Downloader] GraphQL interceptor injected successfully"
      );
      script.remove();
    };
    script.onerror = (error) => {
      console.error(
        "[Facebook Downloader] GraphQL interceptor injection failed:",
        error
      );
    };

    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(script);
    }
  } catch (error) {
    console.error(
      "[Facebook Downloader] Error injecting GraphQL interceptor:",
      error
    );
  }
}

// Message bridge
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const message = event.data;

  if (message && message.__EXT__ === true) {
    if (!isExtensionContextValid()) {
      console.error("[Facebook Downloader] ❌ Extension context invalid!");
      return;
    }

    chrome.runtime
      .sendMessage({
        type: message.type,
        payload: message.payload,
      })
      .then((response) => {
        if (response) {
          window.postMessage(
            {
              __EXT__: true,
              type: `${message.type}_RESPONSE`,
              payload: response,
            },
            "*"
          );
        }
      })
      .catch((err) => {
        console.error("[Facebook Downloader] Message error:", err.message);
      });
  }
});

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  window.postMessage(
    {
      __EXT__: true,
      type: message.type,
      payload: message.payload,
    },
    "*"
  );
  sendResponse({ received: true });
  return true;
});

// Create UI
function initializeUI() {
  if (!document.body) {
    setTimeout(initializeUI, 100);
    return;
  }

  if (document.getElementById("fb-downloader-root")) {
    return;
  }

  try {
    const container = document.createElement("div");
    container.id = "fb-downloader-root";
    // CRITICAL: Set attributes to prevent React conflicts
    container.setAttribute("data-reactroot", "");
    container.style.cssText =
      "all: initial; * { all: unset; } position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; pointer-events: none !important; z-index: 2147483647 !important;";

    document.body.appendChild(container);

    const root = createRoot(container);

    root.render(<DownloaderApp />);

    setTimeout(() => {
      const check = document.getElementById("fb-downloader-root");

      const button = document.querySelector(".fb-dl-toggle");

      if (button) {
        console.log("[Facebook Downloader] 🎉 Button is visible!");
      }
    }, 1000);
  } catch (error) {
    console.error("[Facebook Downloader] ❌ Error initializing UI:", error);
  }
}

// Initialize
console.log("[Facebook Downloader] Starting initialization...");

if (!isExtensionContextValid()) {
  console.error("[Facebook Downloader] ❌ Extension context invalid!");
} else {
  injectPageScript();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeUI);
  } else {
    initializeUI();
  }

  setTimeout(() => {
    if (!document.getElementById("fb-downloader-root")) {
      console.log("[Facebook Downloader] Fallback init");
      initializeUI();
    }
  }, 2000);
}

console.log("[Facebook Downloader] Content script END");
