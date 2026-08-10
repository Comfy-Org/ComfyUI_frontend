/**
 * Commands, keybindings and notifications, without `app.registerExtension`.
 *
 * These are the last things keeping the legacy app object alive in packs that
 * are otherwise fully converted: six kjnodes files register a command or bind a
 * key, three raise a toast. None of it is node behaviour, but all of it is
 * something a node pack legitimately does.
 *
 * A command and its key are declared together on purpose. They were two calls
 * into two subsystems, and a pack that registered one without the other — which
 * happens — produced a binding pointing at nothing, or an unreachable command.
 */
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import type { KeyCombo } from '@/platform/keybindings/types'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCommandStore } from '@/stores/commandStore'

import { ComfyApiError } from './errors'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface CommandDef {
  /** Namespaced, e.g. `MyPack.doTheThing`. Shared with core and every pack. */
  readonly id: string
  readonly label: string
  readonly run: () => void | Promise<void>
  /** Bound as a default, so a user's own binding still wins. */
  readonly keybinding?: KeyCombo
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface NotifyDef {
  readonly severity?: 'success' | 'info' | 'warn' | 'error'
  readonly summary: string
  readonly detail?: string
  /** Milliseconds. Omit for the host's default. */
  readonly life?: number
}

export interface CommandsHandle {
  register(def: CommandDef): void
  notify(def: NotifyDef): void
}

export function createCommandsApi(): CommandsHandle {
  const handle: CommandsHandle = {
    register(def: CommandDef) {
      if (!def.id.includes('.')) {
        throw new ComfyApiError(
          `Command id '${def.id}' must be namespaced, e.g. 'MyPack.${def.id}'.`
        )
      }

      useCommandStore().registerCommand({
        id: def.id,
        label: def.label,
        function: def.run,
        source: 'pack'
      })

      if (!def.keybinding) return
      // A default rather than a user binding: the user's own choice must
      // survive the pack re-registering on every load.
      useKeybindingStore().addDefaultKeybinding(
        new KeybindingImpl({ commandId: def.id, combo: def.keybinding })
      )
    },

    notify(def: NotifyDef) {
      useToastStore().add({
        severity: def.severity ?? 'info',
        summary: def.summary,
        detail: def.detail,
        life: def.life
      })
    }
  }
  return Object.freeze(handle)
}
