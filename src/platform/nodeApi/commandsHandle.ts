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
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCommandStore } from '@/stores/commandStore'

import { ComfyApiError } from './errors'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface KeyCombo {
  readonly key: string
  readonly ctrl?: boolean
  readonly alt?: boolean
  readonly shift?: boolean
  readonly meta?: boolean
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface CommandDef {
  /** Namespaced, e.g. `MyPack.doTheThing`. Shared with core and every pack. */
  readonly id: string
  /**
   * A function when the label depends on state — a toggle that reads "Follow
   * execution" and then "Stop following execution". It is read each time the
   * label is shown, so it must return quickly.
   */
  readonly label: string | (() => string)
  readonly run: () => void | Promise<void>
  /** Bound as a default, so a user's own binding still wins. */
  readonly keybinding?: KeyCombo
  /**
   * Where the keybinding applies. Defaults to anywhere in the application.
   *
   * `'canvas'` limits it to the graph, so it will not fire while the user is
   * typing in a node's text widget or any other field. The host already
   * withholds combos a text input owns — every bare arrow, Ctrl+Left/Right,
   * Ctrl+A/C/V/X/Z — but a pack binding something it does not, say Ctrl+Up,
   * would otherwise fire mid-sentence.
   */
  readonly scope?: 'canvas'
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface NotifyDef {
  readonly severity?: 'success' | 'info' | 'warn' | 'error'
  readonly summary: string
  readonly detail?: string
  /** Milliseconds. Omit for the host's default. */
  readonly life?: number
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface PlaySoundDef {
  /**
   * A browser-readable audio asset. Sandboxed hosts restrict this to pack files.
   */
  readonly src: string
  /** Range 0–1. Defaults to 1. */
  readonly volume?: number
}

export interface CommandsHandle {
  register(def: CommandDef): void
  notify(def: NotifyDef): void
  playSound(def: PlaySoundDef): Promise<void>
  /**
   * Runs a command the host or another pack registered, by id.
   *
   * Packs reached into internals to do what a command already does — opening
   * the mask editor was `ComfyApp.copyToClipspace` plus `clipspace_return_node`
   * plus invoking `Comfy.MaskEditor.OpenMaskEditor` by hand. Commands are the
   * sanctioned action layer, so a pack can ask for the behaviour without the
   * host having to publish the machinery behind it.
   *
   * Rejects if no such command is registered — a pack naming a command that
   * has been renamed should hear about it rather than silently do nothing.
   */
  run(id: string): Promise<void>
  /** Whether a command exists, for a pack that offers an entry conditionally. */
  has(id: string): boolean
}

export function createCommandsApi(): CommandsHandle {
  const handle: CommandsHandle = {
    async run(id: string) {
      await useCommandStore().execute(id)
    },

    has: (id: string) => useCommandStore().isRegistered(id),

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
        new KeybindingImpl({
          commandId: def.id,
          combo: def.keybinding,
          ...(def.scope === 'canvas' ? { targetElementId: 'graph-canvas' } : {})
        })
      )
    },

    notify(def: NotifyDef) {
      useToastStore().add({
        severity: def.severity ?? 'info',
        summary: def.summary,
        detail: def.detail,
        life: def.life
      })
    },

    async playSound(def: PlaySoundDef) {
      const volume = def.volume ?? 1
      if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
        throw new ComfyApiError('Sound volume must be a number from 0 to 1.')
      }
      const audio = new Audio(def.src)
      audio.volume = volume
      await audio.play()
    }
  }
  return Object.freeze(handle)
}
