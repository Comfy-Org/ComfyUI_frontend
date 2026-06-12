import type {
  MissingErrorMessageSource,
  ResolvedMissingErrorMessage
} from './types'
import { normalizeNodeName, translateCatalogMessage } from './catalogI18n'
import { countMissingMediaReferences } from '@/platform/missingMedia/missingMediaGrouping'
import { st } from '@/i18n'

function formatCountTitle(title: string, count: number): string {
  return `${title} (${count})`
}

function formatNodeTypeName(nodeType: string): string | null {
  const trimmed = nodeType.trim()
  if (!trimmed) return null

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

type NodeTypeErrorSource = Extract<
  MissingErrorMessageSource,
  { kind: 'missing_node' | 'swap_nodes' }
>
type NodeTypeErrorItem = NodeTypeErrorSource['nodeTypes'][number]

function getNodeTypeLabel(nodeType: NodeTypeErrorItem): string {
  return typeof nodeType === 'string' ? nodeType : nodeType.type
}

function getDistinctNodeTypeLabels(nodeTypes: NodeTypeErrorItem[]): string[] {
  const labels = new Set<string>()
  for (const nodeType of nodeTypes) labels.add(getNodeTypeLabel(nodeType))
  return Array.from(labels)
}

type MissingNodeSource = Extract<
  MissingErrorMessageSource,
  { kind: 'missing_node' }
>

function isMissingNodeType(nodeType: NodeTypeErrorItem): boolean {
  return typeof nodeType === 'string' || !nodeType.isReplaceable
}

function resolveMissingNodeDisplayMessage(source: MissingNodeSource): string {
  const key = source.isCloud
    ? 'errorCatalog.missingErrors.missing_node.displayMessageCloud'
    : 'errorCatalog.missingErrors.missing_node.displayMessageOss'
  const fallback = source.isCloud
    ? "Required custom nodes aren't supported on Cloud. Replace them with supported nodes."
    : 'Install missing packs to use this workflow.'
  return translateCatalogMessage(key, fallback)
}

function resolveMissingNodeToastTitle(source: MissingNodeSource): string {
  const labels = getDistinctNodeTypeLabels(
    source.nodeTypes.filter(isMissingNodeType)
  )
  const [firstLabel] = labels
  if (labels.length === 1 && firstLabel) {
    const key = source.isCloud
      ? 'errorCatalog.missingErrors.missing_node.toastTitleOneCloud'
      : 'errorCatalog.missingErrors.missing_node.toastTitleOneOss'
    const fallback = source.isCloud
      ? "{nodeType} isn't available on Cloud"
      : 'Missing node: {nodeType}'
    return translateCatalogMessage(key, fallback, { nodeType: firstLabel })
  }

  const key = source.isCloud
    ? 'errorCatalog.missingErrors.missing_node.toastTitleManyCloud'
    : 'errorCatalog.missingErrors.missing_node.toastTitleManyOss'
  const fallback = source.isCloud
    ? "Nodes aren't available on Cloud"
    : 'Missing nodes'
  return translateCatalogMessage(key, fallback)
}

function resolveMissingNodeToastMessage(source: MissingNodeSource): string {
  const labels = getDistinctNodeTypeLabels(
    source.nodeTypes.filter(isMissingNodeType)
  )
  const count = labels.length || source.count

  if (count === 1) {
    const key = source.isCloud
      ? 'errorCatalog.missingErrors.missing_node.toastMessageOneCloud'
      : 'errorCatalog.missingErrors.missing_node.toastMessageOneOss'
    const fallback = source.isCloud
      ? "This node isn't supported on Cloud."
      : "This workflow uses a custom node that isn't installed. Install it from the registry or replace the node."
    return translateCatalogMessage(key, fallback)
  }

  const key = source.isCloud
    ? 'errorCatalog.missingErrors.missing_node.toastMessageManyCloud'
    : 'errorCatalog.missingErrors.missing_node.toastMessageManyOss'
  const fallback = source.isCloud
    ? "This workflow uses nodes that aren't supported on Cloud."
    : '{count} nodes require missing node packs.'
  return translateCatalogMessage(key, fallback, { count })
}

type SwapNodeSource = Extract<MissingErrorMessageSource, { kind: 'swap_nodes' }>

function isSwapNodeType(nodeType: NodeTypeErrorItem): nodeType is Exclude<
  NodeTypeErrorItem,
  string
> & {
  isReplaceable: true
} {
  return typeof nodeType !== 'string' && nodeType.isReplaceable === true
}

function getSwapNodeTypes(source: SwapNodeSource) {
  return source.nodeTypes.filter(isSwapNodeType)
}

function resolveSwapNodeToastTitle(source: SwapNodeSource): string {
  const nodeTypes = getSwapNodeTypes(source)
  const labels = getDistinctNodeTypeLabels(nodeTypes)
  const [firstLabel] = labels
  if (labels.length === 1 && firstLabel) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.swap_nodes.toastTitleOne',
      '{nodeType} can be replaced',
      { nodeType: firstLabel }
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.swap_nodes.toastTitleMany',
    'Nodes can be replaced'
  )
}

