import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import { throttle } from 'lodash'
import { Ref, onUnmounted, ref } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'

/**
 * Define interfaces for LiteGraph objects
 * @interface LiteGraphContextMenuOptions
 * @property {string} [title] - The title of the context menu
 * @property {string} [className] - The CSS class name for the context menu
 * @property {(v: any, option: any, event: MouseEvent) => void} [callback] - The callback function for the context menu
 */
interface LiteGraphContextMenuOptions {
  title?: string
  className?: string
  callback?: (v: any, option: any, event: MouseEvent) => void
  // Add other properties as needed
}

/**
 * Define interfaces for LiteGraph objects
 * @interface LiteGraphContextMenuItem
 * @property {string} title - The title of the context menu item
 * @property {(v: any, option: any, event: MouseEvent) => void} [callback] - The callback function for the context menu item
 */
interface LiteGraphContextMenuItem {
  title: string
  callback?: (v: any, option: any, event: MouseEvent) => void
  // Add other properties as needed
}

/**
 * Define the interface for the original context menu constructor
 * @interface OriginalContextMenu
 */
interface OriginalContextMenu {
  new (
    items: LiteGraphContextMenuItem[],
    options: LiteGraphContextMenuOptions,
    ref_window?: Window
  ): any
}

/**
 * Overrides the LiteGraph ContextMenu to make it follow the canvas when dragging.
 * @function useContextMenuOverride
 * @returns {void}
 */
