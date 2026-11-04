import type { Modality } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { deriveRouterContract } from '@/renderer/extensions/superComfy/router/routerContract'
import claudeHaiku from '@/renderer/extensions/superComfy/router/fixtures/claude-haiku-4-5-20251001.json'
import seedance from '@/renderer/extensions/superComfy/router/fixtures/dreamina-seedance-2-0-260128.json'
import elevenSfx from '@/renderer/extensions/superComfy/router/fixtures/eleven_sfx_v2.json'
import elevenV3 from '@/renderer/extensions/superComfy/router/fixtures/eleven_v3.json'
import flux2Pro from '@/renderer/extensions/superComfy/router/fixtures/flux-2-pro.json'
import gemini3ProImage from '@/renderer/extensions/superComfy/router/fixtures/gemini-3-pro-image.json'
import gpt5Mini from '@/renderer/extensions/superComfy/router/fixtures/gpt-5-mini.json'
import gptImage2 from '@/renderer/extensions/superComfy/router/fixtures/gpt-image-2.json'
import klingV3Omni from '@/renderer/extensions/superComfy/router/fixtures/kling-v3-omni.json'
import klingV3 from '@/renderer/extensions/superComfy/router/fixtures/kling-v3.json'
import meshy71 from '@/renderer/extensions/superComfy/router/fixtures/meshy-7.1.json'
import meshyRigging from '@/renderer/extensions/superComfy/router/fixtures/rigging.json'
import seedream from '@/renderer/extensions/superComfy/router/fixtures/seedream-5-0-260128.json'
import veo31 from '@/renderer/extensions/superComfy/router/fixtures/veo-3.1-generate-001.json'
import { parseOpenApiDoc } from '@/renderer/extensions/superComfy/router/routerSchema'
import type {
  OpenApiDoc,
  RouterContract
} from '@/renderer/extensions/superComfy/router/routerTypes'

export const ROUTER_FIXTURES = {
  'anthropic/claude-haiku-4-5-20251001': claudeHaiku,
  'byteplus/dreamina-seedance-2-0-260128': seedance,
  'byteplus/seedream-5-0-260128': seedream,
  'elevenlabs/eleven_sfx_v2': elevenSfx,
  'elevenlabs/eleven_v3': elevenV3,
  'bfl/flux-2-pro': flux2Pro,
  'vertexai/gemini-3-pro-image': gemini3ProImage,
  'openai/gpt-5-mini': gpt5Mini,
  'openai/gpt-image-2': gptImage2,
  'kling/kling-v3-omni': klingV3Omni,
  'kling/kling-v3': klingV3,
  'meshy/meshy-7.1': meshy71,
  'meshy/rigging': meshyRigging,
  'veo/veo-3.1-generate-001': veo31
} as const

export type FixtureId = keyof typeof ROUTER_FIXTURES

export function fixtureDoc(id: FixtureId): OpenApiDoc {
  const doc = parseOpenApiDoc(ROUTER_FIXTURES[id])
  if (!doc) throw new Error(`Router fixture ${id} did not parse`)
  return doc
}

export function contractFrom(
  id: string,
  doc: OpenApiDoc,
  modality: Modality
): RouterContract {
  const outcome = deriveRouterContract(id, doc, modality)
  if (!outcome.ok) throw new Error(`Router fixture ${id}: ${outcome.reason}`)
  return outcome.contract
}

export function fixtureContract(
  id: FixtureId,
  modality: Modality
): RouterContract {
  return contractFrom(id, fixtureDoc(id), modality)
}
