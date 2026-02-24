<template>
  <div class="rounded-lg flex flex-col gap-2">
    <div class="flex items-start gap-2 my-0">
      <i
        class="icon-[lucide--circle-alert] my-auto size-4 shrink-0 text-warning-background"
      />
      <p class="m-0 text-xs text-muted-foreground">
        {{ $t('shareWorkflow.createLinkDescription') }}
      </p>
    </div>

    <div class="overflow-hidden rounded-lg border border-border-subtle">
      <div
        v-for="section in sections"
        :key="section.id"
        class="border-b border-border-subtle bg-secondary-background last:border-b-0"
      >
        <button
          type="button"
          :data-testid="`section-header-${section.id}`"
          :aria-expanded="expandedSectionId === section.id"
          :aria-controls="`section-content-${section.id}`"
          class="flex h-6 w-full cursor-pointer items-center justify-between gap-2 border-none bg-transparent px-2 py-1 text-left"
          @click="toggleSection(section.id)"
        >
          <span class="text-xs text-muted-foreground">
            {{ $t(section.labelKey, section.items.length) }}
          </span>
          <i
            :class="
              cn(
                'icon-[lucide--chevron-down] size-4 text-muted-foreground transition-transform',
                expandedSectionId === section.id && 'rotate-180'
              )
            "
          />
        </button>
        <div
          v-show="expandedSectionId === section.id"
          :id="`section-content-${section.id}`"
          :data-testid="`section-content-${section.id}`"
          class="max-h-[101px] overflow-y-auto border-t border-border-subtle py-1"
        >
          <div
            v-for="item in section.items"
            :key="item.name"
            class="flex items-center gap-2 p-2"
          >
            <ShareAssetThumbnail
              :name="item.name"
              :thumbnail-url="item.thumbnailUrl"
              @thumbnail-error="
                onThumbnailError($event.name, $event.thumbnailUrl)
              "
            />
            <span class="truncate text-sm text-base-foreground">
              {{ item.name }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <label class="mt-3 flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        :checked="acknowledged"
        class="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary-background"
        @change="
          $emit(
            'update:acknowledged',
            ($event.target as HTMLInputElement).checked
          )
        "
      />
      <span class="text-xs text-base-foreground font-bold">
        {{ $t('shareWorkflow.acknowledgeCheckbox') }}
      </span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { WorkflowAsset, WorkflowModel } from '@/schemas/apiSchema'
import ShareAssetThumbnail from '@/platform/workflow/sharing/components/ShareAssetThumbnail.vue'
import { cn } from '@/utils/tailwindUtil'

const { assets, models } = defineProps<{
  assets: WorkflowAsset[]
  models: WorkflowModel[]
  acknowledged: boolean
}>()

defineEmits<{
  'update:acknowledged': [value: boolean]
}>()

type SectionId = 'media' | 'models'

const sections = computed(() =>
  [
    {
      id: 'media' as SectionId,
      labelKey: 'shareWorkflow.mediaLabel',
      items: assets
    },
    {
      id: 'models' as SectionId,
      labelKey: 'shareWorkflow.modelsLabel',
      items: models.map((model) => ({
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
  if (availableSections.length === 0) {
    return null
  }

  return (
    availableSections.find((section) => section.id === 'media')?.id ??
    availableSections[0].id
  )
}

watch(
  sections,
  (availableSections) => {
    const hasExpandedSection = availableSections.some(
      (section) => section.id === expandedSectionId.value
    )
    if (hasExpandedSection) {
      return
    }
    expandedSectionId.value = getDefaultExpandedSection(availableSections)
  },
  { immediate: true }
)

function toggleSection(sectionId: SectionId) {
  if (expandedSectionId.value === sectionId) {
    return
  }
  expandedSectionId.value = sectionId
}

function onThumbnailError(
  name: string,
  thumbnailUrl: string | null | undefined
) {
  console.warn('[share][assets][thumbnail-error]', {
    name,
    thumbnailUrl: thumbnailUrl ?? null
  })
}
</script>
