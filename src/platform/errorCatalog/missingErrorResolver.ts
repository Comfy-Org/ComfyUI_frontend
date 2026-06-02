import type {
  MissingErrorMessageSource,
  ResolvedMissingErrorMessage
} from './types'
import { translateCatalogMessage } from './catalogI18n'
import { st } from '@/i18n'

const MAX_DETAIL_ITEMS = 3

function formatCountTitle(title: string, count: number): string {
  return `${title} (${count})`
}

function formatListedNames(names: string[]): string {
  const visibleNames = names.slice(0, MAX_DETAIL_ITEMS).join(', ')
  const remainingCount = names.length - MAX_DETAIL_ITEMS
  if (remainingCount <= 0) return visibleNames

  return translateCatalogMessage(
    'errorCatalog.missingErrors.listWithMore',
    '{itemNames}, and {remainingCount} more',
    { itemNames: visibleNames, remainingCount }
  )
}

function formatReferenceLabel(count: number): string {
  if (count <= 0) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.referenceWorkflow',
      'workflow metadata'
    )
  }

  const key =
    count === 1
      ? 'errorCatalog.missingErrors.referenceOne'
      : 'errorCatalog.missingErrors.referenceMany'
  const fallback = count === 1 ? '1 node' : '{count} nodes'
  return translateCatalogMessage(key, fallback, { count })
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

function getFilteredNodeTypeLabels(
  source: NodeTypeErrorSource,
  isIncluded: (nodeType: NodeTypeErrorItem) => boolean
): string[] {
  return source.nodeTypes.filter(isIncluded).map(getNodeTypeLabel)
}

function getNodeTypeReferenceCount(nodeTypes: NodeTypeErrorItem[]): number {
  const nodeIdCount = nodeTypes.filter(
    (nodeType) => typeof nodeType !== 'string' && nodeType.nodeId != null
  ).length
  return nodeIdCount || nodeTypes.length
}

function resolveItemLabel(
  keyPrefix: string,
  labels: string[],
  count: number,
  fallbackLabel: string
): string {
  if (labels.length === 1) return labels[0]

  const key =
    count === 1 ? `${keyPrefix}.itemLabelOne` : `${keyPrefix}.itemLabelMany`
  const fallback =
    count === 1 ? `1 ${fallbackLabel}` : `{count} ${fallbackLabel}s`
  return translateCatalogMessage(key, fallback, { count })
}

type MissingNodeSource = Extract<
  MissingErrorMessageSource,
  { kind: 'missing_node' }
>

function isMissingNodeType(nodeType: NodeTypeErrorItem): boolean {
  return typeof nodeType === 'string' || !nodeType.isReplaceable
}

function getMissingNodeTypes(source: MissingNodeSource): NodeTypeErrorItem[] {
  return source.nodeTypes.filter(isMissingNodeType)
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

function resolveMissingNodeDisplayDetails(source: MissingNodeSource): string {
  const nodeTypes = getMissingNodeTypes(source)
  const labels = nodeTypes.map(getNodeTypeLabel)
  const [firstLabel] = labels
  if (!firstLabel) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_node.detailsUnavailable',
      'Missing node details are unavailable.'
    )
  }

  if (labels.length === 1) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_node.detailsSingle',
      '{nodeType} is missing. Referenced by {referenceLabel}.',
      {
        nodeType: firstLabel,
        referenceLabel: formatReferenceLabel(
          getNodeTypeReferenceCount(nodeTypes)
        )
      }
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_node.detailsMany',
    'Missing nodes: {itemNames}.',
    { itemNames: formatListedNames(labels) }
  )
}

