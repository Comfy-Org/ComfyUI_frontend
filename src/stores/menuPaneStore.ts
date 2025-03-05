import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'

import { MenuPaneDefinition, RegisteredMenuPane } from '@/types/menuPaneTypes'

const createId = (id: string): string => `menu-pane://${id}`

const isMenuPanePath = (path: string): boolean =>
  path.startsWith('menu-pane://')

const getIdFromPath = (path: string): string | null => {
  if (!isMenuPanePath(path)) return null
  return path.substring('menu-pane://'.length)
}

export const useMenuPaneStore = defineStore('menuPane', () => {
  const registeredPanes = ref<Record<string, RegisteredMenuPane>>({})
  const activeMenuPaneId = ref<string | null>(null)

  const activeMenuPane = computed(() =>
    activeMenuPaneId.value
      ? registeredPanes.value[activeMenuPaneId.value]
      : null
  )
  const visiblePanes = computed(() =>
    Object.values(registeredPanes.value).filter((pane) => pane.visible)
  )

  /**
   * Register a new menu pane
   * @param pane The menu pane definition
   * @returns The ID of the registered pane
   */
  const registerMenuPane = (pane: MenuPaneDefinition) => {
    if (registeredPanes.value[pane.id]) {
      console.warn(`Menu pane with ID ${pane.id} already exists. Overwriting.`)
    }

    registeredPanes.value[pane.id] = {
      ...pane,
      component: markRaw(pane.component),
      visible: false,
      path: createId(pane.id)
    }

    return pane.id
  }

  /**
   * Unregister a menu pane
   * @param id The ID of the pane to unregister
   */
  const unregisterMenuPane = (id: string) => {
    if (activeMenuPaneId.value === id) {
      activeMenuPaneId.value = null
    }

    if (registeredPanes.value[id]?.visible) {
      hideMenuPane(id)
    }

    delete registeredPanes.value[id]
  }

  /**
   * Show a menu pane and make it active
   * @param id The ID of the pane to show
   * @param props Optional props to pass to the pane component
   */
  const showMenuPane = (id: string, props?: Record<string, any>) => {
    const pane = registeredPanes.value[id]
    if (!pane) return

    if (props) {
      pane.props = { ...pane.props, ...props }
    }

    pane.visible = true
    activeMenuPaneId.value = id
  }

  /**
   * Hide a menu pane
   * @param id The ID of the pane to hide
   */
  const hideMenuPane = (id: string) => {
    const pane = registeredPanes.value[id]
    if (!pane) {
      return
    }

    pane.visible = false
    if (activeMenuPaneId.value === id) {
      activeMenuPaneId.value = null
    }
  }

  /**
   * Set the active menu pane
   * @param id The ID of the pane to make active, or null to clear
   */
  const setActiveMenuPane = (id: string | null) => {
    if (id === null) {
      activeMenuPaneId.value = null
      return
    }

    const pane = registeredPanes.value[id]
    if (!pane) return
    if (!pane.visible) pane.visible = true
    activeMenuPaneId.value = id
  }

  /**
   * Toggle a menu pane's visibility
   * @param id The ID of the pane to toggle
   */
  const toggleMenuPane = (id: string) => {
    const pane = registeredPanes.value[id]
    if (!pane) {
      console.error(`Menu pane with ID ${id} not found`)
      return
    }

    if (pane.visible) {
      hideMenuPane(id)
    } else {
      showMenuPane(id)
    }
  }

  /**
   * Get a menu pane by path
   * @param path The path to look up
   * @returns The menu pane or null if not found
   */
  const getMenuPaneByPath = (path: string) => {
    if (!isMenuPanePath(path)) return null

    const id = getIdFromPath(path)
    if (!id) return null

    return registeredPanes.value[id] || null
  }

  return {
    registeredPanes,
    activeMenuPaneId,
    activeMenuPane,
    visiblePanes,

    registerMenuPane,
    unregisterMenuPane,
    showMenuPane,
    hideMenuPane,
    setActiveMenuPane,
    toggleMenuPane,
    getMenuPaneByPath
  }
})
