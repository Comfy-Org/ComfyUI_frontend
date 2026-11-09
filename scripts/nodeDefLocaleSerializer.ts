import {
  escapeI18nMessage,
  normalizeI18nKey
} from '@comfyorg/shared-frontend-utils/formatUtil'

interface LocalizableInput {
  type: string
  name?: string
  tooltip?: string
}

interface LocalizableOutput {
  type: string
  name?: string
  tooltip?: string
}

interface LocalizableNodeDef {
  category: string
  inputs: Record<string, LocalizableInput>
  name: string
  outputs: LocalizableOutput[]
  description?: string
  display_name?: string
}

interface SerializedLabel {
  name?: string
  tooltip?: string
}

interface SerializedNodeDef {
  display_name: string
  description?: string
  inputs?: Record<string, SerializedLabel>
  outputs?: Record<string, SerializedLabel>
}

export type WidgetLabels = Record<
  string,
  Record<string, { name: string | undefined }>
>

export function serializeNodeDefLocales(
  nodeDefs: readonly LocalizableNodeDef[],
  widgetLabels: WidgetLabels = {}
) {
  const dataTypes = Object.fromEntries(
    nodeDefs
      .flatMap((nodeDef) => [
        ...Object.values(nodeDef.inputs).map(({ type }) => type),
        ...nodeDef.outputs.map(({ type }) => type)
      ])
      .flatMap((type) => type.split(','))
      .map((dataType) => [
        normalizeI18nKey(dataType),
        escapeI18nMessage(dataType)
      ])
      .sort((a, b) => a[0].localeCompare(b[0]))
  )

  function serializeInputs(nodeDef: LocalizableNodeDef) {
    const inputs = Object.fromEntries(
      Object.values(nodeDef.inputs).flatMap(({ name, tooltip }) => {
        if (name === undefined && tooltip === undefined) return []

        return [
          [
            normalizeI18nKey(name ?? ''),
            {
              name: name === undefined ? undefined : escapeI18nMessage(name),
              tooltip
            }
          ]
        ]
      })
    )
    return Object.keys(inputs).length > 0 ? inputs : undefined
  }

  function serializeOutputs(nodeDef: LocalizableNodeDef) {
    const outputs = Object.fromEntries(
      nodeDef.outputs.flatMap(({ name, tooltip }, index) => {
        const serializedName =
          name === undefined || name in dataTypes
            ? undefined
            : escapeI18nMessage(name)
        if (serializedName === undefined && tooltip === undefined) return []

        return [[index.toString(), { name: serializedName, tooltip }]]
      })
    )
    return Object.keys(outputs).length > 0 ? outputs : undefined
  }

  function serializeWidgetLabels(nodeName: string) {
    return Object.fromEntries(
      Object.entries(widgetLabels[nodeName] ?? {}).map(([name, label]) => [
        normalizeI18nKey(name),
        {
          name:
            label.name === undefined ? undefined : escapeI18nMessage(label.name)
        }
      ])
    )
  }

  const nodeDefinitions: Record<string, SerializedNodeDef> = Object.fromEntries(
    [...nodeDefs]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nodeDef) => {
        const inputs = {
          ...serializeInputs(nodeDef),
          ...serializeWidgetLabels(nodeDef.name)
        }

        return [
          normalizeI18nKey(nodeDef.name),
          {
            display_name: escapeI18nMessage(
              nodeDef.display_name ?? nodeDef.name
            ),
            description: nodeDef.description
              ? escapeI18nMessage(nodeDef.description)
              : undefined,
            inputs: Object.keys(inputs).length > 0 ? inputs : undefined,
            outputs: serializeOutputs(nodeDef)
          }
        ]
      })
  )

  const nodeCategories = Object.fromEntries(
    nodeDefs.flatMap(({ category }) =>
      category
        .split('/')
        .map((part) => [normalizeI18nKey(part), escapeI18nMessage(part)])
    )
  )

  return { dataTypes, nodeCategories, nodeDefinitions }
}
