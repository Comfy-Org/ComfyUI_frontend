// @ts-strict-ignore
import { $el } from '../ui'
import { api } from '../api'
import { ComfyDialog } from './dialog'
import type { ComfyApp } from '../app'
import type { Setting, SettingParams } from '@/types/settingTypes'
import { useSettingStore } from '@/stores/settingStore'
import { Settings } from '@/types/apiTypes'
import { useToastStore } from '@/stores/toastStore'

export class ComfySettingsDialog extends ComfyDialog<HTMLDialogElement> {
  app: ComfyApp
  settingsValues: any
  settingsLookup: Record<string, Setting>
  settingsParamLookup: Record<string, SettingParams>

  constructor(app: ComfyApp) {
    super()
    const frontendVersion = window['__COMFYUI_FRONTEND_VERSION__']
    this.app = app
    this.settingsValues = {}
    this.settingsLookup = {}
    this.settingsParamLookup = {}
    this.element = $el(
      'dialog',
      {
        id: 'comfy-settings-dialog',
        parent: document.body
      },
      [
        $el('table.comfy-modal-content.comfy-table', [
          $el(
            'caption',
            { textContent: `Settings (v${frontendVersion})` },
            $el('button.comfy-btn', {
              type: 'button',
              textContent: '\u00d7',
              onclick: () => {
                this.element.close()
              }
            })
          ),
          $el('tbody', { $: (tbody) => (this.textElement = tbody) }),
          $el('button', {
            type: 'button',
            textContent: 'Close',
            style: {
              cursor: 'pointer'
            },
            onclick: () => {
              this.element.close()
            }
          })
        ])
      ]
    ) as HTMLDialogElement
  }

  get settings() {
    return Object.values(this.settingsLookup)
  }

  private tryMigrateDeprecatedValue(id: string, value: any) {
    if (this.app.vueAppReady) {
      const settingStore = useSettingStore()
      const setting = settingStore.settings[id]
      if (setting?.migrateDeprecatedValue) {
        return setting.migrateDeprecatedValue(value)
      }
    }
    return value
  }

  #dispatchChange<T>(id: string, value: T, oldValue?: T) {
    // Keep the settingStore updated. Not using `store.set` as it would trigger
    // setSettingValue again.
    // `load` re-dispatch the change for any settings added before load so
    // settingStore is always up to date.
    if (this.app.vueAppReady) {
      useSettingStore().settingValues[id] = value
    }

