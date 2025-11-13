import { isCloud } from '@/platform/distribution/types'
import type {
  ComfyExtensionConfigs,
  ComfyExtensionEntrance,
  ComfyExtensionLoadContext
} from './types'
import { formatExtensions, normalizationActivationEvents } from './utils'

const extLoadContext: ComfyExtensionLoadContext = {
  get isCloud() {
    return isCloud
  },
  get subscriptionRequired() {
    return !!window.__CONFIG__?.subscription_required
  }
}

export async function dispatchComfyExtensions(options: {
  configs: ComfyExtensionConfigs
  entrance: ComfyExtensionEntrance
}) {
  const { configs, entrance } = options
  const extensions = formatExtensions(entrance, configs)
  for (const extension of Object.values(extensions)) {
    // if (shouldLoadExtension(extLoadContext, extension.config)) {
    //   const module = await extension.entry()
    //   console.log('✅ extension', extension.name, 'loaded', extension, module)
    // } else {
    //   console.log('❌ extension', extension.name, 'disabled', extension.config)
    // }
    const activationEvents = normalizationActivationEvents(
      extLoadContext,
      extension.config
    )
    if (!activationEvents.length) {
      console.log(
        '❌ extension',
        extension.name,
        'has no activation events',
        extension.config
      )
    } else {
      console.log(
        '🧶 extension',
        extension.name,
        'has activation events:',
        activationEvents
      )
    }
    activationEvents.forEach((event) =>
      onceExtImportEvent(event, async ({ event }) => {
        console.log(
          '✅ extension',
          extension.name,
          'loaded by',
          event,
          extension
        )
        await extension.entry()
      })
    )
  }
}

type EventCallback = (ctx: { event: string }) => void | Promise<void>

const eventMap = new Map<string, Set<EventCallback>>()

export async function importExtensionsByEvent(event: string) {
  const callbacks = eventMap.get(event)
  if (!callbacks) return
  eventMap.delete(event)
  await Promise.all([...callbacks].map((cb) => cb({ event })))
}

function onceExtImportEvent(event: string, callback: EventCallback) {
  if (eventMap.has(event)) {
    eventMap.get(event)!.add(callback)
  } else {
    eventMap.set(event, new Set([callback]))
  }
}
