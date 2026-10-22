<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal
} from 'reka-ui'
import type { DropdownMenuContentProps } from 'reka-ui'
import { useEventListener } from '@vueuse/core'
import { nextTick, ref, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import MenuItems from './MenuItems.vue'
import { getMenuAnchorPosition } from './menuAnchor'
import { menuContentClass } from './menuStyles'
import type { MenuItem } from './types'

defineOptions({ inheritAttrs: false })

const {
  id: providedId,
  model,
  reference
} = defineProps<{
  id?: string
  model: MenuItem[]
  reference?: DropdownMenuContentProps['reference']
}>()
const emit = defineEmits<{ show: []; hide: [] }>()

const visible = ref(false)
const generatedId = useId()
const ownerId = `context-menu-${generatedId}`
const anchorPosition = ref({ x: 0, y: 0 })
let showRequest = 0
let shownFrom: EventTarget | null = null
let dismissingPressTarget: Node | null = null

function setOpen(value: boolean) {
  if (visible.value === value) return
  visible.value = value
  void nextTick(() => {
    if (value) emit('show')
    else emit('hide')
  })
}

function show(event: Event) {
  if (event.type === 'contextmenu') event.preventDefault()
  shownFrom = event.currentTarget ?? event.target
  anchorPosition.value = getMenuAnchorPosition(event)
  if (!visible.value) {
    setOpen(true)
    return
  }
  setOpen(false)
  const request = ++showRequest
  void nextTick(() => {
    if (request === showRequest) setOpen(true)
  })
}

function hide() {
  showRequest++
  setOpen(false)
}

function isOwnContent(target: Element) {
  return (
    target.closest('[data-menu-owner]')?.getAttribute('data-menu-owner') ===
    ownerId
  )
}

useEventListener(
  document,
  'pointerdown',
  ({ target }) => {
    dismissingPressTarget = null
    if (!visible.value || !(target instanceof Element) || isOwnContent(target))
      return
    dismissingPressTarget = target
    hide()
  },
  { capture: true }
)

function isClickFromDismissingPress(event: Event) {
  return (
    event instanceof MouseEvent &&
    event.detail > 0 &&
    shownFrom instanceof Node &&
    dismissingPressTarget !== null &&
    shownFrom.contains(dismissingPressTarget)
  )
}

function toggle(event: Event) {
  if (visible.value) hide()
  else if (!isClickFromDismissingPress(event)) show(event)
}

defineExpose({ hide, show, toggle, visible })
</script>

<template>
  <DropdownMenuRoot :open="visible" :modal="false" @update:open="setOpen">
    <Teleport to="body">
      <DropdownMenuTrigger as-child>
        <button
          :data-menu-owner="ownerId"
          type="button"
          tabindex="-1"
          aria-hidden="true"
          class="pointer-events-none fixed size-px opacity-0"
          :style="{
            left: `${anchorPosition.x}px`,
            top: `${anchorPosition.y}px`
          }"
        />
      </DropdownMenuTrigger>
    </Teleport>
    <DropdownMenuPortal :key="Number(visible)">
      <DropdownMenuContent
        :id="providedId ?? generatedId"
        :reference
        :data-menu-owner="ownerId"
        :class="
          cn(
            menuContentClass,
            'max-h-(--reka-dropdown-menu-content-available-height)',
            $attrs.class
          )
        "
        :side-offset="2"
        align="start"
        :update-position-strategy="reference ? 'always' : 'optimized'"
        @close-auto-focus.prevent
        @focus-outside.prevent
      >
        <MenuItems :items="model" :owner-id @select="hide">
          <template v-if="$slots.item" #item="slotProps">
            <slot name="item" v-bind="slotProps" />
          </template>
        </MenuItems>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
