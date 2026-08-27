import type { BundledLanguage } from 'shiki'

import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

/**
 * Structured, non-copy data for the /developers page. Display copy lives in
 * the `developers.*` namespace of src/i18n/translations.ts.
 */

/**
 * CTA destinations. `joinBeta` is a placeholder until the real Serverless API
 * beta signup target exists (tracked in the developers-page content pass).
 */
export const developersCtas = {
  platform: 'https://cloud.comfy.org',
  docs: 'https://docs.comfy.org',
  sdkDocs: 'https://docs.comfy.org',
  joinBeta: 'https://cloud.comfy.org'
} as const

export type HeroSnippetEnv = 'cloud' | 'local' | 'serverless'
export type HeroSnippetLang = 'python' | 'javascript' | 'curl'

/** Shiki language id per tab, so the highlighter and the label stay in sync. */
export const heroSnippetLanguages = {
  python: { label: 'Python', shikiLang: 'python' },
  javascript: { label: 'JavaScript', shikiLang: 'javascript' },
  curl: { label: 'cURL', shikiLang: 'bash' }
} as const satisfies Record<
  HeroSnippetLang,
  { label: string; shikiLang: BundledLanguage }
>

/**
 * `COMFY_BASE_URL` per environment, verified against @comfyorg/sdk 0.1.7 and
 * comfy-sdk 0.1.8. Cloud is the SDKs' own default, so its snippets set nothing;
 * the self-hosted URL is comfy-api-proxy, which fronts a local ComfyUI with the
 * v2 API and takes no key.
 */
const BASE_URLS: Record<Exclude<HeroSnippetEnv, 'cloud'>, string> = {
  local: 'http://127.0.0.1:8189',
  serverless: 'https://<deployment>.run.comfy.app'
}

/** The proxy in front of a self-hosted ComfyUI authenticates no requests. */
const NEEDS_API_KEY: Record<HeroSnippetEnv, boolean> = {
  cloud: true,
  local: false,
  serverless: true
}

function baseUrlNote(env: HeroSnippetEnv, comment: string): string {
  if (env === 'cloud') return ''
  return `${comment} export COMFY_BASE_URL="${BASE_URLS[env]}"\n`
}

function python(env: HeroSnippetEnv): string {
  const client = NEEDS_API_KEY[env]
    ? 'Comfy(api_key=os.environ["COMFY_API_KEY"])'
    : 'Comfy()  # the proxy takes no key'
  const osImport = NEEDS_API_KEY[env] ? 'import os\n' : ''
  return `# pip install comfy-sdk
${baseUrlNote(env, '#')}${osImport}from comfy_sdk import Comfy

client = ${client}
wf = client.workflows.from_file("workflow_api.json")

job = client.run(wf)  # submit, then poll to a terminal state
for output in job.get_outputs("9"):  # "9" is your SaveImage node
    output.to_file(output.name)`
}

function javascript(env: HeroSnippetEnv): string {
  const client = NEEDS_API_KEY[env]
    ? 'new Comfy({ apiKey: process.env.COMFY_API_KEY })'
    : 'new Comfy()  // the proxy takes no key'
  return `// npm i @comfyorg/sdk
${baseUrlNote(env, '//')}import { Comfy } from '@comfyorg/sdk'

const client = ${client}
const wf = await client.workflows.fromFile('workflow_api.json')

const job = await client.run(wf) // submit, then poll to a terminal state
await job.getOutputs('9')[0].toFile('output.png') // "9" is your SaveImage node`
}

/*
 * The v2 job endpoint wraps the graph rather than taking the file as the body,
 * so the workflow is spliced into the request instead of passed with `@`.
 */
function curl(env: HeroSnippetEnv): string {
  const baseUrl = env === 'cloud' ? 'https://cloud.comfy.org' : BASE_URLS[env]
  const auth = NEEDS_API_KEY[env]
    ? '  -H "Authorization: Bearer $COMFY_API_KEY" \\\n'
    : ''
  return `curl -X POST ${baseUrl}/api/v2/jobs \\
${auth}  -H "Content-Type: application/json" \\
  -d "{\\"workflow\\": $(cat workflow_api.json)}"

# poll GET /api/v2/jobs/{id} until it reaches a terminal status,
# then GET /api/v2/assets/{id}/content for each output`
}

