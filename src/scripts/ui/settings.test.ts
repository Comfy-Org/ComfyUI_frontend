import { expectTypeOf, it } from 'vitest'

import type { ComfySettingsDialog } from './settings'

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
