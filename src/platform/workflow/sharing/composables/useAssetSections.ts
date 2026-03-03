import { partition } from 'es-toolkit'
import { computed, ref, watch } from 'vue'

import type { AssetInfo } from '@/schemas/apiSchema'

type SectionId = 'media' | 'models'

interface AssetSection {
  id: SectionId
  labelKey: string
  items: AssetInfo[]
}

export function useAssetSections(items: () => AssetInfo[]) {
  const sections = computed(() => {
    const [models, media] = partition(items(), (a) => a.model)
    const allSections: AssetSection[] = [
      {
        id: 'media',
        labelKey: 'shareWorkflow.mediaLabel',
        items: media
      },
      {
        id: 'models',
        labelKey: 'shareWorkflow.modelsLabel',
        items: models
      }
    ]
    return allSections.filter((s) => s.items.length > 0)
  })

  const expandedSectionId = ref<SectionId | null>(null)

  function getDefaultExpandedSection(
    availableSections: AssetSection[]
  ): SectionId | null {
    if (availableSections.length === 0) return null
    return (
      availableSections.find((s) => s.id === 'media')?.id ??
      availableSections[0].id
    )
  }

  watch(
    sections,
    (availableSections) => {
      const hasExpanded = availableSections.some(
        (s) => s.id === expandedSectionId.value
      )
      if (hasExpanded) return
      expandedSectionId.value = getDefaultExpandedSection(availableSections)
    },
    { immediate: true }
  )

  function onSectionOpenChange(sectionId: SectionId, open: boolean) {
    if (open) {
      expandedSectionId.value = sectionId
      return
    }
    if (expandedSectionId.value === sectionId) {
      expandedSectionId.value = null
    }
  }

  return {
    sections,
    expandedSectionId,
    onSectionOpenChange
  }
}
