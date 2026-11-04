import { cva } from 'cva'

export const tabStateVariants = cva({
  base: 'cursor-pointer rounded-lg border-none text-sm outline-hidden transition-all duration-200 focus-visible:ring-1 focus-visible:ring-ring',
  variants: {
    active: {
      true: 'bg-accent/60 text-foreground',
      false:
        'bg-transparent text-muted-foreground hover:bg-accent/40 focus:bg-accent/40'
    }
  },
  defaultVariants: {
    active: false
  }
})
