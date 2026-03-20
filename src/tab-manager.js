// Tab Manager (3.6) — manages multiple open files as tabs
// Tab rendering is delegated to SplitView when available.
import { basename } from "./utils.js";

export class TabManager {
  constructor({ stateManager, fileManager, appDiv, onTabChange }) {
    this.stateManager = stateManager;
    this.fileManager = fileManager;
    this.appDiv = appDiv;
    this.onTabChange = onTabChange;

    this.tabs = [];
    this.activeTabId = null;
    this.nextId = 1;

    this.tabBar = document.getElementById('tab-bar');
    this.btnNewTab = document.getElementById('btn-new-tab');
    this.tabBarActions = this.tabBar ? this.tabBar.querySelector('.tab-bar-actions') : null;

    if (this.btnNewTab) {
      this.btnNewTab.addEventListener('click', () => this.createTab());
    }

    // Create initial tab from current state
    const initialTab = {
      id: this.nextId++,
      title: 'Welcome',
      filePath: null,
      snapshot: this.stateManager.saveSnapshot(),
      scrollTop: 0,
    };
    this.tabs.push(initialTab);
    this.activeTabId = initialTab.id;
    this.renderTabs();
  }

  createTab(title = 'New Document', filePath = null, markdown = null) {
    // Save current tab state
    this._saveCurrentTab();

    const defaultMarkdown = markdown || '# New Document\n\nStart writing your Markdown text here...';

    const tab = {
      id: this.nextId++,
      title,
      filePath,
      snapshot: null,
      scrollTop: 0,
    };
    this.tabs.push(tab);
    this.activeTabId = tab.id;

    // Load new state
    this.stateManager.markClean(defaultMarkdown);
    this.stateManager.triggerRender();
    this.fileManager.forceCurrentFilePath(filePath);

    // Save snapshot
    tab.snapshot = this.stateManager.saveSnapshot();

    // Ensure split view tracks this tab in the focused pane
    if (window._splitView) {
      window._splitView.ensureTabInPane(tab.id, window._splitView.focusedPane);
    }

    this.renderTabs();
    if (this.onTabChange) this.onTabChange(tab);
    return tab;
  }

  openInTab(filePath, content) {
    const existingTab = this.tabs.find(t => t.filePath === filePath);
    if (existingTab) {
      this.switchTab(existingTab.id);
      return existingTab;
    }

    // Replace the welcome tab if it's the active tab and has no file
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab && activeTab.filePath === null && activeTab.title === 'Welcome') {
      const name = basename(filePath);
      activeTab.title = name;
      activeTab.filePath = filePath;
      this.stateManager.markClean(content);
      this.stateManager.triggerRender();
      this.fileManager.forceCurrentFilePath(filePath);
      activeTab.snapshot = this.stateManager.saveSnapshot();
      this.renderTabs();
      if (this.onTabChange) this.onTabChange(activeTab);
      return activeTab;
    }

    const name = basename(filePath);
    return this.createTab(name, filePath, content);
  }

  switchTab(tabId) {
    if (tabId === this.activeTabId) return;

    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || !tab.snapshot) return;

    this._saveCurrentTab();
    this.activeTabId = tabId;

    this.stateManager.loadSnapshot(tab.snapshot);
    this.fileManager.forceCurrentFilePath(tab.filePath);

    const targetDiv = window._splitView ? window._splitView.focusedDiv : this.appDiv;
    requestAnimationFrame(() => {
      if (targetDiv) targetDiv.scrollTop = tab.scrollTop;
    });

    this.renderTabs();
    if (this.onTabChange) this.onTabChange(tab);
  }

  closeTab(tabId) {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    if (tabId === this.activeTabId) {
      this._saveCurrentTab();
    }

    const tab = this.tabs[idx];

    if (tab.snapshot && tab.snapshot.rawMarkdown !== tab.snapshot.savedMarkdown) {
      if (!confirm(`"${tab.title}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }

    this.tabs.splice(idx, 1);

    if (this.tabs.length === 0) {
      this.activeTabId = null;
      this.createTab();
      return;
    }

    if (tabId === this.activeTabId) {
      const newIdx = Math.min(idx, this.tabs.length - 1);
      this.activeTabId = null;
      this.switchTab(this.tabs[newIdx].id);
    } else {
      this.renderTabs();
    }
  }

  _saveCurrentTab() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;

    // Flush pending raw textarea changes before saving snapshot
    if (window._rawViewMode) window._rawViewMode.flushSync();

    tab.snapshot = this.stateManager.saveSnapshot();
    const targetDiv = window._splitView ? window._splitView.focusedDiv : this.appDiv;
    tab.scrollTop = targetDiv ? targetDiv.scrollTop : 0;
    tab.filePath = this.fileManager.getCurrentFilePath();
    tab.title = tab.filePath ? basename(tab.filePath) : 'Unsaved';
  }

  updateActiveTab() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (!tab) return;
    tab.filePath = this.fileManager.getCurrentFilePath();
    tab.title = tab.filePath ? basename(tab.filePath) : 'Unsaved';
    this.renderTabs();
  }

  hasUnsavedTabs() {
    this._saveCurrentTab();
    return this.tabs.some(t =>
      t.snapshot && t.snapshot.rawMarkdown !== t.snapshot.savedMarkdown
    );
  }

  get activeTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  }

  /** Render tabs — delegates to SplitView if available */
  renderTabs() {
    if (window._splitView) {
      window._splitView.renderLeftTabs();
      if (window._splitView.isOpen) {
        window._splitView.renderRightTabs();
      }
      window._splitView._updateBreadcrumbs();
      return;
    }

    // Fallback: direct render (before SplitView is initialized)
    if (!this.tabBar) return;

    const existingTabs = this.tabBar.querySelectorAll('.tab');
    existingTabs.forEach(t => t.remove());

    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab${tab.id === this.activeTabId ? ' active' : ''}`;
      tabEl.dataset.tabId = tab.id;

      const isDirty = tab.id === this.activeTabId
        ? this.stateManager.dirty
        : (tab.snapshot && tab.snapshot.rawMarkdown !== tab.snapshot.savedMarkdown);

      if (isDirty) {
        const dot = document.createElement('span');
        dot.className = 'tab-dirty';
        dot.textContent = '\u25CF';
        tabEl.appendChild(dot);
      }

      const titleSpan = document.createElement('span');
      titleSpan.className = 'tab-title';
      titleSpan.textContent = tab.title;
      titleSpan.title = tab.filePath || tab.title;
      tabEl.appendChild(titleSpan);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '\u00D7';
      closeBtn.title = 'Close tab';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });
      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => this.switchTab(tab.id));

      tabEl.addEventListener('mousedown', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.closeTab(tab.id);
        }
      });

      this.tabBar.insertBefore(tabEl, this.tabBarActions);
    });
  }
}
