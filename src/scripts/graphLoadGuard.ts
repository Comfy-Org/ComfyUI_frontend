import type { ComfyApp } from '@/types/comfy'

const graphLoadEntrypoints = [
  'loadGraphData',
  'loadApiJson',
  'handleFile'
] satisfies (keyof ComfyApp)[]

const graphLoadReentrancyMessage =
  'A graph-load lifecycle hook cannot start a nested graph load'

let graphLoadHookDepth = 0

export function duringGraphLoadHook<T>(operation: () => T): T {
  graphLoadHookDepth++
  try {
    return operation()
  } finally {
    graphLoadHookDepth--
  }
}

export function isInGraphLoadHook(): boolean {
  return graphLoadHookDepth > 0
}

function graphLoadReentrancyError(): Error {
  return new Error(graphLoadReentrancyMessage)
}

export function rejectGraphLoadFromHook(): void {
  if (!isInGraphLoadHook()) return
  throw graphLoadReentrancyError()
}

/**
 * Rejects a graph-bearing dispatch whose entrypoint was reached from a
 * graph-load lifecycle hook, after an await has already cleared the live depth.
 */
export function rejectGraphLoadFromHookOrigin(
  fromGraphLoadHook: boolean
): void {
  if (!fromGraphLoadHook) return
  throw graphLoadReentrancyError()
}

export interface GraphLoadHookDispatch {
  /**
   * The app passed to graph-load lifecycle hooks. Nested graph-load entrypoint
   * calls through it reject until {@link endDispatch} runs; afterwards they
   * delegate to the entrypoint captured when the dispatch began.
   */
  hookApp: ComfyApp
  endDispatch: () => void
}

export function createGraphLoadHookDispatch(
  app: ComfyApp
): GraphLoadHookDispatch {
  let dispatching = true
  const overrides = new Map<PropertyKey, unknown>()
  for (const name of graphLoadEntrypoints) {
    const original = app[name] as (...args: unknown[]) => unknown
    overrides.set(name, (...args: unknown[]) =>
      dispatching
        ? Promise.reject(graphLoadReentrancyError())
        : Reflect.apply(original, app, args)
    )
  }
  const hookApp = new Proxy(app, {
    get(target, property) {
      const override = overrides.get(property)
      if (override !== undefined) return override
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
  return {
    hookApp,
    endDispatch: () => {
      dispatching = false
    }
  }
}
