import { cn } from '@comfyorg/tailwind-utils'
import type { HTMLAttributes } from 'vue'

export type ButtonSize = 'full-width' | 'fit-content' | 'sm' | 'md'
type ButtonType = 'primary' | 'secondary' | 'transparent' | 'accent'
type ButtonBorder = boolean

export interface BaseButtonProps {
  size?: ButtonSize
  type?: ButtonType
  border?: ButtonBorder
  disabled?: boolean
  class?: HTMLAttributes['class']
}

export const getButtonSizeClasses = (size: ButtonSize = 'md') => {
  const sizeClasses = {
    'fit-content': '',
    'full-width': 'w-full',
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm'
  }
  return sizeClasses[size]
}

export const getButtonTypeClasses = (type: ButtonType = 'primary') => {
  const baseByType = {
    primary: 'bg-base-foreground border-none text-base-background',
    secondary: cn(
      'bg-secondary-background border-none text-base-foreground hover:bg-secondary-background-hover'
    ),
    transparent: cn(
      'bg-transparent border-none text-muted-foreground hover:bg-secondary-background-hover'
    ),
    accent:
      'bg-primary-background hover:bg-primary-background-hover border-none text-white font-bold'
  } as const

  return baseByType[type]
}

export const getBorderButtonTypeClasses = (type: ButtonType = 'primary') => {
  const baseByType = {
    primary: 'bg-base-background text-base-foreground',
    secondary: 'bg-secondary-background text-base-foreground',
    transparent: cn(
      'bg-transparent text-base-foreground hover:bg-secondary-background-hover'
    ),
    accent:
      'bg-primary-background hover:bg-primary-background-hover text-white font-bold'
  } as const

  const borderByType = {
    primary: 'border border-solid border-base-background',
    secondary: 'border border-solid border-base-foreground',
    transparent: 'border border-solid border-base-foreground',
    accent: 'border border-solid border-primary-background'
  } as const

  return `${baseByType[type]} ${borderByType[type]}`
}

export const getBaseButtonClasses = () => {
  return [
    'flex items-center justify-center shrink-0',
    'outline-hidden rounded-lg cursor-pointer transition-all duration-200',
    'disabled:opacity-50 disabled:pointer-events-none'
  ].join(' ')
}
