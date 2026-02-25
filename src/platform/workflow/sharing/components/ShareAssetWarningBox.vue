<template>
  <div class="rounded-lg flex flex-col gap-3">
    <div class="overflow-hidden rounded-lg bg-secondary-background">
      <div
        class="flex items-center gap-2 border-b border-border-subtle px-4 py-2"
      >
        <i
          class="icon-[lucide--circle-alert] size-4 shrink-0 text-warning-background"
        />
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('shareWorkflow.privateAssetsDescription') }}
        </p>
      </div>

      <div class="flex flex-col gap-1 p-2">
        <CollapsibleRoot
          v-for="section in sections"
          :key="section.id"
          class="overflow-hidden rounded-sm"
          :open="expandedSectionId === section.id"
          @update:open="onSectionOpenChange(section.id, $event)"
        >
          <CollapsibleTrigger as-child>
            <button
              type="button"
              :data-testid="`section-header-${section.id}`"
              :aria-expanded="expandedSectionId === section.id"
              :aria-controls="`section-content-${section.id}`"
              class="flex h-6 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border-none bg-secondary-background px-6 py-1 text-left hover:bg-secondary-background-hover"
            >
              <span class="text-xs text-base-foreground">
                {{ $t(section.labelKey, section.items.length) }}
              </span>
              <i
                :class="
                  cn(
                    'icon-[lucide--chevron-right] size-4 text-muted-foreground transition-transform',
                    expandedSectionId === section.id && 'rotate-90'
                  )
                "
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            :id="`section-content-${section.id}`"
            :data-testid="`section-content-${section.id}`"
            class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
          >
            <div class="max-h-25 overflow-y-auto px-2 pb-1 pt-0.5">
              <div
                v-for="item in section.items"
                :key="item.name"
                class="flex items-center gap-2 rounded-sm px-2 py-1"
              >
                <ShareAssetThumbnail
                  :name="item.name"
                  :thumbnail-url="item.thumbnailUrl"
                  @thumbnail-error="
                    onThumbnailError($event.name, $event.thumbnailUrl)
                  "
                />
                <span class="truncate text-xs text-base-foreground">
                  {{ item.name }}
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </CollapsibleRoot>
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
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'
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

function onSectionOpenChange(sectionId: SectionId, open: boolean) {
  if (open) {
    expandedSectionId.value = sectionId
    return
  }

  if (expandedSectionId.value === sectionId) {
    expandedSectionId.value = null
  }
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
