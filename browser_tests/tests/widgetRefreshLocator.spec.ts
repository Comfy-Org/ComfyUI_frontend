import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'

/**
 * A node pack refreshes a widget by re-installing the same plain source object
 * after mutating it. When that refresh also renames the source, the input slot
 * bound to the old widget has to follow: the slot's `widget` locator is what
 * every name-based consumer resolves through, including the serializer that
 * writes the saved workflow.
 *
 * Before the fix the direct reference was repaired but the locator was not, so
 * the widget kept working on screen while the saved workflow still pointed at
 * the old widget name — a binding the next load cannot resolve.
 */
const ENTRY_PATHS = [
  { entry: 'addCustomWidget', viaWidgetsArray: false },
  { entry: 'widgets.unshift', viaWidgetsArray: true }
] as const

interface RefreshResult {
  serializedWidgetName: string | null
  liveWidgetNames: string[]
  boundWidgetName: string | null
}

test.describe(
  'Widget refresh that renames the source',
  { tag: ['@widget'] },
  () => {
    for (const { entry, viaWidgetsArray } of ENTRY_PATHS) {
      test(`keeps the saved input locator resolvable through ${entry}`, async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.clearGraph()

        const result = await comfyPage.page.evaluate(
          ({ viaWidgetsArray }): RefreshResult => {
            const node = window.LiteGraph!.createNode('Note')!
            node.pos = [400, 200]
            window.app!.graph.add(node)

            // Node packs hand litegraph a plain, sealed widget object.
            const source = Object.preventExtensions<IBaseWidget>({
              name: 'wrapped',
              type: 'number',
              value: 10,
              options: {},
              y: 0
            })
            const installed = node.addCustomWidget(source)
            node.addWidget('number', 'trailing', 2, null)

            const input = node.addInput('wrapped', 'number', {
              widget: { name: 'wrapped' },
              _widget: installed
            })

            // The refresh renames and retypes the same source object.
            source.name = 'renamed'
            source.type = 'toggle'
            if (viaWidgetsArray) {
              node.widgets!.unshift(source)
            } else {
              node.addCustomWidget(source)
            }

            const serialized = window.app!.graph.serialize()
            const serializedNode = serialized.nodes.find(
              (candidate) => String(candidate.id) === String(node.id)
            )
            const serializedInput = serializedNode?.inputs?.find(
              (candidate) => candidate.name === 'wrapped'
            )

            return {
              serializedWidgetName: serializedInput?.widget?.name ?? null,
              liveWidgetNames: (node.widgets ?? []).map(
                (widget) => widget.name
              ),
              boundWidgetName: node.getWidgetFromSlot(input)?.name ?? null
            }
          },
          { viaWidgetsArray }
        )

        // The refreshed widget is installed under its new name, exactly once,
        // and the pre-refresh name is gone from the node.
        expect(
          result.liveWidgetNames.filter((name) => name === 'renamed')
        ).toEqual(['renamed'])
        expect(result.liveWidgetNames).not.toContain('wrapped')

        // Persisted behavior: the saved workflow names the widget that is
        // actually installed, so reloading it rebinds the input.
        expect(result.serializedWidgetName).toBe('renamed')
        expect(result.boundWidgetName).toBe('renamed')
      })
    }
  }
)
