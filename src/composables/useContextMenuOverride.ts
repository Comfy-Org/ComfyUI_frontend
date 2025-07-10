import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import { throttle } from 'lodash'
import { Ref, onUnmounted, ref } from 'vue'

export function useContextMenuOverride() {
  const dragging = ref(false)
  const startTime = ref(0)
  const endTime = ref(0)
  const menuElement: Ref<HTMLElement | null> = ref(null)
  const temp: Ref<HTMLElement | null> = ref(null)
  const observer: Ref<MutationObserver | null> = ref(null)
  const intervalId: Ref<ReturnType<typeof setInterval> | null> = ref(null)

  interface OriginalContextMenu {
    new (items: any[], options: any, ref_window?: any): any
  }
  const OriginalContextMenu = LiteGraph.ContextMenu as OriginalContextMenu
  ;(LiteGraph as any).ContextMenu = function (
    items: any[],
    options: any,
    ref_window?: any
  ) {
    if (observer.value) {
      try {
        observer.value.disconnect()
        observer.value = null
      } catch (err) {
        console.warn('Failed to disconnect old observer:', err)
      }
    }

    const instance = new OriginalContextMenu(items, options, ref_window)

    const seen = new Set()

    document.querySelectorAll('.litecontextmenu').forEach((el) => {
      const content = el.innerHTML.trim()
      if (seen.has(content)) {
        el.remove() // Remove duplicate
      } else {
        seen.add(content) // Keep the first occurrence
      }
    })

    // Set current menu element
    menuElement.value = document.querySelector(
      '.litecontextmenu'
    ) as HTMLElement | null

    if (menuElement.value) {
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
                if (Date.now() - startTime.value < 500) {
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

  const processMouseMove = LGraphCanvas.prototype.processMouseMove

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

        const throttledUpdateMenuPosition = throttle(
          (dx: number, dy: number) => {
            try {
              if (menuElement.value) {
                const left = parseFloat(menuElement.value.style.left || '0')
                const top = parseFloat(menuElement.value.style.top || '0')
                menuElement.value.style.left = `${left + dx}px`
                menuElement.value.style.top = `${top + dy}px`
              }
            } catch (error) {
              console.warn('Failed to update menu position:', error)
            }
          },
          16
        )
        throttledUpdateMenuPosition(dx, dy)
        menuElement.value.style.setProperty('z-index', 'inherit', 'important')
      }
    } else {
      dragging.value = false
    }
  }

  // Cleanup on unmount
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
