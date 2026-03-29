import { parseMarkdown } from "./markdown.js";

const MAX_UNDO_HISTORY = 50;

/**
 * Collapse 3+ consecutive newlines to exactly 2 (one blank line).
 * Preserves content inside fenced code blocks (``` ... ```).
 */
function normalizeWhitespace(markdown) {
  const lines = markdown.split('\n');
  const result = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    result.push(line);
  }

  // Rebuild, collapsing runs of blank lines outside code blocks
  let output = '';
  let consecutiveEmpty = 0;
  inCodeBlock = false;

  for (const line of result) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      consecutiveEmpty = 0;
      output += line + '\n';
      continue;
    }

    if (inCodeBlock) {
      output += line + '\n';
      consecutiveEmpty = 0;
      continue;
    }

    if (line.trim() === '') {
      consecutiveEmpty++;
      // Allow at most 1 blank line (= 2 consecutive newlines)
      if (consecutiveEmpty <= 1) {
        output += '\n';
      }
    } else {
      consecutiveEmpty = 0;
      output += line + '\n';
    }
  }

  return output.replace(/\n+$/, '\n');
}

class StateManager {
  constructor(initialMarkdown, renderCallback) {
    this._rawMarkdown = initialMarkdown;
    this.renderCallback = renderCallback;
    this.tokens = [];
    this._showCommits = false;
    this._leftRawMode = false;

    // Dirty tracking: detect unsaved changes
    this._savedMarkdown = initialMarkdown;
    this._dirty = false;
    this._onDirtyChange = null;

    // Undo/Redo history
    this._undoStack = [];
    this._redoStack = [];
  }

  // --- Dirty State ---
  get dirty() {
    return this._dirty;
  }

  set onDirtyChange(callback) {
    this._onDirtyChange = callback;
  }

  _updateDirty() {
    const wasDirty = this._dirty;
    this._dirty = this._rawMarkdown !== this._savedMarkdown;
    if (wasDirty !== this._dirty && this._onDirtyChange) {
      this._onDirtyChange(this._dirty);
    }
  }

  markSaved() {
    this._savedMarkdown = this._rawMarkdown;
    this._updateDirty();
  }

  markClean(markdown) {
    const normalized = normalizeWhitespace(markdown);
    this._savedMarkdown = normalized;
    this._rawMarkdown = normalized;
    this._dirty = false;
    if (this._onDirtyChange) this._onDirtyChange(false);
  }

  // --- Undo / Redo ---
  _pushUndo(previousMarkdown) {
    this._undoStack.push(previousMarkdown);
    if (this._undoStack.length > MAX_UNDO_HISTORY) {
      this._undoStack.shift();
    }
    // Any new edit clears the redo stack
    this._redoStack = [];
  }

  undo() {
    if (this._undoStack.length === 0) return;
    this._redoStack.push(this._rawMarkdown);
    this._rawMarkdown = this._undoStack.pop();
    this._updateDirty();
    this._update();
  }

  redo() {
    if (this._redoStack.length === 0) return;
    this._undoStack.push(this._rawMarkdown);
    this._rawMarkdown = this._redoStack.pop();
    this._updateDirty();
    this._update();
  }

  get canUndo() {
    return this._undoStack.length > 0;
  }

  get canRedo() {
    return this._redoStack.length > 0;
  }

  get savedMarkdown() {
    return this._savedMarkdown;
  }

  // Save/restore full state for tab switching (3.6)
  saveSnapshot() {
    return {
      rawMarkdown: this._rawMarkdown,
      savedMarkdown: this._savedMarkdown,
      undoStack: [...this._undoStack],
      redoStack: [...this._redoStack],
    };
  }

  loadSnapshot(snapshot) {
    this._rawMarkdown = snapshot.rawMarkdown;
    this._savedMarkdown = snapshot.savedMarkdown;
    this._undoStack = [...snapshot.undoStack];
    this._redoStack = [...snapshot.redoStack];
    this._updateDirty();
    this._update();
  }

  // --- Left Raw Mode (skip DOM updates when raw textarea is active) ---
  get leftRawMode() { return this._leftRawMode; }
  set leftRawMode(value) { this._leftRawMode = value; }

  // --- Show Commits ---
  get showCommits() {
    return this._showCommits;
  }

  set showCommits(value) {
    this._showCommits = value;
    this._update();
  }

  // --- Raw Markdown ---
  get rawMarkdown() {
    return this._rawMarkdown;
  }

  set rawMarkdown(value) {
    if (value === this._rawMarkdown) return;
    this._pushUndo(this._rawMarkdown);
    this._rawMarkdown = value;
    this._updateDirty();
    this._update();
  }

  updateBlock(blockId, newText) {
    const id = parseInt(blockId, 10);
    let newMarkdown = "";

    for (let i = 0; i < this.tokens.length; i++) {
      if (i === id) {
        newMarkdown += newText + "\n\n";
      } else {
        // Use raw text as-is; it already contains trailing whitespace from the lexer
        newMarkdown += this.tokens[i].raw;
        // Only ensure at least one newline after non-space tokens that don't end with one
        if (this.tokens[i].type !== 'space' && !this.tokens[i].raw.endsWith("\n")) {
          newMarkdown += "\n";
        }
      }
    }

    this.rawMarkdown = newMarkdown.trimEnd() + "\n";
  }

  insertBlock(afterBlockId, newText) {
    const id = parseInt(afterBlockId, 10);
    let newMarkdown = "";

    for (let i = 0; i < this.tokens.length; i++) {
      // Use raw text as-is; it already contains trailing whitespace from the lexer
      newMarkdown += this.tokens[i].raw;
      if (this.tokens[i].type !== 'space' && !this.tokens[i].raw.endsWith("\n")) {
        newMarkdown += "\n";
      }
      if (i === id) {
        newMarkdown += newText + "\n\n";
      }
    }

    if (this.tokens.length === 0) {
      newMarkdown = newText + "\n\n";
    }

    this.rawMarkdown = newMarkdown.trimEnd() + "\n";
  }

  _update() {
    if (!this.renderCallback) return;
    const result = parseMarkdown(this._rawMarkdown, this._showCommits);
    this.tokens = result.tokens;
    // Pass rawMarkdown as second arg to avoid TDZ issue during createState
    // Third arg: options object, skipLeftDom when left pane is in raw mode
    this.renderCallback(result.html, this._rawMarkdown, { skipLeftDom: this._leftRawMode });
  }

  triggerRender() {
    this._update();
  }
}

export const createState = (initialMarkdown, renderCallback) => {
  const state = new StateManager(initialMarkdown, renderCallback);
  state.triggerRender();
  return state;
};
