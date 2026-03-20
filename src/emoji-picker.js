// Emoji Picker for Markdown editing
// Provides a grid of common emojis/icons useful for .md documents

const EMOJI_CATEGORIES = [
  {
    label: 'Status',
    emojis: [
      { char: '\u2705', name: 'Done' },
      { char: '\u274C', name: 'Error' },
      { char: '\u26A0\uFE0F', name: 'Warning' },
      { char: '\u2139\uFE0F', name: 'Info' },
      { char: '\u2753', name: 'Question' },
      { char: '\u2757', name: 'Important' },
      { char: '\uD83D\uDCA1', name: 'Idea' },
      { char: '\uD83D\uDD25', name: 'Fire' },
      { char: '\u2B50', name: 'Star' },
      { char: '\uD83D\uDC8E', name: 'Diamond' },
      { char: '\uD83C\uDFAF', name: 'Target' },
      { char: '\uD83D\uDEA7', name: 'Construction' },
    ],
  },
  {
    label: 'Documents',
    emojis: [
      { char: '\uD83D\uDCDD', name: 'Note' },
      { char: '\u270F\uFE0F', name: 'Pencil' },
      { char: '\uD83D\uDCCC', name: 'Pin' },
      { char: '\uD83D\uDCCE', name: 'Paperclip' },
      { char: '\uD83D\uDCC1', name: 'Folder' },
      { char: '\uD83D\uDCC4', name: 'Document' },
      { char: '\uD83D\uDCCA', name: 'Chart' },
      { char: '\uD83D\uDCC8', name: 'Trending up' },
      { char: '\uD83D\uDCC9', name: 'Trending down' },
      { char: '\uD83D\uDCCB', name: 'Clipboard' },
    ],
  },
  {
    label: 'Development',
    emojis: [
      { char: '\uD83C\uDFA8', name: 'Design' },
      { char: '\uD83D\uDD27', name: 'Wrench' },
      { char: '\u2699\uFE0F', name: 'Gear' },
      { char: '\uD83D\uDD11', name: 'Key' },
      { char: '\uD83D\uDD12', name: 'Lock' },
      { char: '\u2728', name: 'Sparkles' },
      { char: '\uD83D\uDE80', name: 'Rocket' },
      { char: '\uD83D\uDCBB', name: 'Laptop' },
      { char: '\uD83D\uDC1B', name: 'Bug' },
      { char: '\uD83D\uDD0D', name: 'Search' },
      { char: '\uD83D\uDCE6', name: 'Package' },
      { char: '\uD83C\uDFF7\uFE0F', name: 'Tag' },
    ],
  },
  {
    label: 'Reactions',
    emojis: [
      { char: '\uD83D\uDC4D', name: 'Thumbs up' },
      { char: '\uD83D\uDC4E', name: 'Thumbs down' },
      { char: '\uD83D\uDC4B', name: 'Wave' },
      { char: '\uD83C\uDF89', name: 'Party' },
      { char: '\uD83D\uDCAA', name: 'Strong' },
      { char: '\uD83E\uDD14', name: 'Thinking' },
      { char: '\uD83D\uDE0A', name: 'Smile' },
      { char: '\uD83D\uDE0E', name: 'Cool' },
    ],
  },
  {
    label: 'Arrows & Symbols',
    emojis: [
      { char: '\u27A1\uFE0F', name: 'Right' },
      { char: '\u2B05\uFE0F', name: 'Left' },
      { char: '\u2B06\uFE0F', name: 'Up' },
      { char: '\u2B07\uFE0F', name: 'Down' },
      { char: '\u2194\uFE0F', name: 'Left-Right' },
      { char: '\uD83D\uDD04', name: 'Refresh' },
      { char: '\u25B6\uFE0F', name: 'Play' },
      { char: '\u23F0', name: 'Alarm' },
      { char: '\uD83D\uDCC5', name: 'Calendar' },
      { char: '\u2764\uFE0F', name: 'Heart' },
      { char: '\uD83D\uDC9A', name: 'Green heart' },
      { char: '\uD83D\uDC99', name: 'Blue heart' },
    ],
  },
];

export const initEmojiPicker = () => {
  const btnEmoji = document.getElementById('btn-emoji-picker');
  const pickerEl = document.getElementById('emoji-picker');

  if (!btnEmoji || !pickerEl) return;

  let isOpen = false;

  // Build the picker content
  const buildPicker = () => {
    pickerEl.innerHTML = '';

    EMOJI_CATEGORIES.forEach(category => {
      const label = document.createElement('div');
      label.className = 'emoji-category-label';
      label.textContent = category.label;
      pickerEl.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'emoji-grid';

      category.emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.textContent = emoji.char;
        btn.title = emoji.name;
        btn.type = 'button';
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault(); // prevent focus loss from textarea
        });
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          insertEmoji(emoji.char);
          closePicker();
        });
        grid.appendChild(btn);
      });

      pickerEl.appendChild(grid);
    });
  };

  const insertEmoji = (emoji) => {
    // Find the active textarea (inline editor or raw view)
    let textarea = document.activeElement;
    if (!textarea || textarea.tagName !== 'TEXTAREA') {
      // Fallback: try raw view textarea
      const rawTa = document.getElementById('raw-left-textarea');
      if (rawTa) {
        textarea = rawTa;
      } else {
        // Try inline editor
        textarea = document.querySelector('.inline-editor');
      }
    }

    if (!textarea) {
      window.showToast && window.showToast('No active editor. Click on a text area first.', 'error');
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);

    textarea.value = before + emoji + after;
    textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  };

  const openPicker = () => {
    if (!pickerEl.hasChildNodes()) {
      buildPicker();
    }
    pickerEl.classList.remove('hidden');
    isOpen = true;
  };

  const closePicker = () => {
    pickerEl.classList.add('hidden');
    isOpen = false;
  };

  // Toggle on button click
  btnEmoji.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen) {
      closePicker();
    } else {
      openPicker();
    }
  });

  // Prevent picker mousedown from stealing focus
  pickerEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (isOpen && !pickerEl.contains(e.target) && e.target !== btnEmoji) {
      closePicker();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closePicker();
    }
  });
};
