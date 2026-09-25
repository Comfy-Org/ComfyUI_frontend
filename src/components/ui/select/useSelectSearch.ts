import { useFuse } from '@vueuse/integrations/useFuse'
import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, toValue } from 'vue'

import type { SelectOption } from './types'

export function useSelectSearch<Value extends string | number>(
  query: Ref<string>,
  options: MaybeRefOrGetter<SelectOption<Value>[]>
) {
  const { results } = useFuse(query, options, {
    fuseOptions: { keys: ['name', 'value'], threshold: 0.3 },
    matchAllWhenSearchEmpty: true
  })

  return computed(() =>
    query.value.trim()
      ? results.value.map(({ item }) => item)
      : toValue(options)
  )
}
