import type { ConsoleMessage } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { getPseudoPreviewWidgets } from '@e2e/fixtures/utils/promotedWidgets'
import { toNodeId } from '@/types/nodeId'

const domPreviewSelector = '.image-preview'

test.describe('Subgraph Lifecycle', { tag: ['@subgraph'] }, () => {
  test.describe(
    'Cleanup Behavior After Promoted Source Removal',
    { tag: ['@vue-nodes'] },
    () => {
      test('Deleting the promoted source removes the exterior promoted widget', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'subgraphs/subgraph-with-promoted-text-widget'
        )

        const subgraphNode = comfyPage.vueNodes.getNodeLocator('11')
        const promotedTextarea = subgraphNode.getByRole('textbox', {
          name: 'text'
        })
        await expect(promotedTextarea).toBeVisible()

        await comfyPage.vueNodes.enterSubgraph('11')

        const clipNode = await comfyPage.nodeOps.getNodeRefById('10')
        await clipNode.delete()

        await comfyPage.subgraph.exitViaBreadcrumb()

        await expect(
          comfyPage.vueNodes
            .getNodeLocator('11')
            .getByRole('textbox', { name: 'text' })
        ).toHaveCount(0)
      })
    }
  )

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

      await comfyPage.page.evaluate((nodeId) => {
        const graph = window.app!.graph!
        const subgraphNode = graph.getNodeById(nodeId)
        if (!subgraphNode || !subgraphNode.isSubgraphNode()) return
        graph.unpackSubgraph(subgraphNode)
      }, toNodeId(5))
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

    // Queues legacy onNodeRemoved/onSelectionChange so unpack completes first,
    // widening the race window so a guard regression deterministically surfaces.
    async function deferLegacyHandlers(comfyPage: ComfyPage) {
      return await comfyPage.page.evaluateHandle(() => {
        const graph = window.app!.graph!
        const canvas = window.app!.canvas!
        const queue: Array<() => void> = []
        const originalNodeRemoved = graph.onNodeRemoved
        const originalSelectionChange = canvas.onSelectionChange
        graph.onNodeRemoved = function (node) {
          queue.push(() => originalNodeRemoved?.call(this, node))
        }
        canvas.onSelectionChange = function (selected) {
          queue.push(() => originalSelectionChange?.call(this, selected))
        }
        return {
          drain: () => {
            for (const fn of queue.splice(0)) fn()
          },
          restore: () => {
            graph.onNodeRemoved = originalNodeRemoved
            canvas.onSelectionChange = originalSelectionChange
          }
        }
      })
    }

    type DeferredHandlers = Awaited<ReturnType<typeof deferLegacyHandlers>>

    // Defers only the legacy selection-change callback, so the detached host
    // node lingers in the reactive selection while onNodeRemoved still runs
    // normally and clears it from the canvas. This isolates the panel render
    // path: a panel mounted during this window reads the stale selection.
    async function deferSelectionChange(
      comfyPage: ComfyPage
    ): Promise<DeferredHandlers> {
      return await comfyPage.page.evaluateHandle(() => {
        const canvas = window.app!.canvas!
        const queue: Array<() => void> = []
        const original = canvas.onSelectionChange
        canvas.onSelectionChange = function (selected) {
          queue.push(() => original?.call(this, selected))
        }
        return {
          drain: () => {
            for (const fn of queue.splice(0)) fn()
          },
          restore: () => {
            canvas.onSelectionChange = original
          }
        }
      })
    }

    function isNullGraphErrorText(text: string): boolean {
      return text.includes('NullGraphError') || text.endsWith('has no graph')
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

    async function reopenRightSidePanel(comfyPage: ComfyPage) {
      const { propertiesPanel } = comfyPage.menu
      await propertiesPanel.toggleButton.click()
      await expect(propertiesPanel.root).toBeHidden()
      await propertiesPanel.toggleButton.click()
      await comfyPage.nextFrame()
    }

    // Unpacks the subgraph behind deferred teardown, runs an optional
    // interaction while the node is detached but not yet cleaned up, then
    // drains the deferred handlers and reports any NullGraphErrors seen.
    async function unpackAndCaptureNullGraphErrors(
      comfyPage: ComfyPage,
      options: {
        defer: (comfyPage: ComfyPage) => Promise<DeferredHandlers>
        duringWindow?: (comfyPage: ComfyPage) => Promise<void>
      }
    ): Promise<string[]> {
      const subgraphNode =
        comfyPage.vueNodes.getNodeByTitle(SUBGRAPH_NODE_TITLE)
      const errors = captureNullGraphErrors(comfyPage)
      const deferred = await options.defer(comfyPage)
      try {
        await unpackViaContextMenu(comfyPage, SUBGRAPH_NODE_TITLE)
        await expect(subgraphNode).toHaveCount(0)
        await options.duringWindow?.(comfyPage)
        await deferred.evaluate((handlers) => handlers.drain())
        // Let drained-handler reactive flushes settle before stop().
        await comfyPage.nextFrame()
        return errors.getErrors()
      } finally {
        await deferred.evaluate((handlers) => handlers.restore())
        await deferred.dispose()
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
      const nullGraphErrors = await unpackAndCaptureNullGraphErrors(comfyPage, {
        defer: deferLegacyHandlers
      })
      expect(
        nullGraphErrors,
        'LGraphNode render path: detach race must not surface NullGraphError'
      ).toEqual([])
    })

    test('unpack does not surface NullGraphError from the TabSubgraphInputs panel', async ({
      comfyPage
    }) => {
      const nullGraphErrors = await unpackAndCaptureNullGraphErrors(comfyPage, {
        defer: deferLegacyHandlers
      })
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

      const nullGraphErrors = await unpackAndCaptureNullGraphErrors(comfyPage, {
        defer: deferLegacyHandlers
      })
      expect(
        nullGraphErrors,
        'SubgraphEditor panel: detach race must not surface NullGraphError'
      ).toEqual([])
    })

    test('reopening the right side panel after unpack does not surface NullGraphError', async ({
      comfyPage
    }) => {
      const nullGraphErrors = await unpackAndCaptureNullGraphErrors(comfyPage, {
        defer: deferSelectionChange,
        duringWindow: reopenRightSidePanel
      })
      expect(
        nullGraphErrors,
        'TabSubgraphInputs remount: stale selection must not surface NullGraphError'
      ).toEqual([])
    })

    test('reopening the right side panel with the subgraph editor open does not surface NullGraphError', async ({
      comfyPage
    }) => {
      await comfyPage.page.getByTestId(TestIds.subgraphEditor.toggle).click()
      await comfyPage.nextFrame()

      const nullGraphErrors = await unpackAndCaptureNullGraphErrors(comfyPage, {
        defer: deferSelectionChange,
        duringWindow: reopenRightSidePanel
      })
      expect(
        nullGraphErrors,
        'SubgraphEditor remount: stale selection must not surface NullGraphError'
      ).toEqual([])
    })
  })
})
