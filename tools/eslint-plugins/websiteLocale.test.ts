// @vitest-environment node
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint()
const astroFile = 'apps/website/src/pages/privacy-policy.astro'
await eslint.calculateConfigForFile(astroFile)

async function localeMessages(code: string, filePath = astroFile) {
  const results = await eslint.lintText(code, { filePath })
  const messages = results.flatMap((result) => result.messages)
  expect(messages.filter((message) => message.fatal)).toEqual([])
  return messages.filter((message) =>
    ['no-restricted-syntax', 'vue/no-restricted-syntax'].includes(
      message.ruleId ?? ''
    )
  )
}

describe('website locale lint policy', () => {
  it.for([
    { expression: 't("key", "en")', reports: 1 },
    { expression: 't(key(section, index), `ja`)', reports: 1 },
    { expression: 'tPlural("key", count, "en")', reports: 1 },
    { expression: 't(key(section, index), locale)', reports: 0 },
    { expression: 'tPlural("key", count, locale)', reports: 0 }
  ])('checks $expression', async ({ expression, reports }) => {
    expect(
      await localeMessages(
        `---\nconst label = ${expression}\n---\n<p>{label}</p>`
      )
    ).toHaveLength(reports)
  })

  it.for([
    { body: '<Component locale="en" />', reports: 1 },
    { body: "<Component locale={'ja'} />", reports: 1 },
    { body: '<Component locale={locale} />', reports: 0 },
    { body: '<Component keywords={["one", "two"]} />', reports: 1 },
    { body: '<Component keywords={keywords} />', reports: 0 },
    { body: '<Component routes={getRoutes("en")} />', reports: 1 },
    { body: '<Component routes={getRoutes(locale)} />', reports: 0 },
    {
      body: '<Component href={localizeHref("/about/", locale)} />',
      reports: 0
    },
    { body: '<Component href={localizeHref("/about/", "fr")} />', reports: 1 }
  ])('checks Astro attributes in $body', async ({ body, reports }) => {
    expect(await localeMessages(body)).toHaveLength(reports)
  })

  it.for([
    'export function getStaticPaths() { const routes = getRoutes("en"); return routes }',
    'export const getStaticPaths = () => { t("key", "en"); return [] }'
  ])('allows locale-specific static path generation: %s', async (code) => {
    expect(await localeMessages(`---\n${code}\n---\n<div />`)).toEqual([])
  })

  it.for([
    'apps/website/src/layouts/BaseLayout.astro',
    'apps/website/src/components/pricing/PricingFaq.astro',
    'apps/website/src/templates/events/EventPage.astro',
    'apps/website/src/routes/models/index.astro'
  ])('rejects literal locales outside pages in %s', async (file) => {
    expect(
      await localeMessages(
        '---\nconst label = t("key", "en")\n---\n<p>{label}</p>',
        file
      )
    ).toHaveLength(1)
  })

  it.for([
    {
      file: 'apps/website/src/config/contentSections.ts',
      code: 'const label = t("key", "en")',
      reports: 1
    },
    {
      file: 'apps/website/src/components/common/ContentSection.vue',
      code: '<script setup lang="ts">const label = t("key", "en")</script><template>{{ t("key", "en") }}</template>',
      reports: 2
    },
    {
      file: 'apps/website/src/components/common/ContentSection.vue',
      code: '<script setup lang="ts">const label = t(key, locale)</script><template>{{ t(key, locale) }}</template>',
      reports: 0
    }
  ])('checks locale propagation in $file', async ({ code, file, reports }) => {
    expect(await localeMessages(code, file)).toHaveLength(reports)
  })
})
