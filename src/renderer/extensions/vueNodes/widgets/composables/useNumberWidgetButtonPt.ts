const sharedButtonClasses =
  '!inline-flex !items-center !justify-center !border-0 !bg-transparent text-inherit transition-colors duration-150 ease-in-out ' +
  'hover:!bg-[var(--color-node-component-surface-hovered)] active:!bg-[var(--color-node-component-surface-selected)] ' +
  'disabled:!bg-[var(--color-node-component-disabled)] disabled:!text-[var(--color-node-icon-disabled)] disabled:cursor-not-allowed'

export function useNumberWidgetButtonPt(options?: {
  roundedLeft?: boolean
  roundedRight?: boolean
}) {
  const { roundedLeft = false, roundedRight = false } = options ?? {}

  const increment = `${sharedButtonClasses}${roundedRight ? ' !rounded-r-lg' : ''}`
  const decrement = `${sharedButtonClasses}${roundedLeft ? ' !rounded-l-lg' : ''}`

  return {
    incrementButton: {
      class: increment.trim()
    },
    decrementButton: {
      class: decrement.trim()
    }
  }
}
