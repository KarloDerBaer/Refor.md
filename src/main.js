import "./style.css";
import "highlight.js/styles/github-dark.css";

// Local fonts (1.9) — no more Google Fonts dependency
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/400-italic.css";
import "@fontsource/lora/500.css";
import "@fontsource/lora/600.css";
import { basename } from "./utils.js";
import { createState } from "./state.js";
import { initEditor } from "./editor.js";
import { initComments } from "./comments.js";
import { RawViewMode } from "./raw-view-mode.js";
import { initDragAndDrop } from "./dragdrop.js";
import { initFileManagement } from "./file-management.js";
import { initSidebar } from "./sidebar.js";
import { initFormatToolbar } from "./format-toolbar.js";
import { TabManager } from "./tab-manager.js";
import { SplitView } from "./split-view.js";
import { initEmojiPicker } from "./emoji-picker.js";

import { createIcons, icons } from 'lucide';

// Initialize Lucide Icons
createIcons({ icons });

// Optimized icon refresh: only scan a subtree instead of entire DOM (1.5)
window.lucide = {
  createIcons: (root) => {
    if (root && root instanceof HTMLElement) {
      const iconElements = root.querySelectorAll('[data-lucide]');
      if (iconElements.length > 0) {
        createIcons({ icons, nameAttr: 'data-lucide' });
      }
    } else {
      createIcons({ icons });
    }
  }
};

// --- Toast Notification System (2.7) ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
window.showToast = showToast;

// --- Global Event Listener Cleanup Registry (1.11) ---
const globalAbort = new AbortController();
const { signal: globalSignal } = globalAbort;

// Cleanup function — call to remove all global listeners
window._cleanupApp = () => globalAbort.abort();

// --- Global Error Handling (4.5) ---
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('An unexpected error occurred.', 'error');
}, { signal: globalSignal });

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
  showToast('An error occurred.', 'error');
}, { signal: globalSignal });

// Initialize UI
const appDiv = document.getElementById("app");

// --- Theme Toggle with Persistence (2.9) ---
const btnThemeToggle = document.getElementById("menu-theme");
const initTheme = async () => {
  const savedTheme = await window.electronAPI.storeGet('theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.add("light-theme");
  }
};
initTheme();

btnThemeToggle.addEventListener("click", async () => {
  const isLight = document.documentElement.classList.toggle("light-theme");
  await window.electronAPI.storeSet('theme', isLight ? 'light' : 'dark');
});

// --- Export PDF/HTML (3.8) ---
const btnExportPdf = document.getElementById("menu-export-pdf");
const btnExportHtml = document.getElementById("menu-export-html");

// Shared export styles and HTML builder
const exportStyles = `
body { font-family: 'Georgia', 'Lora', serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #2b2b2b; line-height: 1.6; }
h1 { font-size: 2em; margin-top: 0.5em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
code { font-family: monospace; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 0.95em; }
pre { background: #f5f5f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { border-left: 4px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
img { max-width: 100%; height: auto; }
hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
th { background: #f5f5f5; }
.add-block-btn { display: none; }
.inline-editor-wrapper { display: none; }
.comment-highlight { background: none; }
.editable-block { cursor: default; }
`;

