import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyApp } from '@/scripts/app'

import { ComfySettingsDialog } from './settings'

it('binds setting defaults, callbacks, and accessors to the selected key', () => {
  type AddSetting =
    typeof ComfySettingsDialog.prototype.addSetting<'Comfy.EditAttention.Delta'>
  type Params = Parameters<AddSetting>[0]

  expectTypeOf<Params['defaultValue']>().toEqualTypeOf<
    number | (() => number)
  >()
  expectTypeOf<NonNullable<Params['onChange']>>().parameters.toEqualTypeOf<
    [number, number?]
  >()
  expectTypeOf<NonNullable<Params['migrateDeprecatedValue']>>().toEqualTypeOf<
    (value: unknown) => number
  >()
  expectTypeOf<AddSetting>().returns.toEqualTypeOf<{ value: number }>()
})

describe('saving a setting that fails to persist', () => {
  it.for([
    {
      caller: 'the accessor setter',
      save: (_: ComfySettingsDialog, accessor: { value: number }) => {
        accessor.value = 0.1
      }
    },
    {
      caller: 'setSettingValue',
      save: (dialog: ComfySettingsDialog) => {
        dialog.setSettingValue('Comfy.EditAttention.Delta', 0.1)
      }
    }
  ])('shows an alert toast when saving via $caller', async ({ save }) => {
    vi.mocked(useSettingStore().set).mockRejectedValue(new Error('offline'))
    const dialog = new ComfySettingsDialog(fromPartial<ComfyApp>({}))
    const accessor = dialog.addSetting({
      id: 'Comfy.EditAttention.Delta',
      name: 'Delta',
      type: 'slider',
      defaultValue: 0.05
    })

    save(dialog, accessor)

    await vi.waitFor(() => {
      expect(useToastStore().messagesToAdd).toContainEqual(
        expect.objectContaining({
          severity: 'warn',
          detail: expect.stringContaining(
            'Error saving setting Comfy.EditAttention.Delta'
          )
        })
      )
    })
  })
})
