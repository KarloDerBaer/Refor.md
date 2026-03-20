/**
 * Extract the filename from a file path (works with both Windows and Unix separators).
 */
export const basename = (filePath) => filePath.split(/\\|\//).pop();
