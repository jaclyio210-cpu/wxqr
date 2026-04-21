import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    // @ts-ignore vitest test options — picked up by vitest CLI
    test: {
      environment: 'jsdom',
      globals: true,
    },
  }
})
