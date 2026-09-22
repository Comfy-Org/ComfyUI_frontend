import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Legacy ecosystem promoted widget options reassignment',
  { tag: ['@vue-nodes', '@widget', '@subgraph'] },
  () => {
    // https://comfy-org.sentry.io/issues/FRONTEND-80
    //
    // comfyui-combofilter (and other legacy extensions that filter COMBO
    // values) blindly reassign `widget.options = {...}` for every widget it
    // finds on a node. A promoted subgraph input is projected onto the host
    // node from the widget-value store (promotedWidgetStoreProjection.ts /
    // promotedInputWidget.ts), and that projection's `options` now has a
    // setter that writes through to the store, so the reassignment applies
    // instead of throwing.
    test('reassigning options on a promoted subgraph widget succeeds', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const promotedTextarea = comfyPage.vueNodes
        .getNodeLocator('11')
        .getByRole('textbox', { name: 'text' })
      await expect(promotedTextarea).toBeVisible()

      const errorMessage = await comfyPage.page.evaluate(() => {
        'use strict'
        const node = window.app!.rootGraph.nodes.find(
          (candidate) => String(candidate.id) === '11'
        )
        const widget = node?.widgets?.[0]
        if (!widget) return 'promoted widget not found'
        try {
          widget.options = { ...widget.options, multiline: true }
          return widget.options.multiline === true
            ? null
            : 'options were not applied'
        } catch (error) {
          return error instanceof Error ? error.message : String(error)
        }
      })

      expect(errorMessage).toBeNull()
    })
  }
)
