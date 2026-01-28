import { uniqWith } from 'es-toolkit'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { SelectOption } from '@/components/input/types'
import type { EnrichedModel } from '@/types/modelBrowserTypes'

/**
 * Composable that extracts available filter options from model data
 * Provides reactive computed properties for file formats and model types
 */
export function useModelFilterOptions(
  models: MaybeRefOrGetter<EnrichedModel[]>
) {
  const availableFileFormats = computed<SelectOption[]>(() => {
    const modelList = toValue(models)
    const extensions = modelList
      .map((model) => {
        const extension = model.fileName.split('.').pop()
        return extension && extension !== model.fileName ? extension : null
      })
      .filter((extension): extension is string => extension !== null)

    const uniqueExtensions = uniqWith(extensions, (a, b) => a === b)

    return uniqueExtensions.sort().map((format) => ({
      name: `.${format}`,
      value: format
    }))
  })

  const availableModelTypes = computed<SelectOption[]>(() => {
    const modelList = toValue(models)
    const types = modelList.map((model) => model.type)

    const uniqueTypes = uniqWith(types, (a, b) => a === b)

    return uniqueTypes.sort().map((type) => ({
      name: type,
      value: type
    }))
  })

  return {
    availableFileFormats,
    availableModelTypes
  }
}
