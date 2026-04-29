import type { InjectionKey } from 'vue'
import { inject } from 'vue'

export interface ShowSnackbarOptions {
  shortcut?: string
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

export interface SnackbarToastItem extends ShowSnackbarOptions {
  id: string
  message: string
}

export interface SnackbarToastApi {
  show(message: string, options?: ShowSnackbarOptions): string
  dismiss(id: string): void
}

export const SnackbarToastKey: InjectionKey<SnackbarToastApi> =
  Symbol('SnackbarToastApi')

export function useSnackbarToast(): SnackbarToastApi {
  const api = inject(SnackbarToastKey, null)
  if (!api) {
    throw new Error(
      'useSnackbarToast() must be called within <SnackbarToastProvider>.'
    )
  }
  return api
}
