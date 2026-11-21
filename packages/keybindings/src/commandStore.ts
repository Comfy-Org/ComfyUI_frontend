import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { CanvasInteractionModeReader } from '@comfyorg/graph-model/CanvasInteractionMode'
import { EDITABLE_INTERACTION_MODE } from '@comfyorg/graph-model/CanvasInteractionMode'
import type { KeybindingImpl } from './keybinding'
import { useKeybindingStore } from './keybindingStore'

export interface ComfyCommand {
  id: string
  function: (metadata?: Record<string, unknown>) => void | Promise<void>

  label?: string | (() => string)
  icon?: string | (() => string)
  tooltip?: string | (() => string)
  menubarLabel?: string | (() => string)
  versionAdded?: string
  confirmation?: string
  source?: string
  active?: () => boolean
  category?: 'essentials' | 'view-controls'
  /** Refused by `execute()` while the canvas interaction mode is select-only. */
  mutatesGraph?: boolean | (() => boolean)
}

function isBlockedByInteractionMode(
  command: ComfyCommand,
  interactionMode: CanvasInteractionModeReader
): boolean {
  if (!interactionMode.isSelectOnly()) return false
  return typeof command.mutatesGraph === 'function'
    ? command.mutatesGraph()
    : command.mutatesGraph === true
}

export class ComfyCommandImpl implements ComfyCommand {
  id: string
  function: (metadata?: Record<string, unknown>) => void | Promise<void>
  _label?: string | (() => string)
  _icon?: string | (() => string)
  _tooltip?: string | (() => string)
  _menubarLabel?: string | (() => string)
  versionAdded?: string
  confirmation?: string
  source?: string
  active?: () => boolean
  category?: 'essentials' | 'view-controls'
  mutatesGraph?: boolean | (() => boolean)

  constructor(command: ComfyCommand) {
    this.id = command.id
    this.function = command.function
    this._label = command.label
    this._icon = command.icon
    this._tooltip = command.tooltip
    this._menubarLabel = command.menubarLabel ?? command.label
    this.versionAdded = command.versionAdded
    this.confirmation = command.confirmation
    this.source = command.source
    this.active = command.active
    this.category = command.category
    this.mutatesGraph = command.mutatesGraph
  }

  get label() {
    return typeof this._label === 'function' ? this._label() : this._label
  }

  get icon() {
    return typeof this._icon === 'function' ? this._icon() : this._icon
  }

  get tooltip() {
    return typeof this._tooltip === 'function' ? this._tooltip() : this._tooltip
  }

  get menubarLabel() {
    return typeof this._menubarLabel === 'function'
      ? this._menubarLabel()
      : this._menubarLabel
  }

  get keybinding(): KeybindingImpl | null {
    return useKeybindingStore().getKeybindingByCommandId(this.id) ?? null
  }
}

export function defineCommandStore(
  useDefaultErrorHandler: () => (error: unknown) => void
) {
  return defineStore('command', () => {
    const commandsById = ref<Record<string, ComfyCommandImpl>>({})
    const commands = computed(() => Object.values(commandsById.value))

    const registerCommand = (command: ComfyCommand) => {
      if (command.id in commandsById.value) {
        console.warn(`Command ${command.id} already registered`)
      }
      commandsById.value[command.id] = new ComfyCommandImpl(command)
    }

    const registerCommands = (commands: ComfyCommand[]) => {
      for (const command of commands) {
        registerCommand(command)
      }
    }

    const getCommand = (command: string) => {
      return commandsById.value[command]
    }

    let interactionMode: CanvasInteractionModeReader = EDITABLE_INTERACTION_MODE
    const setInteractionMode = (mode: CanvasInteractionModeReader) => {
      interactionMode = mode
    }

    const defaultErrorHandler = useDefaultErrorHandler()
    const execute = async (
      commandId: string,
      {
        errorHandler = defaultErrorHandler,
        metadata
      }: {
        errorHandler?: (error: unknown) => void
        metadata?: Record<string, unknown>
      } = {}
    ) => {
      if (!(commandId in commandsById.value)) {
        throw new Error(`Command ${commandId} not found`)
      }
      const command = getCommand(commandId)
      if (isBlockedByInteractionMode(command, interactionMode)) return
      try {
        await command.function(metadata)
      } catch (error) {
        errorHandler(error)
      }
    }

    const isRegistered = (command: string) => {
      return !!commandsById.value[command]
    }

    const loadExtensionCommands = (extension: {
      name: string
      commands?: ComfyCommand[]
    }) => {
      if (extension.commands) {
        for (const command of extension.commands) {
          registerCommand({
            ...command,
            source: extension.name
          })
        }
      }
    }

    const formatKeySequence = (command: ComfyCommandImpl): string => {
      const sequences = command.keybinding?.combo.getKeySequences() || []
      return sequences
        .map((seq) =>
          seq.replace(/Control/g, 'Ctrl').replace(/Shift/g, 'Shift')
        )
        .join(' + ')
    }

    return {
      commands,
      execute,
      getCommand,
      registerCommand,
      registerCommands,
      isRegistered,
      setInteractionMode,
      loadExtensionCommands,
      formatKeySequence
    }
  })
}
