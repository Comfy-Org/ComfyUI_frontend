import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

let createCanvas: typeof import('canvas').createCanvas
try {
  const canvasModule = await import('canvas')
  createCanvas = canvasModule.createCanvas
} catch {
  console.warn('⚠ canvas module not available — skipping preview generation')
  process.exit(0)
}

// Parallel processing configuration
const CONCURRENCY = Math.max(1, os.cpus().length - 1)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface WorkflowNode {
  id: number
  type: string
  pos: [number, number]
  size: [number, number]
  bgcolor?: string
}

interface WorkflowLink {
  id: number
  sourceId: number
  sourceSlot: number
  targetId: number
  targetSlot: number
  type: string
}

interface Workflow {
  nodes: WorkflowNode[]
  links: Array<[number, number, number, number, number, string]>
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
}

interface PreviewOptions {
  width: number
  height: number
}

function extractNodes(workflow: Workflow): WorkflowNode[] {
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return []
  }

  return workflow.nodes
    .filter((node) => node.pos && node.size)
    .map((node) => ({
      id: node.id,
      type: node.type,
      pos: node.pos,
      size: node.size,
      bgcolor: node.bgcolor
    }))
}

function extractLinks(workflow: Workflow): WorkflowLink[] {
  if (!workflow.links || !Array.isArray(workflow.links)) {
    return []
  }

  return workflow.links
    .filter((link) => Array.isArray(link) && link.length >= 6)
    .map((link) => ({
      id: link[0],
      sourceId: link[1],
      sourceSlot: link[2],
      targetId: link[3],
      targetSlot: link[4],
      type: link[5]
    }))
}

function calculateBounds(nodes: WorkflowNode[]): Bounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const [x, y] = node.pos
    const [width, height] = node.size

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  }
}

function calculateScale(
  bounds: Bounds,
  canvasWidth: number,
  canvasHeight: number,
  fillFactor: number = 0.85
): number {
  if (bounds.width === 0 || bounds.height === 0) {
    return 1
  }

  const scaleX = (canvasWidth * fillFactor) / bounds.width
  const scaleY = (canvasHeight * fillFactor) / bounds.height

  return Math.min(scaleX, scaleY)
}

async function generateWorkflowPreview(
  workflowPath: string,
  outputPath: string,
  options: PreviewOptions = { width: 500, height: 400 }
): Promise<void> {
  const workflowContent = await readFile(workflowPath, 'utf-8')

  let workflow: Workflow
  try {
    workflow = JSON.parse(workflowContent)
  } catch {
    throw new Error(`Invalid JSON in workflow file: ${workflowPath}`)
  }

  const nodes = extractNodes(workflow)
  const links = extractLinks(workflow)

  const bounds = calculateBounds(nodes)
  const scale = calculateScale(bounds, options.width, options.height, 0.85)

  const canvas = createCanvas(options.width, options.height)
  const ctx = canvas.getContext('2d')

  // Dark background
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, options.width, options.height)

  const offsetX =
    (options.width - bounds.width * scale) / 2 - bounds.minX * scale
  const offsetY =
    (options.height - bounds.height * scale) / 2 - bounds.minY * scale

  // Build node lookup map for O(1) access
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Draw links
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 1
  for (const link of links) {
    const source = nodeMap.get(link.sourceId)
    const target = nodeMap.get(link.targetId)
    if (source && target) {
      const [sx, sy] = source.pos
      const [sw, sh] = source.size
      const [tx, ty] = target.pos
      const [, th] = target.size

      ctx.beginPath()
      ctx.moveTo((sx + sw) * scale + offsetX, (sy + sh / 2) * scale + offsetY)
      ctx.lineTo(tx * scale + offsetX, (ty + th / 2) * scale + offsetY)
      ctx.stroke()
    }
  }

  // Draw nodes
  for (const node of nodes) {
    const [x, y] = node.pos
    const [width, height] = node.size

    ctx.fillStyle = node.bgcolor || '#374151'
    ctx.fillRect(
      x * scale + offsetX,
      y * scale + offsetY,
      width * scale,
      height * scale
    )
  }

  // Save
  const buffer = canvas.toBuffer('image/png')
  await writeFile(outputPath, buffer)
}

async function shouldRegeneratePreview(
  workflowPath: string,
  previewPath: string
): Promise<boolean> {
  if (!existsSync(previewPath)) {
    return true
  }

  const workflowStat = await stat(workflowPath)
  const previewStat = await stat(previewPath)

  return workflowStat.mtime > previewStat.mtime
}

async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  const queue = [...items]

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item !== undefined) {
        results.push(await processor(item))
      }
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker())
  await Promise.all(workers)
  return results
}

async function main(): Promise<void> {
  const startTime = Date.now()
  const { TEMPLATES_DIR } = await import('./lib/paths.js')
  const templatesDir = TEMPLATES_DIR
  const outputDir = path.resolve(__dirname, '../public/previews')

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true })

  // Get all JSON workflow files (exclude index files and non-workflow files)
  const files = await readdir(templatesDir)
  const excludePatterns = ['index', 'fuse_options', 'schema']
  const workflowFiles = files.filter((f) => {
    if (!f.endsWith('.json')) return false
    const name = path.basename(f, '.json')
    return !excludePatterns.some((pattern) => name.startsWith(pattern))
  })

  console.log(`Found ${workflowFiles.length} workflow files`)
  console.log(`Using ${CONCURRENCY} parallel workers`)

  let generated = 0
  let skipped = 0
  let errors = 0

  // Process files in parallel
  await processInParallel(
    workflowFiles,
    async (file) => {
      const name = path.basename(file, '.json')
      const workflowPath = path.join(templatesDir, file)
      const outputPath = path.join(outputDir, `${name}.png`)

      try {
        const needsRegeneration = await shouldRegeneratePreview(
          workflowPath,
          outputPath
        )

        if (!needsRegeneration) {
          skipped++
          return
        }

        await generateWorkflowPreview(workflowPath, outputPath)
        console.log(`[GENERATED] ${name}`)
        generated++
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[ERROR] ${name}: ${message}`)
        errors++
      }
    },
    CONCURRENCY
  )

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\nSummary (${elapsed}s):`)
  console.log(`  Generated: ${generated}`)
  console.log(`  Skipped (cached): ${skipped}`)
  console.log(`  Errors: ${errors}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('Fatal error:', message)
  process.exit(1)
})
