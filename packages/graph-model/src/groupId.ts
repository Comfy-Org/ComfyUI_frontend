export type GroupId = number & { readonly __brand: 'GroupId' }

export function toGroupId(value: number): GroupId {
  return value as GroupId
}