function buildExportHtml(content) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>refor.md Export</title>
<style>${exportStyles}</style>
</head>
<body>
${content}
</body>
</html>`;
}

btnExportPdf.addEventListener("click", async () => {
  const renderedHtml = document.getElementById("app").innerHTML;
  const fullHtml = buildExportHtml(renderedHtml);
  const result = await window.electronAPI.exportPdf(fullHtml);
  if (result) {
    showToast(`PDF exported: ${basename(result)}`);
  } else {
    showToast("PDF export failed.", "error");
  }
});

btnExportHtml.addEventListener("click", async () => {
  const renderedHtml = document.getElementById("app").innerHTML;
  const fullHtml = buildExportHtml(renderedHtml);
  const result = await window.electronAPI.exportHtml(fullHtml);
  if (result) {
    showToast(`HTML exported: ${basename(result)}`);
  } else {
    showToast("HTML export failed.", "error");
  }
});

// --- Print (3.13) ---
const btnPrint = document.getElementById("menu-print");
btnPrint.addEventListener("click", () => {
  window.electronAPI.printDocument();
});

// --- New Window (3.14) ---
const btnNewWindow = document.getElementById("menu-new-window");
if (btnNewWindow) {
  btnNewWindow.addEventListener("click", () => {
    window.electronAPI.newWindow();
  });
}

// --- Spell-Check Toggle (3.15) ---
const btnSpellcheck = document.getElementById("menu-spellcheck");
let spellcheckEnabled = false;

const initSpellcheck = async () => {
  const saved = await window.electronAPI.storeGet('spellcheck');
  if (saved === true) {
    spellcheckEnabled = true;
    btnSpellcheck.textContent = "Spellcheck: On";
  }
};
initSpellcheck();

btnSpellcheck.addEventListener("click", async () => {
  spellcheckEnabled = !spellcheckEnabled;
  btnSpellcheck.textContent = spellcheckEnabled ? "Spellcheck: On" : "Spellcheck: Off";
  await window.electronAPI.storeSet('spellcheck', spellcheckEnabled);
  showToast(spellcheckEnabled ? "Spellcheck enabled" : "Spellcheck disabled");
});

// --- Edit Mode Toggle (works on focused pane) ---
const btnEditToggle = document.getElementById("btn-edit-toggle");
const btnCommentToggle = document.getElementById("btn-comment-toggle");
const appRight = document.getElementById("app-right");

const getFocusedDiv = () => {
  if (window._splitView && window._splitView.isOpen) {
    return window._splitView.focusedPane === 'right' ? appRight : appDiv;
  }
  return appDiv;
};

const toggleEditMode = () => {
  const target = getFocusedDiv();
  const isEditing = target.classList.toggle("app-edit-mode");
  btnEditToggle.classList.toggle("active", isEditing);
  if (isEditing) {
    target.classList.remove("app-comment-mode");
    btnCommentToggle.classList.remove("active");
  }
};

const toggleCommentMode = () => {
  const target = getFocusedDiv();
  const isCommenting = target.classList.toggle("app-comment-mode");
  btnCommentToggle.classList.toggle("active", isCommenting);
  if (isCommenting) {
    target.classList.remove("app-edit-mode");
    btnEditToggle.classList.remove("active");
  }
};

btnEditToggle.addEventListener("click", toggleEditMode);
btnCommentToggle.addEventListener("click", toggleCommentMode);

// --- Search Bar Logic with Match Counter (2.8) ---
const searchInput = document.getElementById("search-input");
const searchCounter = document.getElementById("search-counter");
let currentSearchMatches = [];
let currentSearchIndex = -1;

function updateSearchCounter() {
  if (currentSearchMatches.length === 0) {
    searchCounter.textContent = searchInput.value ? "0 matches" : "";
  } else {
    searchCounter.textContent = `${currentSearchIndex + 1}/${currentSearchMatches.length}`;
  }
}

function clearSearchHighlights() {
  const highlights = document.querySelectorAll(".search-highlight");
  highlights.forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    }
  });
  currentSearchMatches = [];
  currentSearchIndex = -1;
  updateSearchCounter();
}

function highlightSearchText(query) {
  clearSearchHighlights();
  if (!query || !query.trim()) return;

  // Search in the focused pane
  const appNode = getFocusedDiv();
  const walker = document.createTreeWalker(appNode, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  const lowerQuery = query.toLowerCase();

  nodes.forEach((textNode) => {
    if (textNode.parentNode && textNode.parentNode.closest && textNode.parentNode.closest('.inline-editor')) return;

    const text = textNode.nodeValue;
    const lowerText = text.toLowerCase();
    let index = lowerText.indexOf(lowerQuery);

    if (index >= 0) {
      const parent = textNode.parentNode;
      let currentText = text;
      let currentLower = lowerText;
      let lastNode = textNode;

      while (index >= 0) {
        const before = currentText.substring(0, index);
        const match = currentText.substring(index, index + lowerQuery.length);
        const after = currentText.substring(index + lowerQuery.length);

        const beforeNode = document.createTextNode(before);
        const matchSpan = document.createElement("span");
        matchSpan.className = "search-highlight";
        matchSpan.textContent = match;
        const afterNode = document.createTextNode(after);

        parent.insertBefore(beforeNode, lastNode);
        parent.insertBefore(matchSpan, lastNode);
        parent.insertBefore(afterNode, lastNode);
        parent.removeChild(lastNode);

        currentSearchMatches.push(matchSpan);

        lastNode = afterNode;
        currentText = after;
        currentLower = currentText.toLowerCase();
        index = currentLower.indexOf(lowerQuery);
      }
    }
  });

  if (currentSearchMatches.length > 0) {
    currentSearchIndex = 0;
    focusSearchMatch();
  }
  updateSearchCounter();
}

function focusSearchMatch() {
  currentSearchMatches.forEach(el => el.classList.remove("active"));
  if (currentSearchMatches.length > 0 && currentSearchIndex >= 0) {
    const match = currentSearchMatches[currentSearchIndex];
    match.classList.add("active");
    match.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  updateSearchCounter();
}

searchInput.addEventListener("input", (e) => {
  highlightSearchText(e.target.value);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (currentSearchMatches.length > 0) {
      if (e.shiftKey) {
        currentSearchIndex = (currentSearchIndex - 1 + currentSearchMatches.length) % currentSearchMatches.length;
      } else {
        currentSearchIndex = (currentSearchIndex + 1) % currentSearchMatches.length;
      }
      focusSearchMatch();
    }
  }
  if (e.key === "Escape") {
    searchInput.value = "";
    clearSearchHighlights();
    searchInput.blur();
  }
});

// --- Titlebar controls ---
document.getElementById("btn-close").addEventListener("click", () => {
  window.electronAPI.windowControl("close");
});
document.getElementById("btn-minimize").addEventListener("click", () => {
  window.electronAPI.windowControl("minimize");
});
document.getElementById("btn-maximize").addEventListener("click", () => {
  window.electronAPI.windowControl("maximize");
});

// --- Word/Character Counter (3.5) ---
const statusWords = document.getElementById("status-words");
const statusChars = document.getElementById("status-chars");

function updateWordCount(markdown) {
  const plainText = markdown
    .replace(/^#{1,6}\s/gm, '')
    .replace(/[*_~`>#\-|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  const chars = plainText.length;
  const words = plainText ? plainText.split(/\s+/).filter(w => w.length > 0).length : 0;
  statusWords.textContent = `${words} Words`;
  statusChars.textContent = `${chars} Characters`;
}

