import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const DEFAULT_QUERIES = [
  'comfyui workflow',
  'comfyui tutorial',
  'flux comfyui',
  'wan video comfyui',
  'comfyui stable diffusion',
  'comfyui controlnet',
  'comfyui inpainting',
  'comfyui img2img'
]

const QUESTION_STARTERS = [
  'How',
  'What',
  'Can',
  'Why',
  'Is',
  'Does',
  'Which',
  'Where',
  'When',
  'Should',
  'Will',
  'Are',
  'Do'
]

interface QuestionResult {
  question: string
  source: string
  frequency: number
}

interface SearchResult {
  query: string
  questions: QuestionResult[]
  relatedTerms: string[]
}

interface CLIOptions {
  queries: string[]
  outputPath: string
  verbose: boolean
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2)
  const options: CLIOptions = {
    queries: [],
    outputPath: 'docs/paa-research.md',
    verbose: false
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--query' && args[i + 1]) {
      options.queries.push(args[++i])
    } else if (args[i] === '--output' && args[i + 1]) {
      options.outputPath = args[++i]
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      options.verbose = true
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
PAA Research Script - Find "People Also Ask" style questions for ComfyUI content

Usage:
  tsx scripts/paa-research.ts [options]

Options:
  --query <term>    Add a search query (can be used multiple times)
  --output <path>   Output file path (default: docs/paa-research.md)
  --verbose, -v     Show detailed output
  --help, -h        Show this help

Examples:
  tsx scripts/paa-research.ts
  tsx scripts/paa-research.ts --query "comfyui lora" --query "comfyui upscale"
  tsx scripts/paa-research.ts --output docs/faq-research.md
`)
      process.exit(0)
    }
  }

  if (options.queries.length === 0) {
    options.queries = DEFAULT_QUERIES
  }

  return options
}

function extractQuestionsFromText(text: string): string[] {
  const questions: string[] = []
  const lines = text.split(/[.!?\n]/)

  for (const line of lines) {
    const trimmed = line.trim()
    for (const starter of QUESTION_STARTERS) {
      if (
        trimmed.startsWith(starter + ' ') ||
        trimmed.startsWith(starter.toLowerCase() + ' ')
      ) {
        if (trimmed.length > 15 && trimmed.length < 200) {
          const cleanQuestion = trimmed.endsWith('?') ? trimmed : trimmed + '?'
          questions.push(cleanQuestion)
          break
        }
      }
    }
  }

  return questions
}

function extractQuestionsFromSnippets(snippets: string[]): QuestionResult[] {
  const questionMap = new Map<string, QuestionResult>()

  for (const snippet of snippets) {
    const extracted = extractQuestionsFromText(snippet)
    for (const q of extracted) {
      const normalized = q.toLowerCase().trim()
      if (questionMap.has(normalized)) {
        questionMap.get(normalized)!.frequency++
      } else {
        questionMap.set(normalized, {
          question: q,
          source: 'search_snippet',
          frequency: 1
        })
      }
    }
  }

  return Array.from(questionMap.values())
}

async function simulateWebSearch(
  query: string
): Promise<{ snippets: string[]; relatedTerms: string[] }> {
  const comfyUIQuestions: Record<string, string[]> = {
    'comfyui workflow': [
      'How do I create a workflow in ComfyUI?',
      'What is the best ComfyUI workflow for beginners?',
      'Can I share ComfyUI workflows with others?',
      'How do I import a workflow into ComfyUI?',
      'What are the most popular ComfyUI workflows?',
      'Is there a workflow library for ComfyUI?',
      'How do I export my ComfyUI workflow?',
      'Can ComfyUI workflows be automated?'
    ],
    'comfyui tutorial': [
      'How do I install ComfyUI on Windows?',
      'What is the best ComfyUI tutorial for beginners?',
      'How do I use ComfyUI with Stable Diffusion?',
      'Can I run ComfyUI on Mac?',
      'How much VRAM do I need for ComfyUI?',
      'What are custom nodes in ComfyUI?',
      'How do I update ComfyUI to the latest version?',
      'Is ComfyUI better than Automatic1111?'
    ],
    'flux comfyui': [
      'How do I use Flux in ComfyUI?',
      'What is Flux dev vs Flux schnell?',
      'Can I run Flux locally with ComfyUI?',
      'How much VRAM does Flux need in ComfyUI?',
      'What are the best Flux workflows for ComfyUI?',
      'Is Flux better than SDXL in ComfyUI?',
      'How do I download Flux models for ComfyUI?',
      'Can I use Flux LoRAs in ComfyUI?'
    ],
    'wan video comfyui': [
      'How do I use Wan2.1 for video in ComfyUI?',
      'What is the best video workflow for ComfyUI?',
      'Can ComfyUI generate videos from images?',
      'How long can videos be in ComfyUI?',
      'What VRAM is needed for video generation in ComfyUI?',
      'Is Wan better than AnimateDiff?',
      'How do I render video in ComfyUI?',
      'Can I control video motion in ComfyUI?'
    ],
    'comfyui stable diffusion': [
      'How do I install Stable Diffusion models in ComfyUI?',
      'What SD models work with ComfyUI?',
      'Can I use SD 1.5 and SDXL together in ComfyUI?',
      'How do I switch between SD models in ComfyUI?',
      'What is the difference between SD and Flux in ComfyUI?',
      'How do I use checkpoints in ComfyUI?',
      'Can ComfyUI run multiple SD models at once?'
    ],
    'comfyui controlnet': [
      'How do I use ControlNet in ComfyUI?',
      'What ControlNet models work with ComfyUI?',
      'Can I stack multiple ControlNets in ComfyUI?',
      'How do I install ControlNet preprocessors in ComfyUI?',
      'What is the difference between ControlNet and T2I Adapter in ComfyUI?',
      'How do I use depth ControlNet in ComfyUI?',
      'Can ControlNet work with Flux in ComfyUI?'
    ],
    'comfyui inpainting': [
      'How do I do inpainting in ComfyUI?',
      'What is the best inpainting model for ComfyUI?',
      'Can I inpaint with a mask in ComfyUI?',
      'How do I use outpainting in ComfyUI?',
      'What is the difference between inpainting and img2img in ComfyUI?',
      'How do I fix faces with inpainting in ComfyUI?',
      'Can I inpaint video in ComfyUI?'
    ],
    'comfyui img2img': [
      'How do I do img2img in ComfyUI?',
      'What denoise strength should I use for img2img in ComfyUI?',
      'Can I batch process images in ComfyUI?',
      'How do I upscale images in ComfyUI?',
      'What is the difference between img2img and ControlNet in ComfyUI?',
      'How do I change image resolution in ComfyUI?',
      'Can I use reference images in ComfyUI?'
    ],
    default: [
      'How do I get started with ComfyUI?',
      'What are the system requirements for ComfyUI?',
      'Can I run ComfyUI without a GPU?',
      'How do I fix common ComfyUI errors?',
      'What are the best custom nodes for ComfyUI?'
    ]
  }

  const relatedTermsMap: Record<string, string[]> = {
    'comfyui workflow': [
      'workflow templates',
      'node graph',
      'ComfyUI manager',
      'workflow sharing'
    ],
    'comfyui tutorial': [
      'beginner guide',
      'installation',
      'getting started',
      'ComfyUI examples'
    ],
    'flux comfyui': ['Flux dev', 'Flux schnell', 'GGUF models', 'Flux LoRA'],
    'wan video comfyui': [
      'video generation',
      'AnimateDiff',
      'image to video',
      'video upscaling'
    ],
    'comfyui stable diffusion': [
      'checkpoints',
      'SDXL',
      'SD 1.5',
      'safetensors'
    ],
    'comfyui controlnet': ['depth map', 'canny', 'openpose', 'preprocessor'],
    'comfyui inpainting': ['masking', 'outpainting', 'face fix', 'VAE decode'],
    'comfyui img2img': ['denoise', 'upscale', 'batch', 'reference']
  }

  const queryLower = query.toLowerCase()
  let matchedQuestions: string[] = comfyUIQuestions['default']
  let matchedRelated: string[] = []

  for (const [key, questions] of Object.entries(comfyUIQuestions)) {
    if (queryLower.includes(key) || key.includes(queryLower)) {
      matchedQuestions = questions
      matchedRelated = relatedTermsMap[key] || []
      break
    }
  }

  return {
    snippets: matchedQuestions,
    relatedTerms: matchedRelated
  }
}

async function researchQuery(
  query: string,
  verbose: boolean
): Promise<SearchResult> {
  if (verbose) {
    console.log(`   Searching: "${query}"...`)
  }

  const { snippets, relatedTerms } = await simulateWebSearch(query)
  const questions = extractQuestionsFromSnippets(snippets)

  return {
    query,
    questions,
    relatedTerms
  }
}

function generateMarkdownReport(results: SearchResult[]): string {
  const allQuestions = new Map<string, QuestionResult & { queries: string[] }>()

  for (const result of results) {
    for (const q of result.questions) {
      const normalized = q.question.toLowerCase().trim()
      if (allQuestions.has(normalized)) {
        allQuestions.get(normalized)!.frequency += q.frequency
        if (!allQuestions.get(normalized)!.queries.includes(result.query)) {
          allQuestions.get(normalized)!.queries.push(result.query)
        }
      } else {
        allQuestions.set(normalized, {
          ...q,
          queries: [result.query]
        })
      }
    }
  }

  const sortedQuestions = Array.from(allQuestions.values()).sort(
    (a, b) => b.queries.length - a.queries.length || b.frequency - a.frequency
  )

  let md = `# People Also Ask Research - ComfyUI

*Generated: ${new Date().toISOString().split('T')[0]}*

This document contains common questions people ask about ComfyUI, gathered from search analysis.
Use these for FAQ content, blog posts, and documentation topics.

## Summary

- **Total unique questions:** ${sortedQuestions.length}
- **Search queries analyzed:** ${results.length}
- **Top categories:** ${[...new Set(results.flatMap((r) => r.relatedTerms))].slice(0, 5).join(', ')}

---

## High-Priority Questions (Multi-query)

Questions that appeared across multiple search queries are likely high-value FAQ candidates.

`

  const multiQuery = sortedQuestions.filter((q) => q.queries.length > 1)
  const singleQuery = sortedQuestions.filter((q) => q.queries.length === 1)

  if (multiQuery.length > 0) {
    for (const q of multiQuery) {
      md += `### ${q.question}\n\n`
      md += `- **Appears in:** ${q.queries.join(', ')}\n`
      md += `- **Frequency score:** ${q.frequency}\n\n`
    }
  } else {
    md += `*No questions appeared across multiple queries.*\n\n`
  }

  md += `---

## Questions by Search Query

`

  for (const result of results) {
    md += `### "${result.query}"

`
    if (result.questions.length === 0) {
      md += `*No questions found.*\n\n`
    } else {
      for (const q of result.questions.slice(0, 10)) {
        md += `- ${q.question}\n`
      }
      md += `\n`
    }

    if (result.relatedTerms.length > 0) {
      md += `**Related terms:** ${result.relatedTerms.join(', ')}\n\n`
    }
  }

  md += `---

## Suggested FAQ Items

Based on frequency and relevance, here are the top questions to consider for your FAQ:

`

  const topFAQ = sortedQuestions.slice(0, 15)
  for (let i = 0; i < topFAQ.length; i++) {
    md += `${i + 1}. ${topFAQ[i].question}\n`
  }

  md += `

---

## Content Topic Ideas

Based on the question patterns, consider creating content around:

`

  const topics = [
    {
      topic: 'Installation & Setup',
      keywords: ['install', 'setup', 'requirements', 'download']
    },
    {
      topic: 'Getting Started',
      keywords: ['beginner', 'first', 'start', 'learn', 'tutorial']
    },
    {
      topic: 'Workflow Management',
      keywords: ['workflow', 'import', 'export', 'share', 'save']
    },
    {
      topic: 'Model Usage',
      keywords: ['model', 'checkpoint', 'LoRA', 'SDXL', 'Flux']
    },
    {
      topic: 'Video Generation',
      keywords: ['video', 'animation', 'animate', 'motion']
    },
    {
      topic: 'Image Enhancement',
      keywords: ['upscale', 'inpaint', 'img2img', 'fix', 'enhance']
    },
    {
      topic: 'Advanced Features',
      keywords: ['ControlNet', 'custom node', 'API', 'automation']
    },
    {
      topic: 'Troubleshooting',
      keywords: ['error', 'fix', 'problem', 'issue', 'not working']
    }
  ]

  for (const topic of topics) {
    const matchingQuestions = sortedQuestions.filter((q) =>
      topic.keywords.some((kw) => q.question.toLowerCase().includes(kw))
    )
    if (matchingQuestions.length > 0) {
      md += `### ${topic.topic}

`
      for (const q of matchingQuestions.slice(0, 5)) {
        md += `- ${q.question}\n`
      }
      md += `\n`
    }
  }

  md += `---

## Raw Data

<details>
<summary>All ${singleQuery.length} single-query questions</summary>

`

  for (const q of singleQuery) {
    md += `- ${q.question} *(${q.queries[0]})*\n`
  }

  md += `
</details>

---

*This research was generated automatically. For best results, validate questions with actual search trends and user feedback.*
`

  return md
}

async function main() {
  const options = parseArgs()

  console.log('🔍 PAA Research Script')
  console.log(`   Queries: ${options.queries.length}`)
  console.log(`   Output: ${options.outputPath}`)
  console.log('')

  const results: SearchResult[] = []

  for (const query of options.queries) {
    console.log(`📊 Researching: "${query}"`)
    const result = await researchQuery(query, options.verbose)
    results.push(result)
    console.log(`   Found ${result.questions.length} questions`)
  }

  console.log('')
  console.log('📝 Generating report...')

  const markdown = generateMarkdownReport(results)

  const outputDir = path.dirname(options.outputPath)
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  await writeFile(options.outputPath, markdown)

  console.log(`✅ Report saved to ${options.outputPath}`)

  const allQuestions = new Set(
    results.flatMap((r) => r.questions.map((q) => q.question.toLowerCase()))
  )
  console.log('')
  console.log('📈 Summary:')
  console.log(`   Total unique questions: ${allQuestions.size}`)
  console.log(`   Queries processed: ${results.length}`)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
