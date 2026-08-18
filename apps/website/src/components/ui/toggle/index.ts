import { cva } from 'class-variance-authority'

export const toggleVariants = cva(
  "data-[state=on]:bg-primary-comfy-yellow focus-visible:border-primary-comfy-orange focus-visible:ring-primary-comfy-yellow hover:text-primary-warm-white inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold whitespace-nowrap uppercase transition-[color,box-shadow] duration-300 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-primary-comfy-ink [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-transparency-white-t4 text-primary-warm-gray hover:cursor-pointer'
      },
      size: {
        default: 'h-9 min-w-20 px-4'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)