// --- Welcome Page Content (3.11) ---
const welcomeMarkdown = `# Welcome to refor.md

Your minimalist Markdown editor.

## Getting Started

- **Open file**: Ctrl+O or drag & drop
- **New file**: Ctrl+N
- **Save**: Ctrl+S
- **Edit**: Ctrl+E for block editor, Ctrl+Shift+E for raw editor

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Save | Ctrl+S |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y |
| Search | Ctrl+F |
| Bold | Ctrl+B |
| Italic | Ctrl+I |
| Link | Ctrl+L |
| Zoom +/- | Ctrl+Plus / Ctrl+Minus |
| Print | Ctrl+P |

## Features

- Syntax highlighting for code blocks
- Table of contents in the sidebar
- Comments with HTML comment syntax
- Auto-save every 30 seconds
- PDF & HTML export via the menu
- Formatting toolbar in edit mode
`;

// --- Setup State with Block-Level Diffing (1.4) ---
// The render callback targets the focused pane's content div.
const state = createState(
  welcomeMarkdown,
  (html, rawMarkdown, options = {}) => {
    // Always update word count, even when skipping DOM
    updateWordCount(rawMarkdown);

    // When raw mode is active on focused pane, skip DOM updates
    if (options.skipLeftDom) return;

    // Render into the focused pane's div
    const targetDiv = getFocusedDiv();
    const editorContent = targetDiv.querySelector('.editor-content');

    // First render — no existing content
    if (!editorContent) {
      targetDiv.innerHTML = `<div class="editor-content">${html}</div>`;
      if (window.lucide) window.lucide.createIcons(targetDiv);
      if (searchInput && searchInput.value) {
        highlightSearchText(searchInput.value);
      }
      return;
    }

    // If an inline editor is still in the DOM (e.g. tab switch), remove it
    const staleWrapper = editorContent.querySelector('.inline-editor-wrapper');
    if (staleWrapper) {
      staleWrapper.remove();
    }

    // Save scroll position
    const scrollTop = targetDiv.scrollTop;

    // Block-level diffing: parse new HTML and compare per-block
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const oldChildren = Array.from(editorContent.children);
    const newChildren = Array.from(temp.children);

    let needsIconRefresh = false;

    if (oldChildren.length !== newChildren.length) {
      editorContent.innerHTML = html;
      needsIconRefresh = true;
    } else {
      for (let i = 0; i < newChildren.length; i++) {
        if (oldChildren[i].outerHTML !== newChildren[i].outerHTML) {
          editorContent.replaceChild(newChildren[i], oldChildren[i]);
          needsIconRefresh = true;
        }
      }
    }

    // Restore scroll position
    targetDiv.scrollTop = scrollTop;

    if (needsIconRefresh && window.lucide) {
      window.lucide.createIcons(targetDiv);
    }

    if (searchInput && searchInput.value) {
      highlightSearchText(searchInput.value);
    }
  },
);

