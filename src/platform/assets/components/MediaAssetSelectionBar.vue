<template>
  <div class="relative">
    <div
      data-testid="assets-selection-bar"
      class="absolute bottom-6 left-1/2 z-40 flex w-fit -translate-x-1/2 items-center gap-2 rounded-lg bg-base-foreground p-2 text-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
    >
      <button
        v-tooltip.top="{
          value: t('mediaAsset.selection.unselectAssets', { count }, count),
          showDelay: 300
        }"
        type="button"
        data-testid="assets-deselect-selected"
        :aria-label="$t('mediaAsset.selection.deselectAll')"
        :class="iconButtonClass"
        @click="emit('deselect')"
      >
        <i class="icon-[lucide--x] size-4" />
      </button>
      <span class="pr-6 text-sm font-bold whitespace-nowrap tabular-nums">
        {{ $t('mediaAsset.selection.selectedCount', { count }) }}
      </span>
      <div class="flex items-center gap-1">
        <button
          v-tooltip.top="{
            value: $t('mediaAsset.selection.downloadSelected'),
            showDelay: 300
          }"
          type="button"
          data-testid="assets-download-selected"
          :aria-label="$t('mediaAsset.selection.downloadSelected')"
          :class="iconButtonClass"
          @click="emit('download')"
        >
          <i class="icon-[lucide--download] size-4" />
        </button>
        <template v-if="showDelete">
          <span class="h-6 w-px bg-base-background/20" aria-hidden="true" />
          <button
            v-tooltip.top="{
              value: $t('mediaAsset.selection.deleteSelected'),
              showDelay: 300
            }"
            type="button"
            data-testid="assets-delete-selected"
            :aria-label="$t('mediaAsset.selection.deleteSelected')"
            :class="iconButtonClass"
            @click="emit('delete')"
          >
            <i class="icon-[lucide--trash-2] size-4" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { count, showDelete = true } = defineProps<{
  count: number
  showDelete?: boolean
}>()

const emit = defineEmits<{
  deselect: []
  download: []
  delete: []
}>()

const { t } = useI18n()

const iconButtonClass =
  'flex size-10 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-base-background transition-colors hover:bg-base-background/10 focus-visible:ring-1 focus-visible:ring-base-background/40 focus-visible:outline-none'
</script>
