import * as fs from 'fs'

import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import type { ComfyApi } from '../src/scripts/api'
import { ComfyNodeDefImpl } from '../src/stores/nodeDefStore'
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
      .map((nodeDef) => [
        normalizeI18nKey(nodeDef.name),
        {
          display_name: nodeDef.display_name ?? nodeDef.name,
          description: nodeDef.description || undefined,
          inputs: extractInputs(nodeDef),
          outputs: extractOutputs(nodeDef)
        }
      ])
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
