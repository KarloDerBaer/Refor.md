export const initDragAndDrop = (appContainer, stateManager) => {
  // Prevent default browser behavior on the entire document to avoid electron loading the dropped file
  document.addEventListener("dragover", (e) => e.preventDefault(), false);
  document.addEventListener("drop", (e) => e.preventDefault(), false);

  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Provide visual feedback
  const highlight = () => document.body.classList.add("drag-active");
  const unhighlight = () => document.body.classList.remove("drag-active");

  ["dragenter", "dragover"].forEach((eventName) => {
    document.body.addEventListener(eventName, highlight, false);
  });

  ["dragleave", "drop"].forEach((eventName) => {
    document.body.addEventListener(eventName, unhighlight, false);
  });

  // Handle actual drop
  document.body.addEventListener(
    "drop",
    async (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;

      if (files && files.length > 0) {
        const file = files[0];

        // Check if image by type or extension
        const isImage =
          file.type.startsWith("image/") ||
          /\.(jpe?g|png|gif|webp|svg)$/i.test(file.name);

        if (isImage) {
          const localPath = window.electronAPI.getFilePath
            ? window.electronAPI.getFilePath(file)
            : file.path;

          if (localPath && window.electronAPI.copyImage) {
            try {
              // Ask main process to copy image to local assets folder
              const relativePath =
                await window.electronAPI.copyImage(localPath);

              if (relativePath) {
                const imageMarkdownBlock = `\n![${file.name}](${relativePath})\n`;
                stateManager.rawMarkdown += imageMarkdownBlock;
              } else {
                window.showToast("Failed to insert image.", "error");
              }
            } catch (err) {
              console.error("Error invoking copyImage:", err);
              window.showToast("Error inserting image.", "error");
            }
          } else {
            window.showToast("Could not process image.", "error");
          }
        } else if (file.name.toLowerCase().endsWith(".md") || file.name.toLowerCase().endsWith(".markdown")) {
          const localPath = window.electronAPI.getFilePath
            ? window.electronAPI.getFilePath(file)
            : file.path;

          if (localPath) {
            // Signal the app to open the file
            window.dispatchEvent(new CustomEvent('open-dropped-file', { detail: { path: localPath } }));
          }
        } else {
          console.warn(
            "Dropped file is not recognized as an image or markdown file:",
            file.name,
            file.type,
          );
        }
      }
    },
    false,
  );

  // Separate drag and drop logic for Sidebar Favorites (to add to favs without opening)
  const flyout = document.getElementById("sidebar-flyout");
  flyout.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (document.getElementById("flyout-title").textContent === "Favorites") {
      flyout.style.backgroundColor = "rgba(128, 128, 128, 0.1)"; // visual feedback
    }
  });

  flyout.addEventListener("dragleave", () => {
    flyout.style.backgroundColor = "";
  });

  flyout.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent main app container from catching it
    flyout.style.backgroundColor = "";

    if (document.getElementById("flyout-title").textContent === "Favorites") {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.name.toLowerCase().endsWith(".md") || file.name.toLowerCase().endsWith(".markdown")) {
          const localPath = window.electronAPI.getFilePath ? window.electronAPI.getFilePath(file) : file.path;
          if (localPath) {
            window.dispatchEvent(new CustomEvent('add-favorite-dropped-file', { detail: { path: localPath, name: file.name } }));
          }
        }
      }
    }
  });
};
