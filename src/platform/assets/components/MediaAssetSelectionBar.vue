<template>
  <SelectionBar
    data-testid="assets-selection-bar"
    :label="$t('mediaAsset.selection.selectedCount', { count })"
    :deselect-label="$t('mediaAsset.selection.deselectAll')"
    @deselect="emit('deselect')"
  >
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
  </SelectionBar>
</template>

<script setup lang="ts">
import SelectionBar from '@/components/common/SelectionBar.vue'
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
