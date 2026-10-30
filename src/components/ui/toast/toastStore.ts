import { defineStore } from 'pinia'
import { ref } from 'vue'

import { createToastId } from '@/types/toastId'
import type { ToastId } from '@/types/toastId'
import type { ToastAction, ToastOptions } from '@/types/toastOptions'

type ToastKind = 'error' | 'info' | 'loading' | 'success' | 'warning'

export interface Toast {
  closable: boolean
  duration: number
  id: ToastId
  instance: symbol
  kind: ToastKind
  title: string
  actions: ToastAction[]
  description?: string
}

export const useToast = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  const held = ref(false)
  const closedByUser = new Set<ToastId>()

  function add(kind: ToastKind, title: string, options: ToastOptions = {}) {
    const id = options.id ?? createToastId()
    toasts.value = [
      ...toasts.value.filter((toast) => toast.id !== id),
      {
        actions: [
          ...(options.action ? [options.action] : []),
          ...(options.actions ?? [])
        ],
        closable: options.closable ?? true,
        description: options.description,
        duration: options.duration ?? Number.POSITIVE_INFINITY,
        id,
        instance: Symbol(),
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

  /** Changes a shown toast's text in place, without showing it again. */
  function update(
    id: ToastId,
    changes: Partial<Pick<Toast, 'title' | 'description'>>
  ) {
    toasts.value = toasts.value.map((toast) =>
      toast.id === id ? { ...toast, ...changes } : toast
    )
  }

  function dismiss(id: ToastId): boolean {
    const remaining = toasts.value.filter((toast) => toast.id !== id)
    const removed = remaining.length < toasts.value.length
    toasts.value = remaining
    return removed
  }

  function close(id: ToastId): boolean {
    closedByUser.add(id)
    return dismiss(id)
  }

  function takeClosedByUser(id: ToastId): boolean {
    return closedByUser.delete(id)
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
    update,
    dismiss,
    close,
    takeClosedByUser,
    dismissAll
  }
})
