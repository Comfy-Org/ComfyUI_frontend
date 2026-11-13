import type { Deliver, MethodInstaller } from './dispatchContext'

/** Delivers what the canvas renderer reports of the pointer over a node. */
export function pointerInstallers(
  deliver: Deliver
): Record<string, MethodInstaller> {
  return {
    onMouseEnter(nodeClass, type) {
      const previous = nodeClass.prototype.onMouseEnter
      nodeClass.prototype.onMouseEnter = function (event) {
        previous?.call(this, event)
        deliver(type, 'onHover', this, (callback, handle) =>
          callback(handle, true)
        )
      }
    },
    onMouseLeave(nodeClass, type) {
      const previous = nodeClass.prototype.onMouseLeave
      nodeClass.prototype.onMouseLeave = function (event) {
        previous?.call(this, event)
        deliver(type, 'onHover', this, (callback, handle) =>
          callback(handle, false)
        )
      }
    },
    onDblClick(nodeClass, type) {
      const previous = nodeClass.prototype.onDblClick
      nodeClass.prototype.onDblClick = function (...args) {
        previous?.call(this, ...args)
        deliver(type, 'onDoubleClick', this, (callback, handle) =>
          callback(handle)
        )
      }
    }
  }
}
