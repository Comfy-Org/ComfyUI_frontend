<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useUiStore, NODE_CATEGORIES, type NodeCategoryId } from '@/stores/uiStore'

const uiStore = useUiStore()

const activeNodeCategory = computed(() => uiStore.activeNodeCategory)
const activeNodeCategoryData = computed(() => uiStore.activeNodeCategoryData)
const nodePanelExpanded = computed(() => uiStore.nodePanelExpanded)

const searchQuery = ref('')

// Node preview on hover
const hoveredNode = ref<string | null>(null)
const previewPosition = ref({ top: 0 })

function handleCategoryClick(categoryId: Exclude<NodeCategoryId, null>): void {
  uiStore.toggleNodeCategory(categoryId)
}

function handleNodeHover(nodeName: string, event: MouseEvent): void {
  hoveredNode.value = nodeName
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  previewPosition.value = { top: rect.top }
}

function handleNodeLeave(): void {
  hoveredNode.value = null
}
</script>

<template>
  <!-- Level 1: Category Icon Bar -->
  <nav class="flex w-12 flex-col items-center border-r border-zinc-800 bg-black py-2">
    <div class="flex flex-1 flex-col gap-0.5 overflow-y-auto scrollbar-hide">
      <button
        v-for="category in NODE_CATEGORIES"
        :key="category.id"
        v-tooltip.right="{ value: category.label, showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md transition-all"
        :class="[
          activeNodeCategory === category.id
            ? 'text-white'
            : 'text-zinc-500 hover:text-zinc-200'
        ]"
        :style="{
          backgroundColor: activeNodeCategory === category.id ? category.color + '15' : 'transparent',
        }"
        @click="handleCategoryClick(category.id)"
      >
        <i
          :class="[category.icon, 'text-base']"
          :style="{ color: activeNodeCategory === category.id ? category.color : undefined }"
        />
      </button>
    </div>

    <div class="mt-auto flex flex-col gap-1 pt-2">
      <button
        v-tooltip.right="{ value: 'Help', showDelay: 50 }"
        class="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
      >
        <i class="pi pi-question-circle text-xs" />
      </button>
    </div>
  </nav>

  <!-- Level 2: Subcategory Panel -->
  <aside
    class="border-r border-zinc-800 bg-black/98 transition-all duration-200 ease-out"
    :class="nodePanelExpanded ? 'w-72' : 'w-0 overflow-hidden'"
  >
    <div v-if="nodePanelExpanded && activeNodeCategoryData" class="flex h-full w-72 flex-col">
      <!-- Panel Header -->
      <div class="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div class="flex items-center gap-2">
          <i
            :class="activeNodeCategoryData.icon"
            class="text-sm"
            :style="{ color: activeNodeCategoryData.color }"
          />
          <span
            class="text-sm font-semibold"
            :style="{ color: activeNodeCategoryData.color }"
          >
            {{ activeNodeCategoryData.label }}
          </span>
        </div>
        <Button
          icon="pi pi-times"
          text
          severity="secondary"
          size="small"
          class="!h-6 !w-6"
          @click="uiStore.closeNodePanel()"
        />
      </div>

      <!-- Search Box -->
      <div class="border-b border-zinc-800/50 p-2">
        <div class="relative">
          <i class="pi pi-search absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500" />
          <InputText
            v-model="searchQuery"
            :placeholder="`Search ${activeNodeCategoryData.label.toLowerCase()}...`"
            class="!h-8 w-full !rounded !border-zinc-700 !bg-zinc-800/50 !pl-8 !text-xs"
          />
        </div>
      </div>

      <!-- Nodes List -->
      <div class="flex-1 overflow-y-auto">
        <div class="space-y-3 p-2">
          <div
            v-for="subcategory in activeNodeCategoryData.subcategories"
            :key="subcategory.id"
          >
            <div class="mb-1 flex h-5 items-center rounded bg-zinc-950/70 px-2">
              <span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {{ subcategory.label }}
              </span>
            </div>

            <div class="space-y-0.5">
              <div
                v-for="nodeName in subcategory.nodes"
                :key="nodeName"
                class="group flex cursor-pointer items-center rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
                draggable="true"
                @mouseenter="handleNodeHover(nodeName, $event)"
                @mouseleave="handleNodeLeave"
              >
                <span class="flex-1 truncate text-xs text-zinc-400 group-hover:text-zinc-200">
                  {{ nodeName }}
                </span>
                <i class="pi pi-plus text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-zinc-800/50 px-3 py-2">
        <div class="text-[10px] text-zinc-500">
          {{ activeNodeCategoryData.subcategories.reduce((acc, sub) => acc + sub.nodes.length, 0) }} nodes
        </div>
      </div>
    </div>
  </aside>

  <!-- Node Preview Popup -->
  <Transition name="fade">
    <div
      v-if="hoveredNode && nodePanelExpanded"
      class="pointer-events-none fixed z-50 ml-2 w-64 rounded-lg border border-zinc-700 bg-black p-3 shadow-xl"
      :style="{ top: `${previewPosition.top}px`, left: 'calc(48px + 288px + 8px)' }"
    >
      <div class="mb-2 flex items-center gap-2">
        <span
          class="text-sm font-medium"
          :style="{ color: activeNodeCategoryData?.color }"
        >{{ hoveredNode }}</span>
      </div>
      <p class="text-xs leading-relaxed text-zinc-400">
        Node for processing data in the workflow. Drag to canvas to add.
      </p>
      <div class="mt-2 flex flex-wrap gap-1">
        <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">input: any</span>
        <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">output: any</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
