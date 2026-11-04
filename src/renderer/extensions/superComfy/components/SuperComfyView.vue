<script setup lang="ts">
import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
import { onMounted, ref, useTemplateRef } from 'vue'

import { probeRouterAccess } from '@/renderer/extensions/superComfy/router/routerCatalog'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

import AddNodeMenu from './AddNodeMenu.vue'
import SuperComfyCanvas from './SuperComfyCanvas.vue'
import SuperComfyToolbar from './SuperComfyToolbar.vue'

interface MenuRequest {
  at: Point
  anchor: Point
}

const EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]'

const store = useSuperComfyGraphStore()
const root = useTemplateRef<HTMLElement>('root')
const canvas = useTemplateRef('canvas')
const menu = ref<MenuRequest | null>(null)

function isEditable(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(EDITABLE_SELECTOR) !== null
}

function localPoint(clientX: number, clientY: number): Point {
  const rect = root.value?.getBoundingClientRect()
  return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) }
}

function openMenuFromToolbar(anchor: DOMRect | undefined) {
  menu.value = {
    at: canvas.value?.viewCenter() ?? { x: 0, y: 0 },
    anchor: anchor ? localPoint(anchor.left, anchor.bottom) : { x: 12, y: 44 }
  }
}

function openMenuAt(at: Point, client: Point) {
  menu.value = { at, anchor: localPoint(client.x, client.y) }
}

function runGraph() {
  if (!store.isBusy) void store.runGraph()
}

function onEscape() {
  if (menu.value) menu.value = null
  else canvas.value?.clearSelection()
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    runGraph()
    return
  }
  if (event.key === 'Escape') {
    onEscape()
    return
  }
  if (isEditable(event.target) || event.ctrlKey || event.metaKey) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    canvas.value?.deleteSelection()
  } else if (event.key === 'f' || event.key === 'F') {
    canvas.value?.fit()
  }
}

function onPointerDown(event: PointerEvent) {
  if (!isEditable(event.target)) root.value?.focus({ preventScroll: true })
}

onMounted(async () => {
  root.value?.focus({ preventScroll: true })
  void probeRouterAccess()
  await store.ensureLoaded()
  await store.refreshStaleApps()
})
</script>

<template>
  <div
    ref="root"
    tabindex="-1"
    class="absolute inset-0 z-4 flex flex-col bg-background text-foreground outline-none"
    data-testid="supercomfy-view"
    @keydown="onKeydown"
    @pointerdown.capture="onPointerDown"
    @dragover.prevent
    @drop.prevent
  >
    <SuperComfyToolbar @add="openMenuFromToolbar" @fit="canvas?.fit()" />
    <div class="relative min-h-0 flex-1">
      <SuperComfyCanvas
        v-if="store.loadStatus === 'ready'"
        ref="canvas"
        @request-add="openMenuAt"
      />
      <div v-else class="flex size-full items-center justify-center">
        <i
          class="icon-[lucide--loader-circle] size-6 animate-spin text-muted-foreground"
        />
      </div>
    </div>
    <AddNodeMenu
      v-if="menu"
      :at="menu.at"
      :anchor="menu.anchor"
      @close="menu = null"
      @added="canvas?.selectOnly($event)"
    />
  </div>
</template>
