import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const pillButtonVariants = cva({
  base: 'group relative inline-flex w-fit cursor-pointer items-center overflow-hidden rounded-lg p-1 font-bold text-nowrap transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    variant: {
      solid: 'bg-primary-comfy-yellow text-primary-comfy-ink',
      ghost: 'text-primary-comfy-yellow bg-transparent'
    },
    size: {
      sm: 'h-10 text-xs',
      md: 'h-12 text-sm',
      lg: 'h-14 text-base'
    },
    iconPosition: {
      right: '',
      left: ''
    }
  },
  compoundVariants: [
    {
      size: 'sm',
      iconPosition: 'right',
      class: 'ps-4 pe-12 hover:ps-12 hover:pe-4'
    },
    {
      size: 'md',
      iconPosition: 'right',
      class: 'ps-6 pe-14 hover:ps-14 hover:pe-6'
    },
    {
      size: 'lg',
      iconPosition: 'right',
      class: 'ps-8 pe-16 hover:ps-16 hover:pe-8'
    },
    {
      size: 'sm',
      iconPosition: 'left',
      class: 'ps-12 pe-4 hover:ps-4 hover:pe-12'
    },
    {
      size: 'md',
      iconPosition: 'left',
      class: 'ps-14 pe-6 hover:ps-6 hover:pe-14'
    },
    {
      size: 'lg',
      iconPosition: 'left',
      class: 'ps-16 pe-8 hover:ps-8 hover:pe-16'
    }
  ],
  defaultVariants: {
    variant: 'solid',
    size: 'md',
    iconPosition: 'right'
  }
})

export const pillButtonBadgeVariants = cva({
  base: 'absolute z-10 flex items-center justify-center rounded-lg transition-all duration-500',
  variants: {
    variant: {
      solid: 'bg-primary-comfy-ink text-primary-comfy-yellow',
      ghost: 'bg-primary-comfy-yellow text-primary-comfy-ink'
    },
    size: {
      sm: 'size-8',
      md: 'size-10',
      lg: 'size-12'
    },
    iconPosition: {
      right: '',
      left: ''
    }
  },
  compoundVariants: [
    {
      size: 'sm',
      iconPosition: 'right',
      class: 'right-1 group-hover:right-[calc(100%-36px)]'
    },
    {
      size: 'md',
      iconPosition: 'right',
      class: 'right-1 group-hover:right-[calc(100%-44px)]'
    },
    {
      size: 'lg',
      iconPosition: 'right',
      class: 'right-1 group-hover:right-[calc(100%-52px)]'
    },
    {
      size: 'sm',
      iconPosition: 'left',
      class: 'left-1 group-hover:left-[calc(100%-36px)]'
    },
    {
      size: 'md',
      iconPosition: 'left',
      class: 'left-1 group-hover:left-[calc(100%-44px)]'
    },
    {
      size: 'lg',
      iconPosition: 'left',
      class: 'left-1 group-hover:left-[calc(100%-52px)]'
    }
  ],
  defaultVariants: {
    variant: 'solid',
    size: 'md',
    iconPosition: 'right'
  }
})

export type PillButtonVariants = VariantProps<typeof pillButtonVariants>
