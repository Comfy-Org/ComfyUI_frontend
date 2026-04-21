import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const brandButtonVariants = cva({
  base: 'inline-flex items-center justify-center cursor-pointer font-bold tracking-wider transition-colors',
  variants: {
    variant: {
      solid:
        'bg-primary-comfy-yellow text-primary-comfy-ink transition-opacity hover:opacity-90',
      outline:
        'border-primary-comfy-yellow text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink border',
      'outline-dark':
        'border-primary-comfy-ink text-primary-comfy-ink hover:bg-primary-comfy-ink hover:text-primary-comfy-yellow border-2 uppercase'
    },
    size: {
      sm: 'rounded-2xl px-4 py-2 text-sm font-semibold',
      lg: 'rounded-full px-8 py-4 text-sm'
    }
  },
  defaultVariants: {
    variant: 'solid',
    size: 'sm'
  }
})

export type BrandButtonVariants = VariantProps<typeof brandButtonVariants>
