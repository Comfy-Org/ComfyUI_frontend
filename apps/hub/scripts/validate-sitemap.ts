import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

interface ValidationResult {
  url: string
  status: number | null
  error?: string
}

const SITE_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DIST_DIR = path.join(SITE_DIR, 'dist')

function findSitemaps(): string[] {
  const files = fs.readdirSync(DIST_DIR)
  return files
    .filter((f) => f.startsWith('sitemap') && f.endsWith('.xml'))
    .map((f) => path.join(DIST_DIR, f))
}

function extractUrlsFromSitemap(sitemapPath: string): string[] {
  const content = fs.readFileSync(sitemapPath, 'utf-8')
  const urls: string[] = []

  // Basic XML validation - check for proper structure
  if (
    !content.includes('<?xml') &&
    !content.includes('<urlset') &&
    !content.includes('<sitemapindex')
  ) {
    throw new Error(`Invalid XML structure in ${sitemapPath}`)
  }

  // Extract URLs from <loc> tags
  const locRegex = /<loc>([^<]+)<\/loc>/g
  let match
  while ((match = locRegex.exec(content)) !== null) {
    urls.push(match[1])
  }

  return urls
}

function validateXmlStructure(sitemapPath: string): void {
  const content = fs.readFileSync(sitemapPath, 'utf-8')

  // Check for XML declaration or proper root element
  const hasXmlDecl = content.includes('<?xml')
  const hasUrlset = content.includes('<urlset')
  const hasSitemapIndex = content.includes('<sitemapindex')

  if (!hasXmlDecl) {
    console.warn(
      `  Warning: ${path.basename(sitemapPath)} missing XML declaration`
    )
  }

  if (!hasUrlset && !hasSitemapIndex) {
    throw new Error(
      `${path.basename(sitemapPath)} missing <urlset> or <sitemapindex> root element`
    )
  }

  // Check for balanced tags
  const openUrlset = (content.match(/<urlset/g) || []).length
  const closeUrlset = (content.match(/<\/urlset>/g) || []).length
  if (openUrlset !== closeUrlset) {
    throw new Error(
      `${path.basename(sitemapPath)} has unbalanced <urlset> tags`
    )
  }

  const openUrl = (content.match(/<url>/g) || []).length
  const closeUrl = (content.match(/<\/url>/g) || []).length
  if (openUrl !== closeUrl) {
    throw new Error(`${path.basename(sitemapPath)} has unbalanced <url> tags`)
  }

  console.log(`  ✓ XML structure valid (${openUrl} URLs)`)
}

async function checkUrl(url: string): Promise<ValidationResult> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return { url, status: response.status }
  } catch (error) {
    return {
      url,
      status: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function validateUrls(
  urls: string[],
  concurrency = 10
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(checkUrl))
    results.push(...batchResults)

    // Progress indicator
    process.stdout.write(
      `\r  Checked ${Math.min(i + concurrency, urls.length)}/${urls.length} URLs`
    )
  }
  console.log()

  return results
}

async function main(): Promise<void> {
  console.log('Validating sitemaps...\n')

  if (!fs.existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run `pnpm build` first.')
    process.exit(1)
  }

  const sitemaps = findSitemaps()
  if (sitemaps.length === 0) {
    console.error('Error: No sitemap files found in dist/')
    process.exit(1)
  }

  console.log(`Found ${sitemaps.length} sitemap(s):\n`)

  let allUrls: string[] = []
  let hasXmlErrors = false

  for (const sitemap of sitemaps) {
    console.log(`Validating: ${path.basename(sitemap)}`)

    try {
      validateXmlStructure(sitemap)
      const urls = extractUrlsFromSitemap(sitemap)
      allUrls.push(...urls)
    } catch (error) {
      console.error(`  ✗ ${error instanceof Error ? error.message : error}`)
      hasXmlErrors = true
    }
  }

  if (hasXmlErrors) {
    console.error('\nXML validation failed')
    process.exit(1)
  }

  // Deduplicate URLs
  allUrls = [...new Set(allUrls)]
  console.log(`\nChecking ${allUrls.length} unique URLs...`)

  const results = await validateUrls(allUrls)

  // Report results
  const failed = results.filter((r) => r.status === null || r.status >= 400)
  const succeeded = results.filter((r) => r.status !== null && r.status < 400)

  console.log(`\n✓ ${succeeded.length} URLs accessible`)

  if (failed.length > 0) {
    console.log(`✗ ${failed.length} URLs failed:\n`)
    for (const result of failed) {
      if (result.error) {
        console.log(`  ${result.url}`)
        console.log(`    Error: ${result.error}`)
      } else {
        console.log(`  ${result.url}`)
        console.log(`    Status: ${result.status}`)
      }
    }
    process.exit(1)
  }

  console.log('\nSitemap validation passed!')
}

main()
