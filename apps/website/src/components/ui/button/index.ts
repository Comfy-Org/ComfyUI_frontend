import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    "focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 aria-invalid:bg-destructive aria-invalid:hover:bg-destructive/90 inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-wider whitespace-nowrap uppercase transition-all duration-200 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ],
  {
    variants: {
      variant: {
        default:
          'bg-primary-comfy-yellow hover:bg-primary-comfy-yellow/90 text-primary-comfy-ink',
        outline:
          'text-primary-comfy-yellow hover:bg-primary-comfy-yellow border hover:text-primary-comfy-ink'
      },
      size: {
        default: 'h-10 px-6 py-2.5 has-[>svg]:px-3',
        lg: 'h-14 px-8 py-4 has-[>svg]:px-5',
        icon: 'size-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
