/**
 * LOCAL ONLY — not for production, not committed.
 *
 * Runs a model through the ComfyUI partner-node `/proxy/*` surface, which is
 * what platform.comfy.org's playground uses today.
 *
 * Why this exists rather than posting to Comfy Router directly: our catalog's
 * `parameters` describe a NORMALIZED authoring shape that only the partner
 * bundle understands. Both `/proxy/*` and Router speak the partner's raw
 * native protocol instead — different field names, nested objects, per-model
 * wire ids, three different media strategies. Measured across 259 models, not
 * one request body built from our form matches what either surface wants, and
 * no request URL is derivable from the model id.
 *
 * The bundle is the normalizer. It owns the request builders, the media
 * upload strategies, the per-provider poll loops, and the response
 * normalization. So we call it rather than reimplementing it.
 */
import type { WorkshopDetailModel, WorkshopFormValues } from './workshop-detail'
import type { WorkshopRunResult } from './workshop-run'
import { COMFY_ROUTER_BASE_URL } from './workshop-run'

interface PartnerResult {
  readonly job_id?: string
  readonly status?: string
  readonly type?: string
  readonly results?: ReadonlyArray<{ url?: string; mime?: string }>
}

type PartnerGenerate = (
  config: { baseUrl: string; token: string; headers?: Record<string, string> },
  input: Record<string, unknown>
) => Promise<PartnerResult>

let generateFn: PartnerGenerate | undefined

/**
 * Loaded on first run rather than at module scope: the bundle is 2 MB (0.4 MB
 * gzipped) and nothing about browsing a model page needs it.
 */
async function loadGenerate(): Promise<PartnerGenerate> {
  if (!generateFn) {
    const mod = (await import('../vendor/partner-client.mjs')) as {
      generate: PartnerGenerate
    }
    generateFn = mod.generate
  }
  return generateFn
}

/**
 * The bundle takes the same normalized shape our form produces, because our
 * `parameters` were generated FROM the bundle's own registry. So the form
 * values pass through unchanged, with the model id alongside them.
 */
export async function runViaPartnerProxy(
  model: WorkshopDetailModel,
  values: WorkshopFormValues,
  credentials: string
): Promise<WorkshopRunResult> {
  let generate: PartnerGenerate
  try {
    generate = await loadGenerate()
  } catch (cause) {
    return {
      status: 'error',
      errorType: 'service_unavailable',
      detail: `The partner client failed to load: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      requestId: undefined
    }
  }

  const input: Record<string, unknown> = { model: model.id }
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') input[name] = value
  }

  try {
    const result = await generate(
      { baseUrl: COMFY_ROUTER_BASE_URL, token: credentials },
      input
    )
    if (result.status === 'failed') {
      return {
        status: 'error',
        errorType: 'provider_error',
        detail: `The run did not complete (job ${result.job_id ?? 'unknown'}).`,
        requestId: result.job_id
      }
    }
    return { status: 'ok', output: result, requestId: result.job_id }
  } catch (cause) {
    return {
      status: 'error',
      errorType: 'provider_error',
      detail: cause instanceof Error ? cause.message : String(cause),
      requestId: undefined
    }
  }
}