function resolveMissingNodeToastTitle(source: MissingNodeSource): string {
  const labels = getFilteredNodeTypeLabels(source, isMissingNodeType)
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
  const labels = getFilteredNodeTypeLabels(source, isMissingNodeType)
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

function resolveSwapNodeDisplayDetails(source: SwapNodeSource): string {
  const nodeTypes = getSwapNodeTypes(source)
  const labels = nodeTypes.map(getNodeTypeLabel)
  const [firstNodeType] = nodeTypes
  const [firstLabel] = labels
  if (!firstNodeType || !firstLabel) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.swap_nodes.detailsUnavailable',
      'Swap node details are unavailable.'
    )
  }

  if (labels.length === 1) {
    const replacement = firstNodeType.replacement?.new_node_id
    const key = replacement
      ? 'errorCatalog.missingErrors.swap_nodes.detailsSingle'
      : 'errorCatalog.missingErrors.swap_nodes.detailsSingleWithoutReplacement'
    const fallback = replacement
      ? '{nodeType} can be replaced with {replacementNodeType}.'
      : '{nodeType} can be replaced with a compatible alternative.'
    return translateCatalogMessage(key, fallback, {
      nodeType: firstLabel,
      replacementNodeType: replacement ?? ''
    })
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.swap_nodes.detailsMany',
    'Replaceable nodes: {itemNames}.',
    { itemNames: formatListedNames(labels) }
  )
}

function resolveSwapNodeToastTitle(source: SwapNodeSource): string {
  const labels = getSwapNodeTypes(source).map(getNodeTypeLabel)
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
  const [firstNodeType] = nodeTypes
  if (nodeTypes.length === 1 && firstNodeType?.replacement?.new_node_id) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.swap_nodes.toastMessageOne',
      'Replace it with {replacementNodeType} from the error panel.',
      { replacementNodeType: firstNodeType.replacement.new_node_id }
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.swap_nodes.toastMessageMany',
    '{count} node types can be replaced with compatible alternatives.',
    { count: nodeTypes.length || source.count }
  )
}

type MissingModelSource = Extract<
  MissingErrorMessageSource,
  { kind: 'missing_model' }
>

function getMissingModelNames(groups: MissingModelSource['groups']): string[] {
  return groups.flatMap((group) => group.models.map((model) => model.name))
}

function getMissingModelCount(source: MissingModelSource): number {
  return getMissingModelNames(source.groups).length || source.count
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

function resolveMissingModelDisplayDetails(source: MissingModelSource): string {
  const [firstGroup] = source.groups
  const [firstModel] = firstGroup?.models ?? []
  if (!firstModel) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_model.detailsUnavailable',
      'Missing model details are unavailable.'
    )
  }

  const modelNames = getMissingModelNames(source.groups)
  if (modelNames.length === 1) {
    const referenceLabel = formatReferenceLabel(
      firstModel.referencingNodes.length
    )
    if (firstGroup.directory) {
      return translateCatalogMessage(
        'errorCatalog.missingErrors.missing_model.detailsSingleWithCategory',
        'ComfyUI needs {modelName} in {directory}. Referenced by {referenceLabel}.',
        {
          modelName: firstModel.name,
          directory: firstGroup.directory,
          referenceLabel
        }
      )
    }

    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_model.detailsSingle',
      'ComfyUI needs {modelName}. Referenced by {referenceLabel}.',
      { modelName: firstModel.name, referenceLabel }
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_model.detailsMany',
    'Required models: {itemNames}.',
    { itemNames: formatListedNames(modelNames) }
  )
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

  const key =
    source.isCloud && count > 1
      ? 'errorCatalog.missingErrors.missing_model.toastTitleManyCloud'
      : 'errorCatalog.missingErrors.missing_model.toastTitleMany'
  const fallback =
    source.isCloud && count > 1
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

function getMissingMediaItems(source: MissingMediaSource) {
  return source.groups.flatMap((group) => group.items)
}

function getMissingMediaReferenceCount(source: MissingMediaSource): number {
  return getMissingMediaItems(source).reduce(
    (count, item) => count + item.referencingNodes.length,
    0
  )
}

function formatMediaFileType(
  mediaType: MissingMediaSource['mediaTypes'][number]
) {
  const fallback = mediaType === 'audio' ? 'audio file' : mediaType
  return translateCatalogMessage(
    `errorCatalog.missingErrors.mediaFileTypes.${mediaType}`,
    fallback
  )
}

function getMissingMediaNodeName(
  item: ReturnType<typeof getMissingMediaItems>[number]
): string | null {
  return formatNodeTypeName(item.representative.nodeType)
}

