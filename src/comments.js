// Comment Mode — click a block to add a comment (no floating button needed)
// In comment mode, blocks get a visual hover indicator and clicking opens
// a comment popup positioned next to the click point.
// Clicking an existing inline-commit span opens the popup pre-filled for editing.

export const initComments = (appContainer, stateManager) => {
  let currentTargetBlockId = null;
  let popupVisible = false;
  let editingCommentSpan = null; // The <span class="inline-commit"> being edited (if any)

  // Create the popup container (appended to document.body for no clipping)
  const popupEl = document.createElement("div");
  popupEl.className = "comment-popup-container";

  const showPopup = (clickX, clickY, prefillText = "", isEdit = false) => {
    if (popupVisible) hidePopup();
    popupVisible = true;

    popupEl.innerHTML = "";
    const popup = document.createElement("div");
    popup.className = "comment-popup";

    const input = document.createElement("textarea");
    input.placeholder = "Add comment...";
    input.className = "comment-input";
    input.value = prefillText;

    const actions = document.createElement("div");
    actions.className = "comment-popup-actions";

    // Delete button (only for editing existing comments)
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "comment-delete-btn";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "comment-cancel-btn";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.className = "comment-save-btn";

    cancelBtn.addEventListener("click", () => hidePopup());
    deleteBtn.addEventListener("click", () => {
      if (editingCommentSpan && currentTargetBlockId !== null) {
        deleteCommentFromState();
      }
      hidePopup();
    });
    saveBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (text && currentTargetBlockId !== null) {
        if (editingCommentSpan) {
          updateCommentInState(text);
        } else {
          saveCommentToState(text);
        }
      }
      hidePopup();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hidePopup();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        saveBtn.click();
      }
    });

    actions.appendChild(cancelBtn);
    if (isEdit) actions.appendChild(deleteBtn);
    actions.appendChild(saveBtn);
    popup.appendChild(input);
    popup.appendChild(actions);
    popupEl.appendChild(popup);
    document.body.appendChild(popupEl);

    // Position near click point — try right of click, fallback left
    const popupWidth = 260; // matches CSS .comment-popup width
    const margin = 12;
    let left = clickX + margin;
    let top = clickY - 20;

    // If popup would overflow right, place it left of the click
    if (left + popupWidth > window.innerWidth - margin) {
      left = clickX - popupWidth - margin;
    }
    // If still overflows left, clamp to margin
    if (left < margin) {
      left = margin;
    }

    popupEl.style.left = left + "px";
    popupEl.style.top = top + "px";

    // After rendering, check bottom overflow
    requestAnimationFrame(() => {
      const popupRect = popupEl.getBoundingClientRect();
      if (popupRect.bottom > window.innerHeight - margin) {
        popupEl.style.top = (window.innerHeight - popupRect.height - margin) + "px";
      }
      if (popupRect.top < margin) {
        popupEl.style.top = margin + "px";
      }
    });

    input.focus();
    // Place cursor at end of prefilled text
    if (prefillText) {
      input.selectionStart = input.selectionEnd = prefillText.length;
    }
  };

  const hidePopup = () => {
    if (!popupVisible) return;
    popupVisible = false;
    editingCommentSpan = null;
    if (popupEl.parentNode) popupEl.remove();
  };

  /**
   * Extract the comment text from a span's raw source in the markdown.
   * Handles both <!-- comment --> and <span class="inline-commit">[ comment ]</span> formats.
   */
  const extractCommentText = (spanElement) => {
    // Get text content, strip surrounding brackets
    let text = spanElement.textContent || '';
    text = text.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
    return text;
  };

  /**
   * Find the raw source representation of a comment span within its block token.
   * Returns the matching pattern (<!-- ... --> or <span...>...</span>) or null.
   */
  const findCommentInRaw = (blockRaw, commentText) => {
    // Try HTML comment format first: <!-- commentText -->
    const htmlCommentRegex = /<!--([\s\S]*?)-->/g;
    let match;
    while ((match = htmlCommentRegex.exec(blockRaw)) !== null) {
      if (match[1].trim() === commentText.trim()) {
        return { full: match[0], format: 'html' };
      }
    }

    // Try legacy span format: <span class="inline-commit">[ commentText ]</span>
    const spanRegex = /<span\s+class="inline-commit">\[([\s\S]*?)\]<\/span>/g;
    while ((match = spanRegex.exec(blockRaw)) !== null) {
      if (match[1].trim() === commentText.trim()) {
        return { full: match[0], format: 'span' };
      }
    }

    return null;
  };

  // Click on a block in comment mode → open popup
  appContainer.addEventListener("click", (e) => {
    if (!appContainer.classList.contains("app-comment-mode")) return;

    // Don't trigger if clicking inside the popup
    if (e.target.closest(".comment-popup-container")) return;

    const block = e.target.closest(".editable-block");
    if (!block) return;

    const blockId = block.getAttribute("data-block-id");
    if (blockId == null) return;

    e.preventDefault();
    e.stopPropagation();

    currentTargetBlockId = parseInt(blockId, 10);

    // Check if the user clicked on an existing inline-commit span
    const commitSpan = e.target.closest(".inline-commit");
    if (commitSpan) {
      editingCommentSpan = commitSpan;
      const existingText = extractCommentText(commitSpan);
      showPopup(e.clientX, e.clientY, existingText, true);
    } else {
      editingCommentSpan = null;
      showPopup(e.clientX, e.clientY);
    }
  });

  // Close popup on outside click
  document.addEventListener("mousedown", (e) => {
    if (popupVisible && !popupEl.contains(e.target)) {
      hidePopup();
    }
  });

  // Close popup when comment mode is deactivated
  const observer = new MutationObserver(() => {
    if (!appContainer.classList.contains("app-comment-mode") && popupVisible) {
      hidePopup();
    }
  });
  observer.observe(appContainer, { attributes: true, attributeFilter: ["class"] });

  const saveCommentToState = (commentText) => {
    if (currentTargetBlockId === null) return;

    const targetToken = stateManager.tokens[currentTargetBlockId];
    if (!targetToken) return;

    const newBlockText = targetToken.raw + ` <!-- ${commentText} -->`;
    stateManager.updateBlock(currentTargetBlockId, newBlockText);
  };

  const updateCommentInState = (newCommentText) => {
    if (currentTargetBlockId === null || !editingCommentSpan) return;

    const targetToken = stateManager.tokens[currentTargetBlockId];
    if (!targetToken) return;

    const oldText = extractCommentText(editingCommentSpan);
    const found = findCommentInRaw(targetToken.raw, oldText);

    if (found) {
      // Replace old comment with new one (always save as HTML comment format)
      const newComment = `<!-- ${newCommentText} -->`;
      const newBlockText = targetToken.raw.replace(found.full, newComment);
      stateManager.updateBlock(currentTargetBlockId, newBlockText);
    } else {
      // Fallback: append as new comment if we can't find the old one
      saveCommentToState(newCommentText);
    }
  };

  const deleteCommentFromState = () => {
    if (currentTargetBlockId === null || !editingCommentSpan) return;

    const targetToken = stateManager.tokens[currentTargetBlockId];
    if (!targetToken) return;

    const oldText = extractCommentText(editingCommentSpan);
    const found = findCommentInRaw(targetToken.raw, oldText);

    if (found) {
      // Remove the comment and any surrounding extra whitespace
      const newBlockText = targetToken.raw.replace(found.full, '').replace(/  +/g, ' ').trim();
      stateManager.updateBlock(currentTargetBlockId, newBlockText);
    }
  };
};
