import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const iconButtonVariants = cva(
  [
    'focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-all duration-200 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0'
  ],
  {
    variants: {
      variant: {
        ghost:
          'text-primary-warm-white hover:text-primary-comfy-yellow bg-transparent',
        outline:
          'text-primary-comfy-yellow hover:bg-primary-comfy-yellow border-primary-comfy-yellow border-2 bg-primary-comfy-ink hover:text-primary-comfy-ink'
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