// --- Dirty State indicator in title bar (2.1) ---
const titleEl = document.querySelector(".title");
state.onDirtyChange = (isDirty) => {
  const currentText = titleEl.textContent;
  if (isDirty && !currentText.startsWith("● ")) {
    titleEl.textContent = "● " + currentText;
  } else if (!isDirty && currentText.startsWith("● ")) {
    titleEl.textContent = currentText.substring(2);
  }
  // Update tab bar dirty indicators
  if (window._splitView) {
    window._splitView.renderLeftTabs();
    if (window._splitView.isOpen) window._splitView.renderRightTabs();
  }
};

// --- Show Commits Toggle ---
const btnShowCommits = document.getElementById("btn-show-commits");
btnShowCommits.addEventListener("click", () => {
  state.showCommits = !state.showCommits;
  btnShowCommits.classList.toggle("active", state.showCommits);
});

// --- Setup Editor Interactions (both panes) ---
initEditor(appDiv, state);
initEditor(appRight, state);
initComments(appDiv, state);
initComments(appRight, state);
initDragAndDrop(appDiv, state);
const fileManager = initFileManagement(state, { signal: globalSignal });

// Setup Sidebar Logic
initSidebar(state, fileManager);

// Setup Formatting Toolbar (3.4)
initFormatToolbar();

// --- Tab Manager (3.6) ---
const tabManager = new TabManager({
  stateManager: state,
  fileManager,
  appDiv,
  onTabChange: (tab) => {
    titleEl.textContent = tab.filePath
      ? `refor.md - ${basename(tab.filePath)}`
      : `refor.md - ${tab.title}`;
  },
});
window._tabManager = tabManager;

// Sync tab state when files are opened/saved
fileManager.onFileChange(() => {
  tabManager.updateActiveTab();
  if (window._splitView) window._splitView.refresh();
});

