import { chromium, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { websiteRoot } from '@website/paths'

import { isolatedPage, readOnlyRoutes } from './catalog-browser-harness'

const website = 'http://127.0.0.1:4353'
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 }
  })
  const graph = await readFile(
    join(websiteRoot, 'public/workflow-graphs/remove-background.json')
  )
  const writes = await readOnlyRoutes(context, website, {
    blocked: /^\/api\//,
    fulfill: async (url, route) => {
      if (
        url.origin === website &&
        url.pathname.startsWith('/preview-media/')
      ) {
        await route.fulfill({ contentType: 'application/json', body: graph })
        return true
      }
      if (url.href !== `${website}/__ccc_readonly_component_check__`)
        return false
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><head></head><body></body></html>'
      })
      return true
    }
  })
  const { page, errors } = await isolatedPage(context)
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
      cloud: false,
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
          runnable: false,
          scriptCode: state.empty
            ? undefined
            : { python: 'print("Read-only script example")' },
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
                cloudShareURL: 'https://cloud.comfy.org/?share=abcdef123456',
                documentationURL: 'https://docs.comfy.org/api-reference/',
                workflowFiles: [
                  {
                    name: 'Version one',
                    uid: '00000000-0000-4000-8000-000000000080',
                    href: '/workflow-graphs/remove-background.json'
                  },
                  {
                    name: 'Version two',
                    uid: '00000000-0000-4000-8000-000000000080',
                    href: '/workflow-graphs/animate-reference-sheet.json'
                  }
                ],
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
        if (!state.empty) catalogDetails.worksOnCloud = state.cloud
        const selected = { ...model, catalogDetails }
        return h('div', {}, [
          h(
            'button',
            {
              onClick: () => {
                state.cloud = true
              }
            },
            'Check Cloud link'
          ),
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
  await expect(page.getByRole('tab', { name: 'Playground' })).toHaveCount(0)
  await expect(page.getByTestId('workflow-api-snippet')).toContainText(
    'Read-only script example'
  )
  await expect(page.getByTestId('workflow-details')).toContainText(
    'Comfy CloudNo'
  )
  await expect(
    page.getByRole('link', { name: 'Referenced model' })
  ).toHaveAttribute('href', '/hub/models/local-fixture/')
  await expect(
    page.getByRole('link', { name: 'Download workflow JSON' })
  ).toHaveAttribute('href', '/workflow-graphs/animate-reference-sheet.json')
  await expect(
    page
      .getByTestId('workflow-actions')
      .getByRole('link', { name: 'API documentation', exact: true })
  ).toHaveAttribute('href', 'https://docs.comfy.org/api-reference/')
  await expect(page.getByTestId('api-docs')).toHaveAttribute(
    'href',
    'https://docs.comfy.org/api-reference/'
  )
  await page
    .getByRole('combobox', { name: 'Workflow version' })
    .selectOption({ label: 'Version one' })
  await expect(
    page.getByRole('link', { name: 'Download workflow JSON' })
  ).toHaveAttribute('href', '/workflow-graphs/remove-background.json')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download workflow JSON' }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('local-readonly-fixture.json')
  const savedPath = await download.path()
  if (!savedPath) throw new Error('Workflow download was not saved')
  expect(await readFile(savedPath)).toEqual(graph)
  await page.getByRole('button', { name: 'Check Cloud link' }).click()
  await expect(
    page.getByRole('link', { name: 'Try in Cloud' })
  ).toHaveAttribute('href', 'https://cloud.comfy.org/?share=abcdef123456')
  await page.getByRole('button', { name: 'Can I customize it?' }).click()
  await expect(page.getByText('Yes. Edit the workflow JSON.')).toBeVisible()
  await page.screenshot({
    path: '/tmp/ccc-bruce-workflow-details-desktop.png',
    animations: 'disabled',
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
  expect(writes).toEqual([])
  process.stdout.write(
    'PASS: read-only desktop/mobile workflow body, Q&A, linked facts, false/zero, empty sections; no catalog writes\n'
  )
} finally {
  await browser.close()
}
