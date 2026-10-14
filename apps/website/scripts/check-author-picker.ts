import { chromium, expect } from '@playwright/test'

// Actual compiled Vue/styles with labeled public-profile fixtures only. No
// credentials, catalog writes, real profile edits or external network requests.
const port = process.env.CCC_AUTHOR_PICKER_TEST_PORT ?? '4353'
if (!['4349', '4353'].includes(port))
  throw new Error('Use an owned local frontend port')
const website = `http://127.0.0.1:${port}`
const browser = await chromium.launch({ headless: true })
try {
  for (const fixture of [
    {
      locale: 'en',
      width: 1440,
      name: 'Author',
      result: 'Profile fixture',
      suffix: 'desktop'
    },
    {
      locale: 'zh-CN',
      width: 390,
      name: '作者',
      result: 'Profile fixture',
      suffix: 'mobile-zh'
    }
  ]) {
    const context = await browser.newContext({
      viewport: { width: fixture.width, height: 900 }
    })
    const writes: string[] = []
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() !== 'GET') {
        writes.push(request.method())
        await route.abort()
        return
      }
      if (
        url.origin === website &&
        url.pathname === '/admin/content-api/profiles'
      ) {
        await route.fulfill({
          json: {
            items: url.searchParams.get('q')?.includes('Profile')
              ? [
                  {
                    id: 'fixture-Author-Case',
                    label: fixture.result,
                    username: 'profile-fixture'
                  }
                ]
              : []
          }
        })
      } else if (
        url.origin === website &&
        !/^\/(?:admin|api)\//.test(url.pathname)
      ) {
        await route.continue()
      } else await route.abort()
    })
    const page = await context.newPage()
    await page.routeWebSocket('**', (socket) => socket.close())
    await page.addInitScript('globalThis.__name = (value) => value')
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${website}/hub/models/`)
    await page.evaluate(async (locale) => {
      const path = '/src/components/cms/editor/AuthorPicker.vue'
      const stylePath = '/src/styles/global.css'
      await import(stylePath)
      const source = await (await fetch(path)).text()
      const runtime = source.match(
        /from\s+["']([^"']*\/vue\.js[^"']*)["']/
      )?.[1]
      if (!runtime) throw new Error('Component Vue runtime not found')
      const { createApp, h, reactive } = await import(runtime)
      const picker = (await import(path)).default
      document.body.replaceChildren()
      document.body.className = 'bg-admin-page font-admin text-admin-fg'
      const root = document.createElement('main')
      root.className = 'mx-auto max-w-xl p-6'
      document.body.append(root)
      const state = reactive({ id: 'fixture-current-account', submits: 0 })
      createApp({
        render: () =>
          h(
            'form',
            {
              onSubmit: (event: Event) => {
                event.preventDefault()
                state.submits++
              }
            },
            [
              h(
                'h1',
                { class: 'mb-5 text-xl' },
                'Author picker — local fixture'
              ),
              h(picker, {
                locale,
                modelValue: state.id,
                'onUpdate:modelValue': (value: string) => {
                  state.id = value
                }
              }),
              h(
                'output',
                { 'data-selection': '', class: 'mt-6 block break-all text-xs' },
                state.id
              ),
              h('output', { 'data-submits': '' }, String(state.submits))
            ]
          )
      }).mount(root)
    }, fixture.locale)
    await page.getByRole('combobox', { name: fixture.name }).fill('Profile')
    await expect(page.getByRole('option')).toContainText(fixture.result)
    await expect(page.locator('[data-selection]')).toHaveText(
      'fixture-current-account'
    )
    await page.screenshot({
      path: `/tmp/ccc-bruce-author-picker-${fixture.suffix}.png`,
      fullPage: true
    })
    await page.getByRole('combobox', { name: fixture.name }).press('Enter')
    await expect(page.locator('[data-selection]')).toHaveText(
      'fixture-Author-Case'
    )
    await expect(page.locator('[data-submits]')).toHaveText('0')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    expect(errors).toEqual([])
    expect(writes).toEqual([])
    await context.close()
  }
  process.stdout.write(
    'PASS: desktop/mobile Chinese author picker; explicit canonical selection, no form submits, writes, overflow or page errors\n'
  )
} finally {
  await browser.close()
}
