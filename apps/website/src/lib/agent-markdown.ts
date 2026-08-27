/**
 * Markdown twins served to agents: `/index.md`, `/api.md`, and `/404.md`,
 * plus the same bodies via `Accept: text/markdown` negotiation (middleware.ts).
 * Composed from the live i18n strings and route tables so the twins can't
 * drift from the rendered pages.
 */

import { externalLinks, getRoutes } from '../config/routes'
import { modelReleaseSlides } from '../data/modelRelease'
import { t } from '../i18n/translations'

const SITE = 'https://comfy.org'
const OPENAPI_PATH = '/openapi.json'

const routes = getRoutes('en')

function en(...keys: Parameters<typeof t>[0][]): string {
  return keys
    .map((key) => t(key, 'en'))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

function abs(path: string): string {
  return new URL(path, SITE).toString()
}

function agentFooter(pagePath: string, twinPath: string): string {
  return [
    '---',
    '',
    `This is the markdown twin of ${abs(pagePath)}, also served there via \`Accept: text/markdown\` content negotiation (direct URL: ${abs(twinPath)}).`,
    `Machine-readable index of the site: ${abs('/llms.txt')} · Site map: ${abs('/sitemap-index.xml')} · OpenAPI spec: ${abs(OPENAPI_PATH)}`,
    ''
  ].join('\n')
}

export function homepageMarkdown(): string {
  const modelLines = modelReleaseSlides.map((slide) => {
    const title = en(slide.titleKey)
    const body = en(slide.bodyKey)
    return `- **${title}** — ${body} ([explore](${abs(routes[slide.exploreRoute])}))`
  })

  return [
    `# Comfy — ${en('hero.title')}`,
    '',
    `> ${en('hero.subtitle')}`,
    '',
    'Comfy is built around ComfyUI — the open-source node-graph runtime with 60,000+ community nodes and thousands of shared workflows. It ships as a free local app, a managed cloud, an API, and an enterprise platform.',
    '',
    `## ${en('modelRelease.heading')}`,
    '',
    ...modelLines,
    '',
    `## ${en('showcase.heading')}`,
    '',
    `${en('showcase.subtitle1')} ${en('showcase.subtitle2')}`,
    '',
    `- **${en('showcase.feature1.title')}** — ${en('showcase.feature1.description')}`,
    `- **${en('showcase.feature2.title')}** — ${en('showcase.feature2.description')}`,
    `- **${en('showcase.feature3.title')}** — ${en('showcase.feature3.description')}`,
    '',
    `## ${en('useCase.label')}`,
    '',
    `${en('useCase.vfx')} · ${en('useCase.advertising')} · ${en('useCase.gaming')} · ${en('useCase.ecommerce')}. ${en('useCase.body')}`,
    '',
    `## ${en('getStarted.heading')}`,
    '',
    `1. **${en('getStarted.step1.title')}** — [Download Comfy Desktop](${abs(routes.download)}) or [try Comfy Cloud](${externalLinks.cloud}).`,
    `2. **${en('getStarted.step2.title')}** — start from [a community workflow](${externalLinks.workflows}) or build your own.`,
    `3. **${en('getStarted.step3.title')}** — ${en('getStarted.step3.description')}`,
    '',
    `## ${en('products.heading')}`,
    '',
    `${en('products.subheading')}`,
    '',
    `- [${en('products.local.title')}](${abs(routes.download)}) — ${en('products.local.description')}`,
    `- [${en('products.cloud.title')}](${abs(routes.cloud)}) — ${en('products.cloud.description')}`,
    `- [${en('products.api.title')}](${abs(routes.api)}) — ${en('products.api.description')}`,
    `- [${en('products.enterprise.title')}](${abs(routes.cloudEnterprise)}) — ${en('products.enterprise.description')}`,
    '',
    '## For developers and agents',
    '',
    `- [Comfy API](${abs(routes.api)}) — markdown twin at ${abs('/api.md')}`,
    `- [OpenAPI 3 spec](${abs(OPENAPI_PATH)}) — every operation typed, with unique operationIds (source: https://api.comfy.org/openapi)`,
    `- [Documentation](${externalLinks.docs}) — every docs page also serves markdown (append \`.md\`); index at https://docs.comfy.org/llms.txt`,
    `- [Comfy MCP](${abs(routes.mcp)}) — MCP server endpoint at ${externalLinks.mcpEndpoint}`,
    `- [Community workflows](${externalLinks.workflows})`,
    '',
    agentFooter('/', '/index.md')
  ].join('\n')
}

export function apiMarkdown(): string {
  return [
    `# Comfy API — ${en('api.hero.heading')}`,
    '',
    `> ${en('api.hero.subtitle')}`,
    '',
    `- [Get API keys](${externalLinks.apiKeys})`,
    `- [API quick start](${externalLinks.docsApi})`,
    `- [SDKs](${externalLinks.docsSdk}) — Python (\`pip install comfy-sdk\`) and TypeScript (\`npm install @comfyorg/sdk\`)`,
    `- [OpenAPI 3 spec](${abs(OPENAPI_PATH)}) — every operation typed, with unique operationIds (source: https://api.comfy.org/openapi)`,
    `- [Comfy MCP](${abs(routes.mcp)}) — MCP server endpoint at ${externalLinks.mcpEndpoint}`,
    '',
    `## ${en('api.steps.heading')}`,
    '',
    `1. **${en('api.steps.step1.title')}** — ${en('api.steps.step1.description')}`,
    `2. **${en('api.steps.step2.title')}** — ${en('api.steps.step2.description')}`,
    `3. **${en('api.steps.step3.title')}** — ${en('api.steps.step3.description')}`,
    '',
    `## ${en('api.automation.heading')}`,
    '',
    `${en('api.automation.subtitle')}`,
    '',
    `- **${en('api.automation.feature1.title')}** — ${en('api.automation.feature1.description')}`,
    `- **${en('api.automation.feature2.title')}** — ${en('api.automation.feature2.description')}`,
    `- **${en('api.automation.feature3.title')}** — ${en('api.automation.feature3.description')}`,
    '',
    `## ${en('api.reason.heading', 'api.reason.headingHighlight', 'api.reason.headingSuffix')}`,
    '',
    `${en('api.reason.subtitle')}`,
    '',
    `- **${en('api.reason.1.title')}** — ${en('api.reason.1.description')}`,
    `- **${en('api.reason.2.title')}** — ${en('api.reason.2.description')}`,
    `- **${en('api.reason.3.title')}** — ${en('api.reason.3.description')}`,
    '',
    agentFooter(routes.api, '/api.md')
  ].join('\n')
}

export function notFoundMarkdown(): string {
  return [
    '# 404 — page not found',
    '',
    'Nothing lives at this path on comfy.org. These paths do:',
    '',
    `- [Homepage](${abs('/')}) — markdown twin at ${abs('/index.md')}`,
    `- [llms.txt](${abs('/llms.txt')}) — index of every important page on this site`,
    `- [Site map](${abs('/sitemap-index.xml')})`,
    `- [Comfy API](${abs(routes.api)}) — markdown twin at ${abs('/api.md')}`,
    `- [OpenAPI 3 spec](${abs(OPENAPI_PATH)})`,
    `- [Documentation](${externalLinks.docs}) — markdown index at https://docs.comfy.org/llms.txt`,
    `- [Download Comfy Desktop](${abs(routes.download)})`,
    `- [Comfy Cloud](${abs(routes.cloud)})`,
    `- [Community workflows](${externalLinks.workflows})`,
    ''
  ].join('\n')
}
