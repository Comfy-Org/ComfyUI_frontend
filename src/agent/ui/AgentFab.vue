<template>
  <div
    v-show="positioned"
    ref="fabEl"
    class="agent-fab pointer-events-auto fixed select-none"
    data-testid="agent-fab"
    :style="[style, { zIndex: 9999 }]"
    :class="cn(isDragging && 'cursor-grabbing')"
    role="button"
    tabindex="0"
    :aria-label="t('agent.fab.aria')"
    @click="onClick"
    @keydown.enter="onClick"
    @keydown.space.prevent="onClick"
    @dragover.prevent="onDragOver"
    @dragleave="isHoveringDrop = false"
    @drop.prevent="onDrop"
  >
    <div
      class="relative flex items-center justify-center transition-transform hover:scale-110"
      :class="
        cn(
          isHoveringDrop &&
            'scale-110 drop-shadow-[0_0_8px_rgba(240,255,65,0.9)]'
        )
      "
    >
      <img
        src="/assets/images/comfy-logo-single.svg"
        :alt="t('agent.panel.logoAlt')"
        class="size-12 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] select-none"
        draggable="false"
      />
      <span
        v-if="store.unreadCount > 0"
        class="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-electric-400 text-xs font-bold text-charcoal-800"
      >
        {{ store.unreadCount > 9 ? '9+' : store.unreadCount }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDraggable, watchDebounced } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@/utils/tailwindUtil'

import { useAssetIngest } from '../composables/useAssetIngest'
import { useAgentStore } from '../stores/agentStore'

const { t } = useI18n()
const store = useAgentStore()
const { ingestFromClipboard } = useAssetIngest()

const fabEl = ref<HTMLElement | null>(null)
const isHoveringDrop = ref(false)
const positioned = ref(false)

const { x, y, style, isDragging } = useDraggable(fabEl, {
  initialValue: store.fabPosition,
  containerElement: document.body,
  preventDefault: true
})

let didDrag = false

watchDebounced(
  [x, y],
  ([nx, ny]) => {
    store.fabPosition = { x: nx, y: ny }
  },
  { debounce: 300 }
)

onMounted(() => {
  const el = fabEl.value
  if (!el) return
  const w = el.offsetWidth || 48
  const h = el.offsetHeight || 48
  if (store.fabPosition.x === 0 && store.fabPosition.y === 0) {
    x.value = window.innerWidth - w - 24
    y.value = window.innerHeight - h - 24
  } else {
    x.value = clamp(store.fabPosition.x, 0, window.innerWidth - w)
    y.value = clamp(store.fabPosition.y, 0, window.innerHeight - h)
  }
  positioned.value = true
})

function onClick(): void {
  if (isDragging.value || didDrag) {
    didDrag = false
    return
  }
  store.toggle()
}

function onDragOver(e: DragEvent): void {
  isHoveringDrop.value = true
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

async function onDrop(e: DragEvent): Promise<void> {
  isHoveringDrop.value = false
  const results = await ingestFromClipboard(e.dataTransfer)
  for (const r of results) store.addPendingAsset(r.asset)
  if (results.length > 0) store.open()
}
</script>
