import type { Deliver, MethodInstaller } from './dispatchContext'

/** Delivers what the renderers report of the pointer over a node, and asks whether it takes a drag. */
export function pointerInstallers(
  deliver: Deliver
): Record<string, MethodInstaller> {
  return {
    onMouseEnter(target, type) {
      const previous = target.onMouseEnter
      target.onMouseEnter = function (event) {
        previous?.call(this, event)
        deliver(type, 'onHover', this, (callback, handle) =>
          callback(handle, true)
        )
      }
    },
    onMouseLeave(target, type) {
      const previous = target.onMouseLeave
      target.onMouseLeave = function (event) {
        previous?.call(this, event)
        deliver(type, 'onHover', this, (callback, handle) =>
          callback(handle, false)
        )
      }
    },
    onDblClick(target, type) {
      const previous = target.onDblClick
      target.onDblClick = function (...args) {
        previous?.call(this, ...args)
        deliver(type, 'onDoubleClick', this, (callback, handle) =>
          callback(handle)
        )
      }
    },
    onDragOver(target, type) {
      const previous = target.onDragOver
      target.onDragOver = function (event) {
        if (previous?.call(this, event)) return true
        return deliver(type, 'onDragOver', this, (callback, handle) =>
          callback(handle, event)
        ).includes(true)
      }
    }
  }
}
