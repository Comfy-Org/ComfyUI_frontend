import { markdownTable } from 'markdown-table'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import prettyBytes from 'pretty-bytes'

import { getCategoryMetadata } from './bundle-categories'
import { bundleSizeSchema } from './bundle-size'
import type { BundleSize, SizeMetrics } from './bundle-size'
import { isMainModule } from './isMainModule'

type BundleStatus =
  | 'added'
  | 'removed'
  | 'increased'
  | 'decreased'
  | 'unchanged'

interface BundleDiff {
  fileName: string
  curr: BundleSize | undefined
  prev: BundleSize | undefined
  diff: SizeMetrics
  status: BundleStatus
}

type CountSummary = Record<BundleStatus, number>

interface MetricsComparison {
  current: SizeMetrics
  baseline: SizeMetrics
  diff: SizeMetrics
}

interface CategoryReport {
  name: string
  description: string | undefined
  order: number
  metrics: MetricsComparison
  counts: CountSummary
  bundles: BundleDiff[]
}

export interface BundleReport {
  categories: CategoryReport[]
  overall: {
    currentBundles: number
    baselineBundles: number
    metrics: MetricsComparison
    counts: CountSummary
  }
  hasBaseline: boolean
}

if (isMainModule(import.meta.url)) {
  const currDir = path.resolve('temp/size')
  if (!existsSync(currDir)) {
    console.error('Error: temp/size directory does not exist')
    console.error('Please run "pnpm size:collect" first')
    process.exit(1)
  }

  const report = await buildBundleReport(
    currDir,
    path.resolve('temp/size-prev')
  )
  process.stdout.write(renderReport(report))
}

export async function buildBundleReport(
  currDir: string,
  prevDir: string
): Promise<BundleReport> {
  const filterFiles = (files: string[]) =>
    files.filter((file) => file.endsWith('.json'))

  const currFiles = filterFiles(await readdir(currDir))
  const baselineFiles = existsSync(prevDir)
    ? filterFiles(await readdir(prevDir))
    : []
  const fileList = new Set([...currFiles, ...baselineFiles])

  const categories = new Map<string, CategoryReport>()

  const overall = {
    currentBundles: 0,
    baselineBundles: 0,
    metrics: {
      current: createMetrics(),
      baseline: createMetrics(),
      diff: createMetrics()
    },
    counts: createCounts()
  }

  for (const file of fileList) {
    const currPath = path.resolve(currDir, file)
    const prevPath = path.resolve(prevDir, file)

    const curr = await readBundleSize(currPath)
    const prev = await readBundleSize(prevPath)
    const fileName = curr?.file || prev?.file
    if (!fileName) continue

    const categoryName = curr?.category || prev?.category || 'Other'
    const category = ensureCategoryEntry(categories, categoryName)

    const currMetrics = toMetrics(curr)
    const baselineMetrics = toMetrics(prev)
    const diffMetrics = subtractMetrics(currMetrics, baselineMetrics)
    const status = getStatus(curr, prev, diffMetrics.size)

    if (curr) {
      overall.currentBundles++
    }
    if (prev) {
      overall.baselineBundles++
    }

    addMetrics(overall.metrics.current, currMetrics)
    addMetrics(overall.metrics.baseline, baselineMetrics)
    addMetrics(overall.metrics.diff, diffMetrics)
    incrementStatus(overall.counts, status)

    addMetrics(category.metrics.current, currMetrics)
    addMetrics(category.metrics.baseline, baselineMetrics)
    addMetrics(category.metrics.diff, diffMetrics)
    incrementStatus(category.counts, status)

    category.bundles.push({
      fileName,
      curr,
      prev,
      diff: diffMetrics,
      status
    })
  }

  const sortedCategories = Array.from(categories.values()).sort(
    (a, b) => a.order - b.order
  )

  return {
    categories: sortedCategories,
    overall,
    hasBaseline: baselineFiles.length > 0
  }
}

export function renderReport(report: BundleReport): string {
  const parts = [renderCompactHeader(report)]

  if (report.categories.length > 0) {
    parts.push('\n' + renderCategoryDetails(report))
  }

  return (
    parts
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n'
  )
}

function renderCompactHeader(report: BundleReport): string {
  const { overall, hasBaseline } = report

  const gzipSize = prettyBytes(overall.metrics.current.gzip)
  let header = `## 📦 Bundle: ${gzipSize} gzip`

  if (hasBaseline) {
    header += ` ${formatDiffIndicator(overall.metrics.diff.gzip)}`
  }

  return header
}

