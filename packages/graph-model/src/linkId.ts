export type LinkId = number & { readonly __brand: 'LinkId' }

export function toLinkId(value: number): LinkId {
  return value as LinkId
}

export function parseLinkId(value: string): LinkId | undefined {
  const id = Number(value)
  return Number.isSafeInteger(id) && String(id) === value
    ? toLinkId(id)
    : undefined
}