function resolveSwapNodeToastMessage(source: SwapNodeSource): string {
  const nodeTypes = getSwapNodeTypes(source)
  const labels = getDistinctNodeTypeLabels(nodeTypes)
  const [firstNodeType] = nodeTypes
  if (labels.length === 1 && firstNodeType?.replacement?.new_node_id) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.swap_nodes.toastMessageOne',
      'Replace it with {replacementNodeType} from the error panel.',
      { replacementNodeType: firstNodeType.replacement.new_node_id }
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.swap_nodes.toastMessageMany',
    '{count} node types can be replaced with compatible alternatives.',
    { count: labels.length || source.count }
  )
}

function resolveSwapNodeDisplayMessage(): string {
  return translateCatalogMessage(
    'errorCatalog.missingErrors.swap_nodes.displayMessage',
    'Some nodes can be replaced with alternatives'
  )
}

type MissingModelSource = Extract<
  MissingErrorMessageSource,
  { kind: 'missing_model' }
>

function getMissingModelCount(source: MissingModelSource): number {
  const count = source.groups.reduce(
    (total, group) => total + group.models.length,
    0
  )
  return count || source.count
}

function resolveMissingModelDisplayMessage(source: MissingModelSource): string {
  const key = source.isCloud
    ? 'errorCatalog.missingErrors.missing_model.displayMessageCloud'
    : 'errorCatalog.missingErrors.missing_model.displayMessageOss'
  const fallback = source.isCloud
    ? 'Import a model, or open the node to replace it.'
    : 'Download a model, or open the node to replace it.'
  return translateCatalogMessage(key, fallback)
}

function resolveMissingModelToastTitle(source: MissingModelSource): string {
  const [firstModel] = source.groups.flatMap((group) => group.models)
  const count = getMissingModelCount(source)

  if (count === 1 && firstModel) {
    const key = source.isCloud
      ? 'errorCatalog.missingErrors.missing_model.toastTitleOneCloud'
      : 'errorCatalog.missingErrors.missing_model.toastTitleOneOss'
    const fallback = source.isCloud
      ? "{modelName} isn't available on Cloud"
      : '{modelName} is missing'
    return translateCatalogMessage(key, fallback, {
      modelName: firstModel.name
    })
  }

  const useCloudPluralTitle = source.isCloud && count > 1
  const key = useCloudPluralTitle
    ? 'errorCatalog.missingErrors.missing_model.toastTitleManyCloud'
    : 'errorCatalog.missingErrors.missing_model.toastTitleMany'
  const fallback = useCloudPluralTitle
    ? "Models aren't available on Cloud"
    : 'Missing models'
  return translateCatalogMessage(key, fallback)
}

function getMissingModelNodeName(
  model: MissingModelSource['groups'][number]['models'][number]
): string {
  return (
    formatNodeTypeName(model.representative.nodeType) ??
    translateCatalogMessage('errorCatalog.fallbacks.nodeName', 'This node')
  )
}

function resolveMissingModelToastMessage(source: MissingModelSource): string {
  const [firstModel] = source.groups.flatMap((group) => group.models)
  const count = getMissingModelCount(source)

  if (!firstModel || count !== 1) {
    const key = source.isCloud
      ? 'errorCatalog.missingErrors.missing_model.toastMessageManyCloud'
      : 'errorCatalog.missingErrors.missing_model.toastMessageManyOss'
    const fallback = source.isCloud
      ? "Some models aren't supported. Choose different ones."
      : '{count} model files are missing.'
    return translateCatalogMessage(key, fallback, { count })
  }

  if (source.isCloud) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_model.toastMessageOneCloud',
      "This model isn't supported. Choose a different one."
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_model.toastMessageOneOss',
    '{nodeName} is missing a required model file.',
    { nodeName: getMissingModelNodeName(firstModel) }
  )
}