function renderSummary(report: BundleReport): string {
  const { overall, hasBaseline } = report
  const lines = ['**Summary**']

  const rawLineParts = [
    `- Raw size: ${prettyBytes(overall.metrics.current.size)}`
  ]
  if (hasBaseline) {
    rawLineParts.push(`baseline ${prettyBytes(overall.metrics.baseline.size)}`)
    rawLineParts.push(`— ${formatDiffIndicator(overall.metrics.diff.size)}`)
  }
  lines.push(rawLineParts.join(' '))

  const gzipLineParts = [`- Gzip: ${prettyBytes(overall.metrics.current.gzip)}`]
  if (hasBaseline) {
    gzipLineParts.push(`baseline ${prettyBytes(overall.metrics.baseline.gzip)}`)
    gzipLineParts.push(`— ${formatDiffIndicator(overall.metrics.diff.gzip)}`)
  }
  lines.push(gzipLineParts.join(' '))

  const brotliLineParts = [
    `- Brotli: ${prettyBytes(overall.metrics.current.brotli)}`
  ]
  if (hasBaseline) {
    brotliLineParts.push(
      `baseline ${prettyBytes(overall.metrics.baseline.brotli)}`
    )
    brotliLineParts.push(
      `— ${formatDiffIndicator(overall.metrics.diff.brotli)}`
    )
  }
  lines.push(brotliLineParts.join(' '))

  const bundleStats = [`${overall.currentBundles} current`]
  if (hasBaseline) {
    bundleStats.push(`${overall.baselineBundles} baseline`)
  }

  const statusParts: string[] = []
  if (overall.counts.added) statusParts.push(`${overall.counts.added} added`)
  if (overall.counts.removed)
    statusParts.push(`${overall.counts.removed} removed`)
  if (overall.counts.increased)
    statusParts.push(`${overall.counts.increased} grew`)
  if (overall.counts.decreased)
    statusParts.push(`${overall.counts.decreased} shrank`)

  let bundlesLine = `- Bundles: ${bundleStats.join(' • ')}`
  if (statusParts.length > 0) {
    bundlesLine += ` • ${statusParts.join(' / ')}`
  }
  lines.push(bundlesLine)

  if (!hasBaseline) {
    lines.push(
      '_Baseline artifact not found; showing current bundle sizes only._'
    )
  }

  return lines.join('\n')
}

function renderCategoryGlance(report: BundleReport): string {
  const { categories, hasBaseline } = report
  const relevant = categories.filter(
    (category) =>
      category.metrics.current.size > 0 ||
      (hasBaseline && category.metrics.baseline.size > 0)
  )

  if (relevant.length === 0) return ''

  const sorted = relevant.slice().sort((a, b) => {
    if (hasBaseline) {
      return (
        Math.abs(b.metrics.diff.size) - Math.abs(a.metrics.diff.size) ||
        b.metrics.current.size - a.metrics.current.size
      )
    }
    return b.metrics.current.size - a.metrics.current.size
  })

  const limit = 6
  const trimmed = sorted.slice(0, limit)
  const parts = trimmed.map((category) => {
    const currentStr = prettyBytes(category.metrics.current.size)
    if (hasBaseline) {
      return `${category.name} ${formatDiffIndicator(category.metrics.diff.size)} (${currentStr})`
    }
    return `${category.name} ${currentStr}`
  })

  if (sorted.length > limit) {
    parts.push(`+ ${sorted.length - limit} more`)
  }

  return `**Category Glance**\n${parts.join(' · ')}`
}

function renderCategoryDetails(report: BundleReport): string {
  const lines = ['<details>', '<summary>Details</summary>', '']

  lines.push(renderSummary(report))
  lines.push('')

  const glance = renderCategoryGlance(report)
  if (glance) {
    lines.push(glance)
    lines.push('')
  }

  for (const category of report.categories) {
    lines.push(renderCategoryBlock(category, report.hasBaseline))
    lines.push('')
  }

  if (report.categories.length > 0) {
    lines.pop()
  }

  lines.push('</details>')
  return lines.join('\n')
}

