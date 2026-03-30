import { basename } from "./utils.js";

export const initSidebar = (stateManager, fileManager) => {
    const btnMainMenu = document.getElementById("btn-main-menu");
    const mainMenuPopover = document.getElementById("main-menu-popover");

    const btnRecents = document.getElementById("btn-recents");
    const btnFavorites = document.getElementById("btn-favorites");
    const btnToc = document.getElementById("btn-toc");
    const btnWorktree = document.getElementById("btn-worktree");
    const flyout = document.getElementById("sidebar-flyout");
    const btnCloseFlyout = document.getElementById("btn-close-flyout");
    const flyoutTitle = document.getElementById("flyout-title");
    const flyoutList = document.getElementById("flyout-list");
    const flyoutResizer = document.getElementById("flyout-resizer");

    let currentFlyoutMode = null; // 'recents', 'favorites', 'toc', or 'worktree'

    // --- Flyout Resizer Logic ---
    let flyoutDragging = false;
    if (flyoutResizer) {
        flyoutResizer.addEventListener("mousedown", (e) => {
            flyoutDragging = true;
            flyoutResizer.classList.add("is-resizing");
            document.body.style.cursor = "col-resize";
            e.preventDefault();
        });

        document.addEventListener("mousemove", (e) => {
            if (!flyoutDragging) return;
            const sidebar = document.getElementById("left-sidebar");
            const sidebarWidth = sidebar ? sidebar.getBoundingClientRect().right : 50;
            const newWidth = e.clientX - sidebarWidth;
            if (newWidth >= 150 && newWidth <= 600) {
                flyout.style.width = `${newWidth}px`;
            }
        });

        document.addEventListener("mouseup", () => {
            if (flyoutDragging) {
                flyoutDragging = false;
                flyoutResizer.classList.remove("is-resizing");
                document.body.style.cursor = "";
            }
        });
    }

    // --- Main Menu Toggle ---
    btnMainMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        mainMenuPopover.classList.toggle("hidden");
    });

    document.addEventListener("click", () => {
        if (!mainMenuPopover.classList.contains("hidden")) {
            mainMenuPopover.classList.add("hidden");
        }
    });

    mainMenuPopover.addEventListener("click", (e) => {
        e.stopPropagation(); // keep open if clicking inside (handled by specific buttons anyway)
    });

    // Simple direct binds for menu items not handled in file-management
    document.getElementById("menu-report-bug").addEventListener("click", () => {
        window.electronAPI.openExternal("https://github.com/KarloDerBaer/Refor.md/issues");
        mainMenuPopover.classList.add("hidden");
    });

    document.getElementById("menu-exit").addEventListener("click", () => {
        window.electronAPI.windowControl("close");
    });

    // --- Flyout Logic ---
    const closeFlyout = () => {
        flyout.classList.add("hidden");
        if (flyoutResizer) flyoutResizer.classList.add("hidden");
        btnRecents.classList.remove("active");
        btnFavorites.classList.remove("active");
        if (btnToc) btnToc.classList.remove("active");
        if (btnWorktree) btnWorktree.classList.remove("active");
        currentFlyoutMode = null;
    };

    btnCloseFlyout.addEventListener("click", closeFlyout);

    const loadRecents = async () => {
        const recents = await window.electronAPI.storeGet('recentFiles') || [];
        flyoutList.innerHTML = "";
        if (recents.length === 0) {
            flyoutList.innerHTML = `<li style="color: var(--ui-text-color)">No recent files</li>`;
            return;
        }

        recents.forEach(file => {
            const li = document.createElement("li");

            const nameSpan = document.createElement("span");
            nameSpan.textContent = file.name;
            nameSpan.title = file.path;

            attachFileClickHandlers(li, file.path);

            li.appendChild(nameSpan);
            flyoutList.appendChild(li);
        });
    };

    const loadFavorites = async () => {
        const favorites = await window.electronAPI.storeGet('favoriteFiles') || [];
        flyoutList.innerHTML = "";

        // Always top item: The current file + "Add to favorites" button
        const currentPath = fileManager.getCurrentFilePath();
        if (currentPath) {
            const currentName = basename(currentPath);
            const isFav = favorites.some(f => f.path === currentPath);

            const topLi = document.createElement("li");
            topLi.style.borderBottom = "2px solid rgba(0,0,0,0.1)";
            topLi.style.marginBottom = "8px";
            topLi.style.fontWeight = "600";

            const nameSpan = document.createElement("span");
            nameSpan.textContent = currentName;

            const starBtn = document.createElement("button");
            starBtn.className = "icon-btn";
            starBtn.title = isFav ? "Remove from favorites" : "Add to favorites";
            starBtn.innerHTML = `<i data-lucide="star" fill="${isFav ? 'currentColor' : 'none'}" style="width: 14px; height: 14px;"></i>`;

            starBtn.onclick = async (e) => {
                e.stopPropagation();
                if (isFav) {
                    await window.electronAPI.removeFavorite(currentPath);
                } else {
                    await window.electronAPI.addFavorite({ path: currentPath, name: currentName });
                }
                loadFavorites(); // reload list
            };

            topLi.appendChild(nameSpan);
            topLi.appendChild(starBtn);
            flyoutList.appendChild(topLi);
        }

        if (favorites.length === 0 && !currentPath) {
            flyoutList.innerHTML = `<li style="color: var(--ui-text-color)">No favorites</li>`;
            return;
        }

        favorites.forEach(file => {
            if (file.path === currentPath) return;

            const li = document.createElement("li");

            const nameSpan = document.createElement("span");
            nameSpan.textContent = file.name;
            nameSpan.title = file.path;

            const removeBtn = document.createElement("button");
            removeBtn.className = "icon-btn";
            removeBtn.title = "Remove from favorites";
            removeBtn.innerHTML = `<i data-lucide="star" fill="currentColor" style="width: 14px; height: 14px;"></i>`;
            removeBtn.onclick = async (e) => {
                e.stopPropagation();
                await window.electronAPI.removeFavorite(file.path);
                loadFavorites(); // reload
            };

            attachFileClickHandlers(li, file.path);

            li.appendChild(nameSpan);
            li.appendChild(removeBtn);
            flyoutList.appendChild(li);
        });

        window.lucide && window.lucide.createIcons();
    };

    const openFileFromPath = async (filePath) => {
        try {
            const content = await window.electronAPI.readFile(filePath);
            if (content !== null) {
                // Use TabManager to open the file — updates tab name, snapshot, file path
                if (window._tabManager) {
                    window._tabManager.openInTab(filePath, content);
                } else {
                    stateManager.markClean(content);
                    stateManager.triggerRender();
                    fileManager.forceCurrentFilePath(filePath);
                }
                window.dispatchEvent(new CustomEvent('recent-files-updated'));
                await window.electronAPI.addRecentFile({ path: filePath, name: basename(filePath) });
                if (currentFlyoutMode === 'recents') loadRecents();
            } else {
                window.showToast("Could not load file (may have been deleted or moved).", "error");
            }
        } catch (e) {
            console.error(e);
            window.showToast("Error opening file.", "error");
        }
    };

    // --- TOC (Table of Contents) (3.7) ---
    const loadToc = () => {
        flyoutList.innerHTML = "";
        const markdown = stateManager.rawMarkdown || "";
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        let match;
        const headings = [];
        while ((match = headingRegex.exec(markdown)) !== null) {
            headings.push({
                level: match[1].length,
                text: match[2].replace(/[*_~`\[\]]/g, '').trim()
            });
        }

        if (headings.length === 0) {
            flyoutList.innerHTML = `<li style="color: var(--ui-text-color)">No headings found</li>`;
            return;
        }

        headings.forEach((h) => {
            const li = document.createElement("li");
            li.className = `toc-item toc-h${h.level}`;
            li.textContent = h.text;
            li.onclick = () => {
                // Find heading in rendered content and scroll to it
                const appDiv = document.getElementById("app");
                const allHeadings = appDiv.querySelectorAll("h1, h2, h3, h4, h5, h6");
                for (const el of allHeadings) {
                    if (el.textContent.trim() === h.text) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                        // Brief highlight effect
                        el.style.transition = "background-color 0.3s";
                        el.style.backgroundColor = "rgba(100, 149, 237, 0.2)";
                        setTimeout(() => { el.style.backgroundColor = ""; }, 1500);
                        break;
                    }
                }
            };
            flyoutList.appendChild(li);
        });
    };

    const showFlyout = () => {
        flyout.classList.remove("hidden");
        if (flyoutResizer) flyoutResizer.classList.remove("hidden");
    };

    // Unified flyout opener — handles toggle, active-state cleanup, and loading
    const allFlyoutButtons = { recents: btnRecents, favorites: btnFavorites, toc: btnToc, worktree: btnWorktree };
    const flyoutLoaders = { recents: loadRecents, favorites: loadFavorites, toc: loadToc };
    const flyoutTitles = { recents: "Recent Files", favorites: "Favorites", toc: "Table of Contents", worktree: "Worktree" };

    const openFlyoutMode = (mode) => {
        if (currentFlyoutMode === mode) {
            closeFlyout();
            return;
        }
        // Deactivate all buttons first
        Object.values(allFlyoutButtons).forEach(btn => btn && btn.classList.remove("active"));
        // Activate the clicked button
        const btn = allFlyoutButtons[mode];
        if (btn) btn.classList.add("active");
        flyoutTitle.textContent = flyoutTitles[mode] || mode;
        showFlyout();
        currentFlyoutMode = mode;
        const loader = flyoutLoaders[mode];
        if (loader) loader();
    };

    if (btnToc) btnToc.addEventListener("click", () => openFlyoutMode('toc'));
    btnRecents.addEventListener("click", () => openFlyoutMode('recents'));
    btnFavorites.addEventListener("click", () => openFlyoutMode('favorites'));

    // --- Shared click handler for file items (worktree, recents, favorites) ---
    const attachFileClickHandlers = (element, filePath) => {
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey) {
                openWorktreeFile(filePath, 'other-panel');
            } else {
                openWorktreeFile(filePath, 'replace');
            }
        });
        element.addEventListener('auxclick', (e) => {
            if (e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
                openWorktreeFile(filePath, 'new-tab');
            }
        });
    };

    // --- Worktree (Documentation Browser) ---

    // Find if a file is already open in any tab/panel, and jump to it.
    // targetPane: 'same' (prefer focused), 'other' (prefer other panel), or 'left'/'right' (specific panel)
    const findAndSwitchToTab = (filePath, targetPane) => {
        const tm = window._tabManager;
        const sv = window._splitView;
        if (!tm) return false;
        const existingTab = tm.tabs.find(t => t.filePath === filePath);
        if (!existingTab) return false;

        if (sv && sv.isOpen) {
            const inLeft = sv.leftTabIds.includes(existingTab.id);
            const inRight = sv.rightTabIds.includes(existingTab.id);
            const focused = sv.focusedPane;
            const other = focused === 'left' ? 'right' : 'left';

            if (targetPane === 'other') {
                // Prefer the other panel, then fall back to any panel that has it
                if (other === 'left' && inLeft) { sv.switchTabInPane('left', existingTab.id); return true; }
                if (other === 'right' && inRight) { sv.switchTabInPane('right', existingTab.id); return true; }
                if (focused === 'left' && inLeft) { sv.switchTabInPane('left', existingTab.id); return true; }
                if (focused === 'right' && inRight) { sv.switchTabInPane('right', existingTab.id); return true; }
            } else if (targetPane === 'left' || targetPane === 'right') {
                // Specific panel requested (for history navigation)
                // No fallback — if not in the requested pane, return false so caller opens it there
                if (targetPane === 'left' && inLeft) { sv.switchTabInPane('left', existingTab.id); return true; }
                if (targetPane === 'right' && inRight) { sv.switchTabInPane('right', existingTab.id); return true; }
                return false;
            } else {
                // 'same' — prefer focused panel first, then other
                if (focused === 'left' && inLeft) { sv.switchTabInPane('left', existingTab.id); return true; }
                if (focused === 'right' && inRight) { sv.switchTabInPane('right', existingTab.id); return true; }
                if (inLeft) { sv.switchTabInPane('left', existingTab.id); return true; }
                if (inRight) { sv.switchTabInPane('right', existingTab.id); return true; }
            }
        }
        // Split not open (or tab not in any pane's list)
        if (targetPane === 'other') {
            // 'other' panel doesn't exist yet — let caller open split-view
            return false;
        }
        // For 'same' mode, just switch to the existing tab
        tm.switchTab(existingTab.id);
        return true;
    };

    /**
     * Open a worktree file with mouse-button-aware behavior:
     * - Left click: replace active tab (or jump if already open)
     * - Middle click: open in new tab in same panel (or jump if already open in same panel)
     * - Ctrl+Left click: open in new tab in OTHER panel (or jump if already open)
     * @param {string} filePath
     * @param {'replace'|'new-tab'|'other-panel'} mode
     * @param {string|null} targetPane - optional: 'left'/'right' to target a specific pane (for history nav)
     */
    const openWorktreeFile = async (filePath, mode = 'replace', targetPane = null) => {
        try {
            // Determine the preferred pane for findAndSwitchToTab
            let searchPane = mode === 'other-panel' ? 'other' : 'same';
            if (targetPane) searchPane = targetPane;

            // Try to find and jump to an already-open tab first
            if (findAndSwitchToTab(filePath, searchPane)) return;

            const content = await window.electronAPI.readFile(filePath);
            if (content === null) { window.showToast("Could not load file.", "error"); return; }

            const tm = window._tabManager;
            const sv = window._splitView;

            // If a specific pane is requested and split is open, switch focus first
            if (targetPane && sv && sv.isOpen && sv.focusedPane !== targetPane) {
                sv.setFocusedPane(targetPane);
            }

            if (mode === 'replace') {
                // Replace active tab content in the currently focused pane
                if (tm) {
                    const activeTab = tm.tabs.find(t => t.id === tm.activeTabId);
                    if (activeTab) {
                        // Check if tab is shared between both panes in split-view
                        const isShared = sv && sv.isOpen &&
                            sv.leftTabIds.includes(activeTab.id) &&
                            sv.rightTabIds.includes(activeTab.id);

                        if (isShared) {
                            // Don't mutate shared tab — create new tab in focused pane, remove old from focused only
                            const focusedPane = sv.focusedPane;
                            tm.openInTab(filePath, content);
                            // openInTab already added the new tab to the focused pane via ensureTabInPane
                            // Now remove the old shared tab from ONLY this pane
                            sv.removeTabFromPane(activeTab.id, focusedPane);
                            sv.renderLeftTabs();
                            sv.renderRightTabs();
                        } else {
                            // Warn if unsaved changes
                            if (activeTab.snapshot && activeTab.snapshot.rawMarkdown !== activeTab.snapshot.savedMarkdown) {
                                if (!confirm(`"${activeTab.title}" has unsaved changes. Replace anyway?`)) return;
                            }
                            stateManager.markClean(content);
                            stateManager.triggerRender();
                            fileManager.forceCurrentFilePath(filePath);
                            activeTab.filePath = filePath;
                            activeTab.title = basename(filePath);
                            activeTab.snapshot = stateManager.saveSnapshot();
                            tm.renderTabs();
                        }
                    } else {
                        // No active tab found — fallback to opening in new tab
                        tm.openInTab(filePath, content);
                    }
                } else {
                    stateManager.markClean(content);
                    stateManager.triggerRender();
                    fileManager.forceCurrentFilePath(filePath);
                }
            } else if (mode === 'new-tab') {
                // Open new tab in the currently focused pane
                if (tm) tm.openInTab(filePath, content);
            } else if (mode === 'other-panel') {
                // Open in the other panel
                if (sv && sv.isOpen) {
                    const otherPane = sv.focusedPane === 'left' ? 'right' : 'left';
                    // Save current state, switch focus, then open
                    sv.setFocusedPane(otherPane);
                    if (tm) tm.openInTab(filePath, content);
                } else if (sv) {
                    // Split not open — open it, then create new tab in right pane
                    sv.open();
                    sv.setFocusedPane('right');
                    if (tm) tm.openInTab(filePath, content);
                } else {
                    if (tm) tm.openInTab(filePath, content);
                }
            }

            await window.electronAPI.addRecentFile({ path: filePath, name: basename(filePath) });
            window.dispatchEvent(new CustomEvent('recent-files-updated'));
            window.dispatchEvent(new CustomEvent('navigation-event', { detail: { filePath } }));
        } catch (e) {
            console.error(e);
            window.showToast("Error opening file.", "error");
        }
    };

    // Expose for use by link handler in main.js
    window._openWorktreeFile = openWorktreeFile;

    const buildTree = (nodes, parentUl, depth) => {
        nodes.forEach(node => {
            const li = document.createElement("li");
            li.className = "worktree-item";
            li.style.paddingLeft = `${8 + depth * 16}px`;

            if (node.type === 'directory') {
                li.classList.add("worktree-folder");
                // Layout: icon, name, then chevron at end
                li.innerHTML = `<i data-lucide="folder" style="width:14px;height:14px;flex-shrink:0;"></i>
                    <span class="worktree-name">${node.name}</span>
                    <i data-lucide="chevron-right" class="worktree-chevron"></i>`;

                const childUl = document.createElement("ul");
                childUl.className = "worktree-children hidden";
                let expanded = false;

                li.onclick = (e) => {
                    e.stopPropagation();
                    expanded = !expanded;
                    const chevron = li.querySelector('.worktree-chevron');
                    chevron.style.transform = expanded ? "rotate(90deg)" : "";
                    childUl.classList.toggle("hidden", !expanded);
                };

                parentUl.appendChild(li);
                buildTree(node.children, childUl, depth + 1);
                parentUl.appendChild(childUl);
            } else {
                li.classList.add("worktree-file");
                li.innerHTML = `<i data-lucide="file-text" style="width:14px;height:14px;flex-shrink:0;"></i>
                    <span class="worktree-name" title="${node.path}">${node.name}</span>`;

                // Left click = replace, Middle click = new tab, Ctrl+click = other panel
                attachFileClickHandlers(li, node.path);

                parentUl.appendChild(li);
            }
        });
    };

    // Highlight the active file in the worktree and expand its parent folders
    const highlightActiveFile = () => {
        const currentPath = fileManager.getCurrentFilePath();

        // Remove previous highlight
        const prevActive = flyoutList.querySelectorAll('.worktree-file.active');
        prevActive.forEach(el => el.classList.remove('active'));

        if (!currentPath) return;

        const nameSpans = flyoutList.querySelectorAll('.worktree-file .worktree-name');
        for (const span of nameSpans) {
            if (span.title && span.title.replace(/\\/g, '/').toLowerCase() === currentPath.replace(/\\/g, '/').toLowerCase()) {
                const li = span.closest('.worktree-item');
                if (li) li.classList.add('active');

                // Expand all parent folders
                let parent = li.parentElement;
                while (parent) {
                    if (parent.classList && parent.classList.contains('worktree-children') && parent.classList.contains('hidden')) {
                        parent.classList.remove('hidden');
                        const folderLi = parent.previousElementSibling;
                        if (folderLi) {
                            const chevron = folderLi.querySelector('.worktree-chevron');
                            if (chevron) chevron.style.transform = 'rotate(90deg)';
                        }
                    }
                    parent = parent.parentElement;
                }
                break;
            }
        }
    };

    const loadWorktree = async () => {
        flyoutList.innerHTML = "";

        const worktreePath = await window.electronAPI.storeGet('worktreePath');
        const currentPath = fileManager.getCurrentFilePath();

        // Check if current doc is inside the worktree
        const isInsideWorktree = (() => {
            if (!currentPath || !worktreePath) return true; // no doc or no worktree = show tree
            const normCurrent = currentPath.replace(/\\/g, '/').toLowerCase();
            const normWorktree = worktreePath.replace(/\\/g, '/').toLowerCase().replace(/\/$/, '') + '/';
            return normCurrent.startsWith(normWorktree);
        })();

        // If current doc is outside worktree, show "Set new Worktree" button
        if (worktreePath && !isInsideWorktree && currentPath) {
            const parentDir = currentPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
            const parentName = parentDir.split('/').pop() || parentDir;

            const controlsLi = document.createElement("li");
            controlsLi.className = "worktree-controls";

            const infoSpan = document.createElement("span");
            infoSpan.style.cssText = "font-size: 11px; opacity: 0.6; line-height: 1.3; margin-bottom: 4px;";
            infoSpan.textContent = "Current document is outside the worktree.";
            controlsLi.appendChild(infoSpan);

            const setBtn = document.createElement("button");
            setBtn.className = "worktree-action-btn";
            setBtn.innerHTML = `<i data-lucide="folder-open" style="width:14px;height:14px;"></i> Set new Worktree (${parentName})`;
            setBtn.onclick = async (e) => {
                e.stopPropagation();
                const selected = await window.electronAPI.showFolderDialog(parentDir);
                if (selected) {
                    await window.electronAPI.storeSet('worktreePath', selected);
                    loadWorktree();
                }
            };
            controlsLi.appendChild(setBtn);

            const currentPathSpan = document.createElement("span");
            currentPathSpan.className = "worktree-path";
            currentPathSpan.textContent = `Worktree: ${worktreePath}`;
            currentPathSpan.title = worktreePath;
            controlsLi.appendChild(currentPathSpan);

            flyoutList.appendChild(controlsLi);
            window.lucide && window.lucide.createIcons();
            return;
        }

        // Normal worktree display
        const controlsLi = document.createElement("li");
        controlsLi.className = "worktree-controls";

        const selectBtn = document.createElement("button");
        selectBtn.className = "worktree-action-btn";
        selectBtn.innerHTML = `<i data-lucide="folder-open" style="width:14px;height:14px;"></i> ${worktreePath ? 'Change folder' : 'Select folder'}`;
        selectBtn.onclick = async (e) => {
            e.stopPropagation();
            const defaultDir = currentPath ? currentPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/') : undefined;
            const selected = await window.electronAPI.showFolderDialog(defaultDir);
            if (selected) {
                await window.electronAPI.storeSet('worktreePath', selected);
                loadWorktree();
            }
        };
        controlsLi.appendChild(selectBtn);

        if (worktreePath) {
            const pathSpan = document.createElement("span");
            pathSpan.className = "worktree-path";
            pathSpan.textContent = worktreePath;
            pathSpan.title = worktreePath;
            controlsLi.appendChild(pathSpan);
        }

        flyoutList.appendChild(controlsLi);

        if (!worktreePath) {
            const emptyLi = document.createElement("li");
            emptyLi.style.color = "var(--ui-text-color)";
            emptyLi.textContent = "No folder selected";
            flyoutList.appendChild(emptyLi);
            window.lucide && window.lucide.createIcons();
            return;
        }

        const tree = await window.electronAPI.scanDirectoryMd(worktreePath);
        if (!tree || tree.length === 0) {
            const emptyLi = document.createElement("li");
            emptyLi.style.color = "var(--ui-text-color)";
            emptyLi.textContent = "No .md files found";
            flyoutList.appendChild(emptyLi);
            window.lucide && window.lucide.createIcons();
            return;
        }

        buildTree(tree, flyoutList, 0);
        highlightActiveFile();
        window.lucide && window.lucide.createIcons();
    };

    // Expose worktree refresh for tab-change hook in main.js
    // Lightweight: only update highlight, don't rebuild the entire DOM tree
    window._refreshWorktreeFlyout = () => {
        if (currentFlyoutMode === 'worktree') {
            // Just update the active highlight — no DOM rebuild
            highlightActiveFile();
        }
    };

    // Register worktree loader now that loadWorktree is defined
    flyoutLoaders.worktree = loadWorktree;
    if (btnWorktree) btnWorktree.addEventListener("click", () => openFlyoutMode('worktree'));

    // Listen to external events (like a save triggering a recent update)
    window.addEventListener('recent-files-updated', () => {
        if (currentFlyoutMode === 'recents') {
            loadRecents();
        }
        updateTitleStar();
    });

    // --- Titlebar Star Logic ---
    const btnTitleFavorite = document.getElementById("btn-title-favorite");

    const updateTitleStar = async () => {
        const currentPath = fileManager.getCurrentFilePath();
        if (!currentPath) {
            btnTitleFavorite.innerHTML = `<i data-lucide="star" style="width: 14px; height: 14px;"></i>`;
            btnTitleFavorite.title = "Not saved";
            btnTitleFavorite.onclick = null;
        } else {
            const favorites = await window.electronAPI.storeGet('favoriteFiles') || [];
            const isFav = favorites.some(f => f.path === currentPath);
            btnTitleFavorite.innerHTML = `<i data-lucide="star" fill="${isFav ? 'currentColor' : 'none'}" style="width: 14px; height: 14px;"></i>`;
            btnTitleFavorite.title = isFav ? "Remove from favorites" : "Add to favorites";

            btnTitleFavorite.onclick = async (e) => {
                e.stopPropagation();
                if (isFav) {
                    await window.electronAPI.removeFavorite(currentPath);
                } else {
                    const currentName = basename(currentPath);
                    await window.electronAPI.addFavorite({ path: currentPath, name: currentName });
                }
                updateTitleStar();
                if (currentFlyoutMode === 'favorites') loadFavorites();
            };
        }
        window.lucide && window.lucide.createIcons();
    };

    // Run Once
    updateTitleStar();
};
