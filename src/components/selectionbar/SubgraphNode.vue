<template>
  <SidebarTabTemplate
    :title="'Subgraph Node'"
    class="workflows-sidebar-tab bg-[var(--p-tree-background)]"
  >
  <template #body>
        <OrderList v-model="items" dataKey="id" breakpoint="575px" pt:pcListbox:root="w-full sm:w-56">
            <template #option="{ option }">
                {{ option }}
            </template>
        </OrderList>
  </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import OrderList from 'primevue/orderlist';

import { useI18n } from 'vue-i18n'

import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import { useCanvasStore } from '@/stores/graphStore'
const { t } = useI18n()

const canvasStore = useCanvasStore()

const items = ref(null)

watch(() => canvasStore.selectedItems,
(selectedItems) => {
  const node = selectedItems[0] ?? {}
  const interiorNodes = node?.subgraph?.nodes ?? []
  if (!interiorNodes) {
    items.value = null
    return
  }
  const intn =  interiorNodes.map((n) => 
    n.widgets.map((w) => [n.title, w.name])).flat(1)
  items.value = intn
})
</script>
