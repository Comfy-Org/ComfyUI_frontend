import { ref } from 'vue'
import { getCategories } from '../services/tagApi'

export function useCategories() {
  const categories = ref<string[]>([])

  const refresh = async () => {
    const result = await getCategories()

    categories.value = result.categories
  }

  refresh()

  return { categories, refresh }
}
