import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    "focus-visible:border-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 aria-invalid:bg-destructive aria-invalid:hover:bg-destructive/90 inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-wider whitespace-nowrap transition-all duration-200 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
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
          'bg-primary-comfy-yellow hover:bg-primary-comfy-yellow/90 text-primary-comfy-ink uppercase',
        outline:
          'text-primary-comfy-yellow hover:bg-primary-comfy-yellow border uppercase hover:text-primary-comfy-ink',
        link: "text-primary-comfy-yellow h-auto justify-start px-0 py-1 text-base uppercase hover:opacity-90 [&_svg:not([class*='size-'])]:size-6",
        underlineLink:
          "text-primary-comfy-yellow relative h-auto justify-start px-0 py-1 uppercase after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 hover:opacity-90 hover:after:scale-x-100 [&_svg:not([class*='size-'])]:size-6",
        inline:
          'text-primary-comfy-yellow inline h-auto rounded-none p-0 align-baseline text-sm font-normal tracking-normal whitespace-normal hover:opacity-90 [&>span]:top-0 [&>span]:underline',
        nav: 'text-primary-warm-white hover:text-primary-comfy-yellow h-auto justify-between px-0 py-1 text-start text-2xl font-medium',
        navMuted:
          'hover:text-primary-comfy-yellow h-auto w-full justify-between px-0 py-1 text-start text-2xl font-medium text-primary-comfy-canvas uppercase'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
