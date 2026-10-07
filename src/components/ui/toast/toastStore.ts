import { defineStore } from 'pinia'
import { markRaw, ref, watch } from 'vue'
import type { Component } from 'vue'

import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'
import { toToastId } from '@/types/toastId'
import type { ToastId } from '@/types/toastId'

type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'loading'

interface ToastAction {
  label: string
  onClick: () => unknown
}

export interface ToastOptions {
  action?: ToastAction
  closable?: boolean
  description?: string
  duration?: number
}

interface StandardToast {
  closable: boolean
  duration: number
  id: ToastId
  kind: ToastKind
  title: string
  action?: ToastAction
  description?: string
}

interface DockedToast {
  component: Component
  id: ToastId
  kind: 'dock'
}

type Toast = StandardToast | DockedToast

const PERSISTENT = Number.POSITIVE_INFINITY

export function isDocked(toast: Toast): toast is DockedToast {
  return toast.kind === 'dock'
}

export const useToast = defineStore('toast', () => {
  const agentNodeSelectionStore = useAgentNodeSelectionStore()
  const toasts = ref<Toast[]>([])
  const queuedToasts = ref<Toast[]>([])
  let nextId = 1

  function enqueue(toast: Toast) {
    const target =
      agentNodeSelectionStore.isActive && !isDocked(toast)
        ? queuedToasts
        : toasts
    target.value = [...target.value, toast]
  }

  watch(
    () => agentNodeSelectionStore.isActive,
    (active) => {
      if (active || queuedToasts.value.length === 0) return
      toasts.value = [...toasts.value, ...queuedToasts.value]
      queuedToasts.value = []
    },
    { flush: 'sync' }
  )

  function add(kind: ToastKind, title: string, options: ToastOptions = {}) {
    const id = toToastId(nextId++)
    enqueue({
      action: options.action,
      closable: options.closable ?? true,
      description: options.description,
      duration: options.duration ?? PERSISTENT,
      id,
      kind,
      title
    })
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

  function dock(component: Component) {
    const id = toToastId(nextId++)
    enqueue({ component: markRaw(component), id, kind: 'dock' })
    return id
  }

  function dismiss(id: ToastId) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
    queuedToasts.value = queuedToasts.value.filter((toast) => toast.id !== id)
  }

  function dismissAll() {
    toasts.value = toasts.value.filter(isDocked)
    queuedToasts.value = queuedToasts.value.filter(isDocked)
  }

  return {
    toasts,
    success,
    error,
    info,
    warning,
    loading,
    dock,
    dismiss,
    dismissAll
  }
})
