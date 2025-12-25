/**
 * Type definitions for the Facebook Post Downloader extension
 * (JSDoc style for JavaScript projects)
 */

/**
 * @typedef {Object} Media
 * @property {'image' | 'video'} type - Type of media
 * @property {string} url - URL of the media file
 */

/**
 * @typedef {Object} Post
 * @property {string} id - Unique post identifier
 * @property {string} [author] - Post author name
 * @property {number} [createdTime] - Unix timestamp
 * @property {string} [text] - Post text content
 * @property {string} [group] - Group name if posted in a group
 * @property {Media[]} media - Array of media attachments
 */

/**
 * @typedef {Object} DownloadTask
 * @property {string} url - Download URL
 * @property {string} filename - Target filename with path
 * @property {string} postId - Associated post ID
 * @property {number} tabId - Tab ID for notifications
 * @property {number} retries - Number of retry attempts
 * @property {boolean} [isBlob] - Whether URL is a blob
 */

/**
 * @typedef {Object} DownloadProgress
 * @property {number} completed - Number of completed downloads
 * @property {number} total - Total number of downloads
 */

/**
 * @typedef {Object} ExtensionMessage
 * @property {boolean} __EXT__ - Extension message identifier
 * @property {string} type - Message type
 * @property {*} payload - Message payload
 */

export {};
