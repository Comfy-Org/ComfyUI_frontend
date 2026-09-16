import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { Component } from 'vue'

export const useCanvasOverlayStore = defineStore('canvasOverlay', () => {
  const components = shallowRef<readonly Component[]>([])

  function register(component: Component): () => void {
    components.value = [...components.value, component]
    return () => {
      components.value = components.value.filter(
        (candidate) => candidate !== component
      )
    }
  }

  return { components, register }
})
