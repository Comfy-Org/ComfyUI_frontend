import { defineStore } from 'pinia'
import { markRaw, ref } from 'vue'
import type { Component } from 'vue'

export type ToastId = number
type ToastRole = 'alert' | 'status'
type ToastKind = 'success' | 'error' | 'info' | 'warning' | 'loading'

export interface ToastOptions {
  description?: string
  duration?: number
  closable?: boolean
}

interface CustomToastOptions {
  duration?: number
  closable?: boolean
  role?: ToastRole
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
}

type Toast = StandardToast | CustomToast

const PERSISTENT = Number.POSITIVE_INFINITY

export const useToast = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function add(kind: ToastKind, title: string, options: ToastOptions = {}) {
    const id = nextId++
    toasts.value = [
      ...toasts.value,
      {
        id,
        kind,
        title,
        description: options.description,
        duration: options.duration ?? PERSISTENT,
        closable: options.closable ?? true,
        role: kind === 'error' || kind === 'warning' ? 'alert' : 'status'
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

  function custom(
    component: Component,
    props?: Record<string, unknown>,
    options: CustomToastOptions = {}
  ) {
    const id = nextId++
    toasts.value = [
      ...toasts.value,
      {
        id,
        kind: 'custom',
        component: markRaw(component),
        props,
        duration: options.duration ?? PERSISTENT,
        closable: options.closable ?? true,
        role: options.role ?? 'status'
      }
    ]
    return id
  }

  function dismiss(id: ToastId) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function dismissAll() {
    toasts.value = []
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
