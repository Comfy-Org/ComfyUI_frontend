export const treeItemClass =
  'group/tree-node flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-sm py-(--tree-item-padding,--spacing(2)) pr-2 text-sm text-foreground outline-none select-none hover:bg-accent focus-visible:bg-accent data-selected:bg-muted'

export function treeItemIndent(level: number) {
  return { paddingLeft: `${8 + (level - 1) * 24}px` }
}