// --- Split View (equal panes) ---
const splitView = new SplitView({
  tabManager,
  appDiv,
});
window._splitView = splitView;

// --- Raw View Mode (replaces old power-editor) ---
const rawViewMode = new RawViewMode({
  stateManager: state,
  tabManager,
  splitView,
});
window._rawViewMode = rawViewMode;

// Hook: when focused pane changes, update raw mode state
splitView.onFocusChange = (newPane) => {
  rawViewMode.onFocusChange(newPane);
};

// Update onTabChange to also refresh split view and sync raw mode (persist RAW across tabs)
const origOnTabChange = tabManager.onTabChange;
tabManager.onTabChange = (tab) => {
  origOnTabChange(tab);
  rawViewMode.onTabSwitch(); // Updates textarea content instead of closing RAW mode
  if (splitView) splitView.refresh();
};

// Refresh unfocused pane + raw textareas when state changes
const origRenderCallback = state.renderCallback;
state.renderCallback = (html, rawMarkdown, options = {}) => {
  origRenderCallback(html, rawMarkdown, options);

  // Sync unfocused pane if it shows the same tab
  if (splitView.isOpen) {
    splitView.renderUnfocusedPane();
  }
  rawViewMode.syncRightTextarea();
};

// --- Emoji Picker ---
initEmojiPicker();

// --- Open file passed via command line on startup (e.g. double-click on .md file) ---
(async () => {
  const initialFile = await window.electronAPI.getInitialFile();
  if (initialFile) {
    const content = await window.electronAPI.readFile(initialFile);
    if (content !== null && tabManager) {
      tabManager.openInTab(initialFile, content);
      titleEl.textContent = `refor.md - ${basename(initialFile)}`;
      await window.electronAPI.addRecentFile({ path: initialFile, name: basename(initialFile) });
      window.dispatchEvent(new CustomEvent('recent-files-updated'));
    }
  }
})();

// --- Zoom / Font Size (3.9) ---
const statusZoom = document.getElementById("status-zoom");
let zoomLevel = 100;

const initZoom = async () => {
  const savedZoom = await window.electronAPI.storeGet('zoomLevel');
  if (savedZoom && typeof savedZoom === 'number') {
    zoomLevel = savedZoom;
    applyZoom();
  }
};

const applyZoom = () => {
  document.documentElement.style.setProperty('--zoom', zoomLevel / 100);
  statusZoom.textContent = `${zoomLevel}%`;
};

const changeZoom = async (delta) => {
  zoomLevel = Math.max(50, Math.min(200, zoomLevel + delta));
  applyZoom();
  await window.electronAPI.storeSet('zoomLevel', zoomLevel);
};

const resetZoom = async () => {
  zoomLevel = 100;
  applyZoom();
  await window.electronAPI.storeSet('zoomLevel', zoomLevel);
};

// Click on zoom status to reset
statusZoom.addEventListener("click", resetZoom);

initZoom();

// --- Link Following (3.12) — both panes ---
const handleLinkClick = (e) => {
  const link = e.target.closest("a[href]");
  if (!link) return;

  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    e.stopPropagation();
    const href = link.getAttribute("href");
    if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
      window.electronAPI.openExternal(href);
    } else {
      showToast("Only HTTP/HTTPS links can be opened externally.", "error");
    }
  }
};
appDiv.addEventListener("click", handleLinkClick);
appRight.addEventListener("click", handleLinkClick);

// --- Close Confirmation for unsaved changes (2.1 + 3.6) ---
window.electronAPI.onRequestClose(() => {
  const hasUnsaved = tabManager ? tabManager.hasUnsavedTabs() : state.dirty;
  if (hasUnsaved) {
    const shouldClose = confirm("There are unsaved changes. Close anyway?");
    if (!shouldClose) return;
  }
  window.electronAPI.confirmClose();
});

