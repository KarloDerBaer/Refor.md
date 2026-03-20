// Comment Mode — click a block to add a comment (no floating button needed)
// In comment mode, blocks get a visual hover indicator and clicking opens
// a comment popup positioned next to the click point.

export const initComments = (appContainer, stateManager) => {
  let currentTargetBlockId = null;
  let popupVisible = false;

  // Create the popup container (appended to document.body for no clipping)
  const popupEl = document.createElement("div");
  popupEl.className = "comment-popup-container";

  const showPopup = (clickX, clickY) => {
    if (popupVisible) hidePopup();
    popupVisible = true;

    popupEl.innerHTML = "";
    const popup = document.createElement("div");
    popup.className = "comment-popup";

    const input = document.createElement("textarea");
    input.placeholder = "Add comment...";
    input.className = "comment-input";

    const actions = document.createElement("div");
    actions.className = "comment-popup-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "comment-cancel-btn";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.className = "comment-save-btn";

    cancelBtn.addEventListener("click", () => hidePopup());
    saveBtn.addEventListener("click", () => {
      const text = input.value.trim();
      if (text && currentTargetBlockId !== null) {
        saveCommentToState(text);
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
  };

  const hidePopup = () => {
    if (!popupVisible) return;
    popupVisible = false;
    if (popupEl.parentNode) popupEl.remove();
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

    // Use click coordinates for positioning
    showPopup(e.clientX, e.clientY);
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
};
