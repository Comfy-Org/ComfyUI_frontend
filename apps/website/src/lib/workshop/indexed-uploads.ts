import type { FieldSchema } from '../../config/workshop-playground'
import { urlUploadField } from '../../config/workshop-playground'

export interface IndexedUploadGroup {
  /** The first slot's field name, which also names the group. */
  readonly base: string
  readonly label: string
  /** Every slot in order, the base first. */
  readonly members: readonly string[]
}

interface Slot {
  readonly name: string
  readonly label: string
  readonly accept: string
}

const NUMBERED = /^(.+)_(\d+)$/

/**
 * Reference images reach a model as numbered sibling fields —
 * `reference_image_url`, `reference_image_url_2`, and so on up to whatever the
 * model takes. Rendered one control each they read as separate questions, when
 * they are one question that accepts several answers.
 *
 * A run is only grouped when every sibling uploads the same kind of media and
 * carries the base label plus its own number, which is what distinguishes
 * numbered slots of one input from two inputs that happen to share a prefix.
 */
export function indexedUploadGroups(
  fields: readonly FieldSchema[]
): IndexedUploadGroup[] {
  const slots = new Map<string, Slot>(
    fields.flatMap((field) => {
      const upload = urlUploadField(field)
      return upload
        ? ([
            [
              field.name,
              {
                name: field.name,
                label: field.label,
                accept: upload.accept.join()
              }
            ]
          ] as const)
        : []
    })
  )
  return [...slots.values()]
    .filter((slot) => !NUMBERED.test(slot.name))
    .map((slot) => ({
      base: slot.name,
      label: slot.label,
      members: membersFrom(slot, slots)
    }))
    .filter((group) => group.members.length > 1)
}

function membersFrom(base: Slot, slots: ReadonlyMap<string, Slot>): string[] {
  const members = [base.name]
  for (let index = 2; ; index++) {
    const sibling = slots.get(`${base.name}_${index}`)
    if (
      !sibling ||
      sibling.label !== `${base.label} ${index}` ||
      sibling.accept !== base.accept
    )
      return members
    members.push(sibling.name)
  }
}
