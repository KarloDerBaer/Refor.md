import { basename } from "./utils.js";

export const initSidebar = (stateManager, fileManager) => {
    const btnMainMenu = document.getElementById("btn-main-menu");
    const mainMenuPopover = document.getElementById("main-menu-popover");

    const btnRecents = document.getElementById("btn-recents");
    const btnFavorites = document.getElementById("btn-favorites");
    const btnToc = document.getElementById("btn-toc");
    const flyout = document.getElementById("sidebar-flyout");
    const btnCloseFlyout = document.getElementById("btn-close-flyout");
    const flyoutTitle = document.getElementById("flyout-title");
    const flyoutList = document.getElementById("flyout-list");
    const flyoutResizer = document.getElementById("flyout-resizer");

    let currentFlyoutMode = null; // 'recents' or 'favorites'

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

            const openBtn = document.createElement("button");
            openBtn.className = "icon-btn";
            openBtn.innerHTML = `<i data-lucide="external-link" style="width: 14px; height: 14px;"></i>`;
            openBtn.onclick = (e) => {
                e.stopPropagation();
                openFileFromPath(file.path);
            };

            li.onclick = () => openFileFromPath(file.path);

            li.appendChild(nameSpan);
            li.appendChild(openBtn);
            flyoutList.appendChild(li);
        });

        // Re-init lucide icons for dynamically added elements
        window.lucide && window.lucide.createIcons();
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

            li.onclick = () => openFileFromPath(file.path);

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

    if (btnToc) {
        btnToc.addEventListener("click", () => {
            if (currentFlyoutMode === 'toc') {
                closeFlyout();
                return;
            }
            btnRecents.classList.remove("active");
            btnFavorites.classList.remove("active");
            btnToc.classList.add("active");
            flyoutTitle.textContent = "Table of Contents";
            showFlyout();
            currentFlyoutMode = 'toc';
            loadToc();
        });
    }

    btnRecents.addEventListener("click", () => {
        if (currentFlyoutMode === 'recents') {
            closeFlyout();
            return;
        }
        btnFavorites.classList.remove("active");
        btnRecents.classList.add("active");
        flyoutTitle.textContent = "Recent Files";
        showFlyout();
        currentFlyoutMode = 'recents';
        loadRecents();
    });

    btnFavorites.addEventListener("click", () => {
        if (currentFlyoutMode === 'favorites') {
            closeFlyout();
            return;
        }
        btnRecents.classList.remove("active");
        btnFavorites.classList.add("active");
        flyoutTitle.textContent = "Favorites";
        showFlyout();
        currentFlyoutMode = 'favorites';
        loadFavorites();
    });

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
