import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // Necessary for electron relative path resolution
    build: {
        outDir: 'out/frontend'
    }
});
