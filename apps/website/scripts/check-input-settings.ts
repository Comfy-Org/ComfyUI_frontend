import { chromium, expect } from '@playwright/test'

import { isolatedPage, readOnlyRoutes } from './catalog-browser-harness'

// Local read-only component exercise. This does not create a route, establish
// credentials, fetch catalog data or simulate/execute a paid workflow.
const port = process.env.CCC_INPUT_SETTINGS_TEST_PORT ?? '4367'
if (!['4349', '4367'].includes(port))
  throw new Error('Use local frontend port 4349 or 4367')
const website = `http://127.0.0.1:${port}`
const owner = port === '4367' ? 'buck' : 'bruce'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  })
  const writes = await readOnlyRoutes(context, website)
  const { page, errors } = await isolatedPage(context)
  await page.goto(`${website}/hub/models/`)
  await page.evaluate(async () => {
    const componentPath = '/src/components/cms/editor/InputSettings.vue'
    const stylePath = '/src/styles/global.css'
    await import(stylePath)
    const staffStylePath = '/src/styles/catalog-staff.css'
    await import(staffStylePath)
    const source = await (await fetch(componentPath)).text()
    const vuePath = source.match(/from\s+["']([^"']*\/vue\.js[^"']*)["']/)?.[1]
    if (!vuePath) throw new Error('Cannot find component Vue runtime')
    const { createApp, h, reactive } = await import(vuePath)
    const component = (await import(componentPath)).default
    document.body.replaceChildren()
    document.body.className = 'bg-admin-page font-admin text-admin-fg'
    const root = document.createElement('div')
    document.body.append(root)
    const state = reactive({
      locale: 'en',
      numeric: {
        property: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          multipleOf: 0.5,
          default: 0,
          'x-preserved': { exact: ['keep', false, 7] }
        },
        presentation: {
          control: 'slider',
          label: 'Guidance',
          hidden: false,
          advanced: true,
          help: 'Fixture help'
        }
      },
      options: {
        property: {
          enum: [false, 0, 'high'],
          default: false,
          'x-preserved': 'keep this'
        },
        presentation: {
          control: 'dropdown',
          optionLabels: { false: 'Off', '0': 'Zero', high: 'High' }
        }
      }
    })
    createApp({
      render: () =>
        h(
          'main',
          {
            class:
              'mx-auto grid max-w-6xl gap-6 bg-admin-page p-6 font-admin text-admin-fg'
          },
          [
            h(
              'h1',
              { class: 'text-3xl font-medium' },
              'Input settings — read-only local fixture'
            ),
            h(
              'button',
              {
                type: 'button',
                class:
                  'justify-self-start rounded-lg border border-admin-field px-3 py-2 text-sm',
                onClick: () => {
                  state.locale = 'zh-CN'
                }
              },
              'Chinese fixture labels'
            ),
            h(
              'section',
              { 'aria-label': 'Numeric fixture', class: 'grid gap-3' },
              [
                h('h2', { class: 'text-lg font-medium' }, 'Numeric input'),
                h(component, {
                  schemaProperty: state.numeric.property,
                  presentation: state.numeric.presentation,
                  locale: state.locale,
                  onUpdate: (value: typeof state.numeric) => {
                    state.numeric = value
                  }
                }),
                h(
                  'pre',
                  {
                    'data-numeric': true,
                    class:
                      'overflow-x-auto rounded-lg bg-admin-card p-4 text-xs text-admin-muted'
                  },
                  JSON.stringify(state.numeric, null, 2)
                )
              ]
            ),
            h(
              'section',
              { 'aria-label': 'Options fixture', class: 'grid gap-3' },
              [
                h(
                  'h2',
                  { class: 'text-lg font-medium' },
                  'Typed dropdown options'
                ),
                h(component, {
                  schemaProperty: state.options.property,
                  presentation: state.options.presentation,
                  locale: state.locale,
                  onUpdate: (value: typeof state.options) => {
                    state.options = value
                  }
                }),
                h(
                  'pre',
                  {
                    'data-options': true,
                    class:
                      'overflow-x-auto rounded-lg bg-admin-card p-4 text-xs text-admin-muted'
                  },
                  JSON.stringify(state.options, null, 2)
                )
              ]
            )
          ]
        )
    }).mount(root)
  })
  await page.getByRole('textbox', { name: 'Maximum', exact: true }).fill('1e')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('[data-numeric]')).toContainText('"maximum": 10')
  await page.getByRole('textbox', { name: 'Maximum', exact: true }).fill('20')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('[data-numeric]')).toContainText('"maximum": 20')
  await expect(page.locator('[data-numeric]')).toContainText('"x-preserved"')
  await page
    .getByRole('button', { name: 'Move option down', exact: true })
    .first()
    .click()
  const options = JSON.parse(await page.locator('[data-options]').innerText())
  expect(options.property.enum).toEqual([0, false, 'high'])
  expect(options.property.default).toBe(false)
  expect(options.property['x-preserved']).toBe('keep this')
  await page
    .getByRole('textbox', { name: 'Display label (optional)', exact: true })
    .first()
    .fill('Exactly zero')
  await expect(page.locator('[data-options]')).toContainText(
    '"0": "Exactly zero"'
  )
  await page.screenshot({
    path: `/tmp/ccc-${owner}-input-settings-desktop.png`,
    fullPage: true
  })
  await page.getByRole('button', { name: 'Chinese fixture labels' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole('textbox', { name: '最大值', exact: true })
  ).toHaveValue('20')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: `/tmp/ccc-${owner}-input-settings-mobile-zh.png`,
    fullPage: true
  })
  expect(errors).toEqual([])
  expect(writes).toEqual([])
  process.stdout.write(
    'PASS: isolated structured input controls, exact scalar types/defaults, preservation, invalid-buffer repair, desktop/mobile Chinese; no catalog writes or paid execution\n'
  )
} finally {
  await browser.close()
}
