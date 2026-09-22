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
    // finds on a node. That works for an ordinary widget - see the
    // "wholesale options replacement" case in legacyEcosystemDrawSerialize -
    // but a promoted subgraph input is projected onto the host node from the
    // widget-value store (promotedWidgetStoreProjection.ts /
    // promotedInputWidget.ts), and that projection's `options` is a
    // getter with no setter. Reassigning it throws a TypeError instead of
    // replacing the options object, which crashes the whole extension (and,
    // depending on load order, the workflow) on load.
    test('reassigning options on a promoted subgraph widget throws', async ({
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
          widget.options = { ...widget.options }
          return null
        } catch (error) {
          return error instanceof Error ? error.message : String(error)
        }
      })

      // TODO(FRONTEND-80): this documents a real crash. Remove `test.fail()`
      // once `widget.options` is assignable on promoted subgraph widgets, or
      // the loader guards the assignment instead of letting it throw.
      test.fail()
      expect(errorMessage).toBeNull()
    })
  }
)
