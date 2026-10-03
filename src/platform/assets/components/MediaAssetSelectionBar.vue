<template>
  <div class="relative mx-2">
    <div
      data-testid="assets-selection-bar"
      class="absolute bottom-6 left-1/2 z-40 flex w-full max-w-78 -translate-x-1/2 items-center gap-2 rounded-lg bg-base-foreground p-2 text-base-background shadow-interface"
    >
      <Button
        v-tooltip.top="{
          value: $t('mediaAsset.selection.deselectAll'),
          showDelay: 300
        }"
        variant="inverted"
        size="icon-lg"
        type="button"
        data-testid="assets-deselect-selected"
        :aria-label="$t('mediaAsset.selection.deselectAll')"
        class="rounded-lg hover:bg-base-background/10"
        @click="emit('deselect')"
      >
        <i class="icon-[lucide--x] size-4" />
      </Button>
      <span class="pr-6 text-sm font-bold whitespace-nowrap tabular-nums">
        {{ $t('mediaAsset.selection.selectedCount', { count }) }}
      </span>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <Button
          v-tooltip.top="{
            value: $t('mediaAsset.selection.downloadSelected'),
            showDelay: 300
          }"
          variant="inverted"
          size="icon-lg"
          type="button"
          data-testid="assets-download-selected"
          :aria-label="$t('mediaAsset.selection.downloadSelected')"
          class="rounded-lg hover:bg-base-background/10"
          @click="emit('download')"
        >
          <i class="icon-[lucide--download] size-4" />
        </Button>
        <template v-if="showDelete">
          <span class="h-6 w-px bg-base-background/20" aria-hidden="true" />
          <Button
            v-tooltip.top="{
              value: $t('mediaAsset.selection.deleteSelected'),
              showDelay: 300
            }"
            variant="inverted"
            size="icon-lg"
            type="button"
            data-testid="assets-delete-selected"
            :aria-label="$t('mediaAsset.selection.deleteSelected')"
            class="rounded-lg hover:bg-base-background/10"
            @click="emit('delete')"
          >
            <i class="icon-[lucide--trash-2] size-4" />
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { count, showDelete = true } = defineProps<{
  count: number
  showDelete?: boolean
}>()

const emit = defineEmits<{
  deselect: []
  download: []
  delete: []
}>()
</script>
