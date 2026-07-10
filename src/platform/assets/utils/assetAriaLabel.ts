import type { ComposerTranslation } from 'vue-i18n'

import type { AssetOwner } from '../composables/assetOwnerMock'

/**
 * Accessible name for an asset card or list row. The role=button label masks
 * descendant text, so shared-owner attribution is folded into the name here
 * rather than left to the visible badge.
 */
export function assetCardAriaLabel(
  t: ComposerTranslation,
  params: { name: string; type: string; owner?: AssetOwner }
): string {
  const label = t('assetBrowser.ariaLabel.assetCard', {
    name: params.name,
    type: params.type
  })
  if (!params.owner) return label
  return `${label}. ${t('mediaAsset.sharedByWorkspace', {
    name: params.owner.name
  })}`
}
