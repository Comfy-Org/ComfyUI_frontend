/**
 * Syncs tutorial content from docs repo to the site knowledge base.
 * Tutorials are used as context for AI content generation.
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Try to find docs repo at common paths
const POSSIBLE_DOCS_PATHS = [
  // Cloned to /tmp for workstream sync
  '/tmp/comfy-docs/tutorials',
  // Worktree setup
  '/home/cbyrne/worktrees/docs/main/tutorials',
  // Adjacent repo setup
  '../../../docs/tutorials',
  '../../docs/tutorials'
]

function findDocsTutorialsDir(): string | null {
  for (const p of POSSIBLE_DOCS_PATHS) {
    if (existsSync(p)) {
      return p
    }
  }
  return null
}

const DOCS_TUTORIALS_DIR = findDocsTutorialsDir()
const KNOWLEDGE_TUTORIALS_DIR = 'knowledge/tutorials'
const KNOWLEDGE_EXAMPLES_DIR = 'knowledge/examples'

interface TutorialMeta {
  title: string
  description: string
  sidebarTitle?: string
  filePath: string
  category: string
  models: string[]
  concepts: string[]
}

function extractFrontmatter(content: string): {
  frontmatter: Record<string, string>
  body: string
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatterLines = match[1].split('\n')
  const frontmatter: Record<string, string> = {}

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      let value = line.slice(colonIndex + 1).trim()
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      frontmatter[key] = value
    }
  }

  return { frontmatter, body: match[2] }
}

function extractModelsFromContent(content: string): string[] {
  const models: Set<string> = new Set()

  const modelPatterns = [
    /flux[.-]?1?[.-]?\w*/gi,
    /wan[.-]?\d*\.?\d*\w*/gi,
    /qwen\w*/gi,
    /sdxl\w*/gi,
    /hunyuan\w*/gi,
    /ltx[v]?\w*/gi,
    /stable\s*diffusion\s*\d*\.?\d*/gi,
    /cosmos\w*/gi,
    /kandinsky\w*/gi
  ]

  for (const pattern of modelPatterns) {
    const matches = content.match(pattern)
    if (matches) {
      for (const match of matches) {
        models.add(match.toLowerCase().replace(/[^a-z0-9]/g, ''))
      }
    }
  }

  return [...models]
}

function extractConceptsFromContent(
  content: string,
  category: string
): string[] {
  const concepts: Set<string> = new Set()
  concepts.add(category)

  const conceptPatterns: Record<string, RegExp> = {
    inpainting: /inpaint/i,
    outpainting: /outpaint/i,
    controlnet: /controlnet/i,
    'text-to-image': /text.?to.?image|t2i/i,
    'image-to-video': /image.?to.?video|i2v/i,
    'text-to-video': /text.?to.?video|t2v/i,
    upscale: /upscal/i,
    img2img: /img2img|image.?to.?image/i,
    lora: /lora/i,
    vae: /\bvae\b/i,
    'voice-cloning': /voice.?clon/i,
    'text-to-speech': /text.?to.?speech|tts/i
  }

  for (const [concept, pattern] of Object.entries(conceptPatterns)) {
    if (pattern.test(content)) {
      concepts.add(concept)
    }
  }

  return [...concepts]
}

async function findTutorialFiles(
  dir: string,
  _category = ''
): Promise<string[]> {
  const files: string[] = []

  if (!existsSync(dir)) return files

  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const subFiles = await findTutorialFiles(fullPath, entry.name)
      files.push(...subFiles)
    } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

function cleanMdxContent(content: string): string {
  const cleaned = content
    .replace(/<a[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/<Note>[\s\S]*?<\/Note>/g, (match) => {
      const text = match.replace(/<\/?Note>/g, '').trim()
      return `> Note: ${text}`
    })
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image: $1]')
    .replace(/\n{3,}/g, '\n\n')

  return cleaned.trim()
}

async function syncTutorials(): Promise<void> {
  console.log('📚 Syncing tutorials from docs repo...\n')

  if (!DOCS_TUTORIALS_DIR) {
    console.log(
      '⏭️  Skipping tutorial sync: docs repo not found at any expected path.'
    )
    console.log(
      '   This is normal in CI. Tutorial knowledge is optional for AI generation.'
    )
    console.log('   Expected paths checked:')
    for (const p of POSSIBLE_DOCS_PATHS) {
      console.log(`   - ${p}`)
    }
    return
  }

  if (!existsSync(DOCS_TUTORIALS_DIR)) {
    console.log(
      '⏭️  Skipping tutorial sync: docs tutorials directory not accessible.'
    )
    return
  }

  await mkdir(KNOWLEDGE_TUTORIALS_DIR, { recursive: true })
  await mkdir(KNOWLEDGE_EXAMPLES_DIR, { recursive: true })

  const tutorialFiles = await findTutorialFiles(DOCS_TUTORIALS_DIR)
  console.log(`Found ${tutorialFiles.length} tutorial files\n`)

  const index: TutorialMeta[] = []
  const modelMentions: Record<string, string[]> = {}

  for (const filePath of tutorialFiles) {
    const relativePath = path.relative(DOCS_TUTORIALS_DIR, filePath)
    const category = path.dirname(relativePath).split('/')[0]
    const baseName = path.basename(filePath, path.extname(filePath))

    try {
      const content = await readFile(filePath, 'utf-8')
      const { frontmatter, body } = extractFrontmatter(content)

      if (!frontmatter.title) {
        console.log(`⏭️  Skipping ${relativePath} (no title)`)
        continue
      }

      const models = extractModelsFromContent(content)
      const concepts = extractConceptsFromContent(content, category)
      const cleanedContent = cleanMdxContent(body)

      const outputFileName = `${category}-${baseName}.md`
      const outputPath = path.join(KNOWLEDGE_TUTORIALS_DIR, outputFileName)

      const tutorialDoc = `# ${frontmatter.title}

${frontmatter.description || ''}

**Category:** ${category}
**Models:** ${models.join(', ') || 'None detected'}
**Concepts:** ${concepts.join(', ')}

---

${cleanedContent}
`

      await writeFile(outputPath, tutorialDoc)
      console.log(`✅ ${relativePath} → ${outputFileName}`)

      for (const model of models) {
        if (!modelMentions[model]) {
          modelMentions[model] = []
        }
        modelMentions[model].push(frontmatter.title)
      }

      index.push({
        title: frontmatter.title,
        description: frontmatter.description || '',
        sidebarTitle: frontmatter.sidebarTitle,
        filePath: outputFileName,
        category,
        models,
        concepts
      })
    } catch (error) {
      console.error(`❌ Error processing ${relativePath}:`, error)
    }
  }

  await writeFile(
    path.join(KNOWLEDGE_TUTORIALS_DIR, '_index.json'),
    JSON.stringify(index, null, 2)
  )

  console.log('\n📊 Model mentions across tutorials:')
  const sortedModels = Object.entries(modelMentions)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)

  for (const [model, tutorials] of sortedModels) {
    console.log(`   ${model}: ${tutorials.length} tutorials`)
  }

  console.log('\n✅ Tutorial sync complete!')
  console.log(`   Total: ${index.length} tutorials synced`)
  console.log(`   Output: ${KNOWLEDGE_TUTORIALS_DIR}/`)
}

syncTutorials().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
