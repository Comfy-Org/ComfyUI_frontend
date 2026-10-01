import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { WidgetValue } from '@/types/simplifiedWidget'

/**
 * `ensureUniqueWidgetNames` normally renames a repeated widget name to
 * `name#1` before any widget id is derived, so `widgets_values_named` is
 * unambiguous and `duplicateWidgetNamePersistence.spec.ts`'s two `duplicate`
 * widgets actually persist as `duplicate` and `duplicate#1`.
 *
 * It cannot rename a widget whose `name` is not writable. It warns, gives up,
 * and the node keeps two serializable widgets with one name — at which point
 * `widgets_values_named` can only hold the last of them. These cases cover
 * that path with `Comfy.Workflow.NamedValuesRestore` on, where named values
 * are what the canvas is rebuilt from.
 *
 * Source: FE-3036, item 5 of PM-1783.
 */
const workflowName = `duplicate-widget-names-named-${Date.now()}`

const savedValues: WidgetValue[] = [
  { trim: { start_time: 1, duration: 2 }, extension_only: { untouched: true } },
  { crop: { x: 1, y: 2, width: 3, height: 4 }, unknown_key: ['kept', 2] }
]

type ComfyPage = Parameters<Parameters<typeof test>[2]>[0]['comfyPage']

/**
 * Construction defaults, deliberately unlike any saved value.
 *
 * A widget constructed with the value the case then asserts would make that
 * case pass whether restore ran or not, so every case here builds from these
 * and writes the values it cares about onto the live widgets first.
 */
const constructionDefaults: WidgetValue[] = [
  'construction default a',
  'construction default b'
]

/**
 * Patches the node type so every instance gains two serializable widgets under
 * one name, the second of them unrenameable. Installed on the type rather than
 * on an instance so the reconstruction after a reload builds the same pair the
 * save was made from.
 */
async function installUnrenameableDuplicatePair(
  comfyPage: ComfyPage,
  values: readonly WidgetValue[] = constructionDefaults
): Promise<void> {
  await comfyPage.page.evaluate((widgetValues) => {
    const nodeType =
      window.LiteGraph!.registered_node_types['DevToolsNodeWithOutputList']
    const onNodeCreated = nodeType.prototype.onNodeCreated
    nodeType.prototype.onNodeCreated = function (...args) {
      onNodeCreated?.apply(this, args)
      this.serialize_widgets = true
      this.addWidget('custom', 'duplicate', widgetValues[0], () => {})
      const second = this.addWidget(
        'custom',
        'second',
        widgetValues[1],
        () => {}
      )
      Object.defineProperty(second, 'name', {
        value: 'duplicate',
        writable: false,
        configurable: false
      })
    }
  }, values)
}

/** Writes `values` onto the node's live widgets, in order. */
async function writeWidgetValues(
  comfyPage: ComfyPage,
  nodeId: string,
  values: readonly WidgetValue[]
): Promise<void> {
  await comfyPage.page.evaluate(
    ({ id, widgetValues }) => {
      const node = window.app!.graph.nodes.find(
        ({ id: candidate }) => String(candidate) === id
      )!
      node.widgets!.forEach((widget, index) => {
        widget.value = widgetValues[index]
      })
    },
    { id: nodeId, widgetValues: values }
  )
}

/**
 * A serialized workflow as a bag of properties, for cases that have to mutate
 * fields the schema type does not model — the point of each is a document some
 * *other* producer could legitimately have written.
 */
type MutableWorkflow = {
  nodes: (Record<string, unknown> & { id?: unknown; type?: string })[]
}

async function readWidgetValues(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<unknown[]> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.nodes.find(
      ({ id: candidate }) => String(candidate) === id
    )!
    return node.widgets!.map((widget) => widget.value)
  }, nodeId)
}

async function readWidgetNames(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<string[]> {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.nodes.find(
      ({ id: candidate }) => String(candidate) === id
    )!
    return node.widgets!.map((widget) => widget.name)
  }, nodeId)
}

