import type {
  ComfyExtensionConfig,
  ComfyExtensionConfigs,
  ComfyExtensionEntrance,
  ComfyExtensionLoadContext,
  ComfyExtensionPackages
} from './types'

export function defineComfyExtConfig(
  config: ComfyExtensionConfig
): ComfyExtensionConfig {
  return config
}

export function formatExtensions(
  entrance: ComfyExtensionEntrance,
  configs: ComfyExtensionConfigs
): ComfyExtensionPackages {
  const pkgs: ComfyExtensionPackages = {}
  for (const [entryPath, entry] of Object.entries(entrance)) {
    const pathArr = entryPath.split('/')
    const name = pathArr.at(-2)!
    const path = pathArr.slice(0, -1).join('/')
    if (!name) {
      console.error(`Extension`, path, `has no name`)
      continue
    }
    if (!entry) {
      console.error(`Extension`, path, `has no entrance`)
      continue
    }

    const config = configs[`${path}/comfy.ext.config.ts`]
    // if (!config) {
    //   console.warn(`Extension`, path, `has no config`)
    // }
    pkgs[name] = { name, path, config, entry }
  }
  return pkgs
}

export function normalizationActivationEvents(
  ctx: ComfyExtensionLoadContext,
  config: ComfyExtensionConfig | undefined
): string[] {
  if (!config) return ['*']

  if (!checkAboutCloud(ctx, config)) return []

  const { activationEvents, contributes: _contributes } = config

  if (activationEvents.includes('*')) return ['*']

  const contributes = _contributes
    ? Array.isArray(_contributes)
      ? _contributes
      : [_contributes]
    : []

  const events: string[] = []

  if (activationEvents.includes('onCommands:contributes')) {
    for (const contribute of contributes) {
      if (contribute.commands) {
        for (const command of contribute.commands) {
          events.push(`onCommands:${command}`)
        }
      }
    }
  }

  if (activationEvents.includes('onSettings:contributes')) {
    for (const contribute of contributes) {
      if (contribute.settings) {
        for (const setting of contribute.settings) {
          events.push(`onSettings:${setting.id}`)
        }
      }
    }
  }

  if (activationEvents.includes('onWidgets:contributes')) {
    for (const contribute of contributes) {
      if (contribute.widgets) {
        for (const widget of contribute.widgets) {
          events.push(`onWidgets:${widget}`)
        }
      }
    }
  }

  return events
}

function checkAboutCloud(
  ctx: ComfyExtensionLoadContext,
  extConfig: ComfyExtensionConfig
): boolean {
  // Cloud Only Extension
  const { comfyCloud } = extConfig
  if (comfyCloud) {
    if (!ctx.isCloud) return false
    if (comfyCloud === true) return true
    return comfyCloud.subscriptionRequired && ctx.subscriptionRequired
  }

  // Default Extension -> Load Extension
  return true
}

/**
 * Defines a queue processing function for handling elements in a queue.
 * When elements are present in the queue, all existing elements are automatically retrieved
 * and passed to the callback function for processing.
 * Use the process method to register a callback function, and use the push method to add elements to the queue.
 * @returns Returns an object containing process and push methods
 */
export function defineProcessQueue<T>(): {
  process: (worker: (items: T[]) => void) => void
  push: (items: T[]) => void
} {
  let worker: ((items: T[]) => void) | undefined = undefined
  const items: T[] = []
  function push(newItems: T[]) {
    items.push(...newItems)
    consume()
  }
  function process(newWorker: (items: T[]) => void) {
    if (worker) {
      throw new Error('queue worker already registered')
    }
    worker = newWorker
    consume()
  }

  function consume() {
    if (worker !== undefined && items.length > 0) {
      const itemsToProcess = items.slice()
      items.length = 0
      worker(itemsToProcess)
    }
  }

  return {
    process,
    push
  }
}
