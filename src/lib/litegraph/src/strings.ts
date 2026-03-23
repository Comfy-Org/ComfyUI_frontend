import type { ISlotType } from './litegraph'

export function parseSlotTypes(type: ISlotType): string[] {
  return type == '' || type == '0'
    ? ['*']
    : String(type).toLowerCase().split(',')
}

/**
 * Creates a unique name by appending an underscore and a number to the end of the name
 * if it already exists.
 * @param name The name to make unique
 * @param existingNames The names that already exist. Default: an empty array
 * @returns The name, or a unique name if it already exists.
 * @remark Used by SubgraphInputNode to deduplicate input names when promoting
 * the same widget name from multiple node instances (e.g. `seed` → `seed_1`).
 * Extensions matching by slot name should account for the `_N` suffix.
 */
export function nextUniqueName(
  name: string,
  existingNames: string[] = []
): string {
  let i = 1
  const baseName = name
  while (existingNames.includes(name)) {
    name = `${baseName}_${i++}`
  }
  return name
}
