import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'duplicate widget-name persistence',
  { tag: ['@canvas', '@widget'] },
  () => {
    test('preserves both dict-shaped values across a node save and restore', async ({
      comfyPage
    }) => {
      const values = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const node = graph.nodes[0]
        node.addWidget(
          'videoedit',
          'duplicate',
          {
            trim: { start_time: 1, duration: 2 },
            extension_only: { untouched: true }
          },
          null
        )
        node.addWidget(
          'videoedit',
          'duplicate',
          {
            crop: { x: 1, y: 2, width: 3, height: 4 },
            unknown_key: ['kept', 2]
          },
          null
        )

        const saved = structuredClone(node.serialize())
        node.widgets!.at(-2)!.value = {
          trim: { start_time: 9, duration: 9 }
        }
        node.widgets!.at(-1)!.value = {
          crop: { x: 9, y: 9, width: 9, height: 9 }
        }
        node.configure(saved)

        return graph.nodes[0].widgets
          ?.filter((widget) => widget.name === 'duplicate')
          .map((widget) => widget.value)
      })

      expect(values).toEqual([
        {
          trim: { start_time: 1, duration: 2 },
          extension_only: { untouched: true }
        },
        {
          crop: { x: 1, y: 2, width: 3, height: 4 },
          unknown_key: ['kept', 2]
        }
      ])
    })
  }
)
