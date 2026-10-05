export type ToastId = number & { readonly __brand: 'ToastId' }

export function toToastId(value: number): ToastId {
  return value as ToastId
}
