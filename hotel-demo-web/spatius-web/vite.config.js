import { defineConfig } from 'vite'
import { avatarkitVitePlugin } from '@spatius/avatarkit/vite'
import { mkdirSync } from 'node:fs'

function ensureAssetsDir() {
  return {
    name: 'ensure-assets-dir',
    closeBundle() {
      mkdirSync('dist/assets', { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [ensureAssetsDir(), avatarkitVitePlugin()],
  build: {
    lib: {
      entry: 'src/spatius-tab.js',
      formats: ['es'],
      fileName: () => 'spatius-tab.js',
    },
  },
})
