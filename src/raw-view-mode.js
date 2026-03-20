// Raw View Mode — per-pane RAW/rendered toggle (replaces old power-editor.js)
// Both panes are fully equivalent: editable when focused, sync to StateManager.
// RAW mode persists across tab switches (textarea content is updated).

function debounce(fn, delay) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      fn();
    }
  };
  return debounced;
}

export class RawViewMode {
  constructor({ stateManager, tabManager, splitView }) {
    this.stateManager = stateManager;
    this.tabManager = tabManager;
    this.splitView = splitView;

    this.leftRawActive = false;
    this.rightRawActive = false;

    this.leftTextarea = null;
    this.rightTextarea = null;

    this._leftDebouncedSync = null;
    this._rightDebouncedSync = null;

    this.appDiv = document.getElementById('app');
    this.appRight = document.getElementById('app-right');

    // Track toolbar original position for restore
    this._toolbarOriginalParent = null;
    this._toolbarOriginalNext = null;

    this._initButtons();
    this._initSplitViewHooks();
  }

  // ─── Left Pane RAW Toggle ─────────────────────────────────

  toggleLeft() {
    this.leftRawActive = !this.leftRawActive;

    const btnRawLeft = document.getElementById('btn-raw-left');
    const btnPowerEditor = document.getElementById('btn-power-editor');

    if (this.leftRawActive) {
      this._showLeftRaw();
      if (btnRawLeft) btnRawLeft.classList.add('active');
      if (btnPowerEditor) btnPowerEditor.classList.add('active');
    } else {
      this._hideLeftRaw();
      if (btnRawLeft) btnRawLeft.classList.remove('active');
      if (btnPowerEditor) btnPowerEditor.classList.remove('active');
    }

    this._updateSkipDom();
  }

  _showLeftRaw() {
    // Hide rendered content
    const editorContent = this.appDiv.querySelector('.editor-content');
    if (editorContent) editorContent.style.display = 'none';

    // Enable flex layout so textarea fills the pane
    this.appDiv.classList.add('raw-mode-active');

    // Move format toolbar into this pane (under breadcrumb)
    this._moveToolbarToPane('left');

    // Create editable textarea
    this.leftTextarea = document.createElement('textarea');
    this.leftTextarea.id = 'raw-left-textarea';
    this.leftTextarea.className = 'raw-view-textarea';
    this.leftTextarea.value = this.stateManager.rawMarkdown;
    this.leftTextarea.spellcheck = false;

    // Debounced sync to state manager
    this._leftDebouncedSync = debounce(() => {
      if (this.leftTextarea) {
        this.stateManager.rawMarkdown = this.leftTextarea.value;
      }
    }, 300);
    this.leftTextarea.addEventListener('input', this._leftDebouncedSync);

    this.appDiv.appendChild(this.leftTextarea);
    this.leftTextarea.focus();
  }

  _hideLeftRaw() {
    // Flush pending changes
    if (this._leftDebouncedSync) this._leftDebouncedSync.flush();

    if (this.leftTextarea) {
      this.leftTextarea.remove();
      this.leftTextarea = null;
      this._leftDebouncedSync = null;
    }

    // Restore normal layout
    this.appDiv.classList.remove('raw-mode-active');

    // Restore toolbar to global position
    this._restoreToolbar();

    // Show rendered content again
    const editorContent = this.appDiv.querySelector('.editor-content');
    if (editorContent) {
      editorContent.style.display = '';
    }

    // Trigger re-render to show updated content
    this.stateManager.triggerRender();
  }

  /**
   * Sync left textarea content from external state changes
   * (e.g. undo/redo triggered from keyboard shortcuts)
   */
  syncLeftTextarea() {
    if (!this.leftRawActive || !this.leftTextarea) return;
    if (this.leftTextarea.value !== this.stateManager.rawMarkdown) {
      const pos = this.leftTextarea.selectionStart;
      this.leftTextarea.value = this.stateManager.rawMarkdown;
      this.leftTextarea.selectionStart = this.leftTextarea.selectionEnd = pos;
    }
  }

  // ─── Right Pane RAW Toggle ────────────────────────────────

  toggleRight() {
    this.rightRawActive = !this.rightRawActive;

    const btnRawRight = document.getElementById('btn-raw-right');

    if (this.rightRawActive) {
      this._showRightRaw();
      if (btnRawRight) btnRawRight.classList.add('active');
    } else {
      this._hideRightRaw();
      if (btnRawRight) btnRawRight.classList.remove('active');
    }

    this._updateSkipDom();
  }

