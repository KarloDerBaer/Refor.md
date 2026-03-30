// Split-View — VS Code-style side-by-side editing with equal panes
// Both panes are fully equivalent: edit, comment, file operations.
// Exactly one pane is "focused" at any time; the StateManager always holds
// the focused tab's live state. The unfocused pane renders from snapshot.

import { parseMarkdown } from './markdown.js';
import { basename } from './utils.js';

export class SplitView {
  constructor({ tabManager, appDiv, onToggle }) {
    this.tabManager = tabManager;
    this.appDiv = appDiv; // #app (left pane content)
    this.onToggle = onToggle;

    this.isOpen = false;
    this.focusedPane = 'left'; // 'left' | 'right'

    // Each pane has its own list of tab IDs and an active tab ID
    this.leftTabIds = [];
    this.rightTabIds = [];
    this.leftActiveTabId = null;
    this.rightActiveTabId = null;

    // DOM elements
    this.editorGroupLeft = document.getElementById('editor-group-left');
    this.editorGroupRight = document.getElementById('editor-group-right');
    this.splitResizer = document.getElementById('split-resizer');
    this.appRight = document.getElementById('app-right');
    this.tabBarLeft = document.getElementById('tab-bar');
    this.tabBarRight = document.getElementById('tab-bar-right');
    this.breadcrumbLeft = document.getElementById('breadcrumb-left');
    this.breadcrumbRight = document.getElementById('breadcrumb-right');

    this.tabBarLeftActions = this.tabBarLeft
      ? this.tabBarLeft.querySelector('.tab-bar-actions')
      : null;
    this.tabBarRightActions = this.tabBarRight
      ? this.tabBarRight.querySelector('.tab-bar-actions')
      : null;

    // Hooks for RawViewMode integration
    this.onRenderRightPane = null;
    this.onRenderLeftPane = null;
    this.onSplitClose = null;
    this.onFocusChange = null;

    // Initialize left pane with the current active tab
    if (this.tabManager.activeTabId) {
      this.leftTabIds = [this.tabManager.activeTabId];
      this.leftActiveTabId = this.tabManager.activeTabId;
    }

    // Split buttons in both panes
    const btnSplitLeft = document.getElementById('btn-split-left');
    const btnSplitRight = document.getElementById('btn-split-right');
    // Also support old ID for backwards compat
    const btnSplitView = document.getElementById('btn-split-view');

    [btnSplitLeft, btnSplitView].forEach(btn => {
      if (btn) btn.addEventListener('click', () => this._handleSplitButton('left'));
    });
    if (btnSplitRight) {
      btnSplitRight.addEventListener('click', () => this._handleSplitButton('right'));
    }

    // Plus buttons for new tabs
    const btnNewTabRight = document.getElementById('btn-new-tab-right');
    if (btnNewTabRight) {
      btnNewTabRight.addEventListener('click', () => this.createTabInPane('right'));
    }

    // Focus: click on pane content switches focus
    if (this.appDiv) {
      this.appDiv.addEventListener('mousedown', () => {
        if (this.isOpen && this.focusedPane !== 'left') {
          this.setFocusedPane('left');
        }
      });
    }
    if (this.appRight) {
      this.appRight.addEventListener('mousedown', () => {
        if (this.isOpen && this.focusedPane !== 'right') {
          this.setFocusedPane('right');
        }
      });
    }

    // Resizer
    this._initResizer();

    // Initial render of left tabs
    this._updateFocusClasses();
    this._updateBreadcrumbs();
  }

  // --- Public API ---

  get splitPane() {
    return this.editorGroupRight;
  }

  /** Get the content div for the focused pane */
  get focusedDiv() {
    return this.focusedPane === 'left' ? this.appDiv : this.appRight;
  }

  /** Get the content div for the unfocused pane */
  get unfocusedDiv() {
    return this.focusedPane === 'left' ? this.appRight : this.appDiv;
  }

  /** Get the tab ID of the focused pane */
  get focusedTabId() {
    return this.focusedPane === 'left' ? this.leftActiveTabId : this.rightActiveTabId;
  }

  /** Get the tab ID of the unfocused pane */
  get unfocusedTabId() {
    return this.focusedPane === 'left' ? this.rightActiveTabId : this.leftActiveTabId;
  }

