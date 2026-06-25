<script setup lang="ts">
import { nextTick, ref } from 'vue'

import DropdownMenu from '@/components/ui/dropdown-menu/DropdownMenu.vue'
import DropdownMenuContent from '@/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuItem from '@/components/ui/dropdown-menu/DropdownMenuItem.vue'
import DropdownMenuSeparator from '@/components/ui/dropdown-menu/DropdownMenuSeparator.vue'
import DropdownMenuTrigger from '@/components/ui/dropdown-menu/DropdownMenuTrigger.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

defineProps<{ entries: MenuEntry[] }>()

const emit = defineEmits<{
  (e: 'action', entry: MenuEntry): void
}>()

const isOpen = ref(false)
const anchor = ref({ x: 0, y: 0 })
const lastTrigger = ref<EventTarget | null>(null)

async function open(event: Event) {
  const me = event as MouseEvent
  const trigger = me.currentTarget ?? me.target ?? null

  if (isOpen.value && me.type === 'click' && trigger === lastTrigger.value) {
    isOpen.value = false
    return
  }

  anchor.value = { x: me.clientX, y: me.clientY }
  lastTrigger.value = trigger
  if (isOpen.value) {
    isOpen.value = false
    await nextTick()
  }
  isOpen.value = true
}

function hide() {
  isOpen.value = false
}

function onEntrySelect(entry: MenuEntry) {
  if (entry.kind === 'divider' || entry.disabled) return
  emit('action', entry)
}

defineExpose({ open, hide })
</script>

<template>
  <DropdownMenu v-model:open="isOpen" :modal="false">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        aria-hidden="true"
        tabindex="-1"
        class="pointer-events-none fixed size-0 opacity-0"
        :style="{ left: `${anchor.x}px`, top: `${anchor.y}px` }"
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      size="lg"
      :side-offset="0"
      align="start"
      :collision-padding="8"
    >
      <template v-for="entry in entries" :key="entry.key">
        <DropdownMenuSeparator v-if="entry.kind === 'divider'" />
        <DropdownMenuItem
          v-else
          :disabled="entry.disabled"
          @select="onEntrySelect(entry)"
        >
          <template v-if="entry.icon" #icon>
            <i :class="entry.icon" />
          </template>
          {{ entry.label }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
