import type { ToastId } from '@/types/toastId'

export interface ToastAction {
  label: string
  onClick: () => unknown
}

export interface ToastOptions {
  action?: ToastAction
  closable?: boolean
  description?: string
  duration?: number
  id?: ToastId
}
