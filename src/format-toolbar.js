// 3.4 Markdown Formatting Toolbar
// Provides formatting buttons for bold, italic, headings, lists, links, code etc.
// Works with both inline block editors and the power editor textarea.

export const initFormatToolbar = () => {
  const toolbar = document.getElementById('format-toolbar');
  const appDiv = document.getElementById('app');

  if (!toolbar) return;

  // Track the currently active textarea for formatting
  let activeTextarea = null;

  // Watch for textarea focus
  document.addEventListener('focusin', (e) => {
    if (e.target.tagName === 'TEXTAREA') {
      activeTextarea = e.target;
    }
  });

  document.addEventListener('focusout', (e) => {
    if (e.target.tagName === 'TEXTAREA') {
      // Delay to allow toolbar button click to register before clearing
      setTimeout(() => {
        if (document.activeElement?.tagName !== 'TEXTAREA' &&
            !document.activeElement?.closest('#format-toolbar')) {
          // Keep reference briefly for toolbar clicks
        }
      }, 150);
    }
  });

  const appRight = document.getElementById('app-right');

  // Show/hide toolbar based on context.
  // The toolbar is ONLY shown when explicitly moved into an editor context:
  // - Inside .inline-editor-wrapper (block editing) — managed by editor.js
  // - Inside editor-group (RAW mode) — managed by raw-view-mode.js
  // The global toolbar is always hidden.
  const updateToolbarVisibility = () => {
    // Don't interfere when toolbar is managed by inline editor or raw mode
    if (toolbar.classList.contains('toolbar-inline')) return;
    if (toolbar.classList.contains('toolbar-raw')) return;

    // In all other cases, keep toolbar hidden at the global position
    toolbar.classList.add('hidden');
  };

  // Observe class changes on both panes and child additions (for raw textarea)
  const observer = new MutationObserver(updateToolbarVisibility);
  observer.observe(appDiv, { attributes: true, attributeFilter: ['class'], childList: true });
  if (appRight) {
    observer.observe(appRight, { attributes: true, attributeFilter: ['class'], childList: true });
  }

  // --- Format action definitions ---
  const wrapActions = {
    bold:          { prefix: '**', suffix: '**', placeholder: 'Bold text' },
    italic:        { prefix: '*',  suffix: '*',  placeholder: 'Italic text' },
    strikethrough: { prefix: '~~', suffix: '~~', placeholder: 'Strikethrough text' },
    code:          { prefix: '`',  suffix: '`',  placeholder: 'Code' },
    link:          { prefix: '[',  suffix: '](url)', placeholder: 'Link text' },
    image:         { prefix: '![', suffix: '](url)', placeholder: 'Image description' },
  };

  const lineActions = {
    h1:        '# ',
    h2:        '## ',
    h3:        '### ',
    ul:        '- ',
    ol:        '1. ',
    checklist: '- [ ] ',
    quote:     '> ',
  };

  // Get the right textarea to apply formatting to
  const getTargetTextarea = () => {
    // Prefer the last focused textarea
    if (activeTextarea && document.body.contains(activeTextarea)) {
      return activeTextarea;
    }
    // Fallback to raw view textarea if active
    const rawTa = document.getElementById('raw-left-textarea');
    if (rawTa) return rawTa;
    const rawRightTa = document.getElementById('raw-right-textarea');
    if (rawRightTa && !rawRightTa.readOnly) return rawRightTa;
    // Fallback to any visible inline editor
    const inlineEditor = document.querySelector('.inline-editor');
    if (inlineEditor) return inlineEditor;

    return null;
  };

  const applyFormat = (format) => {
    const textarea = getTargetTextarea();
    if (!textarea) {
      window.showToast && window.showToast('No active editor. Click on a text area first.', 'error');
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    // --- Horizontal rule ---
    if (format === 'hr') {
      const hrText = '\n\n---\n\n';
      textarea.value = before + hrText + after;
      textarea.selectionStart = textarea.selectionEnd = start + hrText.length;
      textarea.dispatchEvent(new Event('input'));
      textarea.focus();
      return;
    }

    // --- Code block ---
    if (format === 'codeblock') {
      const codeText = selectedText || 'Code hier...';
      const blockText = '\n```\n' + codeText + '\n```\n';
      textarea.value = before + blockText + after;
      textarea.selectionStart = start + 4; // after ```\n
      textarea.selectionEnd = start + 4 + codeText.length;
      textarea.dispatchEvent(new Event('input'));
      textarea.focus();
      return;
    }

    // --- Line-prefix actions (headings, lists, quote) ---
    if (lineActions[format]) {
      const prefix = lineActions[format];
      if (selectedText) {
        const lines = selectedText.split('\n');
        const formatted = lines.map(line => prefix + line).join('\n');
        textarea.value = before + formatted + after;
        textarea.selectionStart = start;
        textarea.selectionEnd = start + formatted.length;
      } else {
        textarea.value = before + prefix + after;
        textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
      }
      textarea.dispatchEvent(new Event('input'));
      textarea.focus();
      return;
    }

    // --- Wrap actions (bold, italic, code, link, image) ---
    if (wrapActions[format]) {
      const { prefix, suffix, placeholder } = wrapActions[format];
      if (selectedText) {
        const formatted = prefix + selectedText + suffix;
        textarea.value = before + formatted + after;
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + selectedText.length;
      } else {
        const formatted = prefix + placeholder + suffix;
        textarea.value = before + formatted + after;
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + placeholder.length;
      }
      textarea.dispatchEvent(new Event('input'));
      textarea.focus();
    }
  };

  // --- Event handlers ---
  // Prevent mousedown from stealing focus from textarea
  toolbar.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-format]');
    if (btn) {
      applyFormat(btn.getAttribute('data-format'));
    }
  });

  // --- Keyboard shortcuts for formatting (Ctrl+B, Ctrl+I, Ctrl+L) ---
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    const textarea = document.activeElement;
    if (!textarea || textarea.tagName !== 'TEXTAREA') return;

    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      activeTextarea = textarea;
      applyFormat('bold');
    }

    if (e.key.toLowerCase() === 'i' && !e.shiftKey) {
      e.preventDefault();
      activeTextarea = textarea;
      applyFormat('italic');
    }

    if (e.key.toLowerCase() === 'l' && !e.shiftKey) {
      e.preventDefault();
      activeTextarea = textarea;
      applyFormat('link');
    }
  });
};
