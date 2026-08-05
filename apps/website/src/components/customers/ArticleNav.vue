<script setup lang="ts">
import { useEventListener, useIntersectionObserver } from '@vueuse/core'
import { onMounted, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { scrollTo } from '../../scripts/smoothScroll'
import CategoryNav from '../common/CategoryNav.vue'

type Category = ComponentProps<typeof CategoryNav>['categories'][number]

const { categories } = defineProps<{
  categories: Category[]
}>()

const activeSection = ref(categories[0]?.value ?? '')

const HEADER_OFFSET_PX = -144
const BOTTOM_THRESHOLD_PX = 4
const SCROLL_SAFETY_MS = 1500

let isScrolling = false
let scrollSafetyTimer: ReturnType<typeof setTimeout> | undefined

function clearScrollLock() {
  isScrolling = false
  if (scrollSafetyTimer !== undefined) {
    clearTimeout(scrollSafetyTimer)
    scrollSafetyTimer = undefined
  }
}

function isAtBottom(): boolean {
  const scrollBottom = window.scrollY + window.innerHeight
  return (
    scrollBottom >= document.documentElement.scrollHeight - BOTTOM_THRESHOLD_PX
  )
}

function activateLastIfAtBottom() {
  if (isScrolling) return
  if (!isAtBottom()) return
  const lastId = categories[categories.length - 1]?.value
  if (lastId) activeSection.value = lastId
}

function scrollToSection(id: string) {
  activeSection.value = id
  clearScrollLock()
  isScrolling = true
  scrollSafetyTimer = setTimeout(clearScrollLock, SCROLL_SAFETY_MS)
  const el = document.getElementById(id)
  if (el) {
    scrollTo(el, {
      offset: HEADER_OFFSET_PX,
      duration: 0.8,
      immediate: prefersReducedMotion(),
      onComplete: clearScrollLock
    })
    return
  }
  clearScrollLock()
}

onMounted(() => {
  const elements = categories
    .map((category) => document.getElementById(category.value))
    .filter((el): el is HTMLElement => el !== null)

  useIntersectionObserver(
    elements,
    (entries) => {
      if (isScrolling) return
      if (isAtBottom()) return
      let best: IntersectionObserverEntry | null = null
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        if (!best || entry.boundingClientRect.top < best.boundingClientRect.top)
          best = entry
      }
      if (best) activeSection.value = best.target.id
    },
    { rootMargin: '-20% 0px -60% 0px' }
  )

  activateLastIfAtBottom()
})

useEventListener('scroll', activateLastIfAtBottom, { passive: true })
</script>

<template>
  <CategoryNav
    :categories
    :model-value="activeSection"
    @update:model-value="scrollToSection"
  />
</template>
