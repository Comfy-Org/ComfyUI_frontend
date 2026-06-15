import type { VariantProps } from 'cva'
import { cva } from 'cva'

export { default as MaskRevealButton } from './MaskRevealButton.vue'

export const maskRevealButtonVariants = cva({
  base: 'group/mask-reveal relative inline-flex w-fit uppercase cursor-pointer items-center overflow-hidden rounded-2xl p-1 text-sm font-bold tracking-wider text-nowrap transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    variant: {
      solid: 'bg-primary-comfy-yellow text-primary-comfy-ink',
      ghost: 'text-primary-comfy-yellow bg-transparent'
    },
    size: {
      default: 'h-10 px-6 py-2.5 has-[>svg]:px-3',
      lg: 'h-14 px-8 py-4 has-[>svg]:px-5',
      icon: 'size-9'
    },
    iconPosition: {
      right: '',
      left: ''
    }
  },
  compoundVariants: [
    { size: 'default', iconPosition: 'right', class: 'ps-12 pe-4' },
    { size: 'lg', iconPosition: 'right', class: 'ps-16 pe-8' },
    { size: 'default', iconPosition: 'left', class: 'ps-4 pe-12' },
    { size: 'lg', iconPosition: 'left', class: 'ps-8 pe-16' }
  ],
  defaultVariants: {
    variant: 'solid',
    size: 'default',
    iconPosition: 'right'
  }
})

export const maskRevealButtonBadgeVariants = cva({
  base: 'absolute z-10 flex items-center justify-center rounded-xl transition-all duration-500',
  variants: {
    variant: {
      solid: 'text-primary-comfy-yellow bg-primary-comfy-ink',
      ghost: 'bg-primary-comfy-yellow text-primary-comfy-ink'
    },
    size: {
      default: 'size-8',
      lg: 'size-12',
      icon: 'size-7'
    },
    iconPosition: {
      right: '',
      left: ''
    }
  },
  compoundVariants: [
    {
      size: 'default',
      iconPosition: 'right',
      class: 'right-1 group-hover/mask-reveal:right-[calc(100%-36px)]'
    },
    {
      size: 'lg',
      iconPosition: 'right',
      class: 'right-1 group-hover/mask-reveal:right-[calc(100%-52px)]'
    },
    {
      size: 'default',
      iconPosition: 'left',
      class: 'left-1 group-hover/mask-reveal:left-[calc(100%-36px)]'
    },
    {
      size: 'lg',
      iconPosition: 'left',
      class: 'left-1 group-hover/mask-reveal:left-[calc(100%-52px)]'
    }
  ],
  defaultVariants: {
    variant: 'solid',
    size: 'default',
    iconPosition: 'right'
  }
})

export const MASK_REVEAL_LABEL_CLASS = [
  'relative inline-block align-baseline',
  '[will-change:mask-size,-webkit-mask-size]',
  '[mask-image:linear-gradient(black,black)] [-webkit-mask-image:linear-gradient(black,black)]',
  'mask-no-repeat [-webkit-mask-repeat:no-repeat]',
  'transition-[mask-size,-webkit-mask-size] duration-500 ease-in-out',
  'data-[icon-position=right]:[mask-position:100%_0] data-[icon-position=right]:[-webkit-mask-position:100%_0]',
  'data-[icon-position=left]:[mask-position:0_0] data-[icon-position=left]:[-webkit-mask-position:0_0]',
  'data-[hidden=true]:[mask-size:0%_100%] data-[hidden=true]:[-webkit-mask-size:0%_100%]',
  'data-[hidden=false]:[mask-size:100%_100%] data-[hidden=false]:[-webkit-mask-size:100%_100%]',
  'group-hover/mask-reveal:data-[hidden=true]:[mask-size:calc(100%_+_1px)_100%] group-hover/mask-reveal:data-[hidden=true]:[-webkit-mask-size:calc(100%_+_1px)_100%]',
  'group-focus-visible/mask-reveal:data-[hidden=true]:[mask-size:calc(100%_+_1px)_100%] group-focus-visible/mask-reveal:data-[hidden=true]:[-webkit-mask-size:calc(100%_+_1px)_100%]'
].join(' ')

export type MaskRevealButtonVariants = VariantProps<
  typeof maskRevealButtonVariants
>
