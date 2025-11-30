/* eslint-disable no-console */
/**
 * Generate template ranking scores from Mixpanel usage data.
 *
 * Usage:
 *   pnpm generate:template-scores --input ./mixpanel-export.csv
 *
 * See docs/TEMPLATE_RANKING.md for full documentation.
 */

import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateInfo {
  name: string
  [key: string]: unknown
}

interface WorkflowTemplates {
  templates: TemplateInfo[]
  [key: string]: unknown
}

// Index can be either array of modules or object with modules property
type TemplatesIndex = WorkflowTemplates[] | { modules: WorkflowTemplates[] }

interface RawUsageData {
  templateName: string
  count: number
}

interface Config {
  inputPath: string
  uiOrderPath: string | null
  outputDir: string
  dryRun: boolean
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(): Config {
  const args = process.argv.slice(2)
  const config: Config = {
    inputPath: '',
    uiOrderPath: null,
    outputDir: './public/assets',
    dryRun: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--input':
      case '-i':
        config.inputPath = args[++i]
        break
      case '--ui-order':
      case '-u':
        config.uiOrderPath = args[++i]
        break
      case '--output':
      case '-o':
        config.outputDir = args[++i]
        break
      case '--dry-run':
        config.dryRun = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
    }
  }

  if (!config.inputPath) {
    console.error('Error: --input is required')
    printHelp()
    process.exit(1)
  }

  return config
}

function printHelp(): void {
  console.log(`
Usage: pnpm generate:template-scores --input <csv-path> [options]

Options:
  --input, -i      Path to Mixpanel CSV export (required)
  --ui-order, -u   Path to templates index.json (default: fetch from GitHub)
  --output, -o     Output directory (default: ./public/assets)
  --dry-run        Print scores without writing files
  --help, -h       Show this help message

Example:
  pnpm generate:template-scores -i ./mixpanel-export.csv
  pnpm generate:template-scores -i ./data.csv -u ./index.json --dry-run
`)
}

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

function parseCSV(content: string): RawUsageData[] {
  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV must have header row and at least one data row')
  }

  // Detect column layout from header
  const header = lines[0].toLowerCase()
  const headerParts = parseCSVLine(header)

  // Find template name column (workflow_name or template_name)
  let nameColIndex = headerParts.findIndex(
    (h) =>
      h.includes('workflow_name') ||
      h.includes('template_name') ||
      h.includes('templatename')
  )
  // If no name column found, assume first column (simple 2-column format)
  if (nameColIndex === -1) nameColIndex = 0

  const results: RawUsageData[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = parseCSVLine(line)
    if (parts.length < 2) continue

    const templateName = parts[nameColIndex]?.replace(/^["']|["']$/g, '').trim()
    const countStr = parts[parts.length - 1].replace(/^["']|["']$/g, '').trim()
    const count = parseInt(countStr, 10)

    if (templateName && !isNaN(count) && count > 0) {
      results.push({ templateName, count })
    }
  }

  if (results.length === 0) {
    throw new Error('No valid data rows found in CSV')
  }

  console.log(`Parsed ${results.length} templates from CSV`)
  return results
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (const char of line) {
    if (char === '"' && !inQuotes) {
      inQuotes = true
    } else if (char === '"' && inQuotes) {
      inQuotes = false
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

async function loadUIOrder(uiOrderPath: string | null): Promise<string[]> {
  let content: string

  if (uiOrderPath) {
    content = fs.readFileSync(uiOrderPath, 'utf-8')
  } else {
    console.log('Fetching templates index from GitHub...')
    const url =
      'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/index.json'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch index.json: ${response.status}`)
    }
    content = await response.text()
  }

  const parsed = JSON.parse(content)
  // Handle both array format and { modules: [...] } format
  const modules: WorkflowTemplates[] = Array.isArray(parsed)
    ? parsed
    : parsed.modules

  const order: string[] = []
  for (const module of modules) {
    for (const template of module.templates) {
      order.push(template.name)
    }
  }

  console.log(`Loaded ${order.length} templates from UI order`)
  return order
}

// ---------------------------------------------------------------------------
// Score Computation
// ---------------------------------------------------------------------------

function computePositionCorrection(
  position: number,
  maxPosition: number
): number {
  // Linear interpolation: position 1 = 1.0×, position max = 2.0×
  // Buried templates get proportionally stronger boost
  return 1 + (position - 1) / (maxPosition - 1)
}

function computeNormalizedScores(
  rawData: RawUsageData[],
  uiOrder: string[]
): Record<string, number> {
  // Build position lookup
  const positionMap = new Map<string, number>()
  uiOrder.forEach((name, index) => positionMap.set(name, index + 1))

  const maxPosition = uiOrder.length
  const medianPosition = Math.floor(maxPosition / 2)

  // Apply position correction
  const correctedScores: Array<{ name: string; score: number }> = []
  for (const { templateName, count } of rawData) {
    const position = positionMap.get(templateName) ?? medianPosition
    const correction = computePositionCorrection(position, maxPosition)
    correctedScores.push({
      name: templateName,
      score: count * correction
    })
  }

  // Normalize to 0-1
  const maxScore = Math.max(...correctedScores.map((s) => s.score))
  const normalized: Record<string, number> = {}

  for (const { name, score } of correctedScores) {
    // Round to 4 decimal places for cleaner output
    normalized[name] = Math.round((score / maxScore) * 10000) / 10000
  }

  // Sort by score descending
  const sorted = Object.entries(normalized).sort(([, a], [, b]) => b - a)
  return Object.fromEntries(sorted)
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function writeOutput(
  outputDir: string,
  usageScores: Record<string, number>,
  dryRun: boolean
): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const usageScoresPath = path.join(outputDir, 'template-usage-scores.json')

  if (dryRun) {
    console.log('\n--- DRY RUN: Would write to', usageScoresPath, '---')
    const entries = Object.entries(usageScores).slice(0, 20)
    for (const [name, score] of entries) {
      console.log(`  ${name}: ${score}`)
    }
    console.log(`  ... and ${Object.keys(usageScores).length - 20} more`)
    return
  }

  fs.writeFileSync(usageScoresPath, JSON.stringify(usageScores, null, 2))
  console.log(
    `Wrote ${Object.keys(usageScores).length} scores to ${usageScoresPath}`
  )
}

function printSummary(usageScores: Record<string, number>): void {
  const entries = Object.entries(usageScores)
  console.log('\n=== Summary ===')
  console.log(`Total templates scored: ${entries.length}`)
  console.log('\nTop 10 by usage score:')
  entries.slice(0, 10).forEach(([name, score], i) => {
    console.log(`  ${i + 1}. ${name}: ${score}`)
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const config = parseArgs()

  // Load data
  const csvContent = fs.readFileSync(config.inputPath, 'utf-8')
  const rawData = parseCSV(csvContent)
  const uiOrder = await loadUIOrder(config.uiOrderPath)

  // Compute scores
  const usageScores = computeNormalizedScores(rawData, uiOrder)

  // Output
  writeOutput(config.outputDir, usageScores, config.dryRun)
  printSummary(usageScores)

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
