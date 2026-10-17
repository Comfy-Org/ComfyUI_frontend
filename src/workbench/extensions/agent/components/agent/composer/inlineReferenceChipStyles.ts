import { tagVariants } from '@comfyorg/design-system/tag.variants'
import { cn } from '@comfyorg/tailwind-utils'

export const inlineReferenceNodeViewClass =
  'inline-flex rounded-sm align-middle ring-offset-base-background data-[selected=true]:ring-2 data-[selected=true]:ring-base-foreground data-[selected=true]:ring-offset-1 [&.ProseMirror-selectednode]:ring-2 [&.ProseMirror-selectednode]:ring-base-foreground [&.ProseMirror-selectednode]:ring-offset-1'
export const inlineReferenceChipClass = cn(
  tagVariants({ interactive: true, removable: true }),
  'align-middle whitespace-nowrap'
)
