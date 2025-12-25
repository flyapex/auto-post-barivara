# Facebook Post Downloader - Chrome Extension

A powerful Chrome extension built with CRXJS and React that allows you to download media (images and videos) from Facebook posts.

## Features

- 🔍 **Automatic Post Detection** - Intercepts GraphQL requests to detect posts with media
- 📥 **Bulk Download** - Select and download multiple posts at once
- 🎬 **Media Support** - Downloads both images and videos in high quality
- 📊 **Progress Tracking** - Real-time download progress indicator
- 📝 **Metadata Export** - Generates markdown files with post information
- 🎯 **Smart Organization** - Files organized by date, author, and post ID
- 🔄 **Retry Logic** - Automatic retry for failed downloads
- 🚀 **Queue Management** - Handles concurrent downloads efficiently

## Architecture

### Three-Layer System (Manifest V3)

1. **Page Script** (`src/injected/page-script.js`)

   - Runs in page context
   - Intercepts XMLHttpRequest and fetch requests
   - Extracts post data from GraphQL responses
   - Has access to window internals

2. **Content Script** (`src/content/main.jsx`)

   - Bridge between page and background
   - Manages React UI injection
   - Forwards messages between layers

3. **Background Service Worker** (`src/background/index.js`)
   - Handles download operations
   - Manages download queue
   - Implements retry logic
   - Generates safe filenames

## Installation

### Development Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

### For CRXJS

The extension is already configured for CRXJS. Just run:

```bash
npm run dev
```

## Usage

1. Navigate to Facebook (facebook.com)
2. Scroll through your feed or group posts
3. Click the download button (📥) in the bottom-right corner
4. Select posts you want to download
5. Click "Download Selected"
6. Files will be saved to `Downloads/facebook_downloads/`

## File Structure

```
facebook_downloads/
├── 2024-01-15_john_doe_a1b2c3d4/
│   ├── index.md          # Post metadata
│   ├── image_0.jpg       # First image
│   ├── image_1.jpg       # Second image
│   └── video.mp4         # Video (if present)
└── 2024-01-15_jane_smith_e5f6g7h8/
    └── ...
```

## Project Structure

```
src/
├── background/
│   └── index.js              # Service worker
├── content/
│   ├── main.jsx              # Content script entry
│   └── views/
│       ├── DownloaderApp.jsx # Main UI component
│       └── DownloaderApp.css # Styles
├── injected/
│   └── page-script.js        # Page context script
└── types.js                  # Type definitions
```

## How It Works

### 1. Post Detection

- Intercepts Facebook's GraphQL API calls
- Parses response data to extract post information
- Recursively searches for media URLs

### 2. Data Extraction

- Author name
- Creation timestamp
- Post text
- Group information (if applicable)
- Media URLs (images and videos)

### 3. Download Process

- User selects posts from UI
- Extension queues downloads
- Background worker processes queue (max 3 concurrent)
- Generates metadata files
- Organizes files by post

### 4. Message Flow

```
Page Script → window.postMessage → Content Script → chrome.runtime.sendMessage → Background Script
                                                                                         ↓
Content Script ← window.postMessage ← Content Script ← chrome.runtime.onMessage ← Background Script
```

## Configuration

### Maximum Concurrent Downloads

Edit `src/background/index.js`:

```javascript
const MAX_CONCURRENT_DOWNLOADS = 3; // Change this value
```

### Filename Format

Modify the `generateFilename` function in `src/background/index.js` to customize file naming.

## Permissions Required

- `downloads` - To save files to disk
- `storage` - To persist extension state
- `scripting` - To inject scripts
- Host permissions for `*://*.facebook.com/*`

## Limitations

- Only works on facebook.com
- Requires posts to be loaded (must scroll to see them)
- Download speed depends on Facebook's CDN
- Some private/restricted posts may not be accessible

## Troubleshooting

### Posts not appearing

- Scroll through Facebook to trigger GraphQL requests
- Check console for errors (F12 → Console)
- Ensure extension is enabled

### Downloads failing

- Check Chrome's download settings
- Verify disk space availability
- Try refreshing the page

### UI not showing

- Check if content script loaded (F12 → Console)
- Try disabling and re-enabling the extension
- Clear browser cache

## Development

### Building

```bash
npm run build
```

### Development Mode with Hot Reload

```bash
npm run dev
```

### Debugging

- **Background Script**: `chrome://extensions/` → Inspect service worker
- **Content Script**: F12 on Facebook page
- **Page Script**: F12 → Console (look for `[FB Downloader]` logs)

## Technical Notes

### Why Three Layers?

1. **Content Script** alone can't access page's JavaScript context
2. **Page Script** has full access but can't use Chrome APIs
3. **Background Script** handles Chrome API operations

### GraphQL Interception

Facebook uses GraphQL for most data fetching. By intercepting these requests, we can capture post data as it's loaded, which is more reliable than DOM parsing.

### Security

- No data is sent to external servers
- All processing happens locally
- Downloads use Chrome's native download API

## Contributing

Contributions are welcome! Please ensure:

- Code follows existing style
- All layers work correctly
- No console errors
- Downloads complete successfully

## License

MIT License - feel free to use and modify

## Credits

Built with:

- [CRXJS](https://crxjs.dev/) - Vite plugin for Chrome Extensions
- [React](https://reactjs.org/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
