import { defineStore } from 'pinia'
import { markRaw, ref, watch } from 'vue'
import type { Component } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toToastId } from '@/types/toastId'
import type { ToastId } from '@/types/toastId'

type ToastRole = 'alert' | 'status'
type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'loading'

export interface ToastOptions {
  description?: string
  duration?: number
  closable?: boolean
}

type ToastPlacement = 'stack' | 'dock'

interface CustomToastOptions {
  duration?: number
  closable?: boolean
  role?: ToastRole
  placement?: ToastPlacement
}

interface ToastBase {
  id: ToastId
  duration: number
  closable: boolean
  role: ToastRole
}

interface StandardToast extends ToastBase {
  kind: ToastKind
  title: string
  description?: string
}

interface CustomToast extends ToastBase {
  kind: 'custom'
  component: Component
  props?: Record<string, unknown>
  placement: ToastPlacement
}

type Toast = StandardToast | CustomToast

const PERSISTENT = Number.POSITIVE_INFINITY

export function isDocked(
  toast: Toast
): toast is CustomToast & { placement: 'dock' } {
  return toast.kind === 'custom' && toast.placement === 'dock'
}

export const useToast = defineStore('toast', () => {
  const agentNodeSelectionStore = useCanvasStore()
  const toasts = ref<Toast[]>([])
  const queuedToasts = ref<Toast[]>([])
  let nextId = 1

  function enqueue(toast: Toast) {
    const target =
      agentNodeSelectionStore.isPickingNodes && !isDocked(toast)
        ? queuedToasts
        : toasts
    target.value = [...target.value, toast]
  }

  watch(
    () => agentNodeSelectionStore.isPickingNodes,
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
      id,
      kind,
      title,
      description: options.description,
      duration: options.duration ?? PERSISTENT,
      closable: options.closable ?? true,
      role: kind === 'error' || kind === 'warning' ? 'alert' : 'status'
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

  function custom<C extends Component>(
    component: C,
    props: Omit<ComponentProps<C>, 'toastId'>,
    options: CustomToastOptions = {}
  ) {
    const id = toToastId(nextId++)
    enqueue({
      id,
      kind: 'custom',
      component: markRaw(component),
      props,
      duration: options.duration ?? PERSISTENT,
      closable: options.closable ?? true,
      role: options.role ?? 'status',
      placement: options.placement ?? 'stack'
    })
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
    custom,
    dismiss,
    dismissAll
  }
})
