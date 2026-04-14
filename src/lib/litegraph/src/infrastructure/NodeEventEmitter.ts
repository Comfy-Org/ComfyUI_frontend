type Listener<T = unknown> = (detail: T) => void

type ListenerMap = Map<string, Set<Listener>>

export type Unsubscribe = () => void

interface NodeWithEvents {
  _eventListeners?: ListenerMap
  constructor: { _classEventListeners?: ListenerMap }
}

type EventMapConstraint = { [K: string]: unknown }

export interface INodeEventEmitter<EventMap extends EventMapConstraint> {
  on<K extends keyof EventMap & string>(
    type: K,
    listener: Listener<EventMap[K]>
  ): Unsubscribe

  once<K extends keyof EventMap & string>(
    type: K,
    listener: Listener<EventMap[K]>
  ): Unsubscribe

  off<K extends keyof EventMap & string>(
    type: K,
    listener: Listener<EventMap[K]>
  ): void

  emit<K extends keyof EventMap & string>(
    type: K,
    ...args: EventMap[K] extends never ? [] : [detail: EventMap[K]]
  ): void

  _removeAllListeners?(): void
}

function addListener(
  node: NodeWithEvents,
  type: string,
  listener: Listener
): Unsubscribe {
  if (!node._eventListeners) node._eventListeners = new Map()
  let listeners = node._eventListeners.get(type)
  if (!listeners) {
    listeners = new Set()
    node._eventListeners.set(type, listeners)
  }
  listeners.add(listener)
  return () => node._eventListeners?.get(type)?.delete(listener)
}

function nodeOn(
  this: NodeWithEvents,
  type: string,
  listener: Listener
): Unsubscribe {
  return addListener(this, type, listener)
}

function nodeOnce(
  this: NodeWithEvents,
  type: string,
  listener: Listener
): Unsubscribe {
  const wrapper: Listener = (detail) => {
    this._eventListeners?.get(type)?.delete(wrapper)
    listener(detail)
  }
  return addListener(this, type, wrapper)
}

function nodeOff(this: NodeWithEvents, type: string, listener: Listener) {
  this._eventListeners?.get(type)?.delete(listener)
}

function nodeEmit(this: NodeWithEvents, type: string, detail?: unknown) {
  const listeners = this._eventListeners?.get(type)
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(detail)
      } catch (e) {
        console.error(
          `[ComfyUI] Error in node event listener for "${type}":`,
          e
        )
      }
    }
  }

  const classListeners = this.constructor._classEventListeners?.get(type)
  if (classListeners) {
    for (const listener of classListeners) {
      try {
        listener.call(this, detail)
      } catch (e) {
        console.error(
          `[ComfyUI] Error in class event listener for "${type}":`,
          e
        )
      }
    }
  }
}

function nodeRemoveAllListeners(this: NodeWithEvents) {
  this._eventListeners?.clear()
}

export function applyNodeEventEmitter(target: { prototype: object }): void {
  Object.assign(target.prototype, {
    on: nodeOn,
    once: nodeOnce,
    off: nodeOff,
    emit: nodeEmit,
    _removeAllListeners: nodeRemoveAllListeners
  })
}

export function onAllNodeEvents(
  nodeClass: { _classEventListeners?: ListenerMap },
  type: string,
  listener: Listener
): Unsubscribe {
  if (!nodeClass._classEventListeners)
    nodeClass._classEventListeners = new Map()
  let listeners = nodeClass._classEventListeners.get(type)
  if (!listeners) {
    listeners = new Set()
    nodeClass._classEventListeners.set(type, listeners)
  }
  listeners.add(listener)
  return () => nodeClass._classEventListeners?.get(type)?.delete(listener)
}

export function offAllNodeEvents(
  nodeClass: { _classEventListeners?: ListenerMap },
  type: string,
  listener: Listener
): void {
  nodeClass._classEventListeners?.get(type)?.delete(listener)
}
