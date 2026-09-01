import { z } from 'zod'

const zKeyCombo = z.object({
  key: z.string(),
  ctrl: z.boolean().optional(),
  alt: z.boolean().optional(),
  shift: z.boolean().optional(),
  meta: z.boolean().optional()
})

const zOptionalString = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined)

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
  when: zOptionalString
})

export const zKeybindingPreset = z.object({
  name: z.string().trim().min(1, 'Preset name cannot be empty'),
  newBindings: z.array(zKeybinding),
  unsetBindings: z.array(zKeybinding)
})

export type KeyCombo = z.infer<typeof zKeyCombo>
export type Keybinding = z.infer<typeof zKeybinding>
export type KeybindingPreset = z.infer<typeof zKeybindingPreset>
