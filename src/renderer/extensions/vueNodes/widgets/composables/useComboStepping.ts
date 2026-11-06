import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export function useComboStepping<T>(config: {
  options: MaybeRefOrGetter<readonly T[]>
  selectedOption: MaybeRefOrGetter<T | undefined>
  disabled: MaybeRefOrGetter<boolean>
  dynamicOptions: MaybeRefOrGetter<boolean>
  refreshOptions: () => void
  onSelect: (option: T) => void
}) {
  const adjacentOptions = computed(() => {
    const options = toValue(config.options)
    const selected = toValue(config.selectedOption)
    const index = selected === undefined ? -1 : options.indexOf(selected)
    return {
      [-1]: options[(index < 0 ? options.length : index) - 1],
      [1]: options[index + 1]
    }
  })

  function isStepDisabled(direction: -1 | 1) {
    return (
      toValue(config.disabled) ||
      (!toValue(config.dynamicOptions) &&
        adjacentOptions.value[direction] === undefined)
    )
  }

  function stepOption(direction: -1 | 1) {
    config.refreshOptions()
    const option = adjacentOptions.value[direction]
    if (option !== undefined) config.onSelect(option)
  }

  return { isStepDisabled, stepOption }
}
