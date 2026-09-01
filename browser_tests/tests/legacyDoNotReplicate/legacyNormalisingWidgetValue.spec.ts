import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { NodeId } from '@/types/nodeId'

interface ComparerImage {
  url: string
  name: string
  selected: boolean
}

const WIDGET_NAME = 'legacy_comparer'
const IMAGES: ComparerImage[] = [
  { url: 'a.png', name: 'A', selected: true },
  { url: 'b.png', name: 'B', selected: true }
]

/**
 * Registers an extension that attaches a widget shaped like rgthree's image
 * comparer to every Note node: the widget owns its value behind an accessor
 * pair that takes either the serialised list or `{ images }` and always reads
 * back `{ images }`, and the node rewrites `widgets_values` with the bare list
 * in `onSerialize`.
 */
async function registerComparerWidgetExtension(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate((widgetName) => {
    class ComparerWidget {
      [symbol: symbol]: boolean
      name = widgetName
      type = 'custom'
      options = {}
      y = 0
      _value: { images: ComparerImage[] } = { images: [] }

      get value(): { images: ComparerImage[] } {
        return this._value
      }

      set value(v: { images: ComparerImage[] } | ComparerImage[]) {
        this._value.images = Array.isArray(v) ? v : (v?.images ?? [])
      }
    }

    window.app!.registerExtension({
      name: 'LegacyComparerWidget',
      nodeCreated(node) {
        if (node.comfyClass !== 'Note') return

        node.addCustomWidget(new ComparerWidget())
        node.onSerialize = (data: ISerialisedNode) => {
          const values = data.widgets_values
          if (!Array.isArray(values)) return

          for (const [index] of values.entries()) {
            const widget = node.widgets?.[index]
            if (widget?.name !== widgetName) continue

            const { images } = widget.value as { images: ComparerImage[] }
            values[index] = images.map((image) => ({ ...image }))
          }
        }
      }
    })
  }, WIDGET_NAME)
}

async function setComparerImages(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  images: ComparerImage[]
) {
  await comfyPage.page.evaluate(
    ({ nodeId, widgetName, images }) => {
      const widget = window
        .app!.graph.getNodeById(nodeId)
        ?.widgets?.find((candidate) => candidate.name === widgetName)
      if (!widget) throw new Error(`Widget ${widgetName} not found`)

      widget.value = { images }
    },
    { nodeId, widgetName: WIDGET_NAME, images }
  )
}

/** Serialises the whole graph, as switching workflows does, and reads back the comparer's entry. */
async function serialisedComparerImages(
  comfyPage: ComfyPage,
  nodeId: NodeId
): Promise<unknown> {
  return comfyPage.page.evaluate(
    ({ nodeId, widgetName }) => {
      const index = window
        .app!.graph.getNodeById(nodeId)
        ?.widgets?.findIndex((candidate) => candidate.name === widgetName)
      const values = window
        .app!.graph.serialize()
        .nodes.find(
          (node) => String(node.id) === String(nodeId)
        )?.widgets_values
      return index === undefined || !Array.isArray(values)
        ? undefined
        : values[index]
    },
    { nodeId, widgetName: WIDGET_NAME }
  )
}

test.describe(
  'Legacy widget that normalises its own value',
  { tag: ['@canvas', '@widget'] },
  () => {
    test('serialises after a workflow round trip', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.NamedValuesRestore',
        false
      )
      await comfyPage.nodeOps.clearGraph()
      await registerComparerWidgetExtension(comfyPage)

      const note = await comfyPage.nodeOps.addNode('Note')
      await setComparerImages(comfyPage, note.id, IMAGES)

      expect(await serialisedComparerImages(comfyPage, note.id)).toEqual(IMAGES)

      await comfyPage.nodeOps.loadGraph(
        await comfyPage.nodeOps.getSerializedGraph()
      )

      expect(await serialisedComparerImages(comfyPage, note.id)).toEqual(IMAGES)
    })
  }
)
