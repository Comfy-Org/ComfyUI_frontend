<script setup lang="ts">
import { inject, onMounted, onUnmounted, ref } from 'vue'

import { TOOLTIP_KEY } from './tooltipContext'

const ctx = inject(TOOLTIP_KEY)

const el = ref<HTMLElement | null>(null)

function onMouseEnter() {
  ctx?.scheduleOpen()
}

function onMouseLeave() {
  ctx?.close()
}

function onFocus() {
  ctx?.scheduleOpen()
}

function onBlur() {
  ctx?.close()
}

onMounted(() => {
  if (!el.value || !ctx) return
  // display:contents removes the wrapper's box; use the real child for positioning
  ctx.triggerEl.value =
    (el.value.firstElementChild as HTMLElement | null) ?? el.value
  el.value.addEventListener('mouseenter', onMouseEnter)
  el.value.addEventListener('mouseleave', onMouseLeave)
  el.value.addEventListener('focus', onFocus)
  el.value.addEventListener('blur', onBlur)
})

onUnmounted(() => {
  if (!el.value) return
  el.value.removeEventListener('mouseenter', onMouseEnter)
  el.value.removeEventListener('mouseleave', onMouseLeave)
  el.value.removeEventListener('focus', onFocus)
  el.value.removeEventListener('blur', onBlur)
})
</script>

<template>
  <div ref="el" class="contents">
    <slot />
  </div>
</template>