function renderCategoryBlock(
  category: CategoryReport,
  hasBaseline: boolean
): string {
  const lines = ['<details>']
  const currentStr = prettyBytes(category.metrics.current.size)
  const summaryParts = [`<summary>${category.name} — ${currentStr}`]

  if (hasBaseline) {
    summaryParts.push(
      ` (baseline ${prettyBytes(category.metrics.baseline.size)}) • ${formatDiffIndicator(category.metrics.diff.size)}`
    )
  }

  summaryParts.push('</summary>')
  lines.push(summaryParts.join(''))
  lines.push('')

  if (category.description) {
    lines.push(`_${category.description}_`)
    lines.push('')
  }

  if (category.bundles.length === 0) {
    lines.push('No bundles matched this category.\n')
    lines.push('</details>\n')
    return lines.join('\n')
  }

  const headers = hasBaseline
    ? ['File', 'Before', 'After', 'Δ Raw', 'Δ Gzip', 'Δ Brotli']
    : ['File', 'Size', 'Gzip', 'Brotli']

  // Filter out unchanged bundles to keep report within GitHub's 65k char limit
  const changedBundles = category.bundles.filter(
    (b) => b.status !== 'unchanged'
  )
  const unchangedCount = category.bundles.length - changedBundles.length

  const rows = changedBundles
    .slice()
    .sort((a, b) => {
      const diffMagnitude = Math.abs(b.diff.size) - Math.abs(a.diff.size)
      if (diffMagnitude !== 0) return diffMagnitude
      return a.fileName.localeCompare(b.fileName)
    })
    .map((bundle) => {
      if (hasBaseline) {
        return [
          formatFileLabel(bundle),
          formatSize(bundle.prev?.size),
          formatSize(bundle.curr?.size),
          formatDiffIndicator(bundle.diff.size),
          formatDiffIndicator(bundle.diff.gzip),
          formatDiffIndicator(bundle.diff.brotli)
        ]
      }

      return [
        formatFileLabel(bundle),
        formatSize(bundle.curr?.size),
        formatSize(bundle.curr?.gzip),
        formatSize(bundle.curr?.brotli)
      ]
    })

  if (rows.length > 0) {
    lines.push(markdownTable([headers, ...rows]))
    lines.push('')
  }

  const statusParts: string[] = []
  if (category.counts.added) statusParts.push(`${category.counts.added} added`)
  if (category.counts.removed)
    statusParts.push(`${category.counts.removed} removed`)
  if (category.counts.increased)
    statusParts.push(`${category.counts.increased} grew`)
  if (category.counts.decreased)
    statusParts.push(`${category.counts.decreased} shrank`)
  if (unchangedCount > 0) statusParts.push(`${unchangedCount} unchanged`)

  if (statusParts.length > 0) {
    lines.push(`_Status:_ ${statusParts.join(' / ')}`)
    lines.push('')
  }

  lines.push('</details>')
  return lines.join('\n')
}

function ensureCategoryEntry(
  categories: Map<string, CategoryReport>,
  categoryName: string
): CategoryReport {
  const existing = categories.get(categoryName)
  if (existing) return existing

  const meta = getCategoryMetadata(categoryName)
  const created: CategoryReport = {
    name: categoryName,
    description: meta?.description,
    order: meta?.order ?? 99,
    metrics: {
      current: createMetrics(),
      baseline: createMetrics(),
      diff: createMetrics()
    },
    counts: createCounts(),
    bundles: []
  }
  categories.set(categoryName, created)
  return created
}

function toMetrics(bundle: BundleSize | undefined): SizeMetrics {
  if (!bundle) return createMetrics()
  return {
    size: bundle.size,
    gzip: bundle.gzip,
    brotli: bundle.brotli
  }
}

function createMetrics(): SizeMetrics {
  return { size: 0, gzip: 0, brotli: 0 }
}

function addMetrics(target: SizeMetrics, source: SizeMetrics) {
  target.size += source.size
  target.gzip += source.gzip
  target.brotli += source.brotli
}

function subtractMetrics(
  current: SizeMetrics,
  baseline: SizeMetrics
): SizeMetrics {
  return {
    size: current.size - baseline.size,
    gzip: current.gzip - baseline.gzip,
    brotli: current.brotli - baseline.brotli
  }
}

function createCounts(): CountSummary {
  return { added: 0, removed: 0, increased: 0, decreased: 0, unchanged: 0 }
}

function incrementStatus(counts: CountSummary, status: BundleStatus) {
  counts[status] += 1
}

function getStatus(
  curr: BundleSize | undefined,
  prev: BundleSize | undefined,
  sizeDiff: number
): BundleStatus {
  if (curr && prev) {
    if (sizeDiff > 0) return 'increased'
    if (sizeDiff < 0) return 'decreased'
    return 'unchanged'
  }
  if (curr && !prev) return 'added'
  if (!curr && prev) return 'removed'
  return 'unchanged'
}

function formatFileLabel(bundle: BundleDiff): string {
  if (bundle.status === 'added') {
    return `**${bundle.fileName}** _(new)_`
  }
  if (bundle.status === 'removed') {
    return `~~${bundle.fileName}~~ _(removed)_`
  }
  return bundle.fileName
}

function formatSize(value: number | undefined): string {
  if (value === undefined) return '—'
  return prettyBytes(value)
}

function formatDiffIndicator(diff: number): string {
  if (diff > 0) {
    return `:red_circle: +${prettyBytes(diff)}`
  }
  if (diff < 0) {
    return `:green_circle: -${prettyBytes(Math.abs(diff))}`
  }
  return ':white_circle: 0 B'
}

async function readBundleSize(
  filePath: string
): Promise<BundleSize | undefined> {
  if (!existsSync(filePath)) return undefined
  return bundleSizeSchema.parse(JSON.parse(await readFile(filePath, 'utf-8')))
}
