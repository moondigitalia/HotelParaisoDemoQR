import { defineConfig } from 'vite'
import { avatarkitVitePlugin } from '@spatius/avatarkit/vite'
import { mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

function ensureAssetsDir() {
  return {
    name: 'ensure-assets-dir',
    closeBundle() {
      mkdirSync('dist/assets', { recursive: true })
    },
  }
}

function copyWasmToRoot() {
  return {
    name: 'copy-wasm-to-dist-root',
    closeBundle() {
      const dir = 'dist/assets'
      if (existsSync(dir)) {
        for (const f of readdirSync(dir)) {
          copyFileSync(join(dir, f), join('dist', f))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [ensureAssetsDir(), avatarkitVitePlugin(), copyWasmToRoot()],
  build: {
    lib: {
      entry: 'src/spatius-tab.js',
      formats: ['es'],
      fileName: () => 'spatius-tab.js',
    },
  },
})
