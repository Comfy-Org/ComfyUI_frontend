import type { UploadedNodePack } from '../composables/useCustomNodePacks'

/**
 * Maps a node definition's python_module back to the workspace's own uploaded
 * pack, so graph menus can tell "user" custom nodes (editable through the
 * manager) apart from registry-installed ones.
 *
 * Registered packs load as `custom_nodes.pack_<slug>_<uid>...` where the
 * loader derives the module segment from the pack's revision id
 * (`<slug>-<uid>`) by replacing non-identifier characters. Normalizing both
 * sides through the same collapse makes the comparison independent of the
 * loader's exact character mapping.
 */
const packModulePattern =
  /^custom_nodes\.pack_([A-Za-z0-9_]+_x[0-9a-f]+)(?:\.|$)/

const normalizeKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_')

/** The normalized pack key of a registered-pack module, or null for core,
 * extras, and non-pack custom node modules. */
export function packKeyFromPythonModule(
  pythonModule: string | undefined
): string | null {
  if (!pythonModule) return null
  const match = packModulePattern.exec(pythonModule)
  return match ? normalizeKey(match[1]) : null
}

/** The normalized pack key an uploaded pack's nodes load under. */
export function packKeyFromRevisionId(revisionId: string): string {
  return normalizeKey(revisionId)
}

/** The workspace's own pack that a node definition belongs to, if any. */
export function findOwnedPackForModule(
  pythonModule: string | undefined,
  packs: readonly UploadedNodePack[]
): UploadedNodePack | null {
  const moduleKey = packKeyFromPythonModule(pythonModule)
  if (!moduleKey) return null
  return (
    packs.find(
      (pack) => packKeyFromRevisionId(pack.revisionId) === moduleKey
    ) ?? null
  )
}
