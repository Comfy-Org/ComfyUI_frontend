/**
 * The semantic type at the human-edit mint seam (plan 3.3; LAYOUT/ECS
 * command pattern): systems and mint ports speak `GraphOperation`; ONLY the
 * transport layer (`opEnvelope.ts`) attaches wire identity (`op_id`, `actor`,
 * `base_version`, `stamp`) and speaks the frozen wire vocabulary.
 *
 * Derived from the pinned package's own op union rather than re-declared, so
 * the payload shapes cannot drift from what the applier accepts: a
 * `GraphOperation` IS a wire op minus its envelope.
 */
import type { Op, OpBase } from '@comfyorg/comfy-multi-player'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

export type GraphOperation = DistributiveOmit<Op, keyof OpBase>

type LocalInputSlot = number & { readonly __brand: 'LocalInputSlot' }
export type DocumentInputSlot = number & {
  readonly __brand: 'DocumentInputSlot'
}

export type LocalGraphOperation = GraphOperation & {
  readonly __slotSpace: 'local'
  readonly __localInputSlot?: LocalInputSlot
}
export type DocumentGraphOperation = GraphOperation & {
  readonly __slotSpace: 'document'
}
