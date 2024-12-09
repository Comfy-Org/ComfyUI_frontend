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
  currentCombo: zKeyCombo.optional(),
  // Optional target element CSS selector to limit keybinding to.
  // Note: Currently only used to distinguish between global keybindings
  // and litegraph canvas keybindings.
  // Do NOT use this field in extensions as it has no effect.
  targetSelector: z.string().optional(),
  //context is used to distinguish between global keybindings and keybinds that only work in designated contexts.
  // keybindngs without a set context are presumed to be global keybindngs.
  // Extensions can create their own contexts to reuse keybindngs already set in the global context like crtl+z for undo.
  context: z.string().optional()
})

// KeyBindingContext schema
export const zKeyBindingContext = z.object({
  id: z.string(),
  name: z.string()
})

// Infer types from schemas
export type KeyCombo = z.infer<typeof zKeyCombo>
export type Keybinding = z.infer<typeof zKeybinding>
export type KeyBindingContext = z.infer<typeof zKeyBindingContext>
