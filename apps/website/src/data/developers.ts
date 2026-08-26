import type { BundledLanguage } from 'shiki'

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

const BASE_URLS: Record<HeroSnippetEnv, string> = {
  cloud: 'https://cloud.comfy.org',
  local: 'http://127.0.0.1:8188',
  serverless: 'https://<your-deployment>.comfy.run'
}

function python(baseUrl: string): string {
  return `# pip install comfy-sdk
import os
from comfy_sdk import Comfy

os.environ["COMFY_BASE_URL"] = "${baseUrl}"
client = Comfy(api_key=os.environ["COMFY_API_KEY"])
wf = client.workflows.from_file("workflow_api.json")
job = client.run(wf)  # submit, then poll to a terminal state
job.outputs[0].to_file("output.png")`
}

function javascript(baseUrl: string): string {
  return `// npm install @comfyorg/sdk
import { Comfy } from '@comfyorg/sdk'

const client = new Comfy({
  baseUrl: '${baseUrl}',
  apiKey: process.env.COMFY_API_KEY
})
const wf = await client.workflows.fromFile('workflow_api.json')
const job = await client.run(wf)  // submit, then poll to a terminal state
await job.outputs[0].toFile('output.png')`
}

function curl(baseUrl: string): string {
  return `curl -X POST ${baseUrl}/api/v1/run \\
  -H "Authorization: Bearer $COMFY_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data @workflow_api.json`
}

/**
 * Hero code samples, one per environment × language.
 *
 * UNVERIFIED: only cloud/python is taken from the design. The JavaScript and
 * cURL forms, and the local/serverless base URLs, are drafted from the same
 * shape and must be checked against the shipping SDK surface before launch
 * (developers-page content pass, issue 10).
 */
export const heroSnippets: Record<
  HeroSnippetEnv,
  Record<HeroSnippetLang, string>
> = {
  cloud: {
    python: python(BASE_URLS.cloud),
    javascript: javascript(BASE_URLS.cloud),
    curl: curl(BASE_URLS.cloud)
  },
  local: {
    python: python(BASE_URLS.local),
    javascript: javascript(BASE_URLS.local),
    curl: curl(BASE_URLS.local)
  },
  serverless: {
    python: python(BASE_URLS.serverless),
    javascript: javascript(BASE_URLS.serverless),
    curl: curl(BASE_URLS.serverless)
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
