import { chromium, expect } from '@playwright/test'

import { isolatedPage, readOnlyRoutes } from './catalog-browser-harness'

// Read-only local component harness, not a routable admin/demo page. It loads
// our Vite components into an isolated browser document with labeled fixtures;
// no credentials, catalog mutations, backend requests or production URLs.
const port = process.env.CCC_LAYOUT_TEST_PORT ?? '4367'
if (!['4349', '4367'].includes(port))
  throw new Error('Use an isolated local frontend port: 4349 or 4367')
const website = `http://127.0.0.1:${port}`
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  })
  const writes = await readOnlyRoutes(context, website)
  const { page, errors } = await isolatedPage(context)
  await page.goto(`${website}/hub/models/`)
  await page.evaluate(async () => {
    const shellPath = '/src/components/cms/layout/CatalogAdminShell.vue'
    const previewPath = '/src/components/cms/preview/CatalogPreviewBar.vue'
    const stylePath = '/src/styles/global.css'
    await import(stylePath)
    // Reuse the exact optimized Vue runtime already imported by these modules.
    const source = await (await fetch(shellPath)).text()
    const vuePath = source.match(/from\s+["']([^"']*\/vue\.js[^"']*)["']/)?.[1]
    if (!vuePath) throw new Error('Cannot find the component Vue runtime')
    const { createApp, h, reactive } = await import(vuePath)
    const shell = (await import(shellPath)).default
    const preview = (await import(previewPath)).default
    document.body.replaceChildren()
    const root = document.createElement('div')
    document.body.append(root)
    const state = reactive({
      active: true,
      view: 'DRAFT',
      now: '2026-10-15T09:00:00Z',
      locale: 'en'
    })
    const changes = [
      {
        uid: 'layout-fixture-1',
        title: 'Local layout fixture: model',
        kind: 'modified',
        summary: 'Title and thumbnail changed',
        fields: ['$.title', '$.thumbnail.file_version_uid'],
        route: '/hub/models/'
      },
      {
        uid: 'layout-fixture-2',
        title: 'Local layout fixture: workflow',
        kind: 'added',
        summary: 'New workflow with one example',
        visibleFrom: '2026-10-15T09:00:00Z'
      }
    ]
    createApp({
      render: () =>
        h('div', {}, [
          h(preview, {
            ...state,
            changes,
            launches: [
              {
                uid: 'layout-fixture-2',
                title: 'Local scheduled fixture',
                at: '2026-10-15T09:00:00Z'
              }
            ],
            onExit: () => {
              state.view = 'LIVE'
              state.now = ''
              state.active = false
            },
            onView: (view: string) => {
              state.view = view
            },
            onNavigate: (path: string) => {
              root.dataset.navigation = path
            },
            onTimewarp: (at: string | undefined) => {
              state.now = at ?? ''
            },
            onLocale: (locale: string) => {
              state.locale = locale
            }
          }),
          h(
            shell,
            {
              current: 'content',
              liveRevision: 12,
              draftCount: 2,
              contentCount: 45,
              locale: state.locale
            },
            {
              default: () =>
                h('div', { class: 'grid gap-5' }, [
                  h(
                    'header',
                    {
                      class: 'flex flex-wrap items-center justify-between gap-3'
                    },
                    [
                      h('h1', { class: 'text-3xl font-medium' }, 'All content'),
                      h(
                        'p',
                        { class: 'text-xs text-admin-muted' },
                        'Read-only layout fixtures; not catalog data'
                      )
                    ]
                  ),
                  h(
                    'section',
                    {
                      class:
                        'rounded-2xl border border-admin-line bg-admin-card p-5'
                    },
                    changes.map((change) =>
                      h(
                        'div',
                        {
                          class:
                            'flex flex-wrap items-center justify-between gap-2 border-b border-admin-line py-4 last:border-b-0'
                        },
                        [
                          h(
                            'span',
                            { class: 'text-sm font-medium' },
                            change.title
                          ),
                          h(
                            'span',
                            { class: 'text-xs text-admin-muted' },
                            change.summary
                          )
                        ]
                      )
                    )
                  )
                ])
            }
          )
        ])
    }).mount(root)
  })
  await expect(
    page.getByRole('region', { name: 'Catalog preview controls' })
  ).toBeVisible()
  await expect(page.getByRole('region')).toHaveCSS(
    'background-color',
    'rgb(242, 255, 89)'
  )
  await page.getByRole('button', { name: 'ADMIN', exact: true }).click()
  expect(
    await page.evaluate(() =>
      document.body.firstElementChild?.getAttribute('data-navigation')
    )
  ).toBe('/admin/catalog')
  await page
    .getByRole('combobox', { name: 'Catalog version' })
    .selectOption('LIVE')
  await expect(page.getByRole('region')).toBeVisible()
  await expect(page.getByRole('region')).not.toContainText('2 Draft changes')
  await page
    .getByRole('combobox', { name: 'Catalog version' })
    .selectOption('DRAFT')
  await expect(
    page.getByRole('link', { name: 'All content 45' })
  ).toHaveAttribute('aria-current', 'page')
  await page.screenshot({
    path: '/tmp/ccc-buck-layout-desktop.png',
    fullPage: true
  })
  await page.getByRole('button', { name: 'Changes', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByText('Changed fields').click()
  await expect(page.getByText('$.thumbnail.file_version_uid')).toBeVisible()
  await page.screenshot({
    path: '/tmp/ccc-buck-layout-changes.png',
    fullPage: true
  })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Changes', exact: true })
  ).toBeFocused()
  await page
    .getByRole('button', { name: 'Preview date and time', exact: true })
    .click()
  await page.getByLabel('Preview date and time (UTC)').fill('2026-11-01T01:30')
  await page.getByRole('button', { name: 'Show this date' }).click()
  await expect(
    page.getByRole('button', { name: 'Preview date and time', exact: true })
  ).toContainText('UTC')
  await page
    .getByRole('combobox', { name: 'Preview language' })
    .selectOption('zh-CN')
  await expect(
    page.getByRole('region', { name: '内容目录预览控件' })
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: '目录管理' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/ccc-buck-layout-mobile-zh.png',
    fullPage: true
  })
  await page.getByRole('button', { name: '现在', exact: true }).click()
  await expect(page.getByRole('region')).not.toContainText('定时内容')
  await page.getByRole('button', { name: '退出', exact: true }).click()
  await expect(page.getByRole('region')).toHaveCount(0)
  expect(errors).toEqual([])
  expect(writes).toEqual([])
  process.stdout.write(
    'PASS: isolated Mar shell/Preview layout, desktop/mobile, changes, keyboard focus, UTC/NOW, locale and EXIT; no backend writes or auth claim\n'
  )
} finally {
  await browser.close()
}
