import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORKFLOW_TEMPLATES_BASE =
  'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates'

const TEMPLATES_DIR = fileURLToPath(
  new URL('../../../../workflow_templates/templates', import.meta.url)
)

const QUANT_SUFFIXES = [
  '_fp8_e4m3fn_scaled',
  '_fp8_e4m3fn',
  '_fp8_scaled',
  '_fp4_mixed',
  '_fp8mixed',
  '_fp8',
  '_fp16',
  '_fp4',
  '_bf16',
  '_int8'
]

interface ModelData {
  url: string
  directory: string
  templates: Set<string>
  firstTemplate?: string
}

interface OutputModel {
  slug: string
  name: string
  huggingFaceUrl: string
  directory: string
  workflowCount: number
  displayName: string
  docsUrl?: string
  thumbnailUrl?: string
  canonicalSlug?: string
}

// Maps api_*.json filename prefix to a canonical display name and slug.
// Add entries here as new partner integrations land in workflow_templates.
export const API_PROVIDER_MAP: Record<string, { name: string; slug: string }> =
  {
    nano: { name: 'Nano Banana', slug: 'nano-banana' },
    kling: { name: 'Kling AI', slug: 'kling-ai' },
    kling2: { name: 'Kling AI', slug: 'kling-ai' },
    meshy: { name: 'Meshy AI', slug: 'meshy-ai' },
    meshy7: { name: 'Meshy 7', slug: 'meshy-7' },
    luma: { name: 'Luma Dream Machine', slug: 'luma-dream-machine' },
    runway: { name: 'Runway', slug: 'runway' },
    vidu: { name: 'Vidu', slug: 'vidu' },
    bfl: { name: 'Flux (API)', slug: 'flux-api' },
    grok: { name: 'Grok Imagine', slug: 'grok-imagine' },
    stability: { name: 'Stability AI', slug: 'stability-ai' },
    bytedance: { name: 'Seedance (ByteDance)', slug: 'seedance-bytedance' },
    bytedace: { name: 'Seedance (ByteDance)', slug: 'seedance-bytedance' },
    google: { name: 'Gemini Image', slug: 'gemini-image' },
    hailuo: { name: 'Hailuo MiniMax', slug: 'hailuo-minimax' },
    ideogram: { name: 'Ideogram', slug: 'ideogram' },
    pixverse: { name: 'Pixverse', slug: 'pixverse' },
    rodin: { name: 'Rodin 3D', slug: 'rodin-3d' },
    magnific: { name: 'Magnific AI', slug: 'magnific-ai' },
    bria: { name: 'Bria AI', slug: 'bria-ai' },
    tripo: { name: 'Tripo 3D', slug: 'tripo-3d' },
    tripo3: { name: 'Tripo 3D', slug: 'tripo-3d' },
    hunyuan3d: { name: 'Hunyuan 3D', slug: 'hunyuan-3d' },
    recraft: { name: 'Recraft', slug: 'recraft' },
    topaz: { name: 'Topaz Labs', slug: 'topaz-labs' },
    moonvalley: { name: 'Moonvalley', slug: 'moonvalley' },
    ltxv: { name: 'LTX Video (API)', slug: 'ltxv-api' },
    openai: { name: 'OpenAI DALL-E', slug: 'openai-dall-e' },
    wan: { name: 'Wan (API)', slug: 'wan-api' },
    wan2: { name: 'Wan (API)', slug: 'wan-api' },
    veo2: { name: 'Veo 2', slug: 'veo-2' },
    veo3: { name: 'Veo 3', slug: 'veo-3' },
    flux2: { name: 'Flux 2 (API)', slug: 'flux-2-api' },
    wavespeed: { name: 'Wavespeed', slug: 'wavespeed' },
    wavespped: { name: 'Wavespeed', slug: 'wavespeed' },
    wan2_1: { name: 'Wan 2.1', slug: 'wan2-1' },
    z_image_turbo: { name: 'Z Image Turbo', slug: 'z-image-turbo' },
    wan2_2: { name: 'Wan 2.2', slug: 'wan2-2' },
    gemini3_pro_image_preview: {
      name: 'Gemini 3 Pro Image Preview',
      slug: 'gemini3-pro-image-preview'
    },
    ltx2_3: { name: 'LTX 2.3', slug: 'ltx-2-3' },
    flux_1: { name: 'Flux 1', slug: 'flux-1' },
    nano_banana_2: { name: 'Nano Banana 2', slug: 'nano-banana-2' },
    kling_3_0: { name: 'Kling 3.0', slug: 'kling-3-0' },
    seedance2_0: { name: 'Seedance 2.0', slug: 'seedance-2-0' },
    flux2_klein: { name: 'Flux 2 Klein', slug: 'flux-2-klein' },
    kling_o3: { name: 'Kling O3', slug: 'kling-o3' },
    sdxl: { name: 'SDXL', slug: 'sdxl' },
    flux_1_kontext: { name: 'Flux 1 Kontext', slug: 'flux-1-kontext' },
    wan2_2_animate: { name: 'Wan 2.2 Animate', slug: 'wan2-2-animate' },
    kling_o1: { name: 'Kling O1', slug: 'kling-o1' },
    flux2_dev: { name: 'Flux 2 Dev', slug: 'flux-2-dev' },
    sd1_5: { name: 'SD 1.5', slug: 'sd1-5' },
    sd3_5: { name: 'SD 3.5', slug: 'sd3-5' },
    kling2_6: { name: 'Kling 2.6', slug: 'kling-2-6' },
    gpt_image_1: { name: 'GPT Image 1', slug: 'gpt-image-1' },
    wan2_7: { name: 'Wan 2.7', slug: 'wan2-7' },
    wan3_0: { name: 'Wan 3.0', slug: 'wan-3-0' },
    seedance1_0_pro: { name: 'Seedance 1.0 Pro', slug: 'seedance1-0-pro' },
    kling1_6: { name: 'Kling 1.6', slug: 'kling-1-6' },
    wan2_1_vace: { name: 'Wan 2.1 Vace', slug: 'wan2-1-vace' },
    wan2_6: { name: 'Wan 2.6', slug: 'wan2-6' },
    wan2_5: { name: 'Wan 2.5', slug: 'wan2-5' },
    qwen_image_layered: {
      name: 'Qwen Image Layered',
      slug: 'qwen-image-layered'
    },
    wan_ati: { name: 'Wan ATI', slug: 'wan-ati' },
    ltx_0_9_5: { name: 'LTX 0.9.5', slug: 'ltx-0-9-5' },
    qwen_image_2512: { name: 'Qwen Image 2512', slug: 'qwen-image-2512' },
    wan2_1_infinitetalk: {
      name: 'Wan 2.1 InfiniteTalk',
      slug: 'wan2-1-infinitetalk'
    },
    gpt_image_1_5: { name: 'GPT Image 1.5', slug: 'gpt-image-1-5' },
    seedream_5_0_lite: { name: 'Seedream 5.0 Lite', slug: 'seedream-5-0-lite' },
    wan2_1_scail: { name: 'Wan 2.1 Scail', slug: 'wan2-1-scail' },
    seedream_4_0: { name: 'Seedream 4.0', slug: 'seedream-4-0' },
    seedance1_5_pro: { name: 'Seedance 1.5 Pro', slug: 'seedance-1-5-pro' },
    kling2_0: { name: 'Kling 2.0', slug: 'kling-2-0' },
    flux1_krea_dev: { name: 'Flux 1 Krea Dev', slug: 'flux-1-krea-dev' },
    seedream_4_5: { name: 'Seedream 4.5', slug: 'seedream-4-5' },
    anthropic: { name: 'Anthropic Claude', slug: 'anthropic-claude' },
    beeble: { name: 'Beeble', slug: 'beeble' },
    elevenlabs: { name: 'ElevenLabs', slug: 'elevenlabs' },
    flux: { name: 'Flux', slug: 'flux' },
    happyhorse1: { name: 'Happyhorse1', slug: 'happyhorse1' },
    heygen: { name: 'HeyGen', slug: 'heygen' },
    krea2: { name: 'Krea 2', slug: 'krea-2' },
    ltx2: { name: 'LTX 2', slug: 'ltx-2' },
    minimax: { name: 'MiniMax', slug: 'minimax' },
    openrouter: { name: 'OpenRouter', slug: 'openrouter' },
    quiver: { name: 'Quiver', slug: 'quiver' },
    qwen3: { name: 'Qwen 3', slug: 'qwen-3' },
    rodin3d: { name: 'Rodin 3D', slug: 'rodin-3d' },
    seedance2: { name: 'Seedance 2', slug: 'seedance-2' },
    sonilo: { name: 'Sonilo', slug: 'sonilo' },
    sync: { name: 'Sync', slug: 'sync' }
  }

