/**
 * Which Comfy Router models a provider other than Comfy can serve.
 *
 * Every Router model runs through Comfy's default route. The rows below are the
 * only ones that also accept `model_provider`. They mirror the API spec: each
 * model's `x-comfy-router-alt-providers`, published per model under
 * `router-schemas/` in the public Comfy-Org/docs repository. Reading the live
 * spec needs an API key, so the rows are copied by hand;
 * `router-providers.test.ts` compares them with the published spec and fails
 * the day they drift. Update `ROUTER_PROVIDER_COVERAGE_VERIFIED_AT` with them.
 */

export const ROUTER_SERVING_PROVIDERS = [
  { id: 'fal', name: 'fal' },
  { id: 'higgsfield', name: 'Higgsfield' },
  { id: 'runware', name: 'Runware' },
  { id: 'wavespeed', name: 'WaveSpeed' }
] as const

type RouterServingProviderId = (typeof ROUTER_SERVING_PROVIDERS)[number]['id']

export interface RouterProviderCoverageRow {
  /** The model's name on the page. */
  name: string
  /** The model's name in the docs, when the page shortens it. */
  docsName?: string
  /** The `{provider}/{model}` sent to `POST /v2/models/{provider}/{model}`. */
  modelId: string
  /** The model's page on docs.comfy.org. */
  docsUrl: string
  /** Serving providers that can run the model besides Comfy's default route. */
  providers: readonly RouterServingProviderId[]
}

const DOCS_MODELS_URL = 'https://docs.comfy.org/development/comfy-router/models'

/** The day the rows and the catalog size were last checked against the docs. */
export const ROUTER_PROVIDER_COVERAGE_VERIFIED_AT = '2026-09-23'

/** How many models the Router catalog lists, all served by Comfy. */
export const ROUTER_CATALOG_MODEL_COUNT = 207

/** In the order the page shows them: alphabetical by `name`. */
export const ROUTER_PROVIDER_COVERAGE: readonly RouterProviderCoverageRow[] = [
  {
    name: 'GPT Image 2',
    modelId: 'openai/gpt-image-2',
    docsUrl: `${DOCS_MODELS_URL}/openai/gpt-image-2/code`,
    providers: ['fal', 'runware']
  },
  {
    name: 'Kling 3.0 Turbo',
    modelId: 'kling/kling-3.0-turbo',
    docsUrl: `${DOCS_MODELS_URL}/kling/kling-3-0-turbo/code`,
    providers: ['higgsfield']
  },
  {
    name: 'Kling V3',
    modelId: 'kling/kling-v3',
    docsUrl: `${DOCS_MODELS_URL}/kling/kling-v3/code`,
    providers: ['higgsfield']
  },
  {
    name: 'Nano Banana 2',
    modelId: 'vertexai/gemini-3.1-flash-image',
    docsUrl: `${DOCS_MODELS_URL}/google/nano-banana-2/code`,
    providers: ['fal', 'runware']
  },
  {
    name: 'Nano Banana Pro',
    modelId: 'vertexai/gemini-3-pro-image',
    docsUrl: `${DOCS_MODELS_URL}/google/nano-banana-pro/code`,
    providers: ['fal', 'runware', 'wavespeed']
  },
  {
    name: 'Seedance 2.0',
    docsName: 'Dreamina Seedance 2.0 260128',
    modelId: 'byteplus/dreamina-seedance-2-0-260128',
    docsUrl: `${DOCS_MODELS_URL}/byteplus/dreamina-seedance-2-0-260128/code`,
    providers: ['fal']
  },
  {
    name: 'Seedance 2.5',
    docsName: 'Dreamina Seedance 2.5 260628',
    modelId: 'byteplus/dreamina-seedance-2-5-260628',
    docsUrl: `${DOCS_MODELS_URL}/byteplus/dreamina-seedance-2-5-260628/code`,
    providers: ['fal']
  },
  {
    name: 'Wan 3.0 Video',
    modelId: 'wan/wan3.0-video',
    docsUrl: `${DOCS_MODELS_URL}/wan/wan3-0-video/code`,
    providers: ['higgsfield']
  }
]

export interface RouterComfyOnlyModel {
  name: string
  docsUrl: string
}

/**
 * Catalog models that run only on Comfy's default route, shown under the table
 * as a preview of the rest of the catalog: the first at full strength, the rest
 * fading out.
 */
export const ROUTER_COMFY_ONLY_PREVIEW: readonly RouterComfyOnlyModel[] = [
  {
    name: 'MiniMax H3',
    docsUrl: `${DOCS_MODELS_URL}/minimax/minimax-h3/code`
  },
  {
    name: 'GPT Image 2.5 Flare',
    docsUrl: `${DOCS_MODELS_URL}/openai/gpt-image-2-5-flare/code`
  },
  {
    name: 'Grok Imagine Video 1.5',
    docsUrl: `${DOCS_MODELS_URL}/xai/grok-imagine-video-1-5/code`
  }
]