type MissingMediaSource = Extract<
  MissingErrorMessageSource,
  { kind: 'missing_media' }
>

interface MissingMediaItemLabelSource {
  nodeDisplayName?: string
  nodeType?: string
  widgetName?: string
}

function getMissingMediaItems(source: MissingMediaSource) {
  return source.groups.flatMap((group) => group.items)
}

function getMissingMediaNodeName(
  item: ReturnType<typeof getMissingMediaItems>[number]
): string | null {
  return formatNodeTypeName(item.representative.nodeType)
}

function resolveMissingMediaDisplayMessage(): string {
  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_media.displayMessage',
    'A required media input has no file selected.'
  )
}

export function resolveMissingMediaItemLabel(
  source: MissingMediaItemLabelSource
): { displayItemLabel: string } {
  const nodeName = normalizeNodeName(
    source.nodeDisplayName ||
      formatNodeTypeName(source.nodeType ?? '') ||
      undefined
  )
  const inputName =
    source.widgetName?.trim() ||
    translateCatalogMessage('errorCatalog.fallbacks.inputName', 'unknown input')

  return {
    displayItemLabel: translateCatalogMessage(
      'errorCatalog.missingErrors.missing_media.itemLabel',
      '{nodeName} - {inputName}',
      { nodeName, inputName }
    )
  }
}

function resolveMissingMediaToastTitle(source: MissingMediaSource): string {
  if (countMissingMediaReferences(source.groups) !== 1) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_media.toastTitleMany',
      'Missing media inputs'
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_media.toastTitleOne',
    'Media input missing'
  )
}

function resolveMissingMediaToastMessage(source: MissingMediaSource): string {
  const items = getMissingMediaItems(source)
  const [firstItem] = items
  if (!firstItem || countMissingMediaReferences(source.groups) !== 1) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_media.toastMessageMany',
      'Please select the missing media inputs before running this workflow.'
    )
  }

  const nodeName = getMissingMediaNodeName(firstItem)
  const displayNodeName =
    nodeName ??
    translateCatalogMessage('errorCatalog.fallbacks.nodeName', 'This node')
  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_media.toastMessageWithNode',
    '{nodeName} is missing a required media file.',
    {
      nodeName: displayNodeName
    }
  )
}

export function resolveMissingErrorMessage(
  source: MissingErrorMessageSource
): ResolvedMissingErrorMessage {
  switch (source.kind) {
    case 'missing_node':
      return {
        catalogId: 'missing_node',
        displayTitle: formatCountTitle(
          source.isCloud
            ? st(
                'rightSidePanel.missingNodePacks.unsupportedTitle',
                'Unsupported Node Packs'
              )
            : st('rightSidePanel.missingNodePacks.title', 'Missing Node Packs'),
          source.count
        ),
        displayMessage: resolveMissingNodeDisplayMessage(source),
        toastTitle: resolveMissingNodeToastTitle(source),
        toastMessage: resolveMissingNodeToastMessage(source)
      }
    case 'swap_nodes':
      return {
        catalogId: 'swap_nodes',
        displayTitle: formatCountTitle(
          st('nodeReplacement.swapNodesTitle', 'Swap Nodes'),
          source.count
        ),
        displayMessage: resolveSwapNodeDisplayMessage(),
        toastTitle: resolveSwapNodeToastTitle(source),
        toastMessage: resolveSwapNodeToastMessage(source)
      }
    case 'missing_model':
      return {
        catalogId: 'missing_model',
        displayTitle: formatCountTitle(
          st(
            'rightSidePanel.missingModels.missingModelsTitle',
            'Missing Models'
          ),
          source.count
        ),
        displayMessage: resolveMissingModelDisplayMessage(source),
        toastTitle: resolveMissingModelToastTitle(source),
        toastMessage: resolveMissingModelToastMessage(source)
      }
    case 'missing_media':
      return {
        catalogId: 'missing_media',
        displayTitle: formatCountTitle(
          st('rightSidePanel.missingMedia.missingMediaTitle', 'Missing Inputs'),
          source.count
        ),
        displayMessage: resolveMissingMediaDisplayMessage(),
        toastTitle: resolveMissingMediaToastTitle(source),
        toastMessage: resolveMissingMediaToastMessage(source)
      }
  }
}
