import { rm, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CACHE_DIR = '.content-cache'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function getCacheStats(): Promise<{ files: number; bytes: number }> {
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

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const force = args.includes('--force') || args.includes('-f')

  console.log('🗑️  AI Content Cache Clear')
  console.log('')

  if (!existsSync(CACHE_DIR)) {
    console.log('✓ Cache directory does not exist - nothing to clear')
    return
  }

  const stats = await getCacheStats()

  if (stats.files === 0) {
    console.log('✓ Cache is empty - nothing to clear')
    return
  }

  console.log(`📁 Cache: ${CACHE_DIR}`)
  console.log(`   Files: ${stats.files}`)
  console.log(`   Size: ${formatBytes(stats.bytes)}`)
  console.log('')

  if (dryRun) {
    console.log('🔍 Dry run - would delete:')
    const files = await readdir(CACHE_DIR)
    for (const file of files) {
      console.log(`   - ${file}`)
    }
    console.log('')
    console.log('Run without --dry-run to actually clear the cache')
    return
  }

  if (!force) {
    console.log('⚠️  This will delete all cached AI content.')
    console.log('   Use --force or -f to confirm, or --dry-run to preview.')
    process.exit(1)
  }

  console.log('Clearing cache...')
  await rm(CACHE_DIR, { recursive: true, force: true })

  console.log('')
  console.log(`✅ Cleared ${stats.files} files (${formatBytes(stats.bytes)})`)
  console.log('   Next "pnpm run generate:ai" will regenerate all content')
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
