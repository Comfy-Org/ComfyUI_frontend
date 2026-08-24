import * as fs from 'fs'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import type { ComfyNodeDefImpl } from '../src/stores/nodeDefStore'
import type { WidgetLabels } from './nodeDefLocaleSerializer'
import { serializeNodeDefLocales } from './nodeDefLocaleSerializer'

const localePath = './src/locales/en/main.json'
const nodeDefsPath = './src/locales/en/nodeDefs.json'

test('collect-i18n-node-defs', async ({ comfyPage }) => {
  // Mock view route
  await comfyPage.page.route('**/view**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({})
    })
  })

  // Note: Don't mock the object_info API endpoint - let it hit the actual backend

  const nodeDefs: ComfyNodeDefImpl[] = await comfyPage.page.evaluate(
    async () => {
      const app = window.app
      if (!app) throw new Error('ComfyUI app is not initialized')

      const rawNodeDefs = await app.api.getNodeDefs()
      const { ComfyNodeDefImpl } = await import('../src/stores/nodeDefStore')

      return (
        Object.values(rawNodeDefs)
          // Ignore DevTools nodes (used for internal testing)
          .filter((def: ComfyNodeDef) => !def.name.startsWith('DevTools'))
          .map((def: ComfyNodeDef) => new ComfyNodeDefImpl(def))
      )
    }
  )

  async function extractWidgetLabels() {
    const nodeLabels: WidgetLabels = {}

    for (const nodeDef of nodeDefs) {
      const inputNames = Object.values(nodeDef.inputs).flatMap(
        (input): string[] =>
          typeof input.name === 'string' ? [input.name] : input.name
      )

      if (!inputNames.length) continue

      try {
        const widgetsMappings = await comfyPage.page.evaluate(
          (args): Record<string, string | undefined> => {
            const { nodeName, displayName, inputNames } = args
            const liteGraph = window.LiteGraph
            if (!liteGraph) throw new Error('LiteGraph is not initialized')

            const node = liteGraph.createNode(nodeName, displayName)
            if (!node?.widgets?.length) return {}
            return Object.fromEntries(
              node.widgets
                .filter(
                  (widget) => widget?.name && !inputNames.includes(widget.name)
                )
                .map((widget) => [widget.name, widget.label])
            )
          },
          {
            nodeName: nodeDef.name,
            displayName: nodeDef.display_name,
            inputNames
          }
        )

        const runtimeWidgets = Object.fromEntries(
          Object.entries(widgetsMappings)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, name]) => [key, { name }])
        )

        if (Object.keys(runtimeWidgets).length > 0) {
          nodeLabels[nodeDef.name] = runtimeWidgets
        }
      } catch (error) {
        console.error(
          `Failed to extract widgets from ${nodeDef.name}: ${error}`
        )
      } finally {
        await comfyPage.nextFrame()
      }
    }

    return nodeLabels
  }

  const nodeDefLabels = await extractWidgetLabels()
  const { dataTypes, nodeCategories, nodeDefinitions } =
    serializeNodeDefLocales(nodeDefs, nodeDefLabels)

  const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
  fs.writeFileSync(
    localePath,
    JSON.stringify(
      {
        ...locale,
        dataTypes,
        nodeCategories
      },
      null,
      2
    )
  )

  fs.writeFileSync(nodeDefsPath, JSON.stringify(nodeDefinitions, null, 2))
})
