<template>
  <div
    class="flex w-52 min-w-52 flex-col border-r border-border-default bg-base-background"
  >
    <div class="flex items-center px-3 py-2">
      <span class="text-xs font-semibold text-base-foreground">
        {{ t('layerEditor.layers') }}
      </span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto" @dragleave="onListDragLeave">
      <div
        v-for="node in rows"
        :key="node.id"
        :class="cn(rowClass(isRowSelected(node.id)), dropHintClass(node.id))"
        data-testid="layer-panel-row"
        :draggable="renamingId !== node.id"
        @click="onRowClick(node.id, $event)"
        @dragstart="onRowDragStart(node.id, $event)"
        @dragover="onRowDragOver(node.id, $event)"
        @drop="onRowDrop(node.id, $event)"
        @dragend="endDrag"
      >
        <button
          :class="eyeButtonClass(node.visible)"
          :title="t('layerEditor.toggleVisibility')"
          :aria-label="t('layerEditor.toggleVisibility')"
          @click.stop="session.toggleVisible(node.id)"
        >
          <i :class="eyeIconClass(node.visible)" />
        </button>
        <canvas
          :ref="(el) => registerThumb(node.id, el)"
          width="32"
          height="32"
          class="size-8 shrink-0 rounded-sm border border-border-default bg-base-background"
        />
        <div class="flex min-w-0 flex-1 flex-col">
          <input
            v-if="renamingId === node.id"
            :ref="focusInput"
            class="min-w-0 rounded-sm border border-border-default bg-base-background px-1 text-xs text-base-foreground select-text"
            :value="node.name"
            @blur="commitRename(node.id, $event)"
            @keydown.enter="commitRename(node.id, $event)"
            @keydown.escape="renamingId = null"
            @click.stop
          />
          <span
            v-else
            class="truncate text-xs text-base-foreground"
            :title="node.name"
            @dblclick="renamingId = node.id"
          >
            {{ node.name }}
          </span>
          <span class="truncate text-xs text-muted-foreground">
            {{ layerSubtitle(node) }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="backgroundLayer"
      :class="rowClass(isRowSelected(backgroundLayer.id), 'border-t')"
      data-testid="layer-panel-background-row"
      @click="session.selectBackground()"
    >
      <button
        :class="eyeButtonClass(backgroundLayer.visible)"
        :title="t('layerEditor.toggleVisibility')"
        :aria-label="t('layerEditor.toggleVisibility')"
        @click.stop="session.setBackgroundVisible(!backgroundLayer.visible)"
      >
        <i :class="eyeIconClass(backgroundLayer.visible)" />
      </button>
      <div
        class="size-8 shrink-0 rounded-sm border border-border-default"
        :style="{ backgroundColor: backgroundColor }"
        data-testid="layer-panel-background-swatch"
      />
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="truncate text-xs text-base-foreground">
          {{ t('layerEditor.background') }}
        </span>
        <span class="truncate text-xs text-muted-foreground">
          {{ backgroundSubtitle }}
        </span>
      </div>
    </div>

    <div
      class="flex items-center justify-end gap-1 border-t border-border-default p-1"
    >
      <button
        :class="footerButtonClass"
        :disabled="!canMoveActive"
        :title="t('layerEditor.moveUp')"
        :aria-label="t('layerEditor.moveUp')"
        @click="moveActive(1)"
      >
        <i class="icon-[lucide--chevron-up] size-4" />
      </button>
      <button
        :class="footerButtonClass"
        :disabled="!canMoveActive"
        :title="t('layerEditor.moveDown')"
        :aria-label="t('layerEditor.moveDown')"
        @click="moveActive(-1)"
      >
        <i class="icon-[lucide--chevron-down] size-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LayerDropPos } from '@/renderer/extensions/layerEditor/composables/layerPanelDnd'
import {
  dropPositionFor,
  reorderDropIndex
} from '@/renderer/extensions/layerEditor/composables/layerPanelDnd'
import { DEFAULT_BACKGROUND_COLOR } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type { LayerEditorSession } from '@/renderer/extensions/layerEditor/composables/useLayerEditorSession'
import type {
  RasterData,
  SceneNode
} from '@/renderer/extensions/layerEditor/engine/node'
import { cn } from '@comfyorg/tailwind-utils'

const { session } = defineProps<{ session: LayerEditorSession }>()

const { t } = useI18n()
const {
  imageLayers,
  backgroundLayer,
  activeNode,
  activeNodeId,
  selectedNodeIds,
  canvasSize
} = session
const { version } = session

const renamingId = ref<string | null>(null)

const rows = computed<SceneNode[]>(() => [...imageLayers.value].reverse())

const backgroundColor = computed(() => {
  const fill = backgroundLayer.value?.fill
  return fill?.type === 'solid' ? fill.color : DEFAULT_BACKGROUND_COLOR
})

const backgroundSubtitle = computed(
  () => `${canvasSize.value.w}×${canvasSize.value.h}`
)

const canMoveActive = computed(
  () => activeNode.value !== null && activeNode.value.kind !== 'fill'
)

const footerButtonClass =
  'flex size-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-base-foreground transition-colors hover:bg-secondary-background-hover disabled:cursor-default disabled:opacity-40'

function layerSubtitle(node: SceneNode): string {
  const blendInitial = node.mode.blend.charAt(0).toUpperCase()
  return `${blendInitial} ${Math.round(node.opacity * 100)}%`
}

function isRowSelected(id: string): boolean {
  return selectedNodeIds.value.includes(id) || activeNodeId.value === id
}

function rowClass(selected: boolean, extra?: string): string {
  return cn(
    'group relative flex cursor-pointer items-center gap-2 border-border-default px-2 py-1.5 select-none',
    'hover:bg-secondary-background-hover',
    selected && 'bg-secondary-background-selected',
    extra
  )
}

function eyeButtonClass(visible: boolean): string {
  return cn(
    'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border-0 bg-transparent text-base-foreground hover:bg-secondary-background-hover',
    visible && 'opacity-0 group-hover:opacity-100'
  )
}

function eyeIconClass(visible: boolean): string {
  return cn(
    'size-4',
    visible ? 'icon-[lucide--eye]' : 'icon-[lucide--eye-off] opacity-50'
  )
}

const dragId = ref<string | null>(null)
const dropHint = ref<{ id: string; pos: LayerDropPos } | null>(null)

function endDrag(): void {
  dragId.value = null
  dropHint.value = null
}

function dropHintClass(id: string): string {
  const hint = dropHint.value
  if (hint?.id !== id) return ''
  return hint.pos === 'above'
    ? "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-base-foreground before:content-['']"
    : "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-base-foreground after:content-['']"
}

function onRowDragStart(id: string, e: DragEvent): void {
  dragId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Firefox refuses to start the drag without data; empty keeps text
    // inputs from receiving the layer id on a stray drop.
    e.dataTransfer.setData('text/plain', '')
  }
}

