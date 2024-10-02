import { z } from 'zod'

// KeyCombo schema
export const zKeyCombo = z.object({
  key: z.string(),
  ctrl: z.boolean().optional(),
  alt: z.boolean().optional(),
  shift: z.boolean().optional(),
  meta: z.boolean().optional()
})

// TriggerCondition schema
export const zTriggerCondition = z.function().returns(z.boolean())

// Keybinding schema
export const zKeybinding = z.object({
  commandId: z.string(),
  combo: zKeyCombo,
  triggerCondition: zTriggerCondition
})

// Infer types from schemas
export type KeyCombo = z.infer<typeof zKeyCombo>
export type TriggerCondition = z.infer<typeof zTriggerCondition>
export type Keybinding = z.infer<typeof zKeybinding>
