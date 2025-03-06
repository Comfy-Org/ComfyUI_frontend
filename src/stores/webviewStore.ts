import { merge } from 'lodash'
import { defineStore } from 'pinia'
import { Component, computed, markRaw, ref, shallowRef } from 'vue'

export interface Webview {
  id: string
  component: Component
  props?: Record<string, any>
  keepAlive?: boolean
}

/**
 * Store used to manage webview canvases
 */
export const useWebviewStore = defineStore('webview', () => {
  const registeredWebviews = shallowRef<Record<string, Webview>>({})
  const activeWebviewId = ref<string | null>(null)

  const activeWebview = computed(() =>
    activeWebviewId.value
      ? registeredWebviews.value[activeWebviewId.value]
      : null
  )
  const hasActiveWebview = computed(() => activeWebviewId.value !== null)

  /**
   * Register a new webview
   * @param webview The webview to register
   */
  const registerWebview = (webview: Webview) => {
    registeredWebviews.value[webview.id] = {
      ...webview,
      component: markRaw(webview.component)
    }
  }

  /**
   * Unregister a webview
   * @param id The ID of the webview to unregister
   */
  const unregisterWebview = (id: string) => {
    const webview = registeredWebviews.value[id]
    if (!webview) return

    if (activeWebviewId.value === id) {
      activeWebviewId.value = null
    }

    delete registeredWebviews.value[id]
  }

  /**
   * Show a webview and make it active
   * @param id The ID of the webview to show
   * @param props Optional props to pass to the webview component
   */
  const showWebview = (id: string, props?: Record<string, any>) => {
    const webview = registeredWebviews.value[id]
    if (!webview) return

    if (props) {
      webview.props = merge(webview.props, props)
    }

    activeWebviewId.value = id
  }

  /**
   * Hide a webview by ID
   * @param id The ID of the webview to hide
   */
  const hideWebview = (id: string) => {
    if (activeWebviewId.value === id) {
      activeWebviewId.value = null
    }
  }

  /**
   * Hide the active webview
   */
  const hideActiveWebview = () => {
    activeWebviewId.value = null
  }

  return {
    activeWebviewId,
    activeWebview,
    hasActiveWebview,

    registerWebview,
    unregisterWebview,
    showWebview,
    hideWebview,
    hideActiveWebview
  }
})