export function useContextMenuOverride() {
  /**
   * Flag to track whether the canvas is being dragged.
   * @type {Ref<boolean>}
   */
  const dragging = ref(false)

  /**
   * Timestamp when the context menu was last reattached.
   * @type {Ref<number>}
   */
  const startTime = ref(0)

  /**
   * The current context menu element.
   * @type {Ref<HTMLElement | null>}
   */
  const menuElement: Ref<HTMLElement | null> = ref(null)

  /**
   * Temporary storage for the context menu element during reattachment.
   * @type {Ref<HTMLElement | null>}
   */
  const temp: Ref<HTMLElement | null> = ref(null)

  /**
   * The MutationObserver instance for observing changes to the context menu.
   * @type {Ref<MutationObserver | null>}
   */
  const observer: Ref<MutationObserver | null> = ref(null)

  /**
   * The interval ID for the reattachment timeout.
   * @type {Ref<ReturnType<typeof setInterval> | null>}
   */
  const intervalId: Ref<ReturnType<typeof setInterval> | null> = ref(null)

  /**
   * Error handling utility.
   * @type {{ wrapWithErrorHandling: (func: () => void, errorHandler: (error: any) => void) => void }}
   */
  const { wrapWithErrorHandling } = useErrorHandling()

  /**
   * Timeout for reattaching the context menu after it's removed from the DOM.
   * @constant {number}
   */
  const REATTACH_TIMEOUT_MS = 500

  /**
   * Throttle delay for updating the context menu position.
   * @constant {number}
   */
  const THROTTLE_DELAY_MS = 1

  /**
   * Attribute name for identifying context menus.
   * @constant {string}
   */
  const CONTEXT_MENU_ID_ATTR = 'data-context-menu-id'

  /**
   * The original ContextMenu constructor.
   * @type {OriginalContextMenu}
   */
  const OriginalContextMenu =
    LiteGraph.ContextMenu as unknown as OriginalContextMenu

  /**
   * Counter for generating unique IDs for context menus.
   * @type {number}
   */
  let contextMenuIdCounter = 0

  /**
   * Overrides the LiteGraph ContextMenu constructor to make it follow the canvas when dragging.
   */
  ;(LiteGraph as any).ContextMenu = function (
    items: LiteGraphContextMenuItem[],
    options: LiteGraphContextMenuOptions,
    ref_window?: Window
  ) {
    // Disconnect any existing observer
    if (observer.value) {
      try {
        observer.value.disconnect()
        observer.value = null
      } catch (err) {
        console.warn('Failed to disconnect old observer:', err)
      }
    }

    // Create a new context menu instance
    const instance = new OriginalContextMenu(items, options, ref_window)

    // Remove duplicate context menus
    const seen = new Set<string>()
    document.querySelectorAll('.litecontextmenu').forEach((el) => {
      const id = el.getAttribute(CONTEXT_MENU_ID_ATTR)
      if (id && seen.has(id)) {
        el.remove() // Remove duplicate
      } else if (id) {
        seen.add(id) // Keep the first occurrence
      }
    })

    // Set the current menu element
    menuElement.value = document.querySelector(
      '.litecontextmenu:not([data-context-menu-id])'
    ) as HTMLElement | null

    if (menuElement.value) {
      // Generate a unique ID for the context menu
      const id = `context-menu-${contextMenuIdCounter++}`
      menuElement.value.setAttribute(CONTEXT_MENU_ID_ATTR, id)

      // Observe changes to the context menu
      observer.value = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const removedNode of Array.from(mutation.removedNodes)) {
            if (removedNode === menuElement.value) {
              // Reattach the menu if it was removed
              temp.value = menuElement.value
              startTime.value = Date.now()

              const reattachFrame = () => {
                if (dragging.value && temp.value) {
                  document.body.appendChild(temp.value)
                  dragging.value = false
                  menuElement.value = null
                  return
                }

                if (Date.now() - startTime.value < REATTACH_TIMEOUT_MS) {
                  requestAnimationFrame(reattachFrame)
                }
              }

              requestAnimationFrame(reattachFrame)
            }
          }
        }
      })

      observer.value.observe(document.body, { childList: true })
    }

    return instance
  }

  /**
   * The original processMouseMove function.
   * @type {Function}
   */
  const processMouseMove = LGraphCanvas.prototype.processMouseMove

  /**
   * Overrides the LGraphCanvas.prototype.processMouseMove function to update the context menu position when dragging.
   */
  LGraphCanvas.prototype.processMouseMove = function (e: PointerEvent) {
    if (!menuElement.value) {
      menuElement.value = document.querySelector(
        '.litecontextmenu'
      ) as HTMLElement | null
    }

    const prevOffset = [...this.ds.offset]
    processMouseMove.call(this, e)

    if (this.dragging_canvas) {
      dragging.value = true

      if (menuElement.value) {
        const dx = this.ds.offset[0] - prevOffset[0]
        const dy = this.ds.offset[1] - prevOffset[1]
        throttledUpdateMenuPosition(dx, dy)
        menuElement.value.style.setProperty('z-index', 'inherit', 'important')
      }
    } else {
      dragging.value = false
    }
  }

  /**
   * Throttled function to update the context menu position.
   * @function throttledUpdateMenuPosition
   * @param {number} dx - The change in x-coordinate.
   * @param {number} dy - The change in y-coordinate.
   */
  const throttledUpdateMenuPosition = throttle((dx: number, dy: number) => {
    wrapWithErrorHandling(
      () => {
        if (menuElement.value) {
          const left = parseFloat(menuElement.value.style.left || '0')
          const top = parseFloat(menuElement.value.style.top || '0')
          menuElement.value.style.left = `${left + dx}px`
          menuElement.value.style.top = `${top + dy}px`
        }
      },
      (error) => {
        console.warn('Failed to update menu position:', error)
      }
    )()
  }, THROTTLE_DELAY_MS)

  /**
   * Cleanup function to restore the original behavior when the component is unmounted.
   */
  onUnmounted(() => {
    LGraphCanvas.prototype.processMouseMove = processMouseMove

    if (observer.value) {
      observer.value.disconnect()
      observer.value = null
    }

    if (intervalId.value) {
      clearInterval(intervalId.value)
      intervalId.value = null
    }

    dragging.value = false
    menuElement.value = null
    temp.value = null
  })
}
