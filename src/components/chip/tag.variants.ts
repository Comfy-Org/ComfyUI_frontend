import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const tagVariants = cva({
  base: 'inline-flex h-6 max-w-full shrink-0 items-center justify-center gap-1 text-xs ring-offset-base-background backdrop-blur-sm data-[state=active]:ring-2 data-[state=active]:ring-base-foreground data-[state=active]:ring-offset-1 data-[selected=true]:ring-2 data-[selected=true]:ring-base-foreground data-[selected=true]:ring-offset-1 [&.ProseMirror-selectednode]:ring-2 [&.ProseMirror-selectednode]:ring-base-foreground [&.ProseMirror-selectednode]:ring-offset-1',
  variants: {
    shape: {
      square: 'rounded-sm bg-modal-card-tag-background',
      rounded: 'rounded-full bg-secondary-background',
      overlay: 'rounded-sm bg-zinc-500/40 text-white/90'
    },
    state: {
      default: 'text-modal-card-tag-foreground',
      unselected: 'text-muted-foreground opacity-70',
      selected: 'text-modal-card-tag-foreground'
    },
    removable: {
      true: 'py-1 pr-1 pl-2',
      false: 'px-2 py-1'
    },
    interactive: {
      true: 'cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-base-foreground focus-within:ring-offset-1 hover:bg-modal-card-background-hovered focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-1 focus-visible:outline-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
      false: ''
    }
  },
  defaultVariants: {
    shape: 'square',
    state: 'default',
    removable: false,
    interactive: false
  }
})

export const tagRemoveButtonVariants = cva({
  base: 'w-4 overflow-hidden transition-[opacity,width] duration-150 hover:bg-transparent hover:opacity-100 data-disabled:pointer-events-none data-disabled:w-0 data-disabled:opacity-0'
})

export type TagVariants = VariantProps<typeof tagVariants>
