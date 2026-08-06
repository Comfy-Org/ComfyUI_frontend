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
import { useSettingStore } from '@/platform/settings/settingStore'

import { ComfyApiError } from './errors'

export type SettingValue = string | number | boolean | readonly string[]

export interface SettingDef {
  /**
   * Namespaced, by convention `<Pack>.<name>` — it shares one space with core
   * and every other pack, and it is what the value is stored under forever.
   */
  readonly id: string
  readonly name: string
  readonly type: 'boolean' | 'number' | 'slider' | 'text' | 'combo'
  readonly defaultValue: SettingValue
  readonly tooltip?: string
  /** Panel grouping. Defaults to the id split on dots. */
  readonly category?: readonly string[]
  /** Choices for `combo`. */
  readonly options?: readonly string[]
  readonly onChange?: (value: SettingValue, previous?: SettingValue) => void
}

export interface SettingsHandle {
  /**
   * Registers a setting. Call once, at extension load: a value already stored
   * for this id survives, so re-declaring cannot reset a user's choice.
   */
  declare(def: SettingDef): void
  get<T extends SettingValue = SettingValue>(id: string): T | undefined
  set(id: string, value: SettingValue): Promise<void>
}

/**
 * Pack ids are not in the `Settings` union — that union describes core's own
 * settings, and a pack's are by definition unknown to it. The cast is confined
 * to these three call sites rather than pushed onto packs.
 */
const asKey = (id: string) => id as never

export function createSettingsApi(): SettingsHandle {
  const handle: SettingsHandle = {
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
        options: def.options ? [...def.options] : undefined,
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
