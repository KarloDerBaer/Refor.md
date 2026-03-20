// 2.5 Block Editor with improved UX
// - Save/Cancel action buttons below textarea
// - Escape to cancel, Ctrl+Enter to save
// - Click outside to save
// - Visual highlight with blue border when editing
// - Auto-resize textarea

export const initEditor = (appContainer, stateManager) => {
  let activeEditingBlockId = null;

  appContainer.addEventListener("click", (e) => {
    // Only allow edit if mode is active
    if (!appContainer.classList.contains("app-edit-mode")) return;

    // Check for "Add Block" button interaction
    const addBtn = e.target.closest(".add-block-btn button");
    if (addBtn) {
      const blockId = addBtn.getAttribute("data-insert-after");
      if (blockId != null) {
        stateManager.insertBlock(blockId, "New paragraph...");
      }
      return;
    }

    // Don't open a new editor if one is already active
    if (activeEditingBlockId !== null) return;

    // Find closest editable block
    const block = e.target.closest(".editable-block");
    if (!block) return;

    const blockId = block.getAttribute("data-block-id");
    if (blockId == null) return;

    const id = parseInt(blockId, 10);
    const token = stateManager.tokens[id];
    if (!token) return;

    activeEditingBlockId = id;

    // Create wrapper for textarea + action buttons
    const wrapper = document.createElement("div");
    wrapper.className = "inline-editor-wrapper";

    // Create textarea
    const textarea = document.createElement("textarea");
    textarea.className = "inline-editor";
    textarea.value = token.raw;
    textarea.style.height = Math.max(block.offsetHeight + 40, 80) + "px";

    // Create action buttons bar
    const actionsBar = document.createElement("div");
    actionsBar.className = "inline-editor-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn-cancel-block";
    cancelBtn.textContent = "Cancel (Esc)";

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn-save-block";
    saveBtn.textContent = "Save (Ctrl+\u23CE)";

    actionsBar.appendChild(cancelBtn);
    actionsBar.appendChild(saveBtn);

    // Move format toolbar into the inline editor wrapper
    const toolbar = document.getElementById('format-toolbar');
    const toolbarOriginalParent = toolbar ? toolbar.parentNode : null;
    const toolbarOriginalNext = toolbar ? toolbar.nextSibling : null;

    if (toolbar) {
      toolbar.classList.add('toolbar-inline');
      toolbar.classList.remove('hidden');
      wrapper.appendChild(toolbar);
    }

    wrapper.appendChild(textarea);
    wrapper.appendChild(actionsBar);

    // Swap out the block
    block.replaceWith(wrapper);
    textarea.focus();

    // --- Action handlers ---
    const restoreToolbar = () => {
      if (toolbar && toolbarOriginalParent) {
        toolbar.classList.remove('toolbar-inline');
        toolbarOriginalParent.insertBefore(toolbar, toolbarOriginalNext);
        // Toolbar visibility will be handled by the MutationObserver in format-toolbar.js
      }
    };

    const cleanupOutsideListener = () => {
      document.removeEventListener("mousedown", onClickOutside, true);
    };

    const saveEdit = () => {
      if (activeEditingBlockId === null) return;
      const newValue = textarea.value;
      activeEditingBlockId = null;
      cleanupOutsideListener();
      restoreToolbar();
      wrapper.remove();
      stateManager.updateBlock(id, newValue);
    };

    const cancelEdit = () => {
      if (activeEditingBlockId === null) return;
      activeEditingBlockId = null;
      cleanupOutsideListener();
      restoreToolbar();
      wrapper.remove();
      stateManager.triggerRender();
    };

    // Click outside to save (but not if clicking the toolbar or the wrapper itself)
    const onClickOutside = (ev) => {
      if (activeEditingBlockId === null) return;
      const target = ev.target;
      if (wrapper.contains(target)) return;
      if (target.closest('#format-toolbar')) return;
      if (target.closest('.emoji-picker')) return;
      // Save on outside click
      saveEdit();
    };

    // Use capture phase so we catch it before other handlers
    document.addEventListener("mousedown", onClickOutside, true);

    saveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      saveEdit();
    });

    cancelBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      cancelEdit();
    });

    // Keyboard: Escape to cancel, Ctrl+Enter to save
    textarea.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        cancelEdit();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        saveEdit();
      }
    });

    // Auto-resize on input
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    });

    // Prevent click propagation from wrapper opening another editor
    wrapper.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });
  });
};
