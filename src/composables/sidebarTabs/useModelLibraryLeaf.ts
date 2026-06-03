import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

export const LEAF_ROW_CLASS =
  'group/tree-node flex w-full min-w-0 cursor-grab items-center gap-2 overflow-hidden rounded-sm py-1.5 pr-2 pl-8 outline-none select-none hover:bg-comfy-input'
export const LEAF_MENU_CONTENT_CLASS =
  'z-9999 min-w-44 overflow-hidden rounded-md border border-border-default bg-comfy-menu-bg p-1 shadow-md'
export const LEAF_MENU_ITEM_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-highlight focus:bg-highlight'

// Shared row wiring for a Model Library leaf (asset or partner node): the row
// ref, context-menu open state, and the mouseenter/leave bridge that drives the
// parent's shared hover popover via onShow(rect)/onHide().
export function useModelLibraryLeaf(options: {
  onShow: (rect: DOMRect) => void
  onHide: () => void
}) {
  const rowRef = ref<HTMLElement | null>(null)
  const isContextMenuOpen = ref(false)

  // Opening the context menu dismisses the hover popover so the two don't stack.
  watch(isContextMenuOpen, (open) => {
    if (open) options.onHide()
  })

  const handleMouseEnter = () => {
    const rect = rowRef.value?.getBoundingClientRect()
    if (rect) options.onShow(rect)
  }
  const handleMouseLeave = () => options.onHide()

  onMounted(() => {
    rowRef.value?.addEventListener('mouseenter', handleMouseEnter)
    rowRef.value?.addEventListener('mouseleave', handleMouseLeave)
  })
  onBeforeUnmount(() => {
    rowRef.value?.removeEventListener('mouseenter', handleMouseEnter)
    rowRef.value?.removeEventListener('mouseleave', handleMouseLeave)
    options.onHide()
  })

  return { rowRef, isContextMenuOpen }
}