function formatNodeLabel(
  item: ReturnType<typeof getMissingMediaItems>[number]
): string {
  const nodeName = getMissingMediaNodeName(item)
  if (!nodeName) {
    return translateCatalogMessage(
      'errorCatalog.fallbacks.nodeName',
      'This node'
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.nodeLabel',
    '{nodeName} node',
    { nodeName }
  )
}

function resolveMissingMediaDisplayMessage(): string {
  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_media.displayMessage',
    'A required media input has no file selected.'
  )
}

function resolveMissingMediaDisplayDetails(source: MissingMediaSource): string {
  const items = getMissingMediaItems(source)
  const [firstItem] = items
  if (!firstItem) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_media.detailsUnavailable',
      'Missing input details are unavailable.'
    )
  }

  if (items.length === 1) {
    return translateCatalogMessage(
      'errorCatalog.missingErrors.missing_media.detailsSingle',
      '{nodeLabel} needs a selected {mediaType}. Referenced by {referenceLabel}.',
      {
        nodeLabel: formatNodeLabel(firstItem),
        mediaType: formatMediaFileType(firstItem.mediaType),
        referenceLabel: formatReferenceLabel(firstItem.referencingNodes.length)
      }
    )
  }

  return translateCatalogMessage(
    'errorCatalog.missingErrors.missing_media.detailsMany',
    'Missing media inputs are referenced by {referenceLabel}.',
    {
      referenceLabel: formatReferenceLabel(
        getMissingMediaReferenceCount(source)
      )
    }
  )
}

function resolveMissingMediaToastTitle(source: MissingMediaSource): string {
  const items = getMissingMediaItems(source)
  if (items.length !== 1) {
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
  if (!firstItem || items.length !== 1) {
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
    case 'missing_node': {
      const missingNodeLabels = getFilteredNodeTypeLabels(
        source,
        isMissingNodeType
      )
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
        displayDetails: resolveMissingNodeDisplayDetails(source),
        displayItemLabel: resolveItemLabel(
          'errorCatalog.missingErrors.missing_node',
          missingNodeLabels,
          missingNodeLabels.length || source.count,
          'missing node'
        ),
        toastTitle: resolveMissingNodeToastTitle(source),
        toastMessage: resolveMissingNodeToastMessage(source)
      }
    }
    case 'swap_nodes': {
      const swapNodeLabels = getSwapNodeTypes(source).map(getNodeTypeLabel)
      return {
        catalogId: 'swap_nodes',
        displayTitle: formatCountTitle(
          st('nodeReplacement.swapNodesTitle', 'Swap Nodes'),
          source.count
        ),
        displayMessage: st(
          'errorOverlay.swapNodes',
          'Some nodes can be replaced with alternatives'
        ),
        displayDetails: resolveSwapNodeDisplayDetails(source),
        displayItemLabel: resolveItemLabel(
          'errorCatalog.missingErrors.swap_nodes',
          swapNodeLabels,
          swapNodeLabels.length || source.count,
          'replaceable node'
        ),
        toastTitle: resolveSwapNodeToastTitle(source),
        toastMessage: resolveSwapNodeToastMessage(source)
      }
    }
    case 'missing_model': {
      const modelNames = getMissingModelNames(source.groups)
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
        displayDetails: resolveMissingModelDisplayDetails(source),
        displayItemLabel: resolveItemLabel(
          'errorCatalog.missingErrors.missing_model',
          modelNames,
          modelNames.length || source.count,
          'missing model'
        ),
        toastTitle: resolveMissingModelToastTitle(source),
        toastMessage: resolveMissingModelToastMessage(source)
      }
    }
    case 'missing_media': {
      const itemNames = getMissingMediaItems(source).map((item) => item.name)
      return {
        catalogId: 'missing_media',
        displayTitle: formatCountTitle(
          st('rightSidePanel.missingMedia.missingMediaTitle', 'Missing Inputs'),
          source.count
        ),
        displayMessage: resolveMissingMediaDisplayMessage(),
        displayDetails: resolveMissingMediaDisplayDetails(source),
        displayItemLabel: resolveItemLabel(
          'errorCatalog.missingErrors.missing_media',
          itemNames,
          itemNames.length || source.count,
          'missing input'
        ),
        toastTitle: resolveMissingMediaToastTitle(source),
        toastMessage: resolveMissingMediaToastMessage(source)
      }
    }
  }
}
