export type ToastId = number & { readonly __brand: 'ToastId' }

let lastToastId = 0

export function createToastId(): ToastId {
  lastToastId += 1
  return lastToastId as ToastId
}
