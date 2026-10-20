import { expect } from '@playwright/test'
import { test } from '@website/e2e/fixtures/blockExternalMedia'
import axe from 'axe-core'

import manifest from '@website/.storybook/generated/component-manifest.json' with { type: 'json' }

declare global {
  interface Window {
    axe: typeof axe
  }
}

const fixtures = [
  ['website-common-nodebadge--with-logo', 'WORKS', true],
  ['website-ui-badge--accent', 'Available now', false],
  ['website-ui-badge--callout', 'Featured', false],
  ['website-common-productherobadge--default', 'DESKTOP', false],
  [
    'website-blocks-cardarticle01--default',
    'Connect coding agents to ComfyUI',
    true
  ],
  ['website-guidelines-proposed-components--status', 'Proposals only.', false],
  [
    'website-guidelines-buttons-and-arrows--cta-buttons',
    'GET AN API KEY',
    false
  ]
] as const

test.describe('Marketing catalog', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      'https://media.comfy.org/website/minimax-music-3/*.mp3',
      (route) => route.fulfill({ contentType: 'audio/mpeg', body: '' })
    )
  })

  for (const [id, text, expectsImages] of fixtures) {
    test(id, async ({ page }, testInfo) => {
      await page.goto(
        `/iframe.html?id=${id}&viewMode=story&globals=a11y.manual:true`
      )
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible()
      await page.evaluate(async () => document.fonts.ready)
      const images = page.locator('#storybook-root img')
      if (expectsImages) {
        await expect
          .poll(() =>
            images.evaluateAll(
              (elements) =>
                elements.length > 0 &&
                elements.every(
                  (element) =>
                    element instanceof HTMLImageElement &&
                    element.complete &&
                    element.naturalWidth > 0
                )
            )
          )
          .toBe(true)
      }
      await page.addScriptTag({ content: axe.source })
      await expect(async () => {
        const violations = await page.evaluate(async () => {
          const result = await window.axe.run('#storybook-root', {
            runOnly: ['wcag2a', 'wcag2aa'],
            rules: { 'color-contrast': { enabled: false } }
          })
          return result.violations.map(({ id, description }) => ({
            id,
            description
          }))
        })
        expect(violations).toEqual([])
      }).toPass({ timeout: 5000 })
      await testInfo.attach('rendered-story', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
      })
    })
  }

  for (const component of manifest.components.filter(
    ({ agent }) => agent.compositionSafe
  )) {
    for (const { storyId } of component.stories) {
      test(`certified story renders: ${storyId}`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(
          `/iframe.html?id=${storyId}&viewMode=story&globals=a11y.manual:true`
        )
        await expect
          .poll(() =>
            page.locator('#storybook-root').evaluate((root) => {
              const content = root.textContent.trim()
              const visual = root.querySelector(
                'img,video,svg,canvas,input,button,iframe,[role]'
              )
              return Boolean(content || visual)
            })
          )
          .toBe(true)
        await expect(page.locator('.sb-errordisplay')).not.toBeVisible()
        expect(errors).toEqual([])
      })
    }
  }

  test('published manifest links resolve in the built catalog', async ({
    request
  }) => {
    const indexResponse = await request.get('/index.json')
    expect(indexResponse.ok()).toBe(true)
    const manifestResponse = await request.get(
      '/design-system/component-manifest.json'
    )
    expect(manifestResponse.ok()).toBe(true)
    const index: { entries: Record<string, unknown> } =
      await indexResponse.json()
    const manifest: {
      components: Array<{
        stories: Array<{ storyId: string }>
        agent: { storybookPath: string; docsPath: string }
      }>
      recipes: Array<{ storyId: string }>
    } = await manifestResponse.json()
    const ids = [
      ...manifest.components.flatMap(({ stories, agent }) => [
        ...stories.map(({ storyId }) => storyId),
        agent.storybookPath.split('/').at(-1),
        agent.docsPath.split('/').at(-1)
      ]),
      ...manifest.recipes.map(({ storyId }) => storyId)
    ]
    expect(ids.filter((id) => !id || !(id in index.entries))).toEqual([])
  })

  test('event recipe filters retain their matching articles', async ({
    page
  }) => {
    await page.goto(
      '/iframe.html?id=website-recipes-page-patterns--event&viewMode=story'
    )
    for (const [tab, visible, hidden] of [
      [
        'Livestreams',
        'Building production-ready workflows',
        'A practical guide to reusable graphs'
      ],
      [
        'Community',
        'A practical guide to reusable graphs',
        'Building production-ready workflows'
      ]
    ]) {
      await page.getByRole('button', { name: new RegExp(tab) }).click()
      await expect(page.getByText(visible, { exact: true })).toBeVisible()
      await expect(page.getByText(hidden, { exact: true })).toHaveCount(0)
    }
  })

  test('FAQ opens and closes with the keyboard', async ({ page }) => {
    await page.goto(
      '/iframe.html?id=website-common-faqsection--mobile&viewMode=story&globals=a11y.manual:true'
    )
    const question = page.getByRole('button').first()
    await expect(question).toHaveAttribute('aria-expanded', 'false')
    await question.focus()
    await page.keyboard.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Enter')
    await expect(question).toHaveAttribute('aria-expanded', 'false')
  })
})
