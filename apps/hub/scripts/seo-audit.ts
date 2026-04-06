import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'node-html-parser'

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
}

type Severity = 'critical' | 'warning' | 'info'

interface Issue {
  severity: Severity
  message: string
}

interface PageReport {
  file: string
  issues: Issue[]
}

const DIST_DIR = path.resolve(process.cwd(), 'dist')

function getHtmlFiles(dir: string): string[] {
  const files: string[] = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...getHtmlFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath)
    }
  }

  return files
}

function auditPage(filePath: string): PageReport {
  const relativePath = path.relative(DIST_DIR, filePath)
  const content = fs.readFileSync(filePath, 'utf-8')
  const root = parse(content)
  const issues: Issue[] = []

  // Skip redirect-only pages (e.g., index.html → /templates/)
  const metaRefresh = root.querySelector('meta[http-equiv="refresh"]')
  if (metaRefresh) {
    return { file: relativePath, issues: [] }
  }

  // Check <title> tag
  const titleEl = root.querySelector('title')
  const title = titleEl?.text?.trim() || ''
  if (!title) {
    issues.push({ severity: 'critical', message: 'Missing <title> tag' })
  } else if (title.length < 30) {
    issues.push({
      severity: 'warning',
      message: `Title too short (${title.length} chars, ideal: 50-60)`
    })
  } else if (title.length > 70) {
    issues.push({
      severity: 'warning',
      message: `Title too long (${title.length} chars, ideal: 50-60)`
    })
  }

  // Check meta description
  const metaDescEl = root.querySelector('meta[name="description"]')
  const metaDesc = metaDescEl?.getAttribute('content')?.trim()
  if (!metaDesc) {
    issues.push({
      severity: 'critical',
      message: 'Missing <meta name="description">'
    })
  } else if (metaDesc.length < 100) {
    issues.push({
      severity: 'warning',
      message: `Meta description too short (${metaDesc.length} chars, ideal: 150-160)`
    })
  } else if (metaDesc.length > 170) {
    issues.push({
      severity: 'warning',
      message: `Meta description too long (${metaDesc.length} chars, ideal: 150-160)`
    })
  }

  // Check canonical URL
  const canonical = root
    .querySelector('link[rel="canonical"]')
    ?.getAttribute('href')
  if (!canonical) {
    issues.push({ severity: 'warning', message: 'Missing canonical URL' })
  }

  // Check OG tags
  const ogTitle = root
    .querySelector('meta[property="og:title"]')
    ?.getAttribute('content')
  const ogDesc = root
    .querySelector('meta[property="og:description"]')
    ?.getAttribute('content')
  const ogImage = root
    .querySelector('meta[property="og:image"]')
    ?.getAttribute('content')

  if (!ogTitle) {
    issues.push({ severity: 'warning', message: 'Missing og:title' })
  }
  if (!ogDesc) {
    issues.push({ severity: 'warning', message: 'Missing og:description' })
  }
  if (!ogImage) {
    issues.push({ severity: 'warning', message: 'Missing og:image' })
  }

  // Check structured data (JSON-LD)
  const jsonLd = root.querySelectorAll('script[type="application/ld+json"]')
  if (jsonLd.length === 0) {
    issues.push({
      severity: 'info',
      message: 'No structured data (JSON-LD) found'
    })
  }

  // Check H1 tag
  const h1Tags = root.querySelectorAll('h1')
  if (h1Tags.length === 0) {
    issues.push({ severity: 'critical', message: 'Missing <h1> tag' })
  } else if (h1Tags.length > 1) {
    issues.push({
      severity: 'warning',
      message: `Multiple <h1> tags found (${h1Tags.length}), should have exactly 1`
    })
  }

  // Check images for alt attributes
  const images = root.querySelectorAll('img')
  let imagesWithoutAlt = 0
  for (const img of images) {
    const alt = img.getAttribute('alt')
    if (alt === undefined || alt === null) {
      imagesWithoutAlt++
    }
  }
  if (imagesWithoutAlt > 0) {
    issues.push({
      severity: 'warning',
      message: `${imagesWithoutAlt} image(s) missing alt attribute`
    })
  }

  return { file: relativePath, issues }
}

function severityIcon(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return `${colors.red}✖${colors.reset}`
    case 'warning':
      return `${colors.yellow}⚠${colors.reset}`
    case 'info':
      return `${colors.blue}ℹ${colors.reset}`
  }
}

function severityColor(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return colors.red
    case 'warning':
      return colors.yellow
    case 'info':
      return colors.blue
  }
}

