<script setup lang="ts">
import { useMediaQuery, useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'

const {
  text,
  stagger = 70,
  delay = 0
} = defineProps<{
  text: string
  stagger?: number
  delay?: number
}>()

const root = useTemplateRef<HTMLElement>('root')
const still = useMediaQuery('(prefers-reduced-motion: reduce)')

// Without script the words render plain, so the heading is readable before
// hydration and when the animation is switched off.
const animating = ref(false)
const revealed = ref(false)
const lineOfWord = ref<number[]>([])

let words = 0
const parts = text.split(/(\s+)/).map((value) => ({
  value,
  word: /\S/.test(value) ? words++ : undefined
}))

// The browser has already broken the heading into lines; words that share a
// top edge sit on the same one, so they rise together.
function measureLines() {
  const spans = root.value?.querySelectorAll<HTMLElement>('[data-word]')
  if (!spans) return
  let line = -1
  let previousTop = Number.NaN
  lineOfWord.value = [...spans].map((span) => {
    if (span.offsetTop !== previousTop) {
      previousTop = span.offsetTop
      line += 1
    }
    return line
  })
}

onMounted(async () => {
  if (still.value) return
  animating.value = true
  await nextTick()
  measureLines()
  requestAnimationFrame(() => {
    revealed.value = true
  })
})

useResizeObserver(root, () => {
  if (animating.value) measureLines()
})
</script>

<template>
  <span ref="root" data-testid="split-reveal">
    <template v-for="(part, index) in parts" :key="index">
      <span
        v-if="part.word !== undefined"
        data-word
        class="inline-block transition-[opacity,translate] duration-700 ease-out"
        :class="
          animating && !revealed ? 'translate-y-[0.35em] opacity-0' : undefined
        "
        :style="{
          transitionDelay: `${delay + (lineOfWord[part.word] ?? 0) * stagger}ms`
        }"
        >{{ part.value }}</span
      >
      <template v-else>{{ part.value }}</template>
    </template>
  </span>
</template>
