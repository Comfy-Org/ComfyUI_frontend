import { mergeTests } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
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
        if (widget.name?.startsWith('preview_')) {
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
        execution.executed('', id, { text: 'massive fennec ears' })
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
      const jobId = ''

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
