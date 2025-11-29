<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NodeState, NodeBadge } from '@/types/node'

interface Props {
  title: string
  collapsed?: boolean
  pinned?: boolean
  badges?: NodeBadge[]
  state?: NodeState
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
  pinned: false,
  badges: () => [],
  state: 'idle',
})

const emit = defineEmits<{
  collapse: []
  'update:title': [title: string]
}>()

const isEditing = ref(false)
const editValue = ref('')

const statusBadge = computed((): NodeBadge | null => {
  switch (props.state) {
    case 'muted':
      return { text: 'Muted', icon: 'pi-ban', variant: 'default' }
    case 'bypassed':
      return { text: 'Bypassed', icon: 'pi-redo', variant: 'warning' }
    case 'error':
      return { text: 'Error', icon: 'pi-exclamation-triangle', variant: 'error' }
    case 'executing':
      return { text: 'Running', icon: 'pi-spin pi-spinner', variant: 'default' }
    default:
      return null
  }
})

function handleCollapseClick(event: MouseEvent): void {
  event.stopPropagation()
  emit('collapse')
}

function handleDoubleClick(): void {
  if (!isEditing.value) {
    isEditing.value = true
    editValue.value = props.title
  }
}

function handleTitleBlur(): void {
  if (isEditing.value) {
    const trimmed = editValue.value.trim()
    if (trimmed && trimmed !== props.title) {
      emit('update:title', trimmed)
    }
    isEditing.value = false
  }
}

function handleTitleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    handleTitleBlur()
  } else if (event.key === 'Escape') {
    isEditing.value = false
  }
}

function getBadgeClasses(variant?: string): string {
  switch (variant) {
    case 'success':
      return 'bg-green-500/20 text-green-400'
    case 'warning':
      return 'bg-amber-500/20 text-amber-400'
    case 'error':
      return 'bg-red-500/20 text-red-400'
    default:
      return 'bg-zinc-700 text-zinc-300'
  }
}
</script>

<template>
  <div
    :class="[
      'node-header px-2 py-1.5',
      'text-zinc-100',
      collapsed ? 'rounded-lg' : 'rounded-t-lg',
    ]"
    @dblclick="handleDoubleClick"
  >
    <div class="flex items-center gap-1.5 min-w-0">
      <button
        class="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
        @click="handleCollapseClick"
        @dblclick.stop
      >
        <i
          :class="[
            'pi pi-chevron-down text-[10px] transition-transform duration-200',
            collapsed && '-rotate-90',
          ]"
        />
      </button>

      <div class="flex min-w-0 flex-1 items-center">
        <input
          v-if="isEditing"
          v-model="editValue"
          type="text"
          class="w-full min-w-0 truncate bg-transparent text-xs font-medium text-zinc-100 outline-none ring-1 ring-blue-500 rounded px-1"
          autofocus
          @blur="handleTitleBlur"
          @keydown="handleTitleKeydown"
        />
        <span v-else class="truncate text-xs font-medium">
          {{ title }}
        </span>
      </div>

      <div v-if="badges?.length || statusBadge || pinned" class="flex shrink-0 items-center gap-1">
        <span
          v-for="badge in badges"
          :key="badge.text"
          :class="[
            'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium',
            getBadgeClasses(badge.variant),
          ]"
        >
          <i v-if="badge.icon" :class="['pi', badge.icon, 'text-[8px]']" />
          {{ badge.text }}
        </span>

        <span
          v-if="statusBadge"
          :class="[
            'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium',
            getBadgeClasses(statusBadge.variant),
          ]"
        >
          <i v-if="statusBadge.icon" :class="['pi', statusBadge.icon, 'text-[8px]']" />
          {{ statusBadge.text }}
        </span>

        <i v-if="pinned" class="pi pi-thumbtack text-[10px] text-zinc-500" />
      </div>
    </div>
  </div>
</template>
