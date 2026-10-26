export type LinkTieId = number & { readonly __brand: 'LinkTieId' }

export function toLinkTieId(value: number): LinkTieId {
  return value as LinkTieId
}
