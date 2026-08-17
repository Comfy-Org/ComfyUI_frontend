/**
 * Pack settings, without `app.ui.settings`.
 *
 * This is the single largest reason converted packs still reach for the legacy
 * app object: of 26 kjnodes files, 12 held onto `window.comfyAPI` for nothing
 * but a setting read. A pack that cannot declare a preference cannot be
 * converted, however well the rest of it maps.
 *
 * Deliberately three members. Declaring, reading and writing is the whole of
 * what packs do here; the panel's grouping, ordering and rendering are the
 * host's business, and exposing them would make the settings UI a public
 * contract we then could not change.
 */
import { watch } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

import { ComfyApiError } from './errors'
import type { Unsubscribe } from './widgetHandle'

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type SettingValue = string | number | boolean | readonly string[]

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SettingDef {
  /**
   * Namespaced, by convention `<Pack>.<name>` — it shares one space with core
   * and every other pack, and it is what the value is stored under forever.
   */
  readonly id: string
  readonly name: string
  /**
   * Which control the panel shows. Every one of these is declarative — the
   * host renders it.
   *
   * A pack-supplied renderer is deliberately absent. Core's own setting type
   * accepts a function that is handed the value and a setter and returns an
   * element; publishing that would put packs in charge of the settings
   * panel's markup, which is the thing that cannot then be restyled. Packs
   * that needed a colour or a file were falling back to a text field the user
   * pasted into, so the gap was the missing *types*, not a missing slot.
   */
  readonly type:
    | 'boolean'
    | 'number'
    | 'slider'
    | 'knob'
    | 'combo'
    | 'radio'
    | 'text'
    | 'password'
    | 'color'
    | 'image'
    | 'url'
  readonly defaultValue: SettingValue
  readonly tooltip?: string
  /** Panel grouping. Defaults to the id split on dots. */
  readonly category?: readonly string[]
  /**
   * Choices for `combo` and `radio`.
   *
   * A bare string is both the stored value and the label. Use the pair form
   * when they differ — several packs store a semantic number and show words
   * for it (`0` = off, `1` = selected, `2` = all), and comparing those
   * numerically is the whole point. Flattening them to strings silently
   * re-types every user's saved choice.
   */
  readonly options?: readonly SettingOption[]
  /**
   * Bounds for `number` and `slider`. Without these a slider has no range to
   * draw and packs fall back to a plain text box.
   */
  readonly attrs?: SettingAttrs
  readonly onChange?: (value: SettingValue, previous?: SettingValue) => void
}

/** @knipIgnoreUnusedButUsedByCustomNodes */
export type SettingOption =
  | string
  | { readonly value: string | number; readonly label: string }

/** @knipIgnoreUnusedButUsedByCustomNodes */
export interface SettingAttrs {
  readonly min?: number
  readonly max?: number
  readonly step?: number
}

export interface SettingsHandle {
  /**
   * Registers a setting. Call once, at extension load: a value already stored
   * for this id survives, so re-declaring cannot reset a user's choice.
   */
  declare(def: SettingDef): void
  get<T extends SettingValue = SettingValue>(id: string): T | undefined
  set(id: string, value: SettingValue): Promise<void>
  /**
   * Watches a setting, including one the pack did not declare.
   *
   * `declare`'s own `onChange` only fires for settings the pack owns, so a
   * pack that needs to react to a *core* preference — colour palette, link
   * render mode, locale — had nothing to observe and polled or ignored it.
   *
   * Fires on change only, not on registration. Returns a function that stops
   * watching; call it from wherever the pack tears down.
   */
  onChange<T extends SettingValue = SettingValue>(
    id: string,
    listener: (value: T | undefined, previous: T | undefined) => void
  ): Unsubscribe
}

/**
 * Pack ids are not in the `Settings` union — that union describes core's own
 * settings, and a pack's are by definition unknown to it. The cast is confined
 * to these three call sites rather than pushed onto packs.
 */
const asKey = (id: string) => id as never

export function createSettingsApi(): SettingsHandle {
  const handle: SettingsHandle = {
    onChange(id, listener) {
      const store = useSettingStore()
      // Watching a getter rather than the store's internal map: `get` applies
      // the default when nothing is stored, so a pack sees the same value it
      // would read, not `undefined` until someone writes.
      return watch(
        () => store.get(asKey(id)),
        (value, previous) => listener(value as never, previous as never)
      )
    },

    declare(def: SettingDef) {
      if (!def.id.includes('.')) {
        throw new ComfyApiError(
          `Setting id '${def.id}' must be namespaced, e.g. 'MyPack.${def.id}'.`
        )
      }
      useSettingStore().addSetting({
        id: asKey(def.id),
        name: def.name,
        type: def.type,
        defaultValue: def.defaultValue,
        tooltip: def.tooltip,
        category: def.category ? [...def.category] : undefined,
        // The store's own option shape is `{ text, value }`; ours is
        // `{ label, value }` so a pack is not reading core's internal naming
        // out of our type.
        options: def.options?.map((option) =>
          typeof option === 'string'
            ? option
            : { text: option.label, value: option.value }
        ),
        attrs: def.attrs ? { ...def.attrs } : undefined,
        onChange: def.onChange as SettingDef['onChange']
      })
    },

    get(id: string) {
      return useSettingStore().get(asKey(id)) as never
    },

    async set(id: string, value: SettingValue) {
      await useSettingStore().set(asKey(id), value as never)
    }
  }
  return Object.freeze(handle)
}
