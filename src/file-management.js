import { basename } from "./utils.js";

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export const initFileManagement = (stateManager, { signal } = {}) => {
  const btnMenuSave = document.getElementById("menu-save");
  const btnNewFile = document.getElementById("btn-new-file");
  const btnOpenFolder = document.getElementById("btn-open-folder");

  let currentFilePath = null;
  let autoSaveTimer = null;
  let onFileChangeCallback = null;

  const logRecentFile = async (filePath) => {
    const fileName = basename(filePath);
    await window.electronAPI.addRecentFile({ path: filePath, name: fileName });
    window.dispatchEvent(new CustomEvent('recent-files-updated'));
  };

  const openFile = async () => {
    try {
      const filePath = await window.electronAPI.showOpenDialog();
      if (filePath) {
        const content = await window.electronAPI.readFile(filePath);
        if (content !== null) {
          currentFilePath = filePath;
          stateManager.markClean(content);
          stateManager.triggerRender();
          document.querySelector(".title").textContent =
            `refor.md - ${basename(filePath)}`;
          await logRecentFile(filePath);
          startAutoSave();
          if (onFileChangeCallback) onFileChangeCallback();
        }
      }
    } catch (e) {
      console.error("Failed to open file", e);
    }
  };

  const saveFile = async () => {
    try {
      let targetPath = currentFilePath;

      if (!targetPath) {
        targetPath = await window.electronAPI.showSaveDialog();
      }

      if (targetPath) {
        const success = await window.electronAPI.writeFile(
          targetPath,
          stateManager.rawMarkdown,
        );
        if (success) {
          currentFilePath = targetPath;
          stateManager.markSaved();
          const filename = basename(currentFilePath);
          const titleEl = document.querySelector(".title");
          titleEl.textContent = `refor.md - ${filename} (Saved)`;
          setTimeout(() => {
            titleEl.textContent = `refor.md - ${filename}`;
          }, 2000);
          await logRecentFile(targetPath);
          startAutoSave();
          if (onFileChangeCallback) onFileChangeCallback();
        } else {
          window.showToast("Error saving file.", "error");
        }
      }
    } catch (e) {
      console.error("Failed to save file", e);
    }
  };

  // Auto-save: only saves if there's a file path and unsaved changes
  const autoSave = async () => {
    if (!currentFilePath || !stateManager.dirty) return;
    try {
      const success = await window.electronAPI.writeFile(
        currentFilePath,
        stateManager.rawMarkdown,
      );
      if (success) {
        stateManager.markSaved();
        window.showToast("Auto-saved");
      }
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
  };

  const startAutoSave = () => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    if (currentFilePath) {
      autoSaveTimer = setInterval(autoSave, AUTO_SAVE_INTERVAL);
    }
  };

  const newFile = () => {
    currentFilePath = null;
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    const defaultContent = "# New Document\n\nStart writing your Markdown text here...";
    stateManager.markClean(defaultContent);
    stateManager.triggerRender();
    document.querySelector(".title").textContent = `refor.md - unsaved`;
    window.dispatchEvent(new CustomEvent('recent-files-updated'));
    if (onFileChangeCallback) onFileChangeCallback();
  };

  // Button event listeners
  if (btnMenuSave) btnMenuSave.addEventListener("click", saveFile);
  if (btnNewFile) btnNewFile.addEventListener("click", newFile);
  if (btnOpenFolder) btnOpenFolder.addEventListener("click", openFile);

  // Global keyboard shortcuts (Ctrl+S / Cmd+S and Ctrl+O / Cmd+O) — with cleanup signal (1.11)
  const listenerOpts = signal ? { signal } : {};
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveFile();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
      e.preventDefault();
      openFile();
    }
  }, listenerOpts);

  return {
    openFile,
    saveFile,
    getCurrentFilePath: () => currentFilePath,
    forceCurrentFilePath: (path) => {
      currentFilePath = path;
      startAutoSave();
    },
    onFileChange: (cb) => { onFileChangeCallback = cb; },
  };
};
