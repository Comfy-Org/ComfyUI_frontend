import type { Keybinding } from './types'

export function legacyBindings(bindings: readonly Keybinding[]): Keybinding[] {
  return bindings
    .filter(
      (binding) =>
        !binding.when &&
        !binding.dialogKey &&
        !binding.releaseCommandId &&
        binding.allowRepeat === undefined &&
        binding.preventDefault === undefined
    )
    .map(({ commandId, combo, targetElementId }) => ({
      commandId,
      combo,
      targetElementId
    }))
}
