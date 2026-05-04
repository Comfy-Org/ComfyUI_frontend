import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

interface RawModel {
  name: string
  url: string
  directory: string
}

interface ModelData {
  url: string
  directory: string
  templates: Set<string>
}

interface OutputModel {
  slug: string
  name: string
  huggingFaceUrl: string
  directory: string
  workflowCount: number
  displayName: string
  thumbnailUrl?: string
  canonicalSlug?: string
}

// Maps api_*.json filename prefix to a canonical display name and slug.
// Add entries here as new partner integrations land in workflow_templates.
const API_PROVIDER_MAP: Record<string, { name: string; slug: string }> = {
  nano: { name: 'Nano Banana', slug: 'nano-banana' },
  kling: { name: 'Kling AI', slug: 'kling-ai' },
  kling2: { name: 'Kling AI', slug: 'kling-ai' },
  meshy: { name: 'Meshy AI', slug: 'meshy-ai' },
  luma: { name: 'Luma Dream Machine', slug: 'luma-dream-machine' },
  runway: { name: 'Runway', slug: 'runway' },
  vidu: { name: 'Vidu', slug: 'vidu' },
  bfl: { name: 'Flux (API)', slug: 'flux-api' },
  grok: { name: 'Grok Image', slug: 'grok-image' },
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
  wavespped: { name: 'Wavespeed', slug: 'wavespeed' }
}

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
        models.set(name, { url, directory, templates: new Set() })
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

function extractApiModels(files: string[]): ApiModelData[] {
  const counts = new Map<string, number>()
  for (const file of files) {
    if (!file.startsWith('api_')) continue
    const prefix = file.slice(4).split('_')[0]
    const entry = API_PROVIDER_MAP[prefix]
    if (!entry) continue
    counts.set(entry.slug, (counts.get(entry.slug) ?? 0) + 1)
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

const HUB_BASE = 'https://comfy.org'

async function fetchThumbnail(slug: string): Promise<string | undefined> {
  try {
    const url = `${HUB_BASE}/api/hub/workflows?tag=${encodeURIComponent(slug)}&limit=1`
    const res = await fetch(url)
    if (!res.ok) return undefined
    const data = (await res.json()) as {
      workflows?: Array<{ thumbnail_url?: string; sample_image_urls?: string[] }>
    }
    const wf = data.workflows?.[0]
    const thumb = wf?.thumbnail_url || wf?.sample_image_urls?.[0]
    return thumb || undefined
  } catch {
    return undefined
  }
}

async function run(): Promise<void> {
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
        }`
      )
    }
  }

  const apiModels = extractApiModels(files)

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

  const combined = [...apiOutput, ...output]

  // Fetch hub thumbnails unless skipped (set SKIP_THUMBNAILS=1 for offline use)
  if (!process.env['SKIP_THUMBNAILS']) {
    process.stdout.write(`Fetching hub thumbnails for ${combined.length} models...\n`)
    await Promise.all(
      combined.map(async (m) => {
        const thumb = await fetchThumbnail(m.slug)
        if (thumb) m.thumbnailUrl = thumb
      })
    )
    const withThumbs = combined.filter((m) => m.thumbnailUrl).length
    process.stdout.write(`  ${withThumbs}/${combined.length} models have thumbnails\n`)
  }

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

run().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
