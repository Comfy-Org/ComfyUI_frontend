import type { ConsoleMessage } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getPseudoPreviewWidgets } from '@e2e/fixtures/utils/promotedWidgets'

const domPreviewSelector = '.image-preview'

test.describe('Subgraph Lifecycle', { tag: ['@subgraph'] }, () => {
  test.describe('Cleanup Behavior After Promoted Source Removal', () => {
    test('Deleting the promoted source removes the exterior DOM widget', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )

      const textarea = comfyPage.page.getByTestId(
        TestIds.widgets.domWidgetTextarea
      )
      await expect(textarea).toBeVisible()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      const clipNode = await comfyPage.nodeOps.getNodeRefById('10')
      await clipNode.delete()

      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect(
        comfyPage.page.getByTestId(TestIds.widgets.domWidgetTextarea)
      ).toHaveCount(0)
    })
  })

  test.describe('Unpack/Remove Cleanup for Pseudo-Preview Targets', () => {
    test('Unpacking the preview subgraph clears promoted preview state and DOM', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-preview-node'
      )

      await expect
        .poll(async () => {
          const widgets = await getPseudoPreviewWidgets(comfyPage, '5')
          return widgets.length
        })
        .toBeGreaterThan(0)

      await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph!
        const subgraphNode = graph.getNodeById('5')
        if (!subgraphNode || !subgraphNode.isSubgraphNode()) return
        graph.unpackSubgraph(subgraphNode)
      })
      await comfyPage.nextFrame()

      await expect
        .poll(async () => comfyPage.subgraph.countGraphPseudoPreviewEntries())
        .toBe(0)
      await expect(comfyPage.page.locator(domPreviewSelector)).toHaveCount(0)
    })

    test('Removing the preview subgraph clears promoted preview state and DOM', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-preview-node'
      )

      await expect
        .poll(async () => {
          const widgets = await getPseudoPreviewWidgets(comfyPage, '5')
          return widgets.length
        })
        .toBeGreaterThan(0)

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('5')
      await expect.poll(() => subgraphNode.exists()).toBe(true)

      await subgraphNode.delete()

      await expect.poll(() => subgraphNode.exists()).toBe(false)

      await expect
        .poll(async () => comfyPage.subgraph.countGraphPseudoPreviewEntries())
        .toBe(0)
      await expect(comfyPage.page.locator(domPreviewSelector)).toHaveCount(0)
    })
  })

  test.describe('Detach Race Repro', { tag: ['@vue-nodes'] }, () => {
    const SUBGRAPH_NODE_TITLE = 'New Subgraph'

    // Capture-and-defer the legacy onNodeRemoved/onSelectionChange handlers
    // so the test can drive unpack to completion before they run. Widens
    // the race window so a guard regression deterministically surfaces; on
    // fast environments the legacy cleanup runs in time and masks the bug.
    const DEFERRED_HANDLERS_KEY = '__deferredHandlers'

    async function deferLegacyHandlers(comfyPage: ComfyPage) {
      await comfyPage.page.evaluate((key) => {
        const w = window as unknown as Record<string, unknown>
        const graph = window.app!.graph!
        const canvas = window.app!.canvas!
        const queue: Array<() => void> = []
        const originalNodeRemoved = graph.onNodeRemoved
        const originalSelectionChange = canvas.onSelectionChange
        w[key] = { queue, originalNodeRemoved, originalSelectionChange }
        graph.onNodeRemoved = function (node) {
          queue.push(() => originalNodeRemoved?.call(this, node))
        }
        canvas.onSelectionChange = function (selected) {
          queue.push(() => originalSelectionChange?.call(this, selected))
        }
      }, DEFERRED_HANDLERS_KEY)
    }

    async function runDeferredHandlers(comfyPage: ComfyPage) {
      await comfyPage.page.evaluate((key) => {
        const stash = (window as unknown as Record<string, unknown>)[key] as
          | { queue: Array<() => void> }
          | undefined
        if (!stash) return
        for (const fn of stash.queue.splice(0)) fn()
      }, DEFERRED_HANDLERS_KEY)
    }

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate((key) => {
        const w = window as unknown as Record<string, unknown>
        const graph = window.app?.graph
        const canvas = window.app?.canvas
        const stash = w[key] as
          | {
              originalNodeRemoved?: NonNullable<typeof graph>['onNodeRemoved']
              originalSelectionChange?: NonNullable<
                typeof canvas
              >['onSelectionChange']
            }
          | undefined
        if (stash) {
          if (graph) graph.onNodeRemoved = stash.originalNodeRemoved
          if (canvas) canvas.onSelectionChange = stash.originalSelectionChange
        }
        delete w[key]
      }, DEFERRED_HANDLERS_KEY)
    })

    function isNullGraphErrorText(text: string): boolean {
      return text.includes('NullGraphError') || /has no graph/.test(text)
    }

    // Vue's default errorHandler routes render throws to console.error,
    // not pageerror - listen to both.
    function captureNullGraphErrors(comfyPage: ComfyPage) {
      const captured: string[] = []
      const onPageError = (err: Error) => {
        if (
          err.name === 'NullGraphError' ||
          isNullGraphErrorText(err.message ?? '')
        ) {
          captured.push(`pageerror ${err.name}: ${err.message}`)
        }
      }
      const onConsoleMessage = (msg: ConsoleMessage) => {
        if (msg.type() !== 'error') return
        const text = msg.text()
        if (isNullGraphErrorText(text)) {
          captured.push(`console.error: ${text}`)
        }
      }
      comfyPage.page.on('pageerror', onPageError)
      comfyPage.page.on('console', onConsoleMessage)
      return {
        getErrors: () => [...captured],
        stop: () => {
          comfyPage.page.off('pageerror', onPageError)
          comfyPage.page.off('console', onConsoleMessage)
        }
      }
    }

    async function unpackViaContextMenu(comfyPage: ComfyPage, title: string) {
      const fixture = await comfyPage.vueNodes.getFixtureByTitle(title)
      await comfyPage.contextMenu.openForVueNode(fixture.header)
      await comfyPage.contextMenu.clickMenuItemExact('Unpack Subgraph')
    }

    async function unpackAndCaptureErrors(
      comfyPage: ComfyPage
    ): Promise<string[]> {
      const subgraphNode =
        comfyPage.vueNodes.getNodeByTitle(SUBGRAPH_NODE_TITLE)
      const errors = captureNullGraphErrors(comfyPage)
      try {
        await deferLegacyHandlers(comfyPage)
        await unpackViaContextMenu(comfyPage, SUBGRAPH_NODE_TITLE)
        await expect(subgraphNode).toHaveCount(0)
        await runDeferredHandlers(comfyPage)
        // Let drained-handler reactive flushes settle before stop().
        await comfyPage.nextFrame()
        return errors.getErrors()
      } finally {
        errors.stop()
      }
    }

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.RightSidePanel.IsOpen', true)
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      const subgraphNode =
        comfyPage.vueNodes.getNodeByTitle(SUBGRAPH_NODE_TITLE)
      await expect(subgraphNode).toBeVisible()

      const fixture =
        await comfyPage.vueNodes.getFixtureByTitle(SUBGRAPH_NODE_TITLE)
      await fixture.header.click()
      await expect(
        comfyPage.page.getByTestId(TestIds.propertiesPanel.root)
      ).toBeVisible()
      await comfyPage.nextFrame()
    })

    test('unpack does not surface NullGraphError on the LGraphNode render path', async ({
      comfyPage
    }) => {
      const nullGraphErrors = await unpackAndCaptureErrors(comfyPage)
      expect(
        nullGraphErrors,
        'LGraphNode render path: detach race must not surface NullGraphError'
      ).toEqual([])
    })

    test('unpack does not surface NullGraphError from the TabSubgraphInputs panel', async ({
      comfyPage
    }) => {
      const nullGraphErrors = await unpackAndCaptureErrors(comfyPage)
      expect(
        nullGraphErrors,
        'TabSubgraphInputs panel: detach race must not surface NullGraphError'
      ).toEqual([])
    })

    test('unpack with subgraph editor open does not surface NullGraphError from the SubgraphEditor panel', async ({
      comfyPage
    }) => {
      await comfyPage.page.getByTestId(TestIds.subgraphEditor.toggle).click()
      await comfyPage.nextFrame()

      const nullGraphErrors = await unpackAndCaptureErrors(comfyPage)
      expect(
        nullGraphErrors,
        'SubgraphEditor panel: detach race must not surface NullGraphError'
      ).toEqual([])
    })
  })
})