/**
 * Hero code samples, one per environment × language.
 *
 * Verified 2026-08-27 against the published SDKs (@comfyorg/sdk 0.1.7,
 * comfy-sdk 0.1.8) and the generated Comfy API v2 contract. Neither client
 * takes a base-URL argument, outputs are fetched by node id, and the node ids
 * here ("9") are illustrative — they belong to the reader's own graph.
 */
export const heroSnippets: Record<
  HeroSnippetEnv,
  Record<HeroSnippetLang, string>
> = {
  cloud: {
    python: python('cloud'),
    javascript: javascript('cloud'),
    curl: curl('cloud')
  },
  local: {
    python: python('local'),
    javascript: javascript('local'),
    curl: curl('local')
  },
  serverless: {
    python: python('serverless'),
    javascript: javascript('serverless'),
    curl: curl('serverless')
  }
}

export type ProductCardKey = 'cloudApi' | 'serverlessApi' | 'sdk' | 'router'

/**
 * The four product cards under the hero, in design order. Copy comes from
 * `developers.cards.<key>.*`; `router` shares the platform CTA until Comfy
 * Router has a destination of its own (developers-page issue 10).
 */
export const productCards = [
  { key: 'cloudApi', href: developersCtas.platform },
  { key: 'serverlessApi', href: developersCtas.joinBeta },
  { key: 'sdk', href: developersCtas.sdkDocs },
  { key: 'router', href: developersCtas.platform }
] as const satisfies readonly { key: ProductCardKey; href: string }[]

export type ShowcaseSlide = {
  id: string
  media: { type: 'image' | 'video'; src: string; poster?: string }
  /** The clip's real duration, so the carousel advances as it ends. */
  autoplayMs?: number
}

/**
 * "Built with SDK" showcase. One slide until more case studies exist — the
 * carousel hides its dots below two slides, so the design's four dots appear
 * only once the content does.
 *
 * MISSING ASSET: both URLs 404 today. The clip has to be encoded to the site's
 * web video profile, faststart (moov atom at the front), and uploaded to
 * media.comfy.org before this section renders anything but an empty media box
 * (developers-page issue 10).
 */
export const showcaseSlides: ShowcaseSlide[] = [
  {
    id: 'store',
    media: {
      type: 'video',
      src: 'https://media.comfy.org/website/developers/store-demo.mp4',
      poster:
        'https://media.comfy.org/website/developers/store-demo-poster.webp'
    },
    autoplayMs: 30000
  }
]

/**
 * "Observe and manage" dashboard shot, cropped to the design's framing
 * (956×469, Figma 12335:54591).
 *
 * MISSING ASSET: this URL 404s today. The cropped file is ready to upload at
 * `.scratch/developers-page/assets/observe-dashboard.webp`; until it lands the
 * section renders its tinted placeholder box (developers-page issue 10).
 */
export const observeImage =
  'https://media.comfy.org/website/developers/observe-dashboard.webp'

const FAQ_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/**
 * FAQ ids whose answer is still the `TODO:` placeholder. They render on the
 * page, but are held out of the FAQPage structured data — a placeholder
 * acceptedAnswer is markup that says nothing. Emptying this list in the content
 * pass (developers-page issue 10) fills the json-ld node out on its own.
 */
const PENDING_ANSWER_IDS: readonly string[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9'
]

export type DevelopersFaq = {
  id: string
  question: string
  answer: string
  /** True while the answer is a placeholder awaiting content review. */
  pending: boolean
}

export function developersFaqs(locale: Locale): DevelopersFaq[] {
  return FAQ_NUMBERS.map((n) => ({
    id: String(n),
    question: t(`developers.faq.q${n}`, locale),
    answer: t(`developers.faq.a${n}`, locale),
    pending: PENDING_ANSWER_IDS.includes(String(n))
  }))
}
