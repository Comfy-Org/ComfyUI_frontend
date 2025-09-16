import type { HTMLAttributes } from 'vue'

export type ButtonSize = 'fit-content' | 'sm' | 'md'
type ButtonType = 'primary' | 'secondary' | 'transparent'
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
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-2.5 py-2 text-sm'
  }
  return sizeClasses[size]
}

export const getButtonTypeClasses = (type: ButtonType = 'primary') => {
  const baseByType = {
    primary:
      'bg-neutral-900 border-none text-white dark-theme:bg-white dark-theme:text-neutral-900',
    secondary:
      'bg-white border-none text-neutral-950 dark-theme:bg-zinc-700 dark-theme:text-white',
    transparent:
      'bg-transparent border-none text-neutral-600 dark-theme:text-neutral-400'
  } as const

  return baseByType[type]
}

export const getBorderButtonTypeClasses = (type: ButtonType = 'primary') => {
  const baseByType = {
    primary:
      'bg-neutral-900 text-white dark-theme:bg-white dark-theme:text-neutral-900',
    secondary:
      'bg-white text-neutral-950 dark-theme:bg-zinc-700 dark-theme:text-white',
    transparent: 'bg-transparent text-neutral-600 dark-theme:text-neutral-400'
  } as const

  const borderByType = {
    primary: 'border border-solid border-white dark-theme:border-neutral-900',
    secondary: 'border border-solid border-neutral-950 dark-theme:border-white',
    transparent:
      'border border-solid border-neutral-950 dark-theme:border-white'
  } as const

  return `${baseByType[type]} ${borderByType[type]}`
}

export const getIconButtonSizeClasses = (size: ButtonSize = 'md') => {
  const sizeClasses = {
    'fit-content': 'w-auto h-auto',
    sm: 'size-8 text-xs !rounded-md',
    md: 'size-10 text-sm'
  }
  return sizeClasses[size]
}

export const getBaseButtonClasses = () => {
  return [
    'flex items-center justify-center shrink-0',
    'outline-hidden rounded-lg cursor-pointer transition-all duration-200',
    'disabled:opacity-50 disabled:pointer-events-none'
  ].join(' ')
}
