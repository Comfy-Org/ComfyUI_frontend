import { cva } from 'cva'

export const tabStateVariants = cva({
  base: 'cursor-pointer rounded-lg border-none text-sm outline-hidden transition-all duration-200 focus-visible:ring-1 focus-visible:ring-ring',
  variants: {
    active: {
      true: 'bg-accent text-foreground',
      false:
        'bg-transparent text-muted-foreground hover:bg-accent/50 focus:bg-accent/50'
    }
  },
  defaultVariants: {
    active: false
  }
})
