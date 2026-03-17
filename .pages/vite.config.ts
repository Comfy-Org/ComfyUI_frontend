import fs from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const rootDir = __dirname
const outDir = resolve(rootDir, '../.pages-dist')

const discoverHtmlEntries = () => {
  const entries = new Map<string, string>()
  const topLevel = resolve(rootDir, 'index.html')
  if (fs.existsSync(topLevel)) entries.set('index', topLevel)

  // Directories with pre-built assets (e.g. nx-graph) are copied directly
  // in build-pages.sh to avoid CSS minification issues
  const skipDirs = new Set(['nx-graph'])

  for (const dirent of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!dirent.isDirectory() || dirent.name.startsWith('.')) continue
    if (skipDirs.has(dirent.name)) continue
    const candidate = resolve(rootDir, dirent.name, 'index.html')
    if (fs.existsSync(candidate)) entries.set(dirent.name, candidate)
  }

  return entries.size > 0 ? Object.fromEntries(entries) : undefined
}

export default defineConfig({
  root: rootDir,
  base: '/',
  appType: 'mpa',
  logLevel: 'info',
  publicDir: false,
  server: {
    open: '/index.html',
    fs: {
      allow: [rootDir],
      strict: false
    }
  },
  preview: {
    open: '/index.html'
  },
  build: {
    emptyOutDir: false,
    outDir,
    copyPublicDir: false,
    rollupOptions: {
      input: discoverHtmlEntries()
    }
  }
})
