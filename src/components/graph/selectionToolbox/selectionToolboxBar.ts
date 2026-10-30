const TOOLBOX_INSET = 4
const BAR_GAP_BELOW_TOOLBOX = 8
const BAR_INSET = 4
const TRIGGER_HEIGHT = 32

export const BAR_SIDE_OFFSET = TOOLBOX_INSET + BAR_GAP_BELOW_TOOLBOX
export const LIFT_WHILE_OPEN = BAR_SIDE_OFFSET + BAR_INSET + TRIGGER_HEIGHT

export const hasSameMembers = <T>(items: T[], previous: T[]) => {
  const previousItems = new Set(previous)
  return (
    items.length === previousItems.size &&
    items.every((item) => previousItems.has(item))
  )
}
