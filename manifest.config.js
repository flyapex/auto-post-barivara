import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  description: "Download media from Facebook posts",
  version: pkg.version,
  icons: {
    16: "public/logo.png",
    48: "public/logo.png",
    128: "public/logo.png",
  },
  permissions: ["downloads", "storage", "scripting"],
  host_permissions: ["*://*.facebook.com/*"],
  action: {
    default_icon: {
      16: "public/logo.png",
      48: "public/logo.png",
      128: "public/logo.png",
    },
    default_popup: "src/popup/index.html",
  },
  background: {
    service_worker: "src/background/index.js",
    type: "module",
  },
  content_scripts: [
    {
      js: ["src/content/main.jsx"],
      matches: ["*://*.facebook.com/*"],
      run_at: "document_start",
    },
  ],
  web_accessible_resources: [
    {
      resources: ["src/injected/graphql-interceptor.js"],
      matches: ["*://*.facebook.com/*"],
    },
  ],
});