  setFocusedPane(side) {
    if (!this.isOpen && side === 'right') return;
    if (this.focusedPane === side) return;

    const oldFocusedTabId = this.focusedTabId;
    const newFocusedTabId = side === 'left' ? this.leftActiveTabId : this.rightActiveTabId;

    if (!newFocusedTabId) return;

    // Save snapshot of current focused tab
    this._saveTabSnapshot(oldFocusedTabId);

    // Transfer edit/comment mode classes
    const oldDiv = this.focusedDiv;
    const newDiv = side === 'left' ? this.appDiv : this.appRight;
    const hadEditMode = oldDiv.classList.contains('app-edit-mode');
    const hadCommentMode = oldDiv.classList.contains('app-comment-mode');
    oldDiv.classList.remove('app-edit-mode', 'app-comment-mode');
    if (hadEditMode) newDiv.classList.add('app-edit-mode');
    if (hadCommentMode) newDiv.classList.add('app-comment-mode');

    // Switch focus
    this.focusedPane = side;
    this.tabManager.activeTabId = newFocusedTabId;

    // Load the new focused tab's state
    const newTab = this.tabManager.tabs.find(t => t.id === newFocusedTabId);
    if (newTab && newTab.snapshot) {
      this.tabManager.stateManager.loadSnapshot(newTab.snapshot);
      this.tabManager.fileManager.forceCurrentFilePath(newTab.filePath);
    }

    // Render the now-unfocused pane from snapshot
    this._renderPaneFromSnapshot(this.focusedPane === 'left' ? 'right' : 'left');

    this._updateFocusClasses();
    this.renderLeftTabs();
    this.renderRightTabs();
    this._updateBreadcrumbs();

    // Notify focus change (for RawViewMode)
    if (this.onFocusChange) this.onFocusChange(side);

    // Notify tab change
    if (this.tabManager.onTabChange && newTab) {
      this.tabManager.onTabChange(newTab);
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    // If right pane has no tabs, clone the current active tab there
    if (this.rightTabIds.length === 0) {
      const activeId = this.leftActiveTabId || this.tabManager.activeTabId;
      this.rightTabIds = [activeId];
      this.rightActiveTabId = activeId;
    }

    // Show split view elements
    this.editorGroupRight.classList.remove('hidden');
    this.splitResizer.classList.remove('hidden');

    // Set both panes to 50%
    if (this.editorGroupLeft) this.editorGroupLeft.style.flex = '1';
    this.editorGroupRight.style.flex = '1';

    // Render the unfocused (right) pane from snapshot
    this._renderPaneFromSnapshot('right');
    this.renderLeftTabs();
    this.renderRightTabs();
    this._updateFocusClasses();
    this._updateBreadcrumbs();

    if (this.onToggle) this.onToggle(true);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    // If focus was on right, move it to left first
    if (this.focusedPane === 'right') {
      this._saveTabSnapshot(this.rightActiveTabId);
      this.focusedPane = 'left';

      // Load left active tab
      const leftTab = this.tabManager.tabs.find(t => t.id === this.leftActiveTabId);
      if (leftTab && leftTab.snapshot) {
        this.tabManager.activeTabId = this.leftActiveTabId;
        this.tabManager.stateManager.loadSnapshot(leftTab.snapshot);
        this.tabManager.fileManager.forceCurrentFilePath(leftTab.filePath);
      }
    }

    // Notify RawViewMode before closing
    if (this.onSplitClose) this.onSplitClose();

    this.editorGroupRight.classList.add('hidden');
    this.splitResizer.classList.add('hidden');

    if (this.editorGroupLeft) this.editorGroupLeft.style.flex = '';
    this.editorGroupRight.style.flex = '';

    // Clear right pane tab tracking
    this.rightTabIds = [];
    this.rightActiveTabId = null;

    this.renderLeftTabs();
    this._updateFocusClasses();
    this._updateBreadcrumbs();

    if (this.onToggle) this.onToggle(false);
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Called when tabs change externally (opened, closed, switched) */
  refresh() {
    // Sync left pane tabs with tabManager (when not in split, left tracks all)
    this._syncLeftTabsFromManager();

    if (!this.isOpen) {
      this.renderLeftTabs();
      this._updateBreadcrumbs();
      return;
    }

    // Clean up right tabs that no longer exist
    this.rightTabIds = this.rightTabIds.filter(id =>
      this.tabManager.tabs.some(t => t.id === id)
    );
    if (this.rightActiveTabId && !this.rightTabIds.includes(this.rightActiveTabId)) {
      this.rightActiveTabId = this.rightTabIds[0] || null;
    }

    this.renderLeftTabs();
    this.renderRightTabs();
    this._renderPaneFromSnapshot(this.focusedPane === 'left' ? 'right' : 'left');
    this._updateBreadcrumbs();
  }

  /** Ensure a tab is present in left pane (called from TabManager) */
  ensureTabInPane(tabId, pane = 'left') {
    if (pane === 'left') {
      if (!this.leftTabIds.includes(tabId)) {
        this.leftTabIds.push(tabId);
      }
      this.leftActiveTabId = tabId;
    } else {
      if (!this.rightTabIds.includes(tabId)) {
        this.rightTabIds.push(tabId);
      }
      this.rightActiveTabId = tabId;
    }
  }

  /** Create a new tab and add it to a specific pane */
  createTabInPane(pane) {
    const wasPane = this.focusedPane;

    // If creating in the focused pane, just create normally
    if (pane === this.focusedPane || !this.isOpen) {
      this.tabManager.createTab();
      return;
    }

    // Creating in the unfocused pane: switch focus, create, render
    this.setFocusedPane(pane);
    this.tabManager.createTab();
  }

  /** Remove a tab from a specific pane (doesn't close the tab, just removes from pane) */
  removeTabFromPane(tabId, pane) {
    if (pane === 'left') {
      this.leftTabIds = this.leftTabIds.filter(id => id !== tabId);
      if (this.leftActiveTabId === tabId) {
        this.leftActiveTabId = this.leftTabIds[0] || null;
      }
    } else {
      this.rightTabIds = this.rightTabIds.filter(id => id !== tabId);
      if (this.rightActiveTabId === tabId) {
        this.rightActiveTabId = this.rightTabIds[0] || null;
      }
    }
  }

  /** Move a tab from one pane to the other (drag & drop) */
  moveTabToPane(tabId, targetPane) {
    const sourcePane = this.leftTabIds.includes(tabId) ? 'left' : 'right';
    if (sourcePane === targetPane) return;

    // Add to target pane
    if (targetPane === 'left') {
      if (!this.leftTabIds.includes(tabId)) this.leftTabIds.push(tabId);
      this.leftActiveTabId = tabId;
    } else {
      if (!this.rightTabIds.includes(tabId)) this.rightTabIds.push(tabId);
      this.rightActiveTabId = tabId;
    }

    // Remove from source pane (only if it has other tabs)
    if (sourcePane === 'left' && this.leftTabIds.length > 1) {
      this.leftTabIds = this.leftTabIds.filter(id => id !== tabId);
      if (this.leftActiveTabId === tabId) {
        this.leftActiveTabId = this.leftTabIds[0] || null;
      }
    } else if (sourcePane === 'right' && this.rightTabIds.length > 1) {
      this.rightTabIds = this.rightTabIds.filter(id => id !== tabId);
      if (this.rightActiveTabId === tabId) {
        this.rightActiveTabId = this.rightTabIds[0] || null;
      }
    }

    // Switch focus to the target pane
    this.setFocusedPane(targetPane);
    this.renderLeftTabs();
    this.renderRightTabs();
    this._renderPaneFromSnapshot(targetPane === 'left' ? 'right' : 'left');
    this._updateBreadcrumbs();
  }

  // --- Left Tabs Rendering ---

  renderLeftTabs() {
    if (!this.tabBarLeft) return;

    const existingTabs = this.tabBarLeft.querySelectorAll('.tab');
    existingTabs.forEach(t => t.remove());

    const tabIds = this.leftTabIds.length > 0
      ? this.leftTabIds
      : this.tabManager.tabs.map(t => t.id);

    tabIds.forEach(tabId => {
      const tab = this.tabManager.tabs.find(t => t.id === tabId);
      if (!tab) return;

      const tabEl = this._createTabElement(tab, 'left');
      this.tabBarLeft.insertBefore(tabEl, this.tabBarLeftActions);
    });
  }

  // --- Right Tabs Rendering ---

  renderRightTabs() {
    if (!this.tabBarRight) return;

    const existingTabs = this.tabBarRight.querySelectorAll('.tab');
    existingTabs.forEach(t => t.remove());

    this.rightTabIds.forEach(tabId => {
      const tab = this.tabManager.tabs.find(t => t.id === tabId);
      if (!tab) return;

      const tabEl = this._createTabElement(tab, 'right');
      this.tabBarRight.insertBefore(tabEl, this.tabBarRightActions);
    });
  }

  // --- Internal Helpers ---

  _createTabElement(tab, pane) {
    const isActive = pane === 'left'
      ? tab.id === this.leftActiveTabId
      : tab.id === this.rightActiveTabId;

    const tabEl = document.createElement('div');
    tabEl.className = `tab${isActive ? ' active' : ''}`;
    tabEl.dataset.tabId = tab.id;
    tabEl.dataset.pane = pane;
    tabEl.draggable = true;

    // Dirty indicator
    const isDirty = tab.id === this.tabManager.activeTabId
      ? this.tabManager.stateManager.dirty
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
      this._closeTabInPane(tab.id, pane);
    });
    tabEl.appendChild(closeBtn);

    // Click to switch tab AND focus pane
    tabEl.addEventListener('click', () => {
      this._switchTabInPane(tab.id, pane);
    });

    // Middle-click to split to other pane
    tabEl.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        this.splitTabToOtherPane(tab.id, pane);
      }
    });

    // Drag & Drop
    tabEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        tabId: tab.id,
        sourcePane: pane
      }));
      e.dataTransfer.effectAllowed = 'move';
      tabEl.classList.add('dragging');
    });

    tabEl.addEventListener('dragend', () => {
      tabEl.classList.remove('dragging');
    });

    return tabEl;
  }

  /** Public: switch to a specific tab in a specific pane */
  switchTabInPane(pane, tabId) {
    this._switchTabInPane(tabId, pane);
  }

  _switchTabInPane(tabId, pane) {
    const activeTabId = pane === 'left' ? this.leftActiveTabId : this.rightActiveTabId;

    // First focus the pane
    if (this.isOpen && this.focusedPane !== pane) {
      this.setFocusedPane(pane);
    }

    // Then switch tab within the pane if needed
    if (tabId !== activeTabId) {
      // Save current focused tab
      this._saveTabSnapshot(this.focusedTabId);

      if (pane === 'left') this.leftActiveTabId = tabId;
      else this.rightActiveTabId = tabId;

      this.tabManager.activeTabId = tabId;

      const tab = this.tabManager.tabs.find(t => t.id === tabId);
      if (tab && tab.snapshot) {
        this.tabManager.stateManager.loadSnapshot(tab.snapshot);
        this.tabManager.fileManager.forceCurrentFilePath(tab.filePath);
      }

      this.renderLeftTabs();
      if (this.isOpen) this.renderRightTabs();
      this._updateBreadcrumbs();

      if (this.tabManager.onTabChange && tab) {
        this.tabManager.onTabChange(tab);
      }
    }
  }

  _closeTabInPane(tabId, pane) {
    // Remove from this pane's tab list
    if (pane === 'left') {
      this.leftTabIds = this.leftTabIds.filter(id => id !== tabId);
    } else {
      this.rightTabIds = this.rightTabIds.filter(id => id !== tabId);
    }

    // Check if the tab exists in the other pane
    const otherPaneIds = pane === 'left' ? this.rightTabIds : this.leftTabIds;
    const existsInOtherPane = otherPaneIds.includes(tabId);

    if (!existsInOtherPane) {
      // Actually close the tab
      this.tabManager.closeTab(tabId);
    }

    // Update active tab for this pane
    if (pane === 'left') {
      if (this.leftActiveTabId === tabId) {
        this.leftActiveTabId = this.leftTabIds[0] || null;
        if (this.focusedPane === 'left' && this.leftActiveTabId) {
          this._switchTabInPane(this.leftActiveTabId, 'left');
        }
      }
    } else {
      if (this.rightActiveTabId === tabId) {
        this.rightActiveTabId = this.rightTabIds[0] || null;
        if (this.focusedPane === 'right' && this.rightActiveTabId) {
          this._switchTabInPane(this.rightActiveTabId, 'right');
        }
      }
    }

    // If a pane becomes empty, close split
    if (this.isOpen && (this.leftTabIds.length === 0 || this.rightTabIds.length === 0)) {
      this.close();
      return;
    }

    this.renderLeftTabs();
    if (this.isOpen) this.renderRightTabs();
    this._updateBreadcrumbs();
  }

  _handleSplitButton(fromPane) {
    if (!this.isOpen) {
      // Open split, show same document in both
      const activeTabId = this.tabManager.activeTabId;
      this._saveTabSnapshot(activeTabId);
      this.rightTabIds = [activeTabId];
      this.rightActiveTabId = activeTabId;
      this.open();
      return;
    }

    // Already split
    const currentTabId = fromPane === 'left' ? this.leftActiveTabId : this.rightActiveTabId;
    const otherPane = fromPane === 'left' ? 'right' : 'left';
    const otherTabIds = otherPane === 'left' ? this.leftTabIds : this.rightTabIds;
    const otherActiveTabId = otherPane === 'left' ? this.leftActiveTabId : this.rightActiveTabId;

    if (otherTabIds.includes(currentTabId)) {
      // Document already in both panes → switch focus to other pane
      if (otherActiveTabId !== currentTabId) {
        // Activate the same tab in the other pane first
        if (otherPane === 'left') this.leftActiveTabId = currentTabId;
        else this.rightActiveTabId = currentTabId;
      }
      this.setFocusedPane(otherPane);
    } else {
      // Document only in this pane → open in other pane and focus it
      this._saveTabSnapshot(currentTabId);
      if (otherPane === 'left') {
        this.leftTabIds.push(currentTabId);
        this.leftActiveTabId = currentTabId;
      } else {
        this.rightTabIds.push(currentTabId);
        this.rightActiveTabId = currentTabId;
      }
      this.setFocusedPane(otherPane);
    }
  }

  /** Split a specific tab to the other pane (used by middle-click on tab) */
  splitTabToOtherPane(tabId, fromPane) {
    if (!this.isOpen) {
      // Open split, show the clicked tab in the right pane
      this._saveTabSnapshot(tabId);
      this.rightTabIds = [tabId];
      this.rightActiveTabId = tabId;
      this.open();
      return;
    }

    // Already split — add to other pane
    const otherPane = fromPane === 'left' ? 'right' : 'left';
    const otherTabIds = otherPane === 'left' ? this.leftTabIds : this.rightTabIds;

    if (otherTabIds.includes(tabId)) {
      // Already in both panes, just activate it in the other pane and focus
      if (otherPane === 'left') this.leftActiveTabId = tabId;
      else this.rightActiveTabId = tabId;
      this.setFocusedPane(otherPane);
    } else {
      // Add to other pane
      this._saveTabSnapshot(tabId);
      if (otherPane === 'left') {
        this.leftTabIds.push(tabId);
        this.leftActiveTabId = tabId;
      } else {
        this.rightTabIds.push(tabId);
        this.rightActiveTabId = tabId;
      }
      this.setFocusedPane(otherPane);
    }
  }

  _saveTabSnapshot(tabId) {
    if (!tabId) return;
    const tab = this.tabManager.tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Only save snapshot if this is the currently active (focused) tab
    if (tabId === this.tabManager.activeTabId) {
      tab.snapshot = this.tabManager.stateManager.saveSnapshot();
      tab.scrollTop = this.focusedDiv ? this.focusedDiv.scrollTop : 0;
      tab.filePath = this.tabManager.fileManager.getCurrentFilePath();
      tab.title = tab.filePath ? basename(tab.filePath) : 'Unsaved';
    }
  }

  _renderPaneFromSnapshot(pane) {
    const targetDiv = pane === 'left' ? this.appDiv : this.appRight;
    const tabId = pane === 'left' ? this.leftActiveTabId : this.rightActiveTabId;

    if (!targetDiv || !tabId) return;

    // Check if RawViewMode wants to handle it
    if (pane === 'right' && this.onRenderRightPane && this.onRenderRightPane()) return;
    if (pane === 'left' && this.onRenderLeftPane && this.onRenderLeftPane()) return;

    const tab = this.tabManager.tabs.find(t => t.id === tabId);
    if (!tab) {
      targetDiv.innerHTML = '<div class="editor-content"><p style="color: var(--ui-text-color)">No tab selected</p></div>';
      return;
    }

    let rawMarkdown;
    if (tab.id === this.tabManager.activeTabId) {
      rawMarkdown = this.tabManager.stateManager.rawMarkdown;
    } else if (tab.snapshot) {
      rawMarkdown = tab.snapshot.rawMarkdown;
    } else {
      rawMarkdown = '';
    }

    const result = parseMarkdown(rawMarkdown, false);
    targetDiv.innerHTML = `<div class="editor-content">${result.html}</div>`;

    if (window.lucide) window.lucide.createIcons(targetDiv);
  }

  /** Render the unfocused pane (called from render callback) */
  renderUnfocusedPane() {
    if (!this.isOpen) return;
    const unfocusedSide = this.focusedPane === 'left' ? 'right' : 'left';
    const unfocusedTabId = this.focusedPane === 'left' ? this.rightActiveTabId : this.leftActiveTabId;

    // Only re-render if the unfocused pane shows the same tab as the focused one
    if (unfocusedTabId === this.tabManager.activeTabId) {
      this._renderPaneFromSnapshot(unfocusedSide);
    }
  }

  _syncLeftTabsFromManager() {
    const allIds = this.tabManager.tabs.map(t => t.id);

    if (!this.isOpen) {
      // When split is closed, left pane tracks ALL tabs (single-pane mode)
      allIds.forEach(id => {
        if (!this.leftTabIds.includes(id)) {
          this.leftTabIds.push(id);
        }
      });
    }

    // Always remove closed tabs from both panes
    this.leftTabIds = this.leftTabIds.filter(id => allIds.includes(id));

    // Update active
    if (this.focusedPane === 'left') {
      this.leftActiveTabId = this.tabManager.activeTabId;
    }
    if (!this.leftTabIds.includes(this.leftActiveTabId)) {
      this.leftActiveTabId = this.leftTabIds[0] || null;
    }
  }

  _updateFocusClasses() {
    // Tab bar focus indication
    if (this.tabBarLeft) {
      this.tabBarLeft.classList.toggle('pane-focused',
        this.focusedPane === 'left' || !this.isOpen);
    }
    if (this.tabBarRight) {
      this.tabBarRight.classList.toggle('pane-focused',
        this.focusedPane === 'right' && this.isOpen);
    }
  }

  _updateBreadcrumbs() {
    const leftTab = this.tabManager.tabs.find(t => t.id === this.leftActiveTabId);
    const rightTab = this.tabManager.tabs.find(t => t.id === this.rightActiveTabId);

    if (this.breadcrumbLeft) {
      this.breadcrumbLeft.textContent = leftTab && leftTab.filePath
        ? leftTab.filePath
        : (leftTab ? leftTab.title : '');
    }
    if (this.breadcrumbRight) {
      this.breadcrumbRight.textContent = rightTab && rightTab.filePath
        ? rightTab.filePath
        : (rightTab ? rightTab.title : '');
    }
  }

  // --- Resizer ---

  _initResizer() {
    if (!this.splitResizer) return;

    let isDragging = false;

    this.splitResizer.addEventListener('mousedown', (e) => {
      if (!this.isOpen) return;
      isDragging = true;
      this.splitResizer.classList.add('is-resizing');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const layout = this.appDiv.closest('.app-layout');
      if (!layout) return;
      const rect = layout.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const clampedRatio = Math.max(0.25, Math.min(0.75, ratio));

      if (this.editorGroupLeft) this.editorGroupLeft.style.flex = `${clampedRatio}`;
      if (this.editorGroupRight) this.editorGroupRight.style.flex = `${1 - clampedRatio}`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.splitResizer.classList.remove('is-resizing');
        document.body.style.cursor = '';
      }
    });

    // Drop zone on tab bars
    this._initDropZones();
  }

  _initDropZones() {
    [this.tabBarLeft, this.tabBarRight].forEach((tabBar, idx) => {
      if (!tabBar) return;
      const pane = idx === 0 ? 'left' : 'right';

      tabBar.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        tabBar.classList.add('drag-over');
      });

      tabBar.addEventListener('dragleave', () => {
        tabBar.classList.remove('drag-over');
      });

      tabBar.addEventListener('drop', (e) => {
        e.preventDefault();
        tabBar.classList.remove('drag-over');

        try {
          const data = JSON.parse(e.dataTransfer.getData('text/plain'));
          if (data.tabId && data.sourcePane) {
            if (!this.isOpen) {
              // If not split, open split and move tab to target
              this.open();
            }
            this.moveTabToPane(data.tabId, pane);
          }
        } catch (err) {
          // Not a tab drag
        }
      });
    });
  }
}
