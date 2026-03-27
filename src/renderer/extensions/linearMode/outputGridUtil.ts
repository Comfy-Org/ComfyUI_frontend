// Matches p-2 and gap-2 on the grid container
const GRID_PADDING_PX = 8
const GRID_GAP_PX = 8

/** CSS calc() — exactly centered in the gap between grid rows/columns. */
export function cssSplitPos(ratio: number): string {
  const totalPad = GRID_PADDING_PX * 2
  const pct = ratio * 100
  return `calc(${GRID_PADDING_PX}px + (100% - ${totalPad + GRID_GAP_PX}px) * ${pct / 100} + ${GRID_GAP_PX / 2}px)`
}

/** Build CSS grid-template for a given output count. */
export function gridStyleForCount(
  count: number,
  rowRatio: number,
  colRatio: number
): { gridTemplate: string } {
  const r = rowRatio
  const c = colRatio
  switch (count) {
    case 2:
      return { gridTemplate: `"a" ${r}fr "b" ${1 - r}fr / 1fr` }
    case 3:
      return {
        gridTemplate: `"a c" ${r}fr "b c" ${1 - r}fr / ${c}fr ${1 - c}fr`
      }
    case 4:
      return {
        gridTemplate: `"a b" ${r}fr "c d" ${1 - r}fr / ${c}fr ${1 - c}fr`
      }
    default:
      return { gridTemplate: '"a" 1fr / 1fr' }
  }
}
