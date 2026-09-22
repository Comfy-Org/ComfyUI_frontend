import { cva } from 'cva'

export const tabStateVariants = cva({
  base: 'cursor-pointer rounded-lg border-none text-sm transition-all duration-200 focus-visible:ring-ring/20 outline-hidden focus-visible:ring-1',
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
