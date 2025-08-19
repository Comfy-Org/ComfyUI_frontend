import type { HTMLAttributes } from 'vue'

export interface BaseButtonProps {
  size?: 'sm' | 'md'
  type?: 'primary' | 'secondary' | 'transparent'
  class?: HTMLAttributes['class']
}

export const getButtonSizeClasses = (size: BaseButtonProps['size'] = 'md') => {
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-2.5 py-2 text-sm'
  }
  return sizeClasses[size]
}

export const getButtonTypeClasses = (
  type: BaseButtonProps['type'] = 'primary'
) => {
  const typeClasses = {
    primary:
      'bg-neutral-900 text-white dark-theme:bg-white dark-theme:text-neutral-900',
    secondary:
      'bg-white text-neutral-950 dark-theme:bg-zinc-700 dark-theme:text-white',
    transparent: 'bg-transparent text-neutral-600 dark-theme:text-neutral-400'
  }
  return typeClasses[type]
}

export const getIconButtonSizeClasses = (
  size: BaseButtonProps['size'] = 'md'
) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs !rounded-md',
    md: 'w-8 h-8 text-sm'
  }
  return sizeClasses[size]
}

export const getBaseButtonClasses = () => {
  return 'flex items-center justify-center flex-shrink-0 outline-none border-none rounded-lg cursor-pointer transition-all duration-200'
}
