import type {
  MissingErrorMessageSource,
  ResolvedMissingErrorMessage
} from './types'
import { st, t } from '@/i18n'

// Resolves pre-run missing-resource groups (nodes, models, media, swaps). These
// are grouped catalog messages rather than individual execution error items.
function formatCountTitle(title: string, count: number): string {
  return `${title} (${count})`
}

function translateMissingModelOverlayMessage(count: number): string {
  const translated = t('errorOverlay.missingModels', { count }, count)
  return translated === 'errorOverlay.missingModels'
    ? `${count} required ${count === 1 ? 'model is' : 'models are'} missing`
    : translated
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
        displayMessage: st(
          'errorOverlay.missingNodes',
          'Some nodes are missing and need to be installed'
        )
      }
    case 'swap_nodes':
      return {
        catalogId: 'swap_nodes',
        displayTitle: formatCountTitle(
          st('nodeReplacement.swapNodesTitle', 'Swap Nodes'),
          source.count
        ),
        displayMessage: st(
          'errorOverlay.swapNodes',
          'Some nodes can be replaced with alternatives'
        )
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
        displayMessage: translateMissingModelOverlayMessage(source.count)
      }
    case 'missing_media':
      return {
        catalogId: 'missing_media',
        displayTitle: formatCountTitle(
          st('rightSidePanel.missingMedia.missingMediaTitle', 'Missing Inputs'),
          source.count
        ),
        displayMessage: st(
          'errorOverlay.missingMedia',
          'Some nodes are missing required inputs'
        )
      }
  }
}
