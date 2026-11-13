import type { Deliver, MethodInstaller } from './dispatchContext'

/** Delivers what the canvas renderer reports of the pointer over a node. */
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
    }
  }
}
