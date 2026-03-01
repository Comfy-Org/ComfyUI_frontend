import { computed, ref, watch } from 'vue'

import type { WorkflowAsset, WorkflowModel } from '@/schemas/apiSchema'

type SectionId = 'media' | 'models'

export function useAssetSections(
  assets: () => WorkflowAsset[],
  models: () => WorkflowModel[]
) {
  const sections = computed(() =>
    [
      {
        id: 'media' as SectionId,
        labelKey: 'shareWorkflow.mediaLabel',
        items: assets()
      },
      {
        id: 'models' as SectionId,
        labelKey: 'shareWorkflow.modelsLabel',
        items: models().map((model) => ({
          ...model,
          thumbnailUrl: model.thumbnailUrl ?? null
        }))
      }
    ].filter((s) => s.items.length > 0)
  )

  const expandedSectionId = ref<SectionId | null>(null)

  function getDefaultExpandedSection(
    availableSections: Array<{ id: SectionId }>
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
