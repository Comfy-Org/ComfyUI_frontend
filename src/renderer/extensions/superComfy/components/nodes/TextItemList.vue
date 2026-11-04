<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import Textarea from '@comfyorg/design-system/textarea/Textarea'
import { computed, nextTick, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type { IoNode } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { textItem } from '@/renderer/extensions/superComfy/engine/items'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

const { node } = defineProps<{ node: IoNode }>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()
const fields = useTemplateRef<InstanceType<typeof Textarea>[]>('fields')

const texts = computed(() =>
  node.items.flatMap((item, index) =>
    item.kind === 'text' ? [{ index, text: item.text }] : []
  )
)

function change(index: number, text: string | number | undefined) {
  store.dispatch({
    type: 'textItemChanged',
    nodeId: node.id,
    index,
    text: text === undefined ? '' : String(text)
  })
}

function remove(index: number) {
  store.dispatch({ type: 'itemRemoved', nodeId: node.id, index })
}

async function add() {
  store.dispatch({
    type: 'itemsAdded',
    nodeId: node.id,
    items: [textItem('')],
    mode: 'append'
  })
  await nextTick()
  fields.value?.at(-1)?.focus()
}
</script>

<template>
  <div class="flex flex-col gap-2 p-3" data-no-drag>
    <div v-for="entry in texts" :key="entry.index" class="group/item relative">
      <Textarea
        ref="fields"
        :model-value="entry.text"
        :aria-label="t('superComfy.modality.text')"
        class="max-h-48 min-h-14 bg-input px-2 py-1 pr-7 text-xs"
        @update:model-value="change(entry.index, $event)"
      />
      <Button
        variant="muted-textonly"
        size="icon-sm"
        class="absolute top-1 right-1 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"
        :aria-label="t('superComfy.node.removeItem')"
        @click="remove(entry.index)"
      >
        <i class="icon-[lucide--x] size-3" />
      </Button>
    </div>
    <Button
      variant="muted-textonly"
      size="sm"
      class="justify-start"
      @click="add"
    >
      <i class="icon-[lucide--plus] size-3" />
      {{ t('superComfy.node.addText') }}
    </Button>
  </div>
</template>