function printReport(reports: PageReport[]): void {
  console.log(
    `\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`
  )
  console.log(
    `${colors.bold}${colors.cyan}                    SEO AUDIT REPORT${colors.reset}`
  )
  console.log(
    `${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`
  )

  let totalCritical = 0
  let totalWarning = 0
  let totalInfo = 0
  let pagesWithIssues = 0

  for (const report of reports) {
    if (report.issues.length === 0) continue

    pagesWithIssues++
    console.log(
      `${colors.bold}${colors.magenta}📄 ${report.file}${colors.reset}`
    )
    console.log(`${colors.gray}${'─'.repeat(60)}${colors.reset}`)

    for (const issue of report.issues) {
      const color = severityColor(issue.severity)
      console.log(
        `   ${severityIcon(issue.severity)} ${color}${issue.message}${colors.reset}`
      )

      if (issue.severity === 'critical') totalCritical++
      else if (issue.severity === 'warning') totalWarning++
      else totalInfo++
    }
    console.log()
  }

  // Summary
  console.log(
    `${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`
  )
  console.log(`${colors.bold}                         SUMMARY${colors.reset}`)
  console.log(
    `${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`
  )

  console.log(
    `   ${colors.gray}Pages scanned:${colors.reset}     ${reports.length}`
  )
  console.log(
    `   ${colors.gray}Pages with issues:${colors.reset} ${pagesWithIssues}`
  )
  console.log()
  console.log(
    `   ${colors.red}✖ Critical:${colors.reset}        ${totalCritical}`
  )
  console.log(
    `   ${colors.yellow}⚠ Warnings:${colors.reset}        ${totalWarning}`
  )
  console.log(`   ${colors.blue}ℹ Info:${colors.reset}            ${totalInfo}`)
  console.log()

  if (totalCritical > 0) {
    console.log(
      `${colors.bold}${colors.red}❌ SEO audit FAILED - ${totalCritical} critical issue(s) found${colors.reset}\n`
    )
  } else if (totalWarning > 0) {
    console.log(
      `${colors.bold}${colors.yellow}⚠️  SEO audit passed with ${totalWarning} warning(s)${colors.reset}\n`
    )
  } else {
    console.log(
      `${colors.bold}${colors.green}✅ SEO audit PASSED - No issues found!${colors.reset}\n`
    )
  }
}

function writeSummaryJson(reports: PageReport[]): void {
  const totalCritical = reports.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'critical').length,
    0
  )
  const totalWarning = reports.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'warning').length,
    0
  )
  const totalInfo = reports.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === 'info').length,
    0
  )
  const pagesWithIssues = reports.filter((r) => r.issues.length > 0).length

  const issueCounts: Record<string, number> = {}
  for (const report of reports) {
    for (const issue of report.issues) {
      const key = issue.message
        .replace(/\(\d+ chars.*?\)/, '(N chars...)')
        .replace(/^\d+ image\(s\)/, 'N image(s)')
      issueCounts[key] = (issueCounts[key] || 0) + 1
    }
  }

  const topIssues = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([message, count]) => ({ message, count }))

  const summary = {
    pagesScanned: reports.length,
    pagesWithIssues,
    pagesClean: reports.length - pagesWithIssues,
    critical: totalCritical,
    warnings: totalWarning,
    info: totalInfo,
    topIssues,
    hasCritical: totalCritical > 0
  }

  const outputPath = path.resolve(process.cwd(), 'seo-summary.json')
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2))
}

function main(): void {
  console.log(`${colors.gray}Scanning ${DIST_DIR}...${colors.reset}`)

  if (!fs.existsSync(DIST_DIR)) {
    console.error(
      `${colors.red}Error: dist/ directory not found. Run 'pnpm build' first.${colors.reset}`
    )
    process.exit(1)
  }

  const htmlFiles = getHtmlFiles(DIST_DIR)

  if (htmlFiles.length === 0) {
    console.error(
      `${colors.red}Error: No HTML files found in dist/${colors.reset}`
    )
    process.exit(1)
  }

  console.log(
    `${colors.gray}Found ${htmlFiles.length} HTML file(s)${colors.reset}`
  )

  const reports: PageReport[] = htmlFiles.map(auditPage)

  printReport(reports)
  writeSummaryJson(reports)

  const hasCritical = reports.some((r) =>
    r.issues.some((i) => i.severity === 'critical')
  )

  process.exit(hasCritical ? 1 : 0)
}

main()
