import { cva } from 'cva'

export const tabStateVariants = cva({
  base: 'cursor-pointer rounded-lg border-none text-sm outline-hidden transition-all duration-200 focus-visible:ring-1 focus-visible:ring-border-default',
  variants: {
    active: {
      true: 'bg-interface-menu-component-surface-hovered text-text-primary',
      false:
        'bg-transparent text-text-secondary hover:bg-button-hover-surface focus:bg-button-hover-surface'
    }
  },
  defaultVariants: {
    active: false
  }
})
