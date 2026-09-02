export type RerouteId = number & { readonly __brand: 'RerouteId' }

export function toRerouteId(value: number): RerouteId {
  return value as RerouteId
}