  _showRightRaw() {
    if (!this.appRight) return;

    // Hide rendered content (don't clear innerHTML, just hide editor-content)
    const editorContent = this.appRight.querySelector('.editor-content');
    if (editorContent) editorContent.style.display = 'none';

    // Enable flex layout so textarea fills the pane
    this.appRight.classList.add('raw-mode-active');

    // Move format toolbar into this pane (under breadcrumb)
    this._moveToolbarToPane('right');

    // Create textarea (editable when this pane is focused)
    this.rightTextarea = document.createElement('textarea');
    this.rightTextarea.id = 'raw-right-textarea';
    this.rightTextarea.className = 'raw-view-textarea';
    this.rightTextarea.spellcheck = false;

    const isFocused = this.splitView && this.splitView.focusedPane === 'right';
    this.rightTextarea.readOnly = !isFocused;

    // Debounced sync to state manager (only when focused)
    this._rightDebouncedSync = debounce(() => {
      if (this.rightTextarea && !this.rightTextarea.readOnly) {
        this.stateManager.rawMarkdown = this.rightTextarea.value;
      }
    }, 300);
    this.rightTextarea.addEventListener('input', this._rightDebouncedSync);

    this._updateRightTextareaContent();
    this.appRight.appendChild(this.rightTextarea);

    if (isFocused) this.rightTextarea.focus();
  }

  _hideRightRaw() {
    // Flush pending changes
    if (this._rightDebouncedSync) this._rightDebouncedSync.flush();

    if (this.rightTextarea) {
      this.rightTextarea.remove();
      this.rightTextarea = null;
      this._rightDebouncedSync = null;
    }

    // Restore normal layout
    if (this.appRight) this.appRight.classList.remove('raw-mode-active');

    // Restore toolbar to global position
    this._restoreToolbar();

    // Show rendered content again
    const editorContent = this.appRight ? this.appRight.querySelector('.editor-content') : null;
    if (editorContent) {
      editorContent.style.display = '';
    }

    // Restore rendered view
    if (this.splitView && this.splitView.isOpen) {
      this.splitView._renderPaneFromSnapshot('right');
    }
  }

  _updateRightTextareaContent() {
    if (!this.rightTextarea || !this.splitView) return;

    const tab = this.tabManager.tabs.find(t => t.id === this.splitView.rightActiveTabId);
    if (!tab) return;

    let md;
    if (tab.id === this.tabManager.activeTabId) {
      md = this.stateManager.rawMarkdown;
    } else if (tab.snapshot) {
      md = tab.snapshot.rawMarkdown;
    } else {
      md = '';
    }
    this.rightTextarea.value = md;
  }

  /**
   * Sync right textarea when state changes (called from render callback wrapper).
   */
  syncRightTextarea() {
    if (!this.rightRawActive || !this.rightTextarea) return;
    this._updateRightTextareaContent();
  }

  // ─── Toolbar Management ────────────────────────────────────

  _moveToolbarToPane(pane) {
    const toolbar = document.getElementById('format-toolbar');
    if (!toolbar) return;

    // Save original position if not already saved
    if (!this._toolbarOriginalParent) {
      this._toolbarOriginalParent = toolbar.parentNode;
      this._toolbarOriginalNext = toolbar.nextSibling;
    }

    const editorGroupId = pane === 'left' ? 'editor-group-left' : 'editor-group-right';
    const breadcrumbId = pane === 'left' ? 'breadcrumb-left' : 'breadcrumb-right';
    const editorGroup = document.getElementById(editorGroupId);
    const breadcrumb = document.getElementById(breadcrumbId);

    if (editorGroup && breadcrumb) {
      toolbar.classList.remove('hidden', 'toolbar-inline');
      toolbar.classList.add('toolbar-raw');
      // Insert after breadcrumb
      breadcrumb.after(toolbar);
    }
  }

  _restoreToolbar() {
    const toolbar = document.getElementById('format-toolbar');
    if (!toolbar) return;

    toolbar.classList.remove('toolbar-raw');
    toolbar.classList.add('hidden');

    if (this._toolbarOriginalParent) {
      this._toolbarOriginalParent.insertBefore(toolbar, this._toolbarOriginalNext);
      this._toolbarOriginalParent = null;
      this._toolbarOriginalNext = null;
    }
  }

  // ─── Focus Change Handling ─────────────────────────────────

