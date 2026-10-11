/**
 * The auth pages' toast list, shared between the host island in AuthLayout
 * and whichever island raises a message. It owns the rendered list rather
 * than handing messages over, so one raised before the host hydrates still
 * shows.
 */
import { readonly, ref } from 'vue'

export type AuthToastKind = 'error' | 'success' | 'warning'

interface AuthToastOptions {
  readonly description?: string
  readonly duration?: number
}

export interface AuthToast {
  readonly duration: number
  readonly id: number
  readonly kind: AuthToastKind
  readonly title: string
  readonly description?: string
}

const toasts = ref<AuthToast[]>([])
let nextId = 0

function add(
  kind: AuthToastKind,
  title: string,
  { description, duration = Number.POSITIVE_INFINITY }: AuthToastOptions = {}
): number {
  const id = nextId++
  toasts.value = [...toasts.value, { description, duration, id, kind, title }]
  return id
}

export const authToast: Record<
  AuthToastKind,
  (title: string, options?: AuthToastOptions) => number
> = {
  error: (title, options) => add('error', title, options),
  success: (title, options) => add('success', title, options),
  warning: (title, options) => add('warning', title, options)
}

export function dismissAuthToast(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

export function dismissAllAuthToasts(): void {
  toasts.value = []
}

export function useAuthToasts() {
  return { toasts: readonly(toasts) }
}
