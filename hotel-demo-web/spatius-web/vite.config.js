import { defineConfig } from 'vite'
import { avatarkitVitePlugin } from '@spatius/avatarkit/vite'
export default defineConfig({
  plugins: [avatarkitVitePlugin()],
  build: {
    lib: {
      entry: 'src/spatius-tab.js',
      formats: ['es'],
      fileName: () => 'spatius-tab.js',
    },
  },
})
