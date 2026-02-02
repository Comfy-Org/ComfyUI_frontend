import { readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { glob } from 'glob'

type Pattern = {
  label: string
  regex: RegExp
}

const distDir = resolve('dist')
const allowedExtensions = new Set(['.html', '.js', '.map'])
const telemetryPatterns: Pattern[] = [
  { label: 'GTM container', regex: /GTM-[A-Z0-9]+/i },
  { label: 'GTM script', regex: /gtm\.js/i },
  { label: 'Google Tag Manager', regex: /googletagmanager/i },
  { label: 'dataLayer', regex: /\bdataLayer\b/ }
]

const distStats = await stat(distDir).catch(() => null)
if (!distStats?.isDirectory()) {
  console.error('dist directory not found. Run pnpm build first.')
  process.exit(1)
}

const files = await glob('dist/**/*', { nodir: true })
const violations: Array<{
  file: string
  hits: Array<{ label: string; match: string }>
}> = []

for (const file of files) {
  const extension = extname(file).toLowerCase()
  if (!allowedExtensions.has(extension)) continue

  const content = await readFile(file, 'utf8')
  const hits = telemetryPatterns.flatMap((pattern) => {
    const match = content.match(pattern.regex)
    return match ? [{ label: pattern.label, match: match[0] }] : []
  })

  if (hits.length > 0) {
    violations.push({ file, hits })
  }
}

if (violations.length > 0) {
  console.error('Telemetry references found in dist assets:')
  for (const violation of violations) {
    const formattedHits = violation.hits
      .map((hit) => `${hit.label} (${hit.match})`)
      .join(', ')
    console.error(`- ${violation.file}: ${formattedHits}`)
  }
  process.exit(1)
}
