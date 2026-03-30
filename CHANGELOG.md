# Changelog

## 1.0.2 (2026-03-30)

### Bug Fixes

- **Link navigation**: Fix app freeze when clicking links in rendered markdown; anchor links scroll to headings, relative .md links open in tabs, HTTP links open in browser
- **Sidebar buttons**: Fix toggle behavior (clicking active button now closes panel) and active-state not clearing when switching between panels
- **Split-view tab sync**: Fix tabs appearing in both panels when opening in right panel; each panel now tracks its own tabs independently
- **Split-view replace**: Fix replacing a document that is open in both panels — now only the focused panel is replaced instead of both
- **Navigation history**: Fix back/forward navigating to wrong panel; history now stores and restores panel context

### Features

- **Worktree browser**: New sidebar panel for browsing a folder of .md files as a hierarchical tree with expand/collapse folders and persistent folder selection
- **Worktree active file**: Automatically highlights the currently active document in the worktree and expands its parent folders
- **Worktree context switch**: Shows a "Set new Worktree" button when the active document is outside the current worktree folder, with quick folder selection starting at the document's directory
- **Mouse-button navigation**: Left click replaces active document (or jumps to it if open), middle click opens in new tab, Ctrl+click opens in other panel — works in Worktree, Favorites, Recent Files, and document links
- **Middle-click tab split**: Middle-clicking a tab opens that document in split view in the other panel
- **Navigation history**: Alt+Left/Right and mouse buttons 4/5 navigate back/forward through document history
- **Table styling**: Markdown tables now render with borders, padding, header background, and hover effects

## 1.0.1 (2026-03-29)

### Bug Fixes

- **Raw mode scroll**: Preserve scroll position when toggling between rendered and raw view
- **Whitespace accumulation**: Fix `updateBlock`/`insertBlock` adding extra blank lines on each edit
- **Whitespace cleanup**: Auto-normalize excessive blank lines when loading files
- **Multi-line comments**: Render multi-line `<!-- -->` and legacy `<span>` comments as single styled blocks
- **Toggle comments**: Also hide/show legacy `<span class="inline-commit">` comments

### Features

- **Edit comments**: Click existing comments in comment mode to edit or delete them
- **Version display**: Show installed version in the menu

## 1.0.0 (2026-03-20)

First release of refor.md.

### Features

- Markdown rendering with block-level diffing for performant updates
- Block editor for directly editing individual paragraphs
- Raw editor for full Markdown source editing
- Comment system using HTML comment syntax
- Split view for working on two documents side by side
- Tab system for multiple simultaneously opened files
- Auto-generated table of contents
- Full-text search with match navigation and counter
- PDF and HTML export
- Drag & drop for files and images
- Auto-save every 30 seconds
- Smooth zoom (50%–200%)
- Dark and light theme with persistence
- Spell check (toggleable)
- Favorites and recently opened files
- Formatting toolbar with emoji picker
- Undo/redo with full history
- Frameless window with custom title bar
- Multi-window support
- Protection against unsaved changes on close
- File association for .md files (double-click to open)
- Syntax highlighting for 15+ programming languages
- Content Security Policy for secure execution
- Windows support
