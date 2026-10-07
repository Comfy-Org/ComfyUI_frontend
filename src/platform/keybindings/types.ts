import { z } from 'zod'

import { parseWhenClause } from './whenClause'

const zOptionalBoolean = z
  .boolean()
  .nullish()
  .transform((value) => value ?? undefined)

const zKeyCombo = z.object({
  key: z.string(),
  ctrl: zOptionalBoolean,
  alt: zOptionalBoolean,
  shift: zOptionalBoolean,
  meta: zOptionalBoolean
})

const zOptionalString = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined)

const zWhenClause = z
  .string()
  .nullish()
  .transform((value) => value?.trim() || undefined)
  .superRefine((value, ctx) => {
    if (value === undefined) return
    const parsed = parseWhenClause(value)
    if (!parsed.success) ctx.addIssue({ code: 'custom', message: parsed.error })
  })

export const zKeybinding = z.object({
  commandId: z.string(),
  combo: zKeyCombo,
  targetElementId: zOptionalString,
  /** Fires only while the dialog opened with this key is the active one. */
  dialogKey: zOptionalString,
  /**
   * Context keys that must hold, as `key && !otherKey`. Extensions register
   * keys through `contextKeys` and set them with
   * `app.extensionManager.contextKey.set`.
   */
  when: zWhenClause
})

export const zKeybindingPreset = z.object({
  name: z.string().trim().min(1, 'Preset name cannot be empty'),
  newBindings: z.array(zKeybinding),
  unsetBindings: z.array(zKeybinding)
})

export type KeyCombo = z.infer<typeof zKeyCombo>
export type Keybinding = z.infer<typeof zKeybinding>
export type KeybindingPreset = z.infer<typeof zKeybindingPreset>
