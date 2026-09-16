/**
 * The auth pages' toast list, shared between the host island in AuthLayout
 * and whichever island raises a message. It owns the rendered list rather
 * than handing messages over, so one raised before the host hydrates still
 * shows. Ids and the add/remove shape mirror PrimeVue's ToastService, which
 * the cloud app's GlobalToast sits on.
 */
import { readonly, ref } from 'vue'

export type ToastSeverity = 'success' | 'info' | 'warn' | 'error'

export interface ToastMessageInput {
  readonly severity: ToastSeverity
  readonly summary: string
  readonly detail: string
  /** Milliseconds until auto-dismiss; absent means sticky until closed. */
  readonly life?: number
}

export interface ToastMessage extends ToastMessageInput {
  readonly id: number
}

const messages = ref<ToastMessage[]>([])
let nextId = 0

export function addToast(message: ToastMessageInput): ToastMessage {
  const entry: ToastMessage = { ...message, id: nextId++ }
  messages.value = [...messages.value, entry]
  return entry
}

export function removeToast(id: number): void {
  messages.value = messages.value.filter((message) => message.id !== id)
}

export function removeAllToasts(): void {
  messages.value = []
}

export function useAuthToasts() {
  return { messages: readonly(messages) }
}
