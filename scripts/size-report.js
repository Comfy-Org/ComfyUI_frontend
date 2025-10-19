// @ts-check
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { markdownTable } from 'markdown-table'
import prettyBytes from 'pretty-bytes'

import { getCategoryMetadata } from './bundle-categories.js'

/**
 * @typedef {Object} SizeResult
 * @property {number} size
 * @property {number} gzip
 * @property {number} brotli
 */

/**
 * @typedef {SizeResult & { file: string, category?: string }} BundleResult
 */

const currDir = path.resolve('temp/size')
const prevDir = path.resolve('temp/size-prev')
let output = '## Bundle Size Report\n\n'
const sizeHeaders = ['Size', 'Gzip', 'Brotli']

run()

/**
 * Main function to generate the size report
 */
async function run() {
  if (!existsSync(currDir)) {
    console.error('Error: temp/size directory does not exist')
    console.error('Please run "pnpm size:collect" first')
    process.exit(1)
  }

  await renderFiles()
  process.stdout.write(output)
}

/**
 * Renders file sizes and diffs between current and previous versions
 */
async function renderFiles() {
  /**
   * @param {string[]} files
   * @returns {string[]}
   */
  const filterFiles = (files) => files.filter((file) => file.endsWith('.json'))

  const curr = filterFiles(await readdir(currDir))
  const prev = existsSync(prevDir) ? filterFiles(await readdir(prevDir)) : []
  const fileList = new Set([...curr, ...prev])

  // Group bundles by category
  /** @type {Map<string, Array<{fileName: string, curr: BundleResult | undefined, prev: BundleResult | undefined}>>} */
  const bundlesByCategory = new Map()

  for (const file of fileList) {
    const currPath = path.resolve(currDir, file)
    const prevPath = path.resolve(prevDir, file)

    const curr = await importJSON(currPath)
    const prev = await importJSON(prevPath)
    const fileName = curr?.file || prev?.file || ''
    const category = curr?.category || prev?.category || 'Other'

    if (!bundlesByCategory.has(category)) {
      bundlesByCategory.set(category, [])
    }

    // @ts-expect-error - get is valid
    bundlesByCategory.get(category).push({ fileName, curr, prev })
  }

  // Sort categories by their order
  const sortedCategories = Array.from(bundlesByCategory.keys()).sort((a, b) => {
    const metaA = getCategoryMetadata(a)
    const metaB = getCategoryMetadata(b)
    return (metaA?.order ?? 99) - (metaB?.order ?? 99)
  })

  let totalSize = 0
  let totalCount = 0

  // Render each category
  for (const category of sortedCategories) {
    const bundles = bundlesByCategory.get(category) || []
    if (bundles.length === 0) continue

    const categoryMeta = getCategoryMetadata(category)
    output += `### ${category}\n\n`
    if (categoryMeta?.description) {
      output += `_${categoryMeta.description}_\n\n`
    }

    const rows = []
    let categorySize = 0

    for (const { fileName, curr, prev } of bundles) {
      if (!curr) {
        // File was deleted
        rows.push([`~~${fileName}~~`])
      } else {
        rows.push([
          fileName,
          `${prettyBytes(curr.size)}${getDiff(curr.size, prev?.size)}`,
          `${prettyBytes(curr.gzip)}${getDiff(curr.gzip, prev?.gzip)}`,
          `${prettyBytes(curr.brotli)}${getDiff(curr.brotli, prev?.brotli)}`
        ])
        categorySize += curr.size
        totalSize += curr.size
        totalCount++
      }
    }

    // Sort rows by file name within category
    rows.sort((a, b) => {
      const fileA = a[0].replace(/~~/g, '')
      const fileB = b[0].replace(/~~/g, '')
      return fileA.localeCompare(fileB)
    })

    output += markdownTable([['File', ...sizeHeaders], ...rows])
    output += `\n\n**Category Total:** ${prettyBytes(categorySize)}\n\n`
  }

  // Add overall summary
  if (totalCount > 0) {
    output += '---\n\n'
    output += `**Overall Total Size:** ${prettyBytes(totalSize)}\n`
    output += `**Total Bundle Count:** ${totalCount}\n`
  }
}

/**
 * Imports JSON data from a specified path
 *
 * @template T
 * @param {string} filePath - Path to the JSON file
 * @returns {Promise<T | undefined>} The JSON content or undefined if the file does not exist
 */
async function importJSON(filePath) {
  if (!existsSync(filePath)) return undefined
  return (await import(filePath, { with: { type: 'json' } })).default
}

/**
 * Calculates the difference between the current and previous sizes
 *
 * @param {number} curr - The current size
 * @param {number} [prev] - The previous size
 * @returns {string} The difference in pretty format
 */
function getDiff(curr, prev) {
  if (prev === undefined) return ''
  const diff = curr - prev
  if (diff === 0) return ''
  const sign = diff > 0 ? '+' : ''
  return ` (**${sign}${prettyBytes(diff)}**)`
}
