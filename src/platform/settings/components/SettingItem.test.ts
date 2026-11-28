import { useSettingStore } from '@/platform/settings/settingStore'
import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingItem from '@/platform/settings/components/SettingItem.vue'
import type { SettingParams } from '@comfyorg/settings-core/types'
import { i18n } from '@/i18n'
import {
  ASK_BEFORE_CLOUD_CHECK,
  saveAskBeforeCloudCheck
} from '@/platform/openOnCloud/cloudCheckConsent'

vi.mock(import('@/platform/openOnCloud/cloudCheckConsent'), { spy: true })

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

const mockGet = vi.fn()
const mockSet = vi.fn<ReturnType<typeof useSettingStore>['set']>(
  async () => undefined
)

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

beforeEach(() => {
  vi.mocked(useSettingStore().get).mockImplementation(mockGet)
  vi.mocked(useSettingStore().set).mockImplementation(mockSet)
})

describe('SettingItem', () => {
  beforeEach(() => {
    emitFormValue = null
  })

  function renderComponent(setting: SettingParams) {
    return render(SettingItem, {
      global: {
        plugins: [i18n],
        stubs: {
          FormItem: FormItemUpdateStub
        }
      },
      props: {
        setting
      }
    })
  }

  it('persists setting updates through the setting store', async () => {
    const settingParams: SettingParams = {
      id: 'Comfy.Locale',
      name: 'Visible Setting',
      type: 'text',
      defaultValue: 'default'
    }

    mockGet.mockReturnValue('default')
    mockSet.mockResolvedValue(undefined)

    renderComponent(settingParams)

    emitFormValue!('newvalue')

    await flushPromises()

    expect(mockSet).toHaveBeenCalledWith('Comfy.Locale', 'newvalue')
  })

  it('saves the Comfy Cloud ask-before-check choice through its checked save', async () => {
    vi.mocked(saveAskBeforeCloudCheck).mockResolvedValue()
    mockGet.mockReturnValue(false)

    renderComponent({
      id: ASK_BEFORE_CLOUD_CHECK,
      name: 'Ask before checking',
      type: 'boolean',
      defaultValue: true
    })

    emitFormValue!(true)
    await flushPromises()

    expect(saveAskBeforeCloudCheck).toHaveBeenCalledWith(true)
    expect(mockSet).not.toHaveBeenCalled()
  })
})
