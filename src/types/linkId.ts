export type LinkId = number & { readonly __brand: 'LinkId' }

export function toLinkId(value: number): LinkId {
  return value as LinkId
}
