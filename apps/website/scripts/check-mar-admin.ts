import { chromium, expect } from '@playwright/test'

import { isolatedPage, readOnlyRoutes } from './catalog-browser-harness'

const website = 'http://127.0.0.1:4353'
const browser = await chromium.launch()
try {
  for (const fixture of [
    { locale: 'en', width: 1440, suffix: 'desktop' },
    { locale: 'en', width: 390, suffix: 'mobile-en' },
    { locale: 'zh-CN', width: 390, suffix: 'mobile-zh' }
  ]) {
    const context = await browser.newContext({
      viewport: { width: fixture.width, height: 1000 }
    })
    const writes = await readOnlyRoutes(context, website, {
      blocked: /^\/(?:admin|api|preview-media)\//
    })
    const { page, errors } = await isolatedPage(context)
    await page.goto(`${website}/hub/models/`)
    await page.evaluate(async (locale) => {
      const path = '/src/components/cms/review/CatalogCheckedReview.vue'
      const styles = '/src/styles/global.css'
      const fixturePath = '/src/lib/cms/staging-fixture.ts'
      await import(styles)
      const source = await (await fetch(path)).text()
      const runtime = source.match(
        /from\s+["']([^"']*\/vue\.js[^"']*)["']/
      )?.[1]
      if (!runtime) throw new Error('Component runtime unavailable')
      const { createApp, h } = await import(runtime)
      const component = (await import(path)).default
      const { fixtureReview } = await import(fixturePath)
      const initial = fixtureReview()
      const original = initial.items[0]
      if (!original) throw new Error('Missing review fixture')
      initial.items = [
        ['New Demo Model', 'model', 'Black Forest Labs', true],
        ['Cinematic portrait relight', 'workflow', 'Fixture creator', true],
        ['Product shot on white', 'workflow', 'Fixture creator', true],
        ['Beeble SwitchX Image Edit (Pro)', 'model', 'Beeble', false],
        ['Beeble SwitchX Video Edit', 'model', 'Beeble', false],
        ['FLUX 2 Max Text-to-Image', 'model', 'Black Forest Labs', false]
      ].map(([title, type, provider, added], i) => {
        const item = structuredClone(original)
        item.content.uid = `00000000-0000-4000-8000-${String(i + 10).padStart(12, '0')}`
        item.content.type = type
        item.content.document = {
          title,
          provider,
          slug: `fixture-${i}`,
          description: 'Local visual fixture'
        }
        if (added) delete item.before
        if (i === 5) item.content.document.visible_from = '2026-10-20T16:00:00Z'
        return item
      })
      document.body.replaceChildren()
      document.body.className = 'bg-admin-page text-admin-fg'
      const root = document.createElement('main')
      document.body.append(root)
      createApp({
        render: () =>
          h(component, {
            initial,
            csrf: 'fixture-no-authority',
            canApply: true,
            canEdit: true,
            locale
          })
      }).mount(root)
    }, fixture.locale)
    const title = page.getByRole('button', {
      name: 'New Demo Model',
      exact: true
    })
    await expect(title).toBeVisible()
    await expect(page.getByRole('table')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: `/tmp/ccc-bruce-mar-merged-${fixture.suffix}.png`,
      fullPage: true
    })
    const check = page.getByRole('checkbox', { name: /New Demo Model/ })
    await check.check()
    await title.click()
    const drawer = page.getByRole('dialog', { name: 'New Demo Model' })
    await expect(drawer).toBeVisible()
    await expect
      .poll(async () => {
        const bounds = await drawer.boundingBox()
        return bounds
          ? Math.abs(bounds.x + bounds.width - fixture.width)
          : Infinity
      })
      .toBeLessThanOrEqual(1)
    await page.screenshot({
      path: `/tmp/ccc-bruce-mar-drawer-${fixture.suffix}.png`,
      fullPage: true
    })
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(title).toBeFocused()
    expect(writes).toEqual([])
    expect(errors).toEqual([])
    await context.close()
  }
  process.stdout.write(
    'PASS: merged Mar Draft table and right drawer at desktop/mobile English and Chinese; checkbox and Escape focus restore; no backend writes, page errors or overflow\n'
  )
} finally {
  await browser.close()
}
