import * as fs from 'fs'

import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import type { ComfyNodeDef, InputSpec } from '../src/schemas/nodeDefSchema'
import { normalizeI18nKey } from '../src/utils/formatUtil'

const localePath = './src/locales/en/main.json'
const nodeDefsPath = './src/locales/en/nodeDefs.json'

interface WidgetInfo {
  name?: string
  label?: string
}

interface WidgetLabels {
  [key: string]: Record<string, { name: string }>
}

test('collect-i18n-node-defs', async ({ comfyPage }) => {
  // Mock view route
  await comfyPage.page.route('**/view**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({})
    })
  })

  // Note: Don't mock the object_info API endpoint - let it hit the actual backend

  const nodeDefs: ComfyNodeDef[] = await comfyPage.page.evaluate(async () => {
    // @ts-expect-error - app is dynamically added to window
    const api = window['app'].api
    const rawNodeDefs = await api.getNodeDefs()

    // @ts-expect-error - ComfyNodeDefImpl is available in browser context
    const { ComfyNodeDefImpl } = await import('../src/stores/nodeDefStore')

    return (
      Object.values(rawNodeDefs)
        // Ignore DevTools nodes (used for internal testing)
        .filter((def: any) => !def.name.startsWith('DevTools'))
        .map((def: any) => {
          const nodeDefImpl = new ComfyNodeDefImpl(def)
          // Extract properties needed for i18n collection
          return {
            name: nodeDefImpl.name,
            display_name: nodeDefImpl.display_name,
            description: nodeDefImpl.description,
            category: nodeDefImpl.category,
            input: nodeDefImpl.input,
            output: nodeDefImpl.output,
            output_is_list: nodeDefImpl.output_is_list,
            output_name: nodeDefImpl.output_name,
            output_node: nodeDefImpl.output_node,
            python_module: nodeDefImpl.python_module
          } as ComfyNodeDef
        })
    )
  })

  console.log(`Collected ${nodeDefs.length} node definitions`)

  // If no node definitions were collected (e.g., running without backend),
  // create empty locale files to avoid build failures
  if (nodeDefs.length === 0) {
    console.warn('No node definitions found - creating empty locale files')
    const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
    fs.writeFileSync(
      localePath,
      JSON.stringify(
        {
          ...locale,
          dataTypes: {},
          nodeCategories: {}
        },
        null,
        2
      )
    )
    fs.writeFileSync(nodeDefsPath, JSON.stringify({}, null, 2))
    return
  }

  const allDataTypesLocale = Object.fromEntries(
    nodeDefs
      .flatMap((nodeDef) => {
        const inputDataTypes = nodeDef.input?.required
          ? Object.values(nodeDef.input.required).map((inputSpec: InputSpec) =>
              typeof inputSpec[0] === 'string' ? inputSpec[0] : 'COMBO'
            )
          : []
        const outputDataTypes =
          nodeDef.output?.map((outputSpec) =>
            typeof outputSpec === 'string' ? outputSpec : 'COMBO'
          ) || []
        const allDataTypes = [...inputDataTypes, ...outputDataTypes].flatMap(
          (type: string) => type.split(',')
        )
        return allDataTypes.map((dataType) => [
          normalizeI18nKey(dataType),
          dataType
        ])
      })
      .sort((a, b) => a[0].localeCompare(b[0]))
  )

  async function extractWidgetLabels() {
    const nodeLabels: WidgetLabels = {}

    for (const nodeDef of nodeDefs) {
      const inputNames = nodeDef.input?.required
        ? Object.keys(nodeDef.input.required)
        : []

      if (!inputNames.length) continue

      try {
        const widgetsMappings = await comfyPage.page.evaluate(
          (args) => {
            const [nodeName, displayName, inputNames] = args
            // @ts-expect-error - LiteGraph is dynamically added to window
            const node = window['LiteGraph'].createNode(nodeName, displayName)
            if (!node.widgets?.length) return {}
            return Object.fromEntries(
              node.widgets
                .filter(
                  (w: WidgetInfo) => w?.name && !inputNames.includes(w.name)
                )
                .map((w: WidgetInfo) => [w.name, w.label])
            )
          },
          [nodeDef.name, nodeDef.display_name, inputNames]
        )

        // Format runtime widgets
        const runtimeWidgets = Object.fromEntries(
          Object.entries(widgetsMappings)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, value]) => [normalizeI18nKey(key), { name: value }])
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

  function extractInputs(nodeDef: ComfyNodeDef) {
    const allInputs = {
      ...(nodeDef.input?.required || {}),
      ...(nodeDef.input?.optional || {})
    }
    const inputs = Object.fromEntries(
      Object.entries(allInputs).flatMap(([inputName, inputSpec]) => {
        const tooltip = inputSpec[1]?.tooltip

        if (!inputName && !tooltip) {
          return []
        }

        return [
          [
            normalizeI18nKey(inputName),
            {
              name: inputName,
              tooltip
            }
          ]
        ]
      })
    )
    return Object.keys(inputs).length > 0 ? inputs : undefined
  }

  function extractOutputs(nodeDef: ComfyNodeDef) {
    const outputs = Object.fromEntries(
      (nodeDef.output || []).flatMap((_, i) => {
        const outputName = nodeDef.output_name?.[i]
        const outputTooltip = nodeDef.output_tooltips?.[i]
        // Ignore data types if they are already translated in allDataTypesLocale.
        const name =
          outputName && outputName in allDataTypesLocale
            ? undefined
            : outputName
        const tooltip = outputTooltip

        if (name === undefined && tooltip === undefined) {
          return []
        }

        return [
          [
            i.toString(),
            {
              name,
              tooltip
            }
          ]
        ]
      })
    )
    return Object.keys(outputs).length > 0 ? outputs : undefined
  }

  const allNodeDefsLocale = Object.fromEntries(
    nodeDefs
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nodeDef) => {
        const inputs = {
          ...extractInputs(nodeDef),
          ...(nodeDefLabels[nodeDef.name] ?? {})
        }

        return [
          normalizeI18nKey(nodeDef.name),
          {
            display_name: nodeDef.display_name ?? nodeDef.name,
            description: nodeDef.description || undefined,
            inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
            outputs: extractOutputs(nodeDef)
          }
        ]
      })
  )

  const allNodeCategoriesLocale = Object.fromEntries(
    nodeDefs.flatMap((nodeDef) =>
      nodeDef.category
        .split('/')
        .map((category) => [normalizeI18nKey(category), category])
    )
  )

  const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
  fs.writeFileSync(
    localePath,
    JSON.stringify(
      {
        ...locale,
        dataTypes: allDataTypesLocale,
        nodeCategories: allNodeCategoriesLocale
      },
      null,
      2
    )
  )

  fs.writeFileSync(nodeDefsPath, JSON.stringify(allNodeDefsLocale, null, 2))
})