// Stub entries that exist only to issue 301 redirects from old slugs to
// their new canonical slugs. Keeps renames reproducible across regenerations.
const LEGACY_SLUG_REDIRECTS: OutputModel[] = [
  {
    slug: 'grok-image',
    canonicalSlug: 'grok-imagine',
    name: 'Grok Image',
    displayName: 'Grok Image',
    directory: 'partner_nodes',
    huggingFaceUrl: '',
    workflowCount: 0
  }
]

function stripExt(name: string): string {
  return name.replace(/\.(safetensors|ckpt|pt|bin)$/, '')
}

function stripQuant(base: string): string {
  for (const suffix of QUANT_SUFFIXES) {
    if (base.endsWith(suffix)) return base.slice(0, -suffix.length)
  }
  return base
}

function makeSlug(name: string): string {
  const base = stripExt(name)
  return base
    .toLowerCase()
    .replace(/[_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function makeDisplayName(name: string): string {
  const base = stripExt(name)
  return base
    .split(/[_-]/)
    .map((part) => {
      if (/^(fp\d+|bf\d+|int\d+)$/i.test(part)) return part.toUpperCase()
      if (/^(e4m3fn|scaled|mixed|fp8mixed)$/i.test(part)) return part
      if (/^\d+(\.\d+)?[bBkKmM]?$/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function extractModels(
  obj: unknown,
  templateName: string,
  models: Map<string, ModelData>
): void {
  if (obj === null || typeof obj !== 'object') return

  if (Array.isArray(obj)) {
    for (const item of obj) extractModels(item, templateName, models)
    return
  }

  const record = obj as Record<string, unknown>

  if (Array.isArray(record['models'])) {
    for (const m of record['models'] as unknown[]) {
      if (m === null || typeof m !== 'object' || Array.isArray(m)) continue
      const model = m as Record<string, unknown>
      if (typeof model['name'] !== 'string') continue

      const name = model['name']
      const url = typeof model['url'] === 'string' ? model['url'] : ''
      const directory =
        typeof model['directory'] === 'string' ? model['directory'] : ''

      if (!models.has(name)) {
        models.set(name, {
          url,
          directory,
          templates: new Set(),
          firstTemplate: templateName
        })
      }
      models.get(name)!.templates.add(templateName)
    }
  }

  for (const value of Object.values(record)) {
    extractModels(value, templateName, models)
  }
}

interface ApiModelData {
  slug: string
  name: string
  directory: 'partner_nodes'
  templateCount: number
}

export function extractApiModels(files: string[]): ApiModelData[] {
  const counts = new Map<string, number>()
  const unmapped = new Set<string>()
  const sortedKeys = Object.keys(API_PROVIDER_MAP).sort(
    (a, b) => b.length - a.length
  )

  for (const file of files) {
    if (!file.startsWith('api_')) continue
    const baseName = file
      .slice(4)
      .toLowerCase()
      .replace(/\.json$/, '')

    // Ignore known non-providers or upstream typos until fixed
    if (
      baseName === 'king' ||
      baseName.startsWith('king_') ||
      baseName === 'from' ||
      baseName.startsWith('from_')
    ) {
      continue
    }

    let matchedKey: string | undefined
    for (const key of sortedKeys) {
      if (baseName === key || baseName.startsWith(key + '_')) {
        matchedKey = key
        break
      }
    }

    if (!matchedKey) {
      unmapped.add(`- ${baseName} (from ${file})`)
      continue
    }

    const entry = API_PROVIDER_MAP[matchedKey]
    counts.set(entry.slug, (counts.get(entry.slug) ?? 0) + 1)
  }

  if (unmapped.size > 0) {
    throw new Error(
      `Unmapped API provider prefixes found in template files:\n` +
        Array.from(unmapped).join('\n') +
        `\nYou MUST add them to API_PROVIDER_MAP in generate-models.ts.`
    )
  }
  return [...counts.entries()].map(([slug, count]) => {
    const found = Object.values(API_PROVIDER_MAP).find((e) => e.slug === slug)!
    return {
      slug,
      name: found.name,
      directory: 'partner_nodes' as const,
      templateCount: count
    }
  })
}

// Reads all locale index.json files to build a map of
// raw model filename → tutorialUrl. Index entries name the template file;
// that file's embedded model objects give the actual filenames.
function buildTutorialUrlMap(templatesDir: string): Map<string, string> {
  const map = new Map<string, string>()
  const indexFiles = readdirSync(templatesDir).filter(
    (f) =>
      f.startsWith('index') &&
      f.endsWith('.json') &&
      !f.includes('schema') &&
      !f.includes('logo')
  )
  // Collect template-name → tutorialUrl from all locale indexes (first wins)
  const templateTutorialMap = new Map<string, string>()
  const sorted = ['index.json', ...indexFiles.filter((f) => f !== 'index.json')]
  for (const file of sorted) {
    let data: unknown
    try {
      data = JSON.parse(readFileSync(join(templatesDir, file), 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(data)) continue
    for (const cat of data as unknown[]) {
      if (typeof cat !== 'object' || cat === null) continue
      const templates = (cat as Record<string, unknown>)['templates']
      if (!Array.isArray(templates)) continue
      for (const t of templates) {
        if (typeof t !== 'object' || t === null) continue
        const entry = t as Record<string, unknown>
        const tutorialUrl =
          typeof entry['tutorialUrl'] === 'string'
            ? entry['tutorialUrl']
            : undefined
        const templateName =
          typeof entry['name'] === 'string' ? entry['name'] : undefined
        if (
          tutorialUrl &&
          templateName &&
          !templateTutorialMap.has(templateName)
        ) {
          templateTutorialMap.set(templateName, tutorialUrl)
        }
      }
    }
  }

  // For each template with a tutorialUrl, open the template file and map
  // every embedded model filename to that tutorialUrl
  for (const [templateName, tutorialUrl] of templateTutorialMap) {
    const filePath = join(templatesDir, `${templateName}.json`)
    let data: unknown
    try {
      data = JSON.parse(readFileSync(filePath, 'utf8'))
    } catch {
      continue
    }

    function extractModelNames(obj: unknown): void {
      if (obj === null || typeof obj !== 'object') return
      if (Array.isArray(obj)) {
        for (const item of obj) extractModelNames(item)
        return
      }
      const record = obj as Record<string, unknown>
      if (Array.isArray(record['models'])) {
        for (const m of record['models'] as unknown[]) {
          if (m === null || typeof m !== 'object' || Array.isArray(m)) continue
          const model = m as Record<string, unknown>
          if (typeof model['name'] === 'string' && !map.has(model['name'])) {
            map.set(model['name'], tutorialUrl)
          }
        }
      }
      for (const value of Object.values(record)) {
        extractModelNames(value)
      }
    }

    extractModelNames(data)
  }

  return map
}

function templateThumbnailUrl(
  firstTemplate: string | undefined,
  templatesDir: string
): string | undefined {
  if (!firstTemplate) return undefined
  const base = firstTemplate.replace(/\.json$/, '')
  const localPath = join(templatesDir, `${base}-1.webp`)
  if (!existsSync(localPath)) return undefined
  return `${WORKFLOW_TEMPLATES_BASE}/${encodeURIComponent(base)}-1.webp`
}

function run(): void {
  const models = new Map<string, ModelData>()

  const files = readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'))

  for (const file of files) {
    const filePath = join(TEMPLATES_DIR, file)
    try {
      const raw = readFileSync(filePath, 'utf8')
      const data: unknown = JSON.parse(raw)
      extractModels(data, file, models)
    } catch (error) {
      throw new Error(
        `Failed to parse ${file}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error }
      )
    }
  }

  const apiModels = extractApiModels(files)
  const tutorialUrlMap = buildTutorialUrlMap(TEMPLATES_DIR)

  const sorted = [...models.entries()].sort(
    ([, a], [, b]) => b.templates.size - a.templates.size
  )

  // Build quant convergence map
  const groups = new Map<string, Array<[string, ModelData]>>()
  for (const [name, data] of sorted) {
    const base = stripExt(name)
    const canonicalBase = stripQuant(base)
    if (!groups.has(canonicalBase)) groups.set(canonicalBase, [])
    groups.get(canonicalBase)!.push([name, data])
  }

  const canonicalMap = new Map<string, string | null>()
  for (const members of groups.values()) {
    if (members.length > 1) {
      const membersSorted = [...members].sort(
        ([, a], [, b]) => b.templates.size - a.templates.size
      )
      const canonicalName = membersSorted[0][0]
      canonicalMap.set(canonicalName, null)
      for (const [name] of membersSorted.slice(1)) {
        canonicalMap.set(name, canonicalName)
      }
    } else {
      canonicalMap.set(members[0][0], null)
    }
  }

  const output: OutputModel[] = sorted.map(([name, data]) => {
    const canonicalRaw = canonicalMap.get(name) ?? null
    const result: OutputModel = {
      slug: makeSlug(name),
      name,
      huggingFaceUrl: data.url,
      directory: data.directory,
      workflowCount: data.templates.size,
      displayName: makeDisplayName(name)
    }
    const docsUrl = tutorialUrlMap.get(name)
    if (docsUrl) result.docsUrl = docsUrl
    const thumb = templateThumbnailUrl(data.firstTemplate, TEMPLATES_DIR)
    if (thumb) result.thumbnailUrl = thumb
    if (canonicalRaw !== null) {
      result.canonicalSlug = makeSlug(canonicalRaw)
    }
    return result
  })

  const apiOutput: OutputModel[] = apiModels
    .sort((a, b) => b.templateCount - a.templateCount)
    .map((m) => ({
      slug: m.slug,
      name: m.name,
      huggingFaceUrl: '',
      directory: m.directory,
      workflowCount: m.templateCount,
      displayName: m.name
    }))

  const combined = [...apiOutput, ...output, ...LEGACY_SLUG_REDIRECTS]

  const withThumbs = combined.filter((m) => m.thumbnailUrl).length
  process.stdout.write(
    `  ${withThumbs}/${combined.length} models have thumbnails\n`
  )

  const defaultOut = join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../src/config/generated-models.json'
  )
  const outputArg = process.argv[2] ?? defaultOut
  const json = JSON.stringify(combined, null, 2) + '\n'

  writeFileSync(outputArg, json, 'utf8')
  process.stdout.write(
    `Written ${combined.length} models ` +
      `(${apiOutput.length} partner, ${output.length} local) to ${outputArg}\n`
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    run()
  } catch (err) {
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`
    )
    process.exit(1)
  }
}
