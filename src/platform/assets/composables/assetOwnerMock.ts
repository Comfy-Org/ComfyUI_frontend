/**
 * Deterministic mock ownership for the media-assets reference build.
 *
 * The real asset API has no owner/publisher field yet (see the open questions in
 * the share-flow plan), so a stable pseudo-random slice of assets reads as
 * "shared by a teammate" purely to demonstrate the multi-user share UX.
 * Everything else is owned by the current user. Engineers replace this with
 * real owner data.
 */

import type { AssetId } from '@/platform/assets/schemas/assetSchema'

export interface AssetOwner {
  name: string
}

export const MOCK_TEAMMATES: readonly AssetOwner[] = [
  { name: 'Mei Chen' },
  { name: 'Jordan Lee' },
  { name: 'Priya Nair' },
  { name: 'Sam Rivera' },
  { name: 'Diego Torres' }
]

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (Math.imul(h, 31) + value.charCodeAt(i)) >>> 0
  }
  return h
}

/** ~1 in 4 assets read as owned (and thus already shared) by a teammate. */
export function isTeammateOwned(assetId: AssetId): boolean {
  return hash(assetId) % 4 === 0
}

/** The teammate who owns an asset — only meaningful when {@link isTeammateOwned}. */
export function teammateFor(assetId: AssetId): AssetOwner {
  return MOCK_TEAMMATES[hash(assetId) % MOCK_TEAMMATES.length]!
}
