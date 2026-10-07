import { defineStore } from 'pinia'
import { ref } from 'vue'

import { toToastId } from '@/types/toastId'
import type { ToastId } from '@/types/toastId'
import type { ToastAction, ToastOptions } from '@/types/extensionTypes'

type ToastKind = 'error' | 'info' | 'loading' | 'success' | 'warning'

export interface Toast {
  closable: boolean
  duration: number
  id: ToastId
  kind: ToastKind
  title: string
  action?: ToastAction
  description?: string
}

export const useToast = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  const held = ref(false)
  let nextId = 1

  function add(kind: ToastKind, title: string, options: ToastOptions = {}) {
    const id = toToastId(nextId++)
    toasts.value = [
      ...toasts.value,
      {
        action: options.action,
        closable: options.closable ?? true,
        description: options.description,
        duration: options.duration ?? Number.POSITIVE_INFINITY,
        id,
        kind,
        title
      }
    ]
    return id
  }

  function success(title: string, options?: ToastOptions) {
    return add('success', title, options)
  }

  function error(title: string, options?: ToastOptions) {
    return add('error', title, options)
  }

  function info(title: string, options?: ToastOptions) {
    return add('info', title, options)
  }

  function warning(title: string, options?: ToastOptions) {
    return add('warning', title, options)
  }

  function loading(title: string, options?: ToastOptions) {
    return add('loading', title, options)
  }

  function dismiss(id: ToastId) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function dismissAll() {
    toasts.value = []
  }

  return {
    held,
    toasts,
    success,
    error,
    info,
    warning,
    loading,
    dismiss,
    dismissAll
  }
})
