import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
    base: './', // Necessary for electron relative path resolution
    define: {
        '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    build: {
        outDir: 'out/frontend'
    }
});
