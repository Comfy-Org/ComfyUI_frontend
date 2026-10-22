import { createContext } from 'astro/middleware'
import { expect, it } from 'vitest'

import { routerModelSlugAliases } from '@/config/workshop-browse-content'
import { prepareModelPage } from './model-page'
import { GET } from './page.json'

const modelSlug = 'bfl--flux-2-max--generate-images'
const page = await prepareModelPage(modelSlug)
if (page.kind !== 'page') throw new Error('Expected a canonical model fixture')
const preparedPage = page
const [alias] = routerModelSlugAliases.keys()
if (!alias) throw new Error('Expected a model alias fixture')

it('serves a canonical page as JSON without the redundant form', async () => {
  const response = await GET(
    createContext({
      request: new Request(`https://comfy.org/models/${modelSlug}/page.json`),
      params: { slug: modelSlug },
      defaultLocale: 'en'
    })
  )
  const body: unknown = await response.json()

  expect(response.headers.get('Content-Type')).toBe('application/json')
  expect(body).toMatchObject({
    kind: 'page',
    model: { slug: modelSlug, execution: preparedPage.model.execution },
    related: preparedPage.related.map(({ slug, href }) => ({ slug, href }))
  })
  expect(body).not.toHaveProperty('model.form')
})

it.for([
  { slug: alias, error: 'Expected a canonical Models route' },
  { slug: 'unknown-model', error: 'Unknown Models route: unknown-model' },
  { slug: undefined, error: 'Unknown Models route: (missing)' }
])('rejects a noncanonical payload request: $slug', async ({ slug, error }) => {
  const context = createContext({
    request: new Request('https://comfy.org/models/page.json'),
    params: { slug },
    defaultLocale: 'en'
  })

  await expect(GET(context)).rejects.toThrow(error)
})

it.for([
  { locale: 'ja', status: 200 },
  { locale: 'zh-CN', status: 200 },
  { locale: 'ko', status: 400 },
  { locale: 'zh-cn', status: 400 }
])(
  'accepts every catalog locale and rejects others: $locale',
  async ({ locale, status }) => {
    const response = await GET(
      createContext({
        request: new Request(
          `https://comfy.org/models/${modelSlug}/page.json?locale=${locale}`
        ),
        params: { slug: modelSlug },
        defaultLocale: 'en'
      })
    )
    expect(response.status).toBe(status)
    if (status === 400)
      expect(await response.text()).toBe('Invalid content locale')
  }
)
