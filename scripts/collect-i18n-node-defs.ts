import * as fs from 'fs'

import { transformNodeDefV1ToV2 } from '@comfyorg/object-info-parser/migration'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'

import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import type { WidgetLabels } from './nodeDefLocaleSerializer'
import { serializeNodeDefLocales } from './nodeDefLocaleSerializer'

const localePath = './src/locales/en/main.json'
const nodeDefsPath = './src/locales/en/nodeDefs.json'

test('collect-i18n-node-defs', async ({ comfyPage }) => {
  await comfyPage.page.route('**/view**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({})
    })
  })

  const rawNodeDefs = await comfyPage.page.evaluate(async () => {
    const app = window.app
    if (!app) throw new Error('ComfyUI app is not initialized')

    return app.api.getNodeDefs()
  })
  const nodeDefs: ComfyNodeDefV2[] = Object.values(rawNodeDefs)
    .filter((def: ComfyNodeDef) => !def.name.startsWith('DevTools'))
    .map((def: ComfyNodeDef) => transformNodeDefV1ToV2(def))

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
                  (widget) => widget.name && !inputNames.includes(widget.name)
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
