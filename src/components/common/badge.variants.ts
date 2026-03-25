import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const badgeVariants = cva({
  base: 'inline-flex items-center justify-center rounded-full',
  variants: {
    /* eslint-disable better-tailwindcss/enforce-canonical-classes -- text-[color:*] prevents twMerge from clobbering color with font-size */
    severity: {
      default: 'bg-primary-background text-[color:white]',
      secondary: 'bg-secondary-background-hover text-[color:white]',
      warn: 'bg-warning-background text-[color:white]',
      danger: 'bg-destructive-background text-[color:white]',
      contrast: 'bg-base-foreground text-[color:var(--color-base-background)]'
    },
    /* eslint-enable better-tailwindcss/enforce-canonical-classes */
    variant: {
      label: 'h-3.5 px-1 text-xxxs font-semibold uppercase',
      dot: 'size-2',
      circle: 'size-3.5 text-xxxs font-semibold'
    }
  },
  defaultVariants: {
    severity: 'default',
    variant: 'label'
  }
})

export type BadgeVariants = VariantProps<typeof badgeVariants>
