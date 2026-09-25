import { generationPending } from '../../config/workshop-generation-assets'
import type {
  SavedGeneration,
  SavedGenerationOutput
} from '../../config/workshop-generation-assets'

/** How many tiles the strip keeps. Anything older lives in Cloud. */
const SAVED_ASSETS_SHOWN = 8

export type SavedAssetKind = SavedGenerationOutput['kind']

export type SavedAsset = Extract<SavedAssetTile, { state: 'saved' }>

export type SavedAssetTile =
  | {
      readonly state: 'saved'
      readonly key: string
      readonly assetId: string
      readonly kind: SavedAssetKind
      readonly requestId: string
    }
  | {
      readonly state: 'pending'
      readonly key: string
      readonly generation: SavedGeneration
    }
  | {
      readonly state: 'unsaved'
      readonly key: string
      readonly generation: SavedGeneration
    }

const EXTENSIONS: Record<SavedAssetKind, string> = {
  image: 'png',
  video: 'mp4',
  audio: 'mp3'
}

/**
 * Newest first, so the strip reads the way the reader thinks about their work:
 * what they just made is the first thing under the output. A generation that
 * is still running keeps its place so leaving the page and coming back shows
 * it waiting rather than gone.
 */
export function savedAssetTiles(
  generations: readonly SavedGeneration[],
  unavailable: ReadonlySet<string> = new Set(),
  limit: number = SAVED_ASSETS_SHOWN
): SavedAssetTile[] {
  const tiles: SavedAssetTile[] = []
  for (const generation of generations) {
    if (generationPending(generation)) {
      tiles.push({
        state: 'pending',
        key: generation.request_id,
        generation
      })
      continue
    }
    const saved = generation.asset_outputs.filter(
      (output) => output.status === 'saved' && !unavailable.has(output.asset_id)
    )
    // A run that finished but was not kept still happened, and the reader paid
    // for it. Dropping it leaves the strip empty with nothing said.
    if (!saved.length && generation.asset_save_status === 'failed') {
      tiles.push({
        state: 'unsaved',
        key: generation.request_id,
        generation
      })
      continue
    }
    for (const output of saved) {
      tiles.push({
        state: 'saved',
        key: output.asset_id,
        assetId: output.asset_id,
        kind: output.kind,
        requestId: generation.request_id
      })
    }
  }
  return tiles.slice(0, limit)
}

export function mergeGenerations(
  known: readonly SavedGeneration[],
  incoming: readonly SavedGeneration[]
): SavedGeneration[] {
  return [
    ...new Map(
      [...known, ...incoming].map((generation) => [
        generation.request_id,
        generation
      ])
    ).values()
  ].sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) ||
      b.request_id.localeCompare(a.request_id)
  )
}

/** The signed URL names the stored object, which is friendlier than the id. */
export function savedAssetFileName(
  assetId: string,
  kind: SavedAssetKind,
  url?: string
): string {
  const name = url && new URL(url).pathname.split('/').pop()
  return name?.includes('.') ? name : `comfy-${assetId}.${EXTENSIONS[kind]}`
}

/** What a tile holds while its signed URL is current. */
export interface AssetAccess {
  readonly url?: string
  readonly expiresAt: number
  readonly renewAt: number
}

/**
 * What a tile is left with when a grant request fails. The renewal deadline
 * sits inside the grant's expiry, so a URL with time still on it outlives the
 * attempt to replace it rather than unmounting the player mid-playback. One
 * that has lapsed is let go, and either way a deadline of its own is what
 * makes the tile ask again.
 */
export function accessAfterFailure(
  held: AssetAccess | undefined,
  now: number,
  retryMs: number
): AssetAccess {
  const renewAt = now + retryMs
  return held && held.expiresAt > now
    ? { ...held, renewAt }
    : { expiresAt: 0, renewAt }
}
