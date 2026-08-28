import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const dialogContentVariants = cva({
  base: 'fixed z-1700 flex flex-col rounded-lg border border-border-subtle bg-base-background shadow-lg outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  variants: {
    size: {
      sm: 'sm:max-w-[min(24rem,calc(100vw-var(--workspace-inset-right,0px)-1rem))]',
      md: 'sm:max-w-[min(36rem,calc(100vw-var(--workspace-inset-right,0px)-1rem))]',
      lg: 'sm:max-w-[min(48rem,calc(100vw-var(--workspace-inset-right,0px)-1rem))]',
      xl: 'sm:max-w-[min(64rem,calc(100vw-var(--workspace-inset-right,0px)-1rem))]',
      full: 'sm:max-w-[calc(100vw-var(--workspace-inset-right,0px)-1rem)]'
    },
    maximized: {
      true: 'inset-2 top-2 left-2 size-auto max-h-none max-w-none sm:max-w-none',
      false:
        'top-1/2 left-[calc(50%-var(--workspace-inset-right,0px)/2)] max-h-[85vh] w-[calc(100vw-var(--workspace-inset-right,0px)-1rem)] -translate-1/2'
    }
  },
  defaultVariants: {
    size: 'md',
    maximized: false
  }
})

type DialogContentVariants = VariantProps<typeof dialogContentVariants>

export type DialogContentSize = NonNullable<DialogContentVariants['size']>

const sizes = [
  'sm',
  'md',
  'lg',
  'xl',
  'full'
] as const satisfies Array<DialogContentSize>

export const FOR_STORIES = { sizes } as const

/**
 * Shared content class for full-screen media/model viewer dialogs. Centering
 * comes from the maximized:false variant (inset-aware); sites must not add
 * their own left offset. The breakpoint cap keeps the viewer inside the
 * visible workspace when a docked surface holds the right edge.
 */
export const viewerDialogContentClass =
  'w-[80vw] sm:max-w-[min(80vw,calc(100vw-var(--workspace-inset-right,0px)-1rem))] h-[80vh] max-h-[80vh]'

/**
 * Shrink-wrap the Reka DialogContent around the content's intrinsic width,
 * like the auto-sized PrimeVue root it replaces. The width cap subtracts the
 * workspace inset so hugged dialogs clear a right-docked surface like every
 * other dialog width cap.
 */
export const HUG_CONTENT_CLASS =
  'w-fit max-w-[calc(100vw-var(--workspace-inset-right,0px)-1rem)] sm:max-w-[calc(100vw-var(--workspace-inset-right,0px)-1rem)]'
