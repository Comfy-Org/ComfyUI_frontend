import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingItem from '@/platform/settings/components/SettingItem.vue'
import type { SettingParams } from '@/platform/settings/types'
import { i18n } from '@/i18n'

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

const trackSettingChanged = vi.fn()
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackSettingChanged
  }))
}))

const mockGet = vi.fn()
const mockSet = vi.fn()
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGet,
    set: mockSet
  })
}))

let emitFormValue: ((value: unknown) => void) | null = null

const FormItemUpdateStub = defineComponent({
  props: {
    id: { type: String, default: '' },
    item: { type: Object, default: undefined },
    formValue: { type: [String, Number, Boolean, Object], default: undefined }
  },
  setup(_, { emit }) {
    emitFormValue = (value: unknown) => emit('update:form-value', value)
    return {}
  },
  template: '<div data-testid="form-item-stub" />'
})

describe('SettingItem (telemetry UI tracking)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emitFormValue = null
  })

  function renderComponent(setting: SettingParams) {
    return render(SettingItem, {
      global: {
        plugins: [i18n],
        stubs: {
          FormItem: FormItemUpdateStub,
          Tag: true
        }
      },
      props: {
        setting
      }
    })
  }

  it('tracks telemetry when value changes via UI (uses normalized value)', async () => {
    const settingParams: SettingParams = {
      id: 'main.sub.setting.name',
      name: 'Telemetry Visible',
      type: 'text',
      defaultValue: 'default'
    }

    mockGet.mockReturnValueOnce('default').mockReturnValueOnce('normalized')
    mockSet.mockResolvedValue(undefined)

    renderComponent(settingParams)

    emitFormValue!('newvalue')

    await flushPromises()

    expect(trackSettingChanged).toHaveBeenCalledTimes(1)
    expect(trackSettingChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        setting_id: 'main.sub.setting.name',
        previous_value: 'default',
        new_value: 'normalized'
      })
    )
  })

  it('does not track telemetry when normalized value does not change', async () => {
    const settingParams: SettingParams = {
      id: 'main.sub.setting.name',
      name: 'Telemetry Visible',
      type: 'text',
      defaultValue: 'same'
    }

    mockGet.mockReturnValueOnce('same').mockReturnValueOnce('same')
    mockSet.mockResolvedValue(undefined)

    renderComponent(settingParams)

    emitFormValue!('same')

    await flushPromises()

    expect(trackSettingChanged).not.toHaveBeenCalled()
  })
})
