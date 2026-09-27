import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-wider whitespace-nowrap transition-all duration-200 outline-none focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:bg-destructive aria-invalid:hover:bg-destructive/90 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ],
  {
    variants: {
      size: {
        sm: 'h-8 px-4 py-2 text-xs md:text-sm',
        default: 'h-10 px-6 py-2.5 text-xs md:text-sm',
        lg: 'h-14 px-8 py-4 text-base'
      },
      variant: {
        default:
          'bg-primary-comfy-yellow text-primary-comfy-ink uppercase hover:bg-primary-comfy-yellow/90',
        outline:
          'border text-primary-comfy-yellow uppercase hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink',
        link: "h-auto justify-start px-0 py-1 text-base text-primary-comfy-yellow uppercase hover:opacity-90 [&_svg:not([class*='size-'])]:size-6",
        underlineLink:
          "relative h-auto justify-start px-0 py-1 text-primary-comfy-yellow uppercase after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:opacity-90 hover:after:scale-x-100 [&_svg:not([class*='size-'])]:size-6",
        inline:
          'inline h-auto rounded-none p-0 align-baseline text-sm font-normal tracking-normal whitespace-normal text-primary-comfy-yellow hover:opacity-90 [&>span]:top-0 [&>span]:underline',
        nav: 'h-auto justify-between px-0 py-1 text-start text-2xl font-medium text-primary-warm-white hover:text-primary-comfy-yellow',
        navMuted:
          'h-auto w-full justify-between px-0 py-1 text-start text-2xl font-medium text-primary-comfy-canvas uppercase hover:text-primary-comfy-yellow'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
