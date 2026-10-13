import { chromium, expect } from '@playwright/test'

const website = 'http://127.0.0.1:4353'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  })
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.href === `${website}/__ccc_readonly_component_check__`) {
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head></head><body></body></html>'
      })
      return
    }
    if (url.origin === website && !url.pathname.startsWith('/api/'))
      await route.continue()
    else await route.abort()
  })
  const page = await context.newPage()
  await page.routeWebSocket('**', (socket) => socket.close())
  await page.addInitScript('globalThis.__name = (value) => value')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${website}/__ccc_readonly_component_check__`)
  await page.evaluate(async () => {
    const stylePath = '/src/styles/global.css'
    await import(stylePath)
    const path = '/src/components/workshop/WorkflowPage.vue'
    const source = await (await fetch(path)).text()
    const runtime = source.match(/from\s+["']([^"']*\/vue\.js[^"']*)["']/)?.[1]
    if (!runtime) throw new Error('Component Vue runtime unavailable')
    const { createApp, h, reactive } = await import(runtime)
    const workflowPage = (await import(path)).default
    const state = reactive({
      locale: 'en',
      empty: false
    })
    const model = {
      type: 'CLOUD',
      slug: 'workflows/local-readonly-fixture',
      name: 'Read-only workflow layout fixture',
      href: '/hub/workflows/local-readonly-fixture/',
      workflowId: 'workflows/local-readonly-fixture',
      workflowCount: 0,
      capabilities: [],
      fields: [],
      defaults: {},
      examples: [],
      workflow: {
        id: 'workflows/local-readonly-fixture',
        definitionVersion: 'local-fixture',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        },
        inputs: {}
      }
    }
    document.body.replaceChildren()
    const root = document.createElement('div')
    root.className =
      'bg-primary-comfy-ink min-h-screen text-primary-comfy-canvas'
    document.body.append(root)
    createApp({
      render: () => {
        const catalogDetails = {
          locale: state.locale,
          models: state.empty
            ? []
            : [
                {
                  uid: 'model-fixture',
                  name: 'Referenced model',
                  href: '/hub/models/local-fixture/'
                }
              ],
          ...(state.empty
            ? {}
            : {
                worksOnCloud: false,
                runs: 0,
                downloads: 12,
                outputType: 'video',
                longDescription:
                  'A workflow you can customize.\n\nDownload the JSON, then change the inputs.'
              }),
          faqs: state.empty
            ? []
            : [
                {
                  id: 'local',
                  question: 'Can I customize it?',
                  answer: 'Yes. Edit the workflow JSON.'
                }
              ]
        }
        const selected = { ...model, catalogDetails }
        return h('div', {}, [
          h(
            'button',
            {
              onClick: () => {
                state.locale = 'zh-CN'
              }
            },
            'Check Chinese'
          ),
          h(
            'button',
            {
              onClick: () => {
                state.empty = true
              }
            },
            'Check empty'
          ),
          h(workflowPage, { model: selected })
        ])
      }
    }).mount(root)
  })
  await expect(
    page.getByRole('heading', { name: 'About this workflow' })
  ).toBeVisible()
  await expect(page.getByText('A workflow you can customize.')).toBeVisible()
  await page.getByRole('tab', { name: 'Details' }).click()
  await expect(page.getByTestId('workflow-details')).toContainText(
    'Comfy CloudNo'
  )
  await expect(
    page.getByRole('link', { name: 'Referenced model' })
  ).toHaveAttribute('href', '/hub/models/local-fixture/')
  await page.getByRole('button', { name: 'Can I customize it?' }).click()
  await expect(page.getByText('Yes. Edit the workflow JSON.')).toBeVisible()
  await page.screenshot({
    path: '/tmp/ccc-bruce-workflow-details-desktop.png',
    fullPage: true
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Check Chinese' }).click()
  await expect(
    page.getByRole('heading', { name: '关于此工作流' })
  ).toBeVisible()
  await expect(page.getByTestId('workflow-details')).toContainText('运行次数0')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/ccc-bruce-workflow-details-mobile-zh.png',
    fullPage: true
  })
  await page.getByRole('button', { name: 'Check empty' }).click()
  await expect(page.getByRole('heading', { name: '关于此工作流' })).toHaveCount(
    0
  )
  await expect(page.getByRole('heading', { name: '常见问答' })).toHaveCount(0)
  await expect(page.getByTestId('workflow-facts')).toHaveCount(0)
  expect(errors).toEqual([])
  console.log(
    'PASS: read-only desktop/mobile workflow body, Q&A, linked facts, false/zero, empty sections; no catalog writes'
  )
} finally {
  await browser.close()
}
