import { cva } from 'cva'

export const tabStateVariants = cva({
  base: 'cursor-pointer rounded-lg border-none text-sm outline-hidden transition-all duration-200 focus-visible:ring-1 focus-visible:ring-border',
  variants: {
    active: {
      true: 'bg-accent text-foreground',
      false:
        'bg-transparent text-muted-foreground hover:bg-accent focus:bg-accent'
    }
  },
  defaultVariants: {
    active: false
  }
})
