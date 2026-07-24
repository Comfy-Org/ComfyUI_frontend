import type { VariantProps } from 'cva'
import { cva } from 'cva'

export const buttonPillVariants = cva({
  base: 'group/button-pill isolate relative inline-flex w-fit uppercase cursor-pointer items-center overflow-hidden rounded-2xl p-1 text-sm font-bold tracking-wider text-nowrap transition-all duration-500 disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    variant: {
      solid: 'bg-primary-comfy-yellow text-primary-comfy-ink',
      ghost: 'text-primary-comfy-yellow bg-transparent'
    },
    size: {
      default: 'h-10 px-6 py-2.5 has-[>svg]:px-3',
      lg: 'h-14 px-8 py-4 has-[>svg]:px-5'
    },
    iconPosition: {
      right: '',
      left: ''
    }
  },
  // Hover slide effects are gated to md+: mobile has no hover input, so the
  // icon and paddings stay put there.
  compoundVariants: [
    {
      size: 'default',
      iconPosition: 'right',
      class:
        'ps-6 pe-14 md:group-hover/pill-trigger:ps-14 md:group-hover/pill-trigger:pe-6 md:hover:ps-14 md:hover:pe-6'
    },
    {
      size: 'lg',
      iconPosition: 'right',
      class:
        'ps-8 pe-16 md:group-hover/pill-trigger:ps-16 md:group-hover/pill-trigger:pe-8 md:hover:ps-16 md:hover:pe-8'
    },
    {
      size: 'default',
      iconPosition: 'left',
      class:
        'ps-14 pe-6 md:group-hover/pill-trigger:ps-6 md:group-hover/pill-trigger:pe-14 md:hover:ps-6 md:hover:pe-14'
    },
    {
      size: 'lg',
      iconPosition: 'left',
      class:
        'ps-16 pe-8 md:group-hover/pill-trigger:ps-8 md:group-hover/pill-trigger:pe-16 md:hover:ps-8 md:hover:pe-16'
    }
  ],
  defaultVariants: {
    variant: 'solid',
    size: 'default',
    iconPosition: 'right'
  }
})

export const buttonPillBadgeVariants = cva({
  base: 'absolute z-10 flex items-center justify-center rounded-xl transition-all duration-500',
  variants: {
    variant: {
      solid: 'text-primary-comfy-yellow bg-primary-comfy-ink',
      ghost: 'bg-primary-comfy-yellow text-primary-comfy-ink'
    },
    size: {
      default: 'size-8',
      lg: 'size-12'
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
      class:
        'right-1 md:group-hover/button-pill:right-[calc(100%-36px)] md:group-hover/pill-trigger:right-[calc(100%-36px)]'
    },
    {
      size: 'lg',
      iconPosition: 'right',
      class:
        'right-1 md:group-hover/button-pill:right-[calc(100%-52px)] md:group-hover/pill-trigger:right-[calc(100%-52px)]'
    },
    {
      size: 'default',
      iconPosition: 'left',
      class:
        'left-1 md:group-hover/button-pill:left-[calc(100%-36px)] md:group-hover/pill-trigger:left-[calc(100%-36px)]'
    },
    {
      size: 'lg',
      iconPosition: 'left',
      class:
        'left-1 md:group-hover/button-pill:left-[calc(100%-52px)] md:group-hover/pill-trigger:left-[calc(100%-52px)]'
    }
  ],
  defaultVariants: {
    variant: 'solid',
    size: 'default',
    iconPosition: 'right'
  }
})

export type ButtonPillVariants = VariantProps<typeof buttonPillVariants>
