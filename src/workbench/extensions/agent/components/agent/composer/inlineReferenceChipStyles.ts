import { buttonVariants } from '@/components/ui/button/button.variants'
import {
  tagRemoveButtonVariants,
  tagVariants
} from '@/components/chip/tag.variants'
import { cn } from '@comfyorg/tailwind-utils'

export const inlineReferenceChipClass = cn(
  tagVariants({ interactive: true, removable: true }),
  'group/inline-reference h-4 p-0 align-middle'
)
export const inlineReferenceRemoveAnchorClass =
  'relative inline-block h-4 w-0 align-middle'
export const inlineReferenceRemoveButtonClass = cn(
  buttonVariants({ variant: 'textonly', size: 'icon-sm' }),
  tagRemoveButtonVariants(),
  'pointer-events-none absolute -top-2 -right-2 z-10 flex size-5 cursor-pointer items-center justify-center rounded-full p-0 text-base-foreground opacity-0 transition-opacity group-focus-within/inline-reference:pointer-events-auto group-focus-within/inline-reference:opacity-100 group-hover/inline-reference:pointer-events-auto group-hover/inline-reference:opacity-100 touch:pointer-events-auto touch:opacity-100'
)
export const inlineReferenceRemoveBadgeClass =
  'flex size-3 items-center justify-center rounded-full bg-base-background ring-1 ring-border-default hover:bg-secondary-background-hover'