  /**
   * Called when the focused pane changes. Updates readOnly state
   * of textareas and the skipDom flag.
   */
  onFocusChange(newPane) {
    // Update right textarea readOnly state
    if (this.rightRawActive && this.rightTextarea) {
      this.rightTextarea.readOnly = (newPane !== 'right');
    }
    // Update left textarea readOnly state (always editable when focused)
    if (this.leftRawActive && this.leftTextarea) {
      this.leftTextarea.readOnly = (newPane !== 'left');
    }

    // Move toolbar to the focused pane's raw mode if applicable
    const focusedRaw = newPane === 'left' ? this.leftRawActive : this.rightRawActive;
    if (focusedRaw) {
      this._moveToolbarToPane(newPane);
    }

    this._updateSkipDom();
  }

  // ─── Tab Switch Handling ───────────────────────────────────

  /**
   * Flush any pending textarea changes to stateManager.
   * Call before saving a tab snapshot.
   */
  flushSync() {
    if (this.leftRawActive && this._leftDebouncedSync) {
      this._leftDebouncedSync.flush();
    }
    if (this.rightRawActive && this._rightDebouncedSync) {
      this._rightDebouncedSync.flush();
    }
  }

  /**
   * Called after switching tabs. Update textarea content
   * instead of closing RAW mode.
   */
  onTabSwitch() {
    if (this.leftRawActive && this.leftTextarea) {
      this.leftTextarea.value = this.stateManager.rawMarkdown;
    }
    if (this.rightRawActive && this.rightTextarea) {
      this._updateRightTextareaContent();
    }
  }

  // ─── Skip DOM Flag ─────────────────────────────────────────

  /**
   * Update stateManager.leftRawMode based on whether the focused
   * pane is in RAW mode. This flag tells the render callback
   * to skip DOM updates on the focused pane.
   */
  _updateSkipDom() {
    const focusedPane = this.splitView ? this.splitView.focusedPane : 'left';
    const isActive = focusedPane === 'left' ? this.leftRawActive : this.rightRawActive;
    this.stateManager.leftRawMode = isActive;
  }

  // ─── Button & Hook Setup ──────────────────────────────────

  _initButtons() {
    const btnRawLeft = document.getElementById('btn-raw-left');
    if (btnRawLeft) {
      btnRawLeft.addEventListener('click', () => this.toggleLeft());
    }

    const btnRawRight = document.getElementById('btn-raw-right');
    if (btnRawRight) {
      btnRawRight.addEventListener('click', () => this.toggleRight());
    }

    // Titlebar RAW button also toggles focused pane's raw mode
    const btnPowerEditor = document.getElementById('btn-power-editor');
    if (btnPowerEditor) {
      // Remove old click handler by cloning
      const newBtn = btnPowerEditor.cloneNode(true);
      btnPowerEditor.replaceWith(newBtn);
      newBtn.addEventListener('click', () => {
        const focusedPane = this.splitView ? this.splitView.focusedPane : 'left';
        if (focusedPane === 'right') {
          this.toggleRight();
        } else {
          this.toggleLeft();
        }
      });
    }
  }

  _initSplitViewHooks() {
    if (!this.splitView) return;

    // Hook: when split-view renders right pane, check if raw mode is active
    this.splitView.onRenderRightPane = () => {
      if (this.rightRawActive) {
        this._updateRightTextareaContent();
        return true; // signal that we handled it
      }
      return false;
    };

    // Hook: when split-view closes, deactivate right raw mode
    this.splitView.onSplitClose = () => {
      if (this.rightRawActive) {
        if (this._rightDebouncedSync) this._rightDebouncedSync.flush();
        this.rightRawActive = false;
        if (this.rightTextarea) {
          this.rightTextarea.remove();
          this.rightTextarea = null;
          this._rightDebouncedSync = null;
        }
        if (this.appRight) this.appRight.classList.remove('raw-mode-active');
        const btnRawRight = document.getElementById('btn-raw-right');
        if (btnRawRight) btnRawRight.classList.remove('active');
        // Restore toolbar if it was in the right pane
        const toolbar = document.getElementById('format-toolbar');
        if (toolbar && toolbar.classList.contains('toolbar-raw')) {
          this._restoreToolbar();
          // If left pane is in raw mode, move toolbar there
          if (this.leftRawActive) {
            this._moveToolbarToPane('left');
          }
        }
      }
      this._updateSkipDom();
    };
  }
}
