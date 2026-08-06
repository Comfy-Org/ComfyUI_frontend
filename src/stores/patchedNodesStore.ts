/**
 * Which node types are running code Comfy rewrote, and how well that rewrite
 * was checked.
 *
 * We generate these patches, so a defect in a patched pack is ours rather than
 * the author's. That only holds up if it is visible: a user hitting a problem
 * must be able to see we changed this node before filing it against the author,
 * and an author receiving the report must be able to ask whether it was patched.
 *
 * Keyed by node type, because a patch converts a file and a file registers node
 * types — the node instance is not the unit of patching.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * How thoroughly a patch was checked before shipping, weakest first.
 *
 * `none` exists to be refused rather than displayed: `compile_db` holds back
 * unvalidated patches, so a node carrying this tier means something bypassed
 * that gate and the badge should say so plainly.
 */
type PatchValidation = 'none' | 'harness' | 'manual'

/**
 * Who generated the patch, which decides who owns a defect in it.
 *
 * `comfy` patches are generated and verified in CI and we own their bugs.
 * `user` patches are generated locally by the user for packs nobody is
 * maintaining; neither Comfy nor the pack's author is responsible for them.
 * The distinction is independent of `validation` — a well-checked user patch is
 * still unsupported, and an unchecked Comfy patch is still ours.
 */
type PatchOrigin = 'comfy' | 'user'

export interface PatchRecord {
  readonly origin: PatchOrigin
  readonly validation: PatchValidation
  /** Pack the patched file belongs to, for a bug report to name. */
  readonly pack: string
  /** Hash of the source the patch was generated against. */
  readonly sourceSha256: string
}

export const usePatchedNodesStore = defineStore('patchedNodes', () => {
  const byNodeType = ref(new Map<string, PatchRecord>())

  function markPatched(nodeType: string, record: PatchRecord): void {
    byNodeType.value.set(nodeType, record)
  }

  const patchOf = (nodeType: string): PatchRecord | undefined =>
    byNodeType.value.get(nodeType)

  function clear(): void {
    byNodeType.value.clear()
  }

  return { markPatched, patchOf, clear }
})
