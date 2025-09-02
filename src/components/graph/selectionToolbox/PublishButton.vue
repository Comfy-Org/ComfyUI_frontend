<template>
  <Button
    v-show="nodeDef"
    v-tooltip.top="{
      value: $t('g.bookmark'),
      showDelay: 1000
    }"
    class="help-button"
    text
    severity="secondary"
    @click="bookmarkNode"
  >
    <i-lucide:book-open class="w-4 h-4" />
  </Button>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import { useSelectionState } from '@/composables/graph/useSelectionState'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'

const { nodeDef } = useSelectionState()
const nodeBookmarkStore = useNodeBookmarkStore()

const bookmarkNode = async () => {
  const def = nodeDef.value
  if (!def) return
  await nodeBookmarkStore.addBookmark(def.nodePath)
}
</script>
