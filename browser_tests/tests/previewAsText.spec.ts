import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { heightOf } from '@e2e/fixtures/utils/locatorBox'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

test.describe('Preview as Text node', () => {
  test('does not include preview widget values in the API prompt', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('PreviewAny')!
      node.pos = [500, 200]
      window.app!.graph.add(node)
    })

    // Simulate a previous execution: backend returned text and the frontend
    // populated the preview widget values. The next prompt submission must
    // NOT echo those values back as inputs (which would change the cache
    // signature and trigger a redundant re-execution).
    await comfyPage.page.evaluate(() => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'PreviewAny')!
      for (const widget of node.widgets ?? []) {
        if (widget.name.startsWith('preview_')) {
          widget.value = 'rendered preview content from previous execution'
        }
      }
    })

    const apiWorkflow = await comfyPage.workflow.getExportedWorkflow({
      api: true
    })

    const previewEntry = Object.values(apiWorkflow).find(
      (n) => n.class_type === 'PreviewAny'
    )
    expect(previewEntry).toBeDefined()

    expect(previewEntry!.inputs).not.toHaveProperty('preview_markdown')
    expect(previewEntry!.inputs).not.toHaveProperty('preview_text')
    expect(previewEntry!.inputs).not.toHaveProperty('previewMode')
  })

  wstest(
    'switches between Markdown and plain text in the classic renderer',
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const source = '# Heading\n\nSome **bold** text'

      await comfyPage.menu.topbar.newWorkflowButton.click()
      const node = await comfyPage.nodeOps.addNode(
        'PreviewAny',
        {},
        {
          x: 300,
          y: 200
        }
      )
      const jobId = await execution.run()
      execution.executed(jobId, String(node.id), { text: [source] })

      const plaintext = comfyPage.page.getByRole('textbox', {
        name: 'preview_text'
      })
      const heading = comfyPage.page.getByRole('heading', {
        name: 'Heading',
        level: 1
      })
      await expect(plaintext).toHaveValue(source)

      const modeToggle = await node.getWidgetByName('preview_mode')
      const toggleTop = await modeToggle.getPosition()
      const widgetHeight = await comfyPage.page.evaluate(
        () => window.LiteGraph!.NODE_WIDGET_HEIGHT
      )
      const clickModeToggle = () =>
        comfyPage.page.mouse.click(toggleTop.x, toggleTop.y + widgetHeight / 2)

      await test.step('Markdown mode renders the source', async () => {
        await clickModeToggle()
        await expect(heading).toBeVisible()
        await expect(plaintext).toBeHidden()
      })

      await test.step('plain text mode shows the source', async () => {
        await clickModeToggle()
        await expect(plaintext).toHaveValue(source)
        await expect(heading).toBeHidden()
      })
    }
  )

  wstest(
    'restoring workflow restores state',
    { tag: '@vue-nodes' },
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.searchBoxV2.addNode('Preview as Text')
      const node = await comfyPage.vueNodes.getFixtureByTitle('Preview as Text')
      const preview = comfyPage.vueNodes.getWidgetByName(
        'Preview as Text',
        'preview_text'
      )

      await test.step('node previews execution result', async () => {
        const id = await comfyPage.vueNodes.getNodeIdByTitle('Preview as Text')
        const jobId = await execution.run()
        execution.executed(jobId, id, { text: 'massive fennec ears' })
        await expect(preview).toHaveValue('massive fennec ears')
      })

      await test.step('swap to a different workflow and back', async () => {
        await comfyPage.menu.topbar.getTab(0).click()
        await expect(node.root).toBeHidden()
        await comfyPage.menu.topbar.getTab(1).click()
        await expect(node.root).toBeVisible()
      })

      await expect(preview, 'previous output is restored').toHaveValue(
        'massive fennec ears'
      )
    }
  )

  wstest(
    'Save Text previews its execution result',
    { tag: '@vue-nodes' },
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.searchBoxV2.addNode('Save Text')
      const preview = comfyPage.vueNodes.getWidgetByName(
        'Save Text',
        'preview_text'
      )
      const id = await comfyPage.vueNodes.getNodeIdByTitle('Save Text')
      const jobId = await execution.run()

      await test.step('shows the saved text', async () => {
        execution.executed(jobId, id, { text: ['saved notes'] })
        await expect(preview).toHaveValue('saved notes')
      })

      await test.step('replaces it with the next output', async () => {
        execution.executed(jobId, id, { text: ['revised notes'] })
        await expect(preview).toHaveValue('revised notes')
      })

      await test.step('clears it when the output is empty', async () => {
        execution.executed(jobId, id, null)
        await expect(preview).toHaveValue('')
      })
    }
  )

  wstest(
    'keeps its size and scrolls when switching long output to Markdown',
    { tag: '@vue-nodes' },
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const source = Array.from(
        { length: 40 },
        (_, index) => `- item ${index + 1}`
      ).join('\n')

      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.searchBoxV2.addNode('Preview as Text')
      const node = await comfyPage.vueNodes.getFixtureByTitle('Preview as Text')
      const id = await comfyPage.vueNodes.getNodeIdByTitle('Preview as Text')
      const preview = comfyPage.vueNodes.getWidgetByName(
        'Preview as Text',
        'preview_text'
      )
      const jobId = await execution.run()
      execution.executed(jobId, id, { text: [source] })
      await expect(preview).toHaveValue(source)
      const plaintextHeight = await heightOf(node.root)

      await test.step('Markdown mode keeps the node height', async () => {
        await node.root.getByRole('button', { name: 'Markdown' }).click()
        await expect(preview.getByRole('listitem')).toHaveCount(40)
        await expect.poll(() => heightOf(node.root)).toBe(plaintextHeight)
      })

      await test.step('the focused Markdown preview scrolls', async () => {
        await preview.click()
        await comfyPage.page.mouse.wheel(0, 200)
        await expect
          .poll(() => preview.evaluate((el) => el.scrollTop))
          .toBeGreaterThan(0)
      })
    }
  )

  wstest(
    'renders the payloads users reported blank',
    { tag: '@vue-nodes' },
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())

      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.searchBoxV2.addNode('Preview as Text')
      const preview = comfyPage.vueNodes.getWidgetByName(
        'Preview as Text',
        'preview_text'
      )
      const id = await comfyPage.vueNodes.getNodeIdByTitle('Preview as Text')
      const jobId = await execution.run()

      const payloads = [
        ['compact JSON from an LLM node', '{"name":"Comfy","emoji":"🌟"}'],
        ['JSON array', '[{"a": 1}, {"b": 2}]'],
        ['markdown-fenced JSON', '```json\n{"name":"Comfy"}\n```'],
        ['non-ASCII text', '你好，世界。'],
        ['prompt with a trailing space', '"A red car" is a great prompt. ']
      ] as const

      for (const [label, text] of payloads) {
        await test.step(label, async () => {
          execution.executed(jobId, id, { text: [text] })
          await expect(preview).toHaveValue(text)
        })
      }

      await test.step('numeric output from Get Video Components', async () => {
        execution.executed(jobId, id, { text: 23.976 })
        await expect(preview).toHaveValue('23.976')
      })

      const malformedOutputs = [
        [
          'null text',
          // The shape the Cloud backend produced when it misclassified the
          // text as a filename and dropped it from the payload (BE-3601).
          { text: [null] },
          'recovered'
        ],
        ['output with no text key', {}, 'recovered again'],
        ['nullish output', null, 'recovered from nullish']
      ] as const

      for (const [label, output, recoveredText] of malformedOutputs) {
        await test.step(`${label} does not wedge the widget`, async () => {
          execution.executed(jobId, id, output)
          await expect(preview).toHaveValue('')

          execution.executed(jobId, id, { text: [recoveredText] })
          await expect(preview).toHaveValue(recoveredText)
        })
      }

      await test.step('undefined output does not wedge the widget', async () => {
        execution.executed(jobId, id, undefined)
        await expect(preview).toHaveValue('')

        execution.executed(jobId, id, { text: ['recovered from nullish'] })
        await expect(preview).toHaveValue('recovered from nullish')
      })
    }
  )
})
