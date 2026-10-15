import { chromium, expect } from '@playwright/test'
import tailwind from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { createServer } from 'vite'
import { websiteRoot } from '@website/paths'
import { fixtureReview } from '@/lib/cms/staging-fixture'

const server = await createServer({
  configFile: false,
  appType: 'custom',
  root: websiteRoot,
  plugins: [vue(), tailwind()],
  resolve: { tsconfigPaths: true },
  server: { host: '127.0.0.1', port: 4349, strictPort: true },
  logLevel: 'warn'
})
const path = '/__catalog_review_check'
server.middlewares.use(path, async (_request, response) => {
  const html = await server.transformIndexHtml(
    path,
    `<!doctype html>
    <html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body><main id="review"></main><script type="module">
      import { createApp } from 'vue'
      import CatalogCheckedReview from '/src/components/cms/review/CatalogCheckedReview.vue'
      import { fixtureReview } from '/src/lib/cms/staging-fixture.ts'
      import '/src/styles/global.css'
      const initial = fixtureReview()
      initial.items[0].content.document.title = 'Local review layout fixture'
      createApp(CatalogCheckedReview, { initial, csrf: 'layout-fixture-only', canApply: true, canEdit: true }).mount('#review')
    </script></body></html>`
  )
  response.setHeader('Content-Type', 'text/html')
  response.end(html)
})
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  })
  context.setDefaultTimeout(15_000)
  context.setDefaultNavigationTimeout(20_000)
  const origin = 'http://127.0.0.1:4349'
  const mutations: string[] = []
  const fixture = fixtureReview()
  fixture.items[0].decision = 'APPROVED'
  const final = {
    state: fixture.state,
    changes: fixture.items,
    deferred: [],
    selection_digest: 'b'.repeat(64),
    publish_enabled: false
  }
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (
      url.origin === origin &&
      url.pathname === '/admin/catalog-api/final-review' &&
      request.method() === 'POST'
    ) {
      expect(request.postDataJSON()).toEqual({
        review: {
          expected_live_rev: 1,
          expected_draft_rev: 7,
          expected_draft_generation: 5
        },
        selected_uids: [fixture.items[0].content.uid]
      })
      await route.fulfill({ json: final })
    } else if (request.method() !== 'GET') {
      mutations.push(url.pathname)
      await route.abort()
    } else if (
      url.origin === origin &&
      url.pathname === '/admin/catalog-api/final-review'
    ) {
      await route.fulfill({ json: final })
    } else if (
      url.origin === origin &&
      !url.pathname.startsWith('/admin/') &&
      !url.pathname.startsWith('/api/')
    ) {
      await route.continue()
    } else await route.abort()
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${origin}${path}`)
  await expect(page.locator('#review')).not.toBeEmpty()
  await expect(
    page.getByRole('button', { name: 'Review selected (0)' })
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Defer Selected' })
  ).toHaveCount(0)
  await page
    .getByRole('checkbox', { name: 'Select Local review layout fixture' })
    .check()
  const reviewButton = page.getByRole('button', { name: 'Review selected (1)' })
  await reviewButton.click()
  const dialog = page.getByRole('dialog', { name: 'Final review' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS('opacity', '1')
  await expect(
    dialog.getByRole('button', { name: 'Publish', exact: true })
  ).toBeDisabled()
  await expect(
    dialog.getByText('Review fixture', { exact: true })
  ).toBeVisible()
  await page.screenshot({ path: '/tmp/ccc-bruce-mar-final-review-desktop.png' })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(reviewButton).toBeFocused()
  await page.setViewportSize({ width: 390, height: 844 })
  await reviewButton.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCSS('opacity', '1')
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({ path: '/tmp/ccc-bruce-mar-final-review-mobile.png' })
  await dialog.getByRole('button', { name: 'Back to staging' }).click()
  await expect(dialog).toHaveCount(0)
  await page
    .getByRole('button', {
      name: 'Delete change for Local review layout fixture'
    })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Delete 1 changes?' })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(mutations).toEqual([])
  expect(errors).toEqual([])
  process.stdout.write(
    'PASS: isolated compiled review popup, desktop/mobile, Escape/focus, disabled Publish, cancel; no catalog writes/auth claim\n'
  )
} finally {
  await browser?.close()
  await server.close()
}
