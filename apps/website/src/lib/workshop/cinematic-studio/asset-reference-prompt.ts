import type { AssetReference } from './assets'

/** Reference numbers follow the submitted image order, including cast/palette. */
export function assetReferencePrompt(
  assets: readonly Pick<AssetReference, 'kind' | 'name' | 'notes'>[],
  preceding: number
): string {
  return assets
    .map(
      (asset, index) =>
        `Use reference image ${preceding + index + 1} for the ${asset.kind} ${JSON.stringify(asset.name)}.${asset.notes.trim() ? ` Preserve these details: ${asset.notes.trim()}` : ''}`
    )
    .join(' ')
}
