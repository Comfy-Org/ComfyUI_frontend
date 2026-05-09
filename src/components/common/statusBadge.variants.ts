import { t } from '@/i18n'
import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const statusBadgeVariants = cva({
  base: 'inline-flex items-center justify-center rounded-full',
  variants: {
    severity: {
      default: 'bg-primary-background text-base-foreground',
      secondary: 'bg-secondary-background text-base-foreground',
      warn: 'bg-warning-background text-base-background',
      danger: 'bg-destructive-background text-white',
      contrast: 'bg-base-foreground text-base-background'
    },
    variant: {
      label: 'g.h_3_5_px_1_text_3xs_font_semibold_uppercase',
      dot: 'size-2',
      circle: 'size-3.5 text-3xs font-semibold'
    }
  },
  defaultVariants: {
    severity: 'default',
    variant: 'label'
  }
})

export type StatusBadgeVariants = VariantProps<typeof statusBadgeVariants>