test.describe(
  'duplicate widget-name persistence under named-value restore',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.deleteWorkflow(workflowName)
    })

    test('keeps both values of an unrenameable duplicate name across a reload', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
      await comfyPage.nodeOps.clearGraph()

      await installUnrenameableDuplicatePair(comfyPage)

      const nodeId =
        await test.step('save a node carrying two widgets named "duplicate"', async () => {
          const addedNodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
            'Node With Output List'
          )
          const liveNames = await readWidgetNames(comfyPage, addedNodeId)
          // The premise of the whole case: the rename did not happen, so the
          // name really is ambiguous on the live canvas.
          expect(liveNames).toEqual(['duplicate', 'duplicate'])

          // Written onto the live widgets, never passed as construction
          // defaults: a widget built holding the asserted value would make the
          // canvas assertion below pass with restore switched off entirely.
          await writeWidgetValues(comfyPage, addedNodeId, savedValues)

          const savedRequest = comfyPage.page.waitForRequest(
            (request) =>
              request.method() === 'POST' &&
              decodeURIComponent(new URL(request.url()).pathname).endsWith(
                `/workflows/${workflowName}.json`
              )
          )
          await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
          const saved = zComfyWorkflow.parse(
            JSON.parse((await savedRequest).postData() ?? '{}')
          )
          const savedNode = saved.nodes.find(
            (node) => node.type === 'DevToolsNodeWithOutputList'
          )

          // `widgets_values_named` physically cannot carry both, so the
          // occurrence-addressed form is what the reload below reads.
          expect(savedNode?.widgets_values_named).toEqual({
            duplicate: savedValues[1]
          })
          expect(savedNode?.widgets_values_ordered).toEqual([
            { name: 'duplicate', occurrence: 0, value: savedValues[0] },
            { name: 'duplicate', occurrence: 1, value: savedValues[1] }
          ])

          return addedNodeId
        })

      await test.step('close and reopen the saved workflow', async () => {
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()
      })

      await test.step('both values are back on the canvas, not two copies of the last one', async () => {
        const liveValues = await readWidgetValues(comfyPage, nodeId)

        expect(liveValues).toEqual(savedValues)
      })

      await test.step('re-saving keeps both values', async () => {
        const savedRequest = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'POST' &&
            decodeURIComponent(new URL(request.url()).pathname).endsWith(
              `/workflows/${workflowName}.json`
            )
        )
        await comfyPage.menu.topbar.triggerTopbarCommand(['File', 'Save'])
        const saved = zComfyWorkflow.parse(
          JSON.parse((await savedRequest).postData() ?? '{}')
        )
        const duplicateNode = saved.nodes.find(
          (node) => node.type === 'DevToolsNodeWithOutputList'
        )

        expect(duplicateNode?.widgets_values).toEqual(savedValues)
        expect(duplicateNode?.widgets_values_ordered).toEqual([
          { name: 'duplicate', occurrence: 0, value: savedValues[0] },
          { name: 'duplicate', occurrence: 1, value: savedValues[1] }
        ])
      })
    })

    test('omits the ordered form when the rename succeeds', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
      await comfyPage.nodeOps.clearGraph()

      await comfyPage.page.evaluate((defaults) => {
        const nodeType =
          window.LiteGraph!.registered_node_types['DevToolsNodeWithOutputList']
        const onNodeCreated = nodeType.prototype.onNodeCreated
        nodeType.prototype.onNodeCreated = function (...args) {
          onNodeCreated?.apply(this, args)
          this.serialize_widgets = true
          for (const value of defaults) {
            this.addWidget('custom', 'duplicate', value, () => {})
          }
        }
      }, constructionDefaults)

      const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      const liveNames = await readWidgetNames(comfyPage, nodeId)
      expect(liveNames).toEqual(['duplicate', 'duplicate#1'])
      await writeWidgetValues(comfyPage, nodeId, savedValues)

      const savedRequest = comfyPage.page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          decodeURIComponent(new URL(request.url()).pathname).endsWith(
            `/workflows/${workflowName}.json`
          )
      )
      await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
      const saved = zComfyWorkflow.parse(
        JSON.parse((await savedRequest).postData() ?? '{}')
      )
      const savedNode = saved.nodes.find(
        (node) => node.type === 'DevToolsNodeWithOutputList'
      )

      // Every ordinary workflow stays byte-identical: the names are already
      // unambiguous, so there is nothing for the ordered form to add.
      expect(savedNode).not.toHaveProperty('widgets_values_ordered')
      expect(savedNode?.widgets_values_named).toEqual({
        duplicate: savedValues[0],
        'duplicate#1': savedValues[1]
      })
    })

    test('restores both values from a document that carries only the ordered form', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
      await comfyPage.nodeOps.clearGraph()
      await installUnrenameableDuplicatePair(comfyPage)
      const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      await writeWidgetValues(comfyPage, nodeId, savedValues)

      // A newer or third-party producer — comfy-multi-player's schema-v5
      // projection, an extension-written document — may emit the lossless form
      // and nothing else. The app has to be able to read its own field back.
      // Reloading rebuilds both widgets on their construction defaults, so
      // nothing but the ordered form can put `savedValues` back.
      await comfyPage.page.evaluate(() => {
        const workflow =
          window.app!.graph.serialize() as unknown as MutableWorkflow
        for (const node of workflow.nodes) {
          if (!node['widgets_values_ordered']) continue
          delete node['widgets_values_named']
          delete node['widgets_values']
        }
        return window.app!.loadGraphData(
          workflow as unknown as ComfyWorkflowJSON
        )
      })

      await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()
      const liveValues = await readWidgetValues(comfyPage, nodeId)

      expect(liveValues).toEqual(savedValues)
    })

    test('keeps the named value for a widget whose duplicate the node no longer has', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
      await comfyPage.nodeOps.clearGraph()
      await installUnrenameableDuplicatePair(comfyPage)
      const savedNodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      await writeWidgetValues(comfyPage, savedNodeId, savedValues)

      // The node definition changes under a saved workflow — a custom-node
      // update drops one of the two same-named widgets. Which document entry
      // the survivor corresponds to is unknowable, so it must keep the value a
      // name-addressed read gave it before the ordered form existed, not the
      // stale first entry.
      const nodeId = await comfyPage.page.evaluate(async (defaults) => {
        const workflow =
          window.app!.graph.serialize() as unknown as MutableWorkflow
        const nodeType =
          window.LiteGraph!.registered_node_types['DevToolsNodeWithOutputList']
        nodeType.prototype.onNodeCreated = function () {
          this.serialize_widgets = true
          this.addWidget('custom', 'duplicate', defaults[0], () => {})
        }
        await window.app!.loadGraphData(
          workflow as unknown as ComfyWorkflowJSON
        )
        return String(
          workflow.nodes.find(
            (node) => node.type === 'DevToolsNodeWithOutputList'
          )!.id
        )
      }, constructionDefaults)

      await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()
      const liveValues = await readWidgetValues(comfyPage, nodeId)

      expect(liveValues).toEqual([savedValues[1]])
    })

    test('does not delete an entry key another producer wrote when the user saves', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        true
      )
      await comfyPage.nodeOps.clearGraph()
      await installUnrenameableDuplicatePair(comfyPage)
      const addedNodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      await writeWidgetValues(comfyPage, addedNodeId, savedValues)

      await comfyPage.page.evaluate(() => {
        const workflow =
          window.app!.graph.serialize() as unknown as MutableWorkflow
        for (const node of workflow.nodes) {
          const ordered = node['widgets_values_ordered'] as
            | Record<string, unknown>[]
            | undefined
          if (!ordered) continue
          // The entry contract says a consumer must leave keys it does not
          // understand alone. Rebuilding the field from name and value on
          // every save deletes them instead.
          ordered[0]['source'] = 'extension'
        }
        return window.app!.loadGraphData(
          workflow as unknown as ComfyWorkflowJSON
        )
      })

      const savedRequest = comfyPage.page.waitForRequest(
        (request) =>
          request.method() === 'POST' &&
          decodeURIComponent(new URL(request.url()).pathname).endsWith(
            `/workflows/${workflowName}.json`
          )
      )
      await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
      const saved = zComfyWorkflow.parse(
        JSON.parse((await savedRequest).postData() ?? '{}')
      )
      const savedNode = saved.nodes.find(
        (node) => node.type === 'DevToolsNodeWithOutputList'
      )

      expect(savedNode?.widgets_values_ordered).toEqual([
        {
          name: 'duplicate',
          occurrence: 0,
          value: savedValues[0],
          source: 'extension'
        },
        { name: 'duplicate', occurrence: 1, value: savedValues[1] }
      ])
    })
  }
)
