import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const iconButtonVariants = cva(
  [
    'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-all duration-200 outline-none focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0'
  ],
  {
    variants: {
      variant: {
        ghost:
          'bg-transparent text-primary-warm-white hover:text-primary-comfy-yellow',
        outline:
          'border-2 border-primary-comfy-yellow bg-primary-comfy-ink text-primary-comfy-yellow hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink',
        solid: 'bg-primary-comfy-yellow text-primary-comfy-ink hover:opacity-90'
      },
      size: {
        sm: 'size-8',
        default: 'size-10',
        lg: 'size-14'
      }
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'default'
    }
  }
)
export type IconButtonVariants = VariantProps<typeof iconButtonVariants>
