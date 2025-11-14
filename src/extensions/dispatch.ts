import { isCloud } from '@/platform/distribution/types'
import type {
  ComfyExtensionConfigs,
  ComfyExtensionEntrance,
  ComfyExtensionLoadContext,
  StaticComfyCommand,
  StaticComfyKeybinding,
  StaticComfyMenuCommandGroup,
  StaticComfySettingParams
} from './types'
import {
  defineProcessQueue,
  formatExtensions,
  normalizationActivationEvents
} from './utils'

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
    const activationEvents = normalizationActivationEvents(
      extLoadContext,
      extension.config
    )
    activationEvents.forEach((event) =>
      onceExtImportEvent(event, async () => void (await extension.entry()))
    )

    let contributes = extension.config?.contributes
    if (contributes && !Array.isArray(contributes)) contributes = [contributes]
    if (contributes && contributes.length) {
      for (const contribute of contributes) {
        const { settings, commands, keybindings, menuCommands } = contribute
        if (settings) pushExtensionSettings(settings)
        if (commands) pushExtensionCommands(commands)
        if (keybindings) pushExtensionKeybindings(keybindings)
        if (menuCommands) pushExtensionMenuCommands(menuCommands)
      }
    }
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

export function extentionsImportEventHas(event: string) {
  return eventMap.has(event)
}

function onceExtImportEvent(event: string, callback: EventCallback) {
  if (eventMap.has(event)) {
    eventMap.get(event)!.add(callback)
  } else {
    eventMap.set(event, new Set([callback]))
  }
}

const { process: _processExtensionSettings, push: pushExtensionSettings } =
  defineProcessQueue<StaticComfySettingParams>()
export const processExtensionSettings = _processExtensionSettings

const { process: _processExtensionCommands, push: pushExtensionCommands } =
  defineProcessQueue<StaticComfyCommand>()
export const processExtensionCommands = _processExtensionCommands

const {
  process: _processExtensionMenuCommands,
  push: pushExtensionMenuCommands
} = defineProcessQueue<StaticComfyMenuCommandGroup>()
export const processExtensionMenuCommands = _processExtensionMenuCommands

const {
  process: _processExtensionKeybindings,
  push: pushExtensionKeybindings
} = defineProcessQueue<StaticComfyKeybinding>()
export const processExtensionKeybindings = _processExtensionKeybindings
