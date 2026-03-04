import { computed, ref, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { suggestTags } from '../services/tagApi'

export function useTagSuggestions(
  query: MaybeRefOrGetter<string>,
  nodeTypes?: MaybeRefOrGetter<string[]>
) {
  const args = computed<Parameters<typeof suggestTags>>(() => {
    return [toValue(query), toValue(nodeTypes)]
  })

  const tags = ref<string[]>([])

  const refresh = async () => {
    const result = await suggestTags(...args.value)

    tags.value = result.tags
  }

  refresh()

  return { tags, refresh }
}
