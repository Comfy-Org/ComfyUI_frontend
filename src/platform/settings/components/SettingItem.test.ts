import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingItem from '@/platform/settings/components/SettingItem.vue'
import type { SettingParams } from '@/platform/settings/types'
import { i18n } from '@/i18n'

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

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

describe('SettingItem', () => {
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

  it('persists setting updates through the setting store', async () => {
    const settingParams: SettingParams = {
      id: 'main.sub.setting.name',
      name: 'Visible Setting',
      type: 'text',
      defaultValue: 'default'
    }

    mockGet.mockReturnValue('default')
    mockSet.mockResolvedValue(undefined)

    renderComponent(settingParams)

    emitFormValue!('newvalue')

    await flushPromises()

    expect(mockSet).toHaveBeenCalledWith('main.sub.setting.name', 'newvalue')
  })
})
