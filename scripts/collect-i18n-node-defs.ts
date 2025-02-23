import * as fs from 'fs'

import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import type { ComfyApi } from '../src/scripts/api'
import { ComfyInputsSpec, ComfyNodeDefImpl } from '../src/stores/nodeDefStore'
import { normalizeI18nKey } from '../src/utils/formatUtil'

const localePath = './src/locales/en/main.json'
const nodeDefsPath = './src/locales/en/nodeDefs.json'

test('collect-i18n-node-defs', async ({ comfyPage }) => {
  const nodeDefs: ComfyNodeDefImpl[] = Object.values(
    await comfyPage.page.evaluate(async () => {
      const api = window['app'].api as ComfyApi
      return await api.getNodeDefs()
    })
  ).map((def) => new ComfyNodeDefImpl(def))

  console.log(`Collected ${nodeDefs.length} node definitions`)

  const allDataTypesLocale = Object.fromEntries(
    nodeDefs
      .flatMap((nodeDef) => {
        const inputDataTypes = Object.values(nodeDef.inputs.all).map(
          (inputSpec) => inputSpec.type
        )
        const outputDataTypes = nodeDef.outputs.all.map((output) => output.type)
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
    const nodeLabels = {}

    for (const nodeDef of nodeDefs) {
      const labels = await comfyPage.page.evaluate(async (def) => {
        try {
          // Create and add node to graph
          const node = window['LiteGraph'].createNode(
            def.name,
            def.display_name
          )
          window['app'].graph.add(node)

          // Get node instance and check for widgets
          const nodeInstance = window['app'].graph.getNodeById(node.id)
          if (!nodeInstance?.widgets) return {}

          const getAllInputNames = (inputs: ComfyInputsSpec) => {
            return [
              ...Object.values(inputs?.optional ?? {}),
              ...Object.values(inputs?.required ?? {})
            ]
              .filter((input) => input && input.name !== undefined)
              .map((input) => input.name)
          }

          // Get input names for comparison
          const nodeInputNames = getAllInputNames(def.inputs)

          // Collect runtime-generated widget labels
          const labels = {}
          for (const widget of nodeInstance.widgets) {
            if (!widget?.name) continue
            const isRuntimeGenerated = !nodeInputNames.includes(widget.name)
            if (isRuntimeGenerated) {
              console.warn(widget.label)
              const label = widget.label ?? widget.name
              labels[widget.name] = label
            }
          }

          return labels
        } finally {
          // Cleanup
          window['app'].graph.clear()
        }
      }, nodeDef)

      // Format and store labels if any were found
      if (Object.keys(labels ?? {}).length > 0) {
        nodeLabels[nodeDef.name] = Object.fromEntries(
          Object.entries(labels)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, value]) => [normalizeI18nKey(key), { name: value }])
        )
      }
    }

    return nodeLabels
  }

  const nodeDefLabels = await extractWidgetLabels()

  function extractInputs(nodeDef: ComfyNodeDefImpl) {
    const inputs = Object.fromEntries(
      nodeDef.inputs.all.flatMap((input) => {
        const name = input.name
        const tooltip = input.tooltip

        if (name === undefined && tooltip === undefined) {
          return []
        }

        return [
          [
            normalizeI18nKey(input.name),
            {
              name,
              tooltip
            }
          ]
        ]
      })
    )
    return Object.keys(inputs).length > 0 ? inputs : undefined
  }

  function extractOutputs(nodeDef: ComfyNodeDefImpl) {
    const outputs = Object.fromEntries(
      nodeDef.outputs.all.flatMap((output, i) => {
        // Ignore data types if they are already translated in allDataTypesLocale.
        const name = output.name in allDataTypesLocale ? undefined : output.name
        const tooltip = output.tooltip

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
