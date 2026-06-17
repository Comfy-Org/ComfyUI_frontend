import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const maskRevealButtonVariants = cva({
  base: 'group relative uppercase inline-flex w-fit cursor-pointer items-center overflow-hidden rounded-lg p-1 font-bold text-nowrap transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-50',
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
    { size: 'sm', iconPosition: 'right', class: 'ps-12 pe-4' },
    { size: 'md', iconPosition: 'right', class: 'ps-14 pe-6' },
    { size: 'lg', iconPosition: 'right', class: 'ps-16 pe-8' },
    { size: 'sm', iconPosition: 'left', class: 'ps-4 pe-12' },
    { size: 'md', iconPosition: 'left', class: 'ps-6 pe-14' },
    { size: 'lg', iconPosition: 'left', class: 'ps-8 pe-16' }
  ],
  defaultVariants: {
    variant: 'solid',
    size: 'md',
    iconPosition: 'right'
  }
})

export const maskRevealButtonBadgeVariants = cva({
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

export const maskRevealLabelVariants = cva({
  base: [
    'relative inline-block align-baseline',
    '[will-change:mask-size,-webkit-mask-size]',
    '[mask-image:linear-gradient(black,black)] [-webkit-mask-image:linear-gradient(black,black)]',
    'mask-no-repeat [-webkit-mask-repeat:no-repeat]',
    'transition-[mask-size,-webkit-mask-size] duration-500 ease-in-out',
    'data-[icon-position=right]:[mask-position:100%_0] data-[icon-position=right]:[-webkit-mask-position:100%_0]',
    'data-[icon-position=left]:[mask-position:0_0] data-[icon-position=left]:[-webkit-mask-position:0_0]',
    'data-[hidden=true]:[mask-size:0%_100%] data-[hidden=true]:[-webkit-mask-size:0%_100%]',
    'data-[hidden=false]:[mask-size:100%_100%] data-[hidden=false]:[-webkit-mask-size:100%_100%]',
    'group-hover:data-[hidden=true]:[mask-size:calc(100%_+_1px)_100%] group-hover:data-[hidden=true]:[-webkit-mask-size:calc(100%_+_1px)_100%]',
    'group-focus-visible:data-[hidden=true]:[mask-size:calc(100%_+_1px)_100%] group-focus-visible:data-[hidden=true]:[-webkit-mask-size:calc(100%_+_1px)_100%]'
  ].join(' ')
})

export type MaskRevealButtonVariants = VariantProps<
  typeof maskRevealButtonVariants
>
