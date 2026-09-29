import type { WorkshopModel } from '../../config/models-catalogue'
import { externalLinks } from '../../config/routes'

/**
 * Where a model's docs live. The Router docs page carries one section per
 * provider; the ids below are verified against the live page. Providers
 * without a section get no link at all — a docs button that lands on the
 * page top with the model nowhere in sight is worse than none.
 *
 * Keys are normalized (lowercased, non-alphanumerics stripped), because the
 * lookup speaks two vocabularies: the Router id's raw provider slug ("bfl",
 * "xai", "luma_2") and the display name shown on the model ("Black Forest
 * Labs", "xAI"). The raw slug is tried first — it is the only place "Luma"
 * and "Luma 2" stay distinct. A new model under a known provider needs
 * nothing; a new provider needs one line here once its docs section exists.
 */
const DOCS_URL = externalLinks.docsComfyRouterModels

const ANCHORS: Readonly<Record<string, string>> = {
  anthropic: 'anthropic',
  beeble: 'beeble',
  bfl: 'black-forest-labs',
  blackforestlabs: 'black-forest-labs',
  bria: 'bria',
  bytedance: 'byteplus',
  byteplus: 'byteplus',
  byteplusmediakit: 'byteplus',
  elevenlabs: 'elevenlabs',
  fal: 'fal',
  freepik: 'freepik',
  gemini: 'google',
  geminiinteractions: 'gemini-interactions',
  google: 'google',
  grok: 'xai',
  heygen: 'heygen',
  ideogram: 'ideogram',
  kling: 'kling',
  krea: 'krea',
  lightricks: 'ltx',
  ltx: 'ltx',
  ltxv: 'ltx',
  luma: 'luma',
  luma2: 'luma-2',
  meshy: 'meshy',
  minimax: 'minimax',
  moonvalley: 'moonvalley',
  openai: 'openai',
  qwen: 'qwen',
  recraft: 'recraft',
  runway: 'runway',
  tencent: 'tencent',
  tencenthunyuan3d: 'tencent',
  veo: 'veo',
  vertexai: 'google',
  wan: 'wan',
  wavespeed: 'wavespeed',
  xai: 'xai'
}

function anchorFor(provider: string): string | undefined {
  const key = provider.toLowerCase().replace(/[^a-z0-9]/g, '')
  return Object.hasOwn(ANCHORS, key) ? ANCHORS[key] : undefined
}

export function modelDocsHref(model: {
  readonly provider?: string
  readonly routerId?: WorkshopModel['routerId']
}): string | undefined {
  const rawProvider = model.routerId?.split('/')[0]
  const anchor =
    (rawProvider ? anchorFor(rawProvider) : undefined) ??
    (model.provider ? anchorFor(model.provider) : undefined)
  return anchor ? `${DOCS_URL}#${anchor}` : undefined
}
