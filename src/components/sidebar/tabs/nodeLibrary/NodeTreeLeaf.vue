<template>
  <div class="node-tree-leaf">
    <div class="node-content">
      <Tag
        v-if="node.experimental"
        :value="$t('experimental')"
        severity="primary"
      />
      <Tag v-if="node.deprecated" :value="$t('deprecated')" severity="danger" />
      <span class="node-label">{{ node.display_name }}</span>
    </div>
    <Button
      class="bookmark-button"
      size="small"
      :icon="isBookmarked ? 'pi pi-bookmark-fill' : 'pi pi-bookmark'"
      text
      severity="secondary"
      @click.stop="toggleBookmark"
    />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const props = defineProps<{
  node: ComfyNodeDefImpl
  isBookmarked: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-bookmark', value: ComfyNodeDefImpl): void
}>()

const toggleBookmark = () => {
  emit('toggle-bookmark', props.node)
}
</script>

<style scoped>
.node-tree-leaf {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.node-content {
  display: flex;
  align-items: center;
  flex-grow: 1;
}

.node-label {
  margin-left: 0.5rem;
}

.bookmark-button {
  width: unset;
  padding: 0px;
}
</style>