// --- Global Keyboard Shortcuts (with cleanup signal 1.11) ---
window.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;

  // Undo: Strg+Z (3.1) — also works in raw view mode
  if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
    const inRawTextarea = e.target.id === 'raw-left-textarea';
    if (inRawTextarea || !e.target.closest('textarea, input')) {
      e.preventDefault();
      state.undo();
      rawViewMode.syncLeftTextarea();
    }
  }

  // Redo: Strg+Shift+Z or Strg+Y (3.1)
  if (mod && e.shiftKey && e.key.toLowerCase() === "z") {
    const inRawTextarea = e.target.id === 'raw-left-textarea';
    if (inRawTextarea || !e.target.closest('textarea, input')) {
      e.preventDefault();
      state.redo();
      rawViewMode.syncLeftTextarea();
    }
  }
  if (mod && e.key.toLowerCase() === "y") {
    const inRawTextarea = e.target.id === 'raw-left-textarea';
    if (inRawTextarea || !e.target.closest('textarea, input')) {
      e.preventDefault();
      state.redo();
      rawViewMode.syncLeftTextarea();
    }
  }

  // Edit mode: Strg+E
  if (mod && !e.shiftKey && e.key.toLowerCase() === "e") {
    e.preventDefault();
    toggleEditMode();
  }

  // Raw View Mode: Strg+Shift+E
  if (mod && e.shiftKey && e.key.toLowerCase() === "e") {
    e.preventDefault();
    rawViewMode.toggleLeft();
  }

  // Comment mode: Strg+K
  if (mod && e.key.toLowerCase() === "k") {
    e.preventDefault();
    toggleCommentMode();
  }

  // Search focus: Strg+F
  if (mod && e.key.toLowerCase() === "f") {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }

  // New file: Strg+N
  if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    document.getElementById("btn-new-file").click();
  }

  // New tab: Strg+T (3.6)
  if (mod && e.key.toLowerCase() === "t") {
    e.preventDefault();
    if (tabManager) tabManager.createTab();
  }

  // Close tab: Strg+W (3.6)
  if (mod && e.key.toLowerCase() === "w") {
    e.preventDefault();
    if (tabManager && tabManager.activeTabId) {
      tabManager.closeTab(tabManager.activeTabId);
    }
  }

  // Print: Strg+P (3.13)
  if (mod && e.key.toLowerCase() === "p") {
    e.preventDefault();
    window.electronAPI.printDocument();
  }

  // Zoom in: Strg++ or Strg+= (3.9)
  if (mod && (e.key === "+" || e.key === "=")) {
    e.preventDefault();
    changeZoom(10);
  }

  // Zoom out: Strg+- (3.9)
  if (mod && e.key === "-") {
    e.preventDefault();
    changeZoom(-10);
  }

  // Zoom reset: Strg+0 (3.9)
  if (mod && e.key === "0") {
    e.preventDefault();
    resetZoom();
  }
}, { signal: globalSignal });

// --- Route dropped .md files (updated for tabs 3.6) ---
window.addEventListener('open-dropped-file', async (e) => {
  const filePath = e.detail.path;
  const content = await window.electronAPI.readFile(filePath);
  if (content !== null) {
    if (tabManager) {
      tabManager.openInTab(filePath, content);
    } else {
      state.markClean(content);
      state.triggerRender();
      fileManager.forceCurrentFilePath(filePath);
    }
    titleEl.textContent = `refor.md - ${basename(filePath)}`;
    await window.electronAPI.addRecentFile({ path: filePath, name: basename(filePath) });
    window.dispatchEvent(new CustomEvent('recent-files-updated'));
  } else {
    showToast("Failed to load file.", "error");
  }
}, { signal: globalSignal });

window.addEventListener('add-favorite-dropped-file', async (e) => {
  const { path, name } = e.detail;
  await window.electronAPI.addFavorite({ path, name });
  window.dispatchEvent(new CustomEvent('recent-files-updated'));
}, { signal: globalSignal });
