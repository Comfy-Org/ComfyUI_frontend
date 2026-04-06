import { readFile, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CACHE_DIR = '.content-cache'
const CACHE_MANIFEST_PATH = path.join(CACHE_DIR, '_manifest.json')

interface CacheManifest {
  version: string
  promptsHash: string
  entries: Record<string, CacheEntry>
  lastUpdated: string
}

interface CacheEntry {
  templateHash: string
  promptsHash: string
  generatedAt: string
  model: string
}

async function getCacheSize(): Promise<{ files: number; bytes: number }> {
  if (!existsSync(CACHE_DIR)) {
    return { files: 0, bytes: 0 }
  }

  const files = await readdir(CACHE_DIR)
  let totalBytes = 0

  for (const file of files) {
    const filePath = path.join(CACHE_DIR, file)
    const stats = await stat(filePath)
    totalBytes += stats.size
  }

  return { files: files.length, bytes: totalBytes }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleString()
}

async function main() {
  console.log('📊 AI Content Cache Status')
  console.log('')

  if (!existsSync(CACHE_DIR)) {
    console.log('⚠️  Cache directory does not exist')
    console.log(`   Path: ${CACHE_DIR}`)
    console.log('   Run "pnpm run generate:ai" to initialize the cache')
    return
  }

  const cacheSize = await getCacheSize()
  console.log(`📁 Cache Directory: ${CACHE_DIR}`)
  console.log(`   Files: ${cacheSize.files}`)
  console.log(`   Size: ${formatBytes(cacheSize.bytes)}`)
  console.log('')

  if (!existsSync(CACHE_MANIFEST_PATH)) {
    console.log('⚠️  No cache manifest found')
    console.log('   Cache may be from an older version')
    console.log('   Run "pnpm run generate:ai" to create manifest')
    return
  }

  let manifest: CacheManifest
  try {
    manifest = JSON.parse(await readFile(CACHE_MANIFEST_PATH, 'utf-8'))
  } catch {
    console.log('⚠️  Cache manifest is corrupted')
    console.log('   Run "pnpm run cache:clear --force" to reset')
    return
  }

  console.log('📋 Manifest Info:')
  console.log(`   Version: ${manifest.version}`)
  console.log(`   Prompts hash: ${manifest.promptsHash.slice(0, 16)}...`)
  console.log(`   Last updated: ${formatDate(manifest.lastUpdated)}`)
  console.log(`   Cached entries: ${Object.keys(manifest.entries).length}`)
  console.log('')

  // Group by model
  const byModel: Record<string, number> = {}
  const generationDates: Date[] = []

  for (const entry of Object.values(manifest.entries)) {
    const model = entry.model || 'unknown'
    byModel[model] = (byModel[model] || 0) + 1
    generationDates.push(new Date(entry.generatedAt))
  }

  if (Object.keys(byModel).length > 0) {
    console.log('🤖 By Model:')
    for (const [model, count] of Object.entries(byModel).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`   ${model}: ${count}`)
    }
    console.log('')
  }

  if (generationDates.length > 0) {
    generationDates.sort((a, b) => b.getTime() - a.getTime())
    const newest = generationDates[0]
    const oldest = generationDates[generationDates.length - 1]

    console.log('📅 Generation Timeline:')
    console.log(`   Newest: ${formatDate(newest.toISOString())}`)
    console.log(`   Oldest: ${formatDate(oldest.toISOString())}`)
  }
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
