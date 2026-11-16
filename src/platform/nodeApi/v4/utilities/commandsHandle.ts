import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { CommandsHandle } from '@/platform/nodeApi/v4/types'

import {
  isBoolean,
  isCallback,
  isFiniteNumber,
  isName,
  isObject,
  isStoreKey,
  isText,
  packObject
} from './packArguments'

const TOAST_KINDS = {
  success: 'success',
  info: 'info',
  warn: 'warning',
  error: 'error'
} as const

export function createCommandsHandle(): CommandsHandle {
  const commands: CommandsHandle = {
    register(command) {
      const { id, label, run, keybinding } = commandDefinition(command)
      const store = useCommandStore()
      if (store.isRegistered(id)) {
        throw invalidArgument(
          'commands.register',
          'an id no other command has',
          id
        )
      }
      const keyBound = keybinding === undefined || bindDefaultKey(keybinding)
      store.registerCommand({
        id,
        label,
        function: async () => {
          await run()
        }
      })
      return keyBound
    },

    run(id) {
      if (!isName(id)) throw invalidArgument('commands.run', 'a command id', id)
      return runCommand(id)
    },

    notify(notification) {
      const { kind, summary, detail, life } = toast(notification)
      useToast()[kind](summary, { description: detail, duration: life })
    }
  }
  return Object.freeze(commands)
}

async function runCommand(id: string): Promise<boolean> {
  const store = useCommandStore()
  if (!isStoreKey(id) || !store.isRegistered(id)) return false
  await store.execute(id)
  return true
}

function commandDefinition(command: unknown) {
  const fields = packObject('commands.register', 'a command', command)
  const id = fields.required(
    'id',
    isStoreKey,
    'a non-empty string no object inherits'
  )
  const label = fields.required('label', isText, 'a string')
  const run = fields.required('run', isCallback, 'a function')
  const combo = fields.optional('keybinding', isObject, 'a key combo')
  const scope = fields.optional('scope', isCanvasScope, "'canvas'")
  return {
    id,
    label,
    run,
    keybinding:
      combo &&
      new KeybindingImpl({
        commandId: id,
        combo: keyCombo(combo),
        targetElementId: scope && 'graph-canvas'
      })
  }
}

function isCanvasScope(value: unknown): value is 'canvas' {
  return value === 'canvas'
}

function keyCombo(combo: object) {
  const fields = packObject(
    'commands.register',
    'a key combo',
    combo,
    'keybinding.'
  )
  const key = fields.required('key', isName, 'a key name')
  const modifier = (name: string) =>
    fields.optional(name, isBoolean, 'a boolean') ?? false
  const [ctrl, alt, shift, meta] = ['ctrl', 'alt', 'shift', 'meta'].map(
    modifier
  )
  return { key, ctrl: ctrl || meta, alt, shift }
}

function bindDefaultKey(keybinding: KeybindingImpl): boolean {
  try {
    useKeybindingStore().addDefaultKeybinding(keybinding)
    return true
  } catch {
    return false
  }
}

function toast(notification: unknown) {
  const fields = packObject('commands.notify', 'a notification', notification)
  const severity =
    fields.optional('severity', isSeverity, 'success, info, warn or error') ??
    'info'
  return {
    kind: TOAST_KINDS[severity],
    summary: fields.required('summary', isText, 'a string'),
    detail: fields.optional('detail', isText, 'a string'),
    life: fields.optional('life', isDuration, 'a positive number')
  }
}

function isSeverity(value: unknown): value is keyof typeof TOAST_KINDS {
  return typeof value === 'string' && Object.hasOwn(TOAST_KINDS, value)
}

function isDuration(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}