function onRowDragOver(id: string, e: DragEvent): void {
  if (!dragId.value || dragId.value === id) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
  const pos = dropPositionFor(ratio)
  if (dropHint.value?.id !== id || dropHint.value?.pos !== pos)
    dropHint.value = { id, pos }
}

function onRowDrop(id: string, e: DragEvent): void {
  const dragged = dragId.value
  const hint = dropHint.value
  if (!dragged || hint?.id !== id) {
    endDrag()
    return
  }
  e.preventDefault()
  const toIndex = reorderDropIndex(
    imageLayers.value.map((n) => n.id),
    id,
    hint.pos,
    backgroundLayer.value ? 1 : 0
  )
  if (toIndex !== null) session.moveLayerTo(dragged, toIndex)
  endDrag()
}

function onListDragLeave(e: DragEvent): void {
  const container = e.currentTarget as HTMLElement
  if (!container.contains(e.relatedTarget as Node | null)) dropHint.value = null
}

function onRowClick(id: string, e: MouseEvent): void {
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    const current = selectedNodeIds.value
    session.setSelectedNodes(
      current.includes(id)
        ? current.filter((sid) => sid !== id)
        : [...current, id]
    )
    return
  }
  session.setActiveNode(id)
}

function commitRename(id: string, e: Event): void {
  if (renamingId.value !== id) return
  renamingId.value = null
  session.renameLayer(id, (e.target as HTMLInputElement).value)
}

function focusInput(el: Element | ComponentPublicInstance | null): void {
  if (el instanceof HTMLInputElement) el.focus()
}

function moveActive(dir: 1 | -1): void {
  const id = activeNodeId.value
  if (id) session.moveLayer(id, dir)
}

function computeFit(
  boxW: number,
  boxH: number,
  mediaW: number,
  mediaH: number
): { scale: number; offX: number; offY: number } {
  if (!boxW || !boxH || !mediaW || !mediaH)
    return { scale: 1, offX: 0, offY: 0 }
  const scale = Math.min(boxW / mediaW, boxH / mediaH)
  return {
    scale,
    offX: (boxW - mediaW * scale) / 2,
    offY: (boxH - mediaH * scale) / 2
  }
}

const thumbEls = new Map<string, HTMLCanvasElement>()

function drawThumb(el: HTMLCanvasElement, node: SceneNode): void {
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, el.width, el.height)
  if (node.kind !== 'raster') return
  const entry = session.content.get((node as RasterData).contentId)
  if (!entry) return
  const fit = computeFit(el.width, el.height, entry.width, entry.height)
  ctx.drawImage(
    entry.canvas,
    fit.offX,
    fit.offY,
    entry.width * fit.scale,
    entry.height * fit.scale
  )
}

function registerThumb(
  id: string,
  el: Element | ComponentPublicInstance | null
): void {
  if (el instanceof HTMLCanvasElement) {
    thumbEls.set(id, el)
    const node = imageLayers.value.find((n) => n.id === id)
    if (node) drawThumb(el, node)
  } else {
    thumbEls.delete(id)
  }
}

watch(
  version,
  () => {
    for (const node of imageLayers.value) {
      const el = thumbEls.get(node.id)
      if (el) drawThumb(el, node)
    }
  },
  { flush: 'post' }
)
</script>
