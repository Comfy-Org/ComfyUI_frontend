import { mapKeys, omitBy, pickBy, values } from 'es-toolkit/compat'

import type { components } from '@comfyorg/api-client/generatedManagerTypes'

type InstalledPacks = components['schemas']['InstalledPacksResponse']
type InstalledPack = components['schemas']['ManagerPackInstalled']

/**
 * Normalizes a pack ID by removing the version suffix.
 *
 * ComfyUI-Manager returns pack IDs in different formats:
 * - Enabled packs: "packname" (without version)
 * - Disabled packs: "packname@1_0_3" (with version suffix)
 * - Latest versions from registry: "packname" (without version)
 *
 * Since the pack object itself contains the version info (ver field),
 * we normalize all pack IDs to just the base name for consistent access.
 * This ensures we can always find a pack by its base name (nodePack.id)
 * regardless of its enabled/disabled state.
 *
 * @param packId - The pack ID that may contain a version suffix
 * @returns The normalized pack ID without version suffix
 */
export function normalizePackId(packId: string): string {
  return packId.split('@')[0]
}

function isInvalidInstallation(entry: unknown): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'invalid_installation' in entry &&
    entry.invalid_installation === true
  )
}

/**
 * Strips the version suffix of each key. When keys collide the last entry wins,
 * but an entry flagged `invalid_installation` never replaces one without the flag.
 */
export function normalizePackKeys<T>(
  packs: Record<string, T>
): Record<string, T> {
  const validInstalls = pickBy(packs, (entry) => !isInvalidInstallation(entry))
  return {
    ...mapKeys(packs, (_value, key) => normalizePackId(key)),
    ...mapKeys(validInstalls, (_value, key) => normalizePackId(key))
  }
}

function nodePackIdOf(pack: InstalledPack) {
  return pack.cnr_id || pack.aux_id
}

/** Normalizes the keys and leaves out each `invalid_installation` entry whose nodepack also has an entry without the flag. */
export function normalizeInstalledPacks(packs: InstalledPacks): InstalledPacks {
  const validNodePackIds = new Set(
    values(packs)
      .filter((pack) => !pack.invalid_installation)
      .map(nodePackIdOf)
  )
  function isInvalidBesideValidInstall(pack: InstalledPack) {
    const id = nodePackIdOf(pack)
    return !!pack.invalid_installation && !!id && validNodePackIds.has(id)
  }
  return normalizePackKeys(omitBy(packs, isInvalidBesideValidInstall))
}

/** Returns the normalized pack id from a `custom_nodes.<pack>` Python module path, or null for any other module. */
export function extractCustomNodeName(
  pythonModule: string | undefined
): string | null {
  const modules = pythonModule?.split('.') || []
  if (modules.length >= 2 && modules[0] === 'custom_nodes') {
    return normalizePackId(modules[1])
  }
  return null
}
