<template>
  <div class="flex flex-col gap-1">
    <CollapsibleRoot
      v-for="section in sections"
      :key="section.id"
      class="overflow-hidden rounded-sm"
      :open="expandedSectionId === section.id"
      @update:open="onSectionOpenChange(section.id, $event)"
    >
      <CollapsibleTrigger as-child>
        <Button
          :data-testid="`section-header-${section.id}`"
          :aria-expanded="expandedSectionId === section.id"
          :aria-controls="`section-content-${section.id}`"
          variant="secondary"
          class="w-full justify-between px-6 py-1"
        >
          <span>
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
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent
        :id="`section-content-${section.id}`"
        :data-testid="`section-content-${section.id}`"
        class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
      >
        <ul class="max-h-25 overflow-y-auto px-6 pt-0.5 pb-1">
          <li
            v-for="item in section.items"
            :key="item.id"
            class="flex items-center gap-2 rounded-sm py-1"
          >
            <ShareAssetThumbnail
              :name="item.name"
              :preview-url="item.preview_url"
              @thumbnail-error="
                onThumbnailError($event.name, $event.previewUrl)
              "
            />
            <span
              v-tooltip="buildTooltipConfig(item.name)"
              class="truncate text-xs text-base-foreground"
            >
              {{ item.name }}
            </span>
            <span
              v-if="item.in_library"
              class="ml-auto shrink-0 text-xs text-muted-foreground"
            >
              {{ $t('shareWorkflow.inLibrary') }}
            </span>
          </li>
        </ul>
      </CollapsibleContent>
    </CollapsibleRoot>
  </div>
</template>

<script setup lang="ts">
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger
} from 'reka-ui'

import type { AssetInfo } from '@/schemas/apiSchema'
import ShareAssetThumbnail from '@/platform/workflow/sharing/components/ShareAssetThumbnail.vue'
import { useAssetSections } from '@/platform/workflow/sharing/composables/useAssetSections'
import Button from '@/components/ui/button/Button.vue'
import { cn } from '@/utils/tailwindUtil'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

const { items } = defineProps<{
  items: AssetInfo[]
}>()

const { sections, expandedSectionId, onSectionOpenChange } = useAssetSections(
  () => items
)

function onThumbnailError(name: string, previewUrl: string | null | undefined) {
  console.warn('[share][assets][thumbnail-error]', {
    name,
    previewUrl: previewUrl ?? null
  })
}
</script>
