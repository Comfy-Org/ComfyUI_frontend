/**
 * How far a submenu has to be pushed to clear the menu its trigger sits in.
 *
 * A submenu opening to the left of its trigger clears the trigger, not the
 * panel around it. Where the trigger is a small button inside a wide menu, the
 * difference is the whole menu, and the submenu lands on top of it. Measuring
 * to the panel's edge instead follows the menu if its width changes, which a
 * pinned number would not.
 */
export function submenuOffset(
  trigger: { readonly left: number },
  panel: { readonly left: number } | undefined,
  gap: number
): number {
  return panel ? trigger.left - panel.left + gap : gap
}
