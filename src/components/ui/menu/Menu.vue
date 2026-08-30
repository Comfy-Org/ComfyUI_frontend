<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { nextTick, ref, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useModalLiftedZIndex } from '@/composables/useModalLiftedZIndex'

import MenuItems from './MenuItems.vue'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const { model } = defineProps<{
  model: MenuItem[]
}>()

const emit = defineEmits<{
  show: []
  hide: []
}>()

const visible = ref(false)
const showTimer = ref<number>()
const showRequest = ref(0)
const anchor = ref({ x: 0, y: 0 })
const triggerId = `${useId()}-trigger`
const overlayVisible = visible
const contentStyle = useModalLiftedZIndex(visible)

function show(event: Event) {
  const mouseEvent = event instanceof MouseEvent ? event : undefined
  const target = event.currentTarget
  const rect = target instanceof Element ? target.getBoundingClientRect() : null
  anchor.value = {
    x: mouseEvent?.clientX ?? rect?.left ?? 0,
    y: mouseEvent?.clientY ?? rect?.bottom ?? 0
  }
  window.clearTimeout(showTimer.value)
  const request = ++showRequest.value
  document.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
  )
  document.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
  )
  void nextTick(() => {
    if (request !== showRequest.value) return
    showTimer.value = window.setTimeout(() => {
      document.getElementById(triggerId)?.click()
    }, 50)
  })
}

function hide() {
  showRequest.value++
  window.clearTimeout(showTimer.value)
  document.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
  )
}

function toggle(event: Event) {
  if (visible.value) hide()
  else show(event)
}

function updateOpen(value: boolean) {
  visible.value = value
  if (value) emit('show')
  else emit('hide')
}

defineExpose({ hide, overlayVisible, show, toggle, visible })
</script>

<template>
  <DropdownMenuRoot @update:open="updateOpen">
    <DropdownMenuTrigger as-child>
      <button
        :id="triggerId"
        type="button"
        tabindex="-1"
        aria-hidden="true"
        class="pointer-events-none fixed size-px opacity-0"
        :style="{ left: `${anchor.x}px`, top: `${anchor.y}px` }"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        v-bind="$attrs"
        :class="cn(menuContentClass, $attrs.class)"
        :style="contentStyle"
        :side-offset="2"
        align="start"
        @close-auto-focus.prevent
      >
        <MenuItems :items="model" @select="hide">
          <template v-if="$slots.item" #item="slotProps">
            <slot name="item" v-bind="slotProps" />
          </template>
        </MenuItems>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