    this.dispatchEvent(
      new CustomEvent(id + '.change', {
        detail: {
          value,
          oldValue
        }
      })
    )
  }

  async load() {
    if (this.app.storageLocation === 'browser') {
      this.settingsValues = localStorage
    } else {
      this.settingsValues = await api.getSettings()
    }

    // Trigger onChange for any settings added before load
    for (const id in this.settingsLookup) {
      const compatId = this.getId(id)
      this.settingsValues[compatId] = this.tryMigrateDeprecatedValue(
        id,
        this.settingsValues[compatId]
      )
      const value = this.settingsValues[compatId]
      this.settingsLookup[id].onChange?.(value)
      this.#dispatchChange(id, value)
    }
  }

  getId(id: string) {
    if (this.app.storageLocation === 'browser') {
      id = 'Comfy.Settings.' + id
    }
    return id
  }

  getSettingValue<K extends keyof Settings>(
    id: K,
    defaultValue?: Settings[K]
  ): Settings[K] {
    let value = this.settingsValues[this.getId(id)]
    if (value != null) {
      if (this.app.storageLocation === 'browser') {
        try {
          value = JSON.parse(value)
        } catch (error) {}
      }
    }
    return (value ?? defaultValue) as Settings[K]
  }

  getSettingDefaultValue(id: string) {
    const param = this.settingsParamLookup[id]
    return param?.defaultValue
  }

  async setSettingValueAsync<K extends keyof Settings>(
    id: K,
    value: Settings[K]
  ) {
    value = this.tryMigrateDeprecatedValue(id, value)

    const json = JSON.stringify(value)
    localStorage['Comfy.Settings.' + id] = json // backwards compatibility for extensions keep setting in storage

    let oldValue = this.getSettingValue(id, undefined)
    this.settingsValues[this.getId(id)] = value

    if (id in this.settingsLookup) {
      this.settingsLookup[id].onChange?.(value, oldValue)
    }
    this.#dispatchChange(id, value, oldValue)

    await api.storeSetting(id, value)
  }

  setSettingValue<K extends keyof Settings>(id: K, value: Settings[K]) {
    this.setSettingValueAsync(id, value).catch((err) => {
      useToastStore().addAlert(`Error saving setting '${id}': ${err}`)
    })
  }

  refreshSetting(id: keyof Settings) {
    const value = this.getSettingValue(id)
    this.settingsLookup[id].onChange?.(value)
    this.#dispatchChange(id, value)
  }

  addSetting(params: SettingParams) {
    const {
      id,
      name,
      type,
      defaultValue,
      onChange,
      attrs = {},
      tooltip = '',
      options = undefined
    } = params
    if (!id) {
      throw new Error('Settings must have an ID')
    }

    if (id in this.settingsLookup) {
      throw new Error(`Setting ${id} of type ${type} must have a unique ID.`)
    }

    let skipOnChange = false
    let value = this.getSettingValue(id)
    if (value == null) {
      if (this.app.isNewUserSession) {
        // Check if we have a localStorage value but not a setting value and we are a new user
        const localValue = localStorage['Comfy.Settings.' + id]
        if (localValue) {
          value = JSON.parse(localValue)
          this.setSettingValue(id, value) // Store on the server
        }
      }
      if (value == null) {
        value = defaultValue
      }
    }

    // Trigger initial setting of value
    if (!skipOnChange) {
      onChange?.(value, undefined)
      this.#dispatchChange(id, value)
    }

    this.settingsParamLookup[id] = params
    if (this.app.vueAppReady) {
      useSettingStore().settings[id] = params
    }
    this.settingsLookup[id] = {
      id,
      onChange,
      name,
      render: () => {
        if (type === 'hidden') return

        const setter = (v) => {
          if (onChange) {
            onChange(v, value)
          }

          this.setSettingValue(id, v)
          value = v
        }
        value = this.getSettingValue(id, defaultValue)

        let element
        const htmlID = id.replaceAll('.', '-')

        const labelCell = $el('td', [
          $el('label', {
            for: htmlID,
            classList: [tooltip !== '' ? 'comfy-tooltip-indicator' : ''],
            textContent: name
          })
        ])

        if (typeof type === 'function') {
          element = type(name, setter, value, attrs)
        } else {
          switch (type) {
            case 'boolean':
              element = $el('tr', [
                labelCell,
                $el('td', [
                  $el('input', {
                    id: htmlID,
                    type: 'checkbox',
                    checked: value,
                    onchange: (event) => {
                      const isChecked = event.target.checked
                      if (onChange !== undefined) {
                        onChange(isChecked)
                      }
                      this.setSettingValue(id, isChecked)
                    }
                  })
                ])
              ])
              break
            case 'number':
              element = $el('tr', [
                labelCell,
                $el('td', [
                  $el('input', {
                    type,
                    value,
                    id: htmlID,
                    oninput: (e) => {
                      setter(e.target.value)
                    },
                    ...attrs
                  })
                ])
              ])
              break
            case 'slider':
              element = $el('tr', [
                labelCell,
                $el('td', [
                  $el(
                    'div',
                    {
                      style: {
                        display: 'grid',
                        gridAutoFlow: 'column'
                      }
                    },
                    [
                      $el('input', {
                        ...attrs,
                        value,
                        type: 'range',
                        oninput: (e) => {
                          setter(e.target.value)
                          e.target.nextElementSibling.value = e.target.value
                        }
                      }),
                      $el('input', {
                        ...attrs,
                        value,
                        id: htmlID,
                        type: 'number',
                        style: { maxWidth: '4rem' },
                        oninput: (e) => {
                          setter(e.target.value)
                          e.target.previousElementSibling.value = e.target.value
                        }
                      })
                    ]
                  )
                ])
              ])
              break
            case 'combo':
              element = $el('tr', [
                labelCell,
                $el('td', [
                  $el(
                    'select',
                    {
                      oninput: (e) => {
                        setter(e.target.value)
                      }
                    },
                    (typeof options === 'function'
                      ? options(value)
                      : options || []
                    ).map((opt) => {
                      if (typeof opt === 'string') {
                        opt = { text: opt }
                      }
                      const v = opt.value ?? opt.text
                      return $el('option', {
                        value: v,
                        textContent: opt.text,
                        selected: value + '' === v + ''
                      })
                    })
                  )
                ])
              ])
              break
            case 'text':
            default:
              if (type !== 'text') {
                console.warn(
                  `Unsupported setting type '${type}, defaulting to text`
                )
              }

              element = $el('tr', [
                labelCell,
                $el('td', [
                  $el('input', {
                    value,
                    id: htmlID,
                    oninput: (e) => {
                      setter(e.target.value)
                    },
                    ...attrs
                  })
                ])
              ])
              break
          }
        }
        if (tooltip) {
          element.title = tooltip
        }

        return element
      }
    } as Setting

    const self = this
    return {
      get value() {
        return self.getSettingValue(id, defaultValue)
      },
      set value(v) {
        self.setSettingValue(id, v)
      }
    }
  }

  show() {
    this.textElement.replaceChildren(
      $el(
        'tr',
        {
          style: { display: 'none' }
        },
        [$el('th'), $el('th', { style: { width: '33%' } })]
      ),
      ...this.settings
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => s.render())
        .filter(Boolean)
    )
    this.element.showModal()
  }
}
