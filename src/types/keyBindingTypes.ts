import { z } from 'zod'

// KeyCombo schema
export const zKeyCombo = z.object({
  key: z.string(),
  ctrl: z.boolean().optional(),
  alt: z.boolean().optional(),
  shift: z.boolean().optional(),
  meta: z.boolean().optional()
})

// Keybinding schema
export const zKeybinding = z.object({
  commandId: z.string(),
  combo: zKeyCombo,
  // Optional target element CSS selector to limit keybinding to.
  // Note: Currently only used to distinguish between global keybindings
  // and litegraph canvas keybindings.
  targetSelector: z.string().optional()
})

// Infer types from schemas
export type KeyCombo = z.infer<typeof zKeyCombo>
export type Keybinding = z.infer<typeof zKeybinding>
