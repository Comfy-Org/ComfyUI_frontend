import { readFile, writeFile, mkdir } from 'fs/promises'
import { readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'
import { extractAllWorkflowText } from './lib/extract/index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SITE_ROOT = path.resolve(__dirname, '..')
const TEMPLATES_ROOT = path.resolve(SITE_ROOT, '..', 'templates')
const OUTPUT_PATH = path.join(SITE_ROOT, 'knowledge/workflow-text/_audit.json')

interface AuditEntry {
  authorNotes: number
  examplePrompts: string[]
  groupTitles: string[]
  customLabels: { type: string; title: string }[]
}

async function main() {
  const files = readdirSync(TEMPLATES_ROOT).filter(
    (f) => f.endsWith('.json') && f !== 'index.json' && !f.startsWith('index.')
  )

  const audit: Record<string, AuditEntry> = {}
  let withNotes = 0
  let withPrompts = 0
  let withGroups = 0
  let withLabels = 0

  for (const file of files) {
    const name = file.replace('.json', '')
    const content = await readFile(path.join(TEMPLATES_ROOT, file), 'utf-8')
    let workflow
    try {
      workflow = JSON.parse(content)
    } catch {
      continue
    }

    const text = extractAllWorkflowText(workflow)

    audit[name] = {
      authorNotes: text.authorNotes.length,
      examplePrompts: text.examplePrompts.map((p) => p.slice(0, 120)),
      groupTitles: text.groupTitles,
      customLabels: text.customNodeLabels.map((l) => ({
        type: l.nodeType,
        title: l.customTitle
      }))
    }

    if (text.authorNotes.length > 0) withNotes++
    if (text.examplePrompts.length > 0) withPrompts++
    if (text.groupTitles.length > 0) withGroups++
    if (text.customNodeLabels.length > 0) withLabels++
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(audit, null, 2))

  console.log(`Audited ${files.length} templates → ${OUTPUT_PATH}`)
  console.log(`  With author notes:  ${withNotes}`)
  console.log(`  With example prompts: ${withPrompts}`)
  console.log(`  With group titles:  ${withGroups}`)
  console.log(`  With custom labels: ${withLabels}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
