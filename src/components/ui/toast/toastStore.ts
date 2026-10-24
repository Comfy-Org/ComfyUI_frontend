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

const isAction = (candidate: unknown): candidate is ToastAction =>
  typeof candidate === 'object' &&
  candidate !== null &&
  typeof (candidate as ToastAction).label === 'string' &&
  typeof (candidate as ToastAction).onClick === 'function'

/**
 * `toast` is part of the public `ExtensionManager` surface, so `action` and
 * `actions` arrive from untyped callers. Every stored action is rendered and
 * read out unconditionally, so one malformed entry would break the whole
 * Toaster render rather than just its own toast.
 */
function toActions(options: ToastOptions): ToastAction[] {
  const supplied: unknown[] = [options.action]
  if (Array.isArray(options.actions)) supplied.push(...options.actions)
  return supplied.filter(isAction)
}

export const useToast = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  const held = ref(false)

  function add(kind: ToastKind, title: string, options: ToastOptions = {}) {
    const id = options.id ?? createToastId()
    toasts.value = [
      ...toasts.value.filter((toast) => toast.id !== id),
      {
        actions: toActions(options),
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

  function dismiss(id: ToastId): boolean {
    const remaining = toasts.value.filter((toast) => toast.id !== id)
    const removed = remaining.length < toasts.value.length
    toasts.value = remaining
    return removed
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
