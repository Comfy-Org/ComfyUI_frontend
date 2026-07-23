import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const attachmentVariants = cva({
  base: 'group/attachment relative flex w-fit min-w-0 max-w-full shrink-0 flex-wrap items-center rounded-xl border border-border-default bg-tertiary-background text-base-foreground transition-colors focus-within:ring-1 focus-within:ring-ring',
  variants: {
    size: {
      default:
        'gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2',
      sm: 'gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5',
      xs: 'gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1'
    }
  },
  defaultVariants: {
    size: 'default'
  }
})

export type AttachmentVariants = VariantProps<typeof attachmentVariants>

export const attachmentMediaClass =
  'flex size-5 shrink-0 items-center justify-center text-muted-foreground'
