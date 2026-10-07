import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { t } from '@/i18n'

import { useCommandStore } from '@/stores/commandStore'

import { CORE_CONTEXT_KEY_OWNER, useContextKeyStore } from './contextKeyStore'
import { KeybindingImpl } from './keybinding'
import { useKeybindingStore } from './keybindingStore'
import type { Keybinding } from './types'

type KeybindingAction = (event?: KeyboardEvent) => void | Promise<void>

export interface RuntimeKeybinding {
  id: string
  label: string | (() => string)
  binding: Omit<Keybinding, 'commandId' | 'releaseCommandId'>
  enabled: () => boolean
  run: KeybindingAction
  release?: KeybindingAction
}

export const useRuntimeKeybindingStore = defineStore(
  'runtimeKeybinding',
  () => {
    const commands = useCommandStore()
    const bindings = useKeybindingStore()
    const context = useContextKeyStore()
    const providers = shallowRef(
      new Map<string, readonly RuntimeKeybinding[]>()
    )

    function resolve(id: string): RuntimeKeybinding | undefined {
      return providers.value.get(id)?.findLast((provider) => provider.enabled())
    }

    function register(options: RuntimeKeybinding) {
      const { id, label } = options
      const contextKey = `${id}.active`
      if (!providers.value.has(id)) {
        context.provide(
          contextKey,
          CORE_CONTEXT_KEY_OWNER,
          () => resolve(id) !== undefined
        )
        commands.registerCommand({
          id,
          label,
          function: (metadata) =>
            resolve(id)?.run(
              metadata?.keybindingEvent instanceof KeyboardEvent
                ? metadata.keybindingEvent
                : undefined
            )
        })
        if (options.release) {
          commands.registerCommand({
            id: `${id}.Release`,
            label: () =>
              t('keybindings.releaseHold', {
                command: typeof label === 'function' ? label() : label
              }),
            function: () => resolve(id)?.release?.()
          })
        }
      }
      const binding = new KeybindingImpl({
        allowRepeat: false,
        ...options.binding,
        commandId: id,
        releaseCommandId: options.release ? `${id}.Release` : undefined,
        when: [contextKey, options.binding.when].filter(Boolean).join(' && ')
      })
      if (
        !bindings
          .getDefaultKeybindingsByCommandId(id)
          .some((existing) => existing.equals(binding))
      ) {
        bindings.addDefaultKeybinding(binding)
      }
      providers.value = new Map(providers.value).set(id, [
        ...(providers.value.get(id) ?? []),
        options
      ])
      return () => {
        providers.value = new Map(providers.value).set(
          id,
          (providers.value.get(id) ?? []).filter(
            (provider) => provider !== options
          )
        )
      }
    }

    function isAvailable(id: string): boolean {
      return !providers.value.has(id) || resolve(id) !== undefined
    }

    return { register, resolve, isAvailable }
  }
)
