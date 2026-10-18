<script setup lang="ts">
import { useElementVisibility } from '@vueuse/core'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import BrandButton from '@/components/common/BrandButton.vue'
import { prefersReducedMotion } from '@/composables/useReducedMotion'
import type { Locale } from '@/i18n/translations'
import { terminalTokens } from './cliTerminalHighlight'
import {
  RESULTS_START,
  SESSION_DURATION,
  sessionEvents
} from './sessionTimeline'

const { locale = 'en', showFooter = true } = defineProps<{
  locale?: Locale
  showFooter?: boolean
}>()
const zh = locale !== 'en'
const root = useTemplateRef<HTMLElement>('root')
const terminal = useTemplateRef<HTMLElement>('terminal')
const visible = useElementVisibility(root)
const FIRST_ENTRY_START = RESULTS_START * 0.75
const elapsed = ref(FIRST_ENTRY_START)
const paused = ref(false)
const reduced = computed(() => prefersReducedMotion())
const resultsVisible = computed(
  () => reduced.value || elapsed.value >= RESULTS_START
)
// Highlight immutable lines once; animation only slices the cached tokens.
const preparedEvents = sessionEvents.map((event) => {
  const kind = event.kind === 'response' ? ('out' as const) : event.kind
  const text = (event.kind === 'cmd' ? '$ ' : '') + event.text
  return { ...event, tokens: terminalTokens({ kind, text: event.text }, text) }
})
const lines = computed(() => {
  if (resultsVisible.value) return []
  return preparedEvents
    .filter((event) => elapsed.value >= event.start)
    .map((event) => {
      const length =
        event.end > event.start
          ? Math.floor(
              event.text.length *
                Math.min(
                  1,
                  (elapsed.value - event.start) / (event.end - event.start)
                )
            )
          : event.text.length
      let remaining = length + (event.kind === 'cmd' ? 2 : 0)
      const tokens = event.tokens.flatMap((token) => {
        const content = token.content.slice(0, remaining)
        remaining = Math.max(0, remaining - token.content.length)
        return content ? [{ ...token, content }] : []
      })
      return { ...event, tokens }
    })
})
const transcript = sessionEvents
  .map((event) => (event.kind === 'cmd' ? '$ ' : '') + event.text)
  .join('\n\n')
let frame = 0
let last = 0
let accumulated = 0
function replay() {
  paused.value = false
  elapsed.value = reduced.value ? RESULTS_START : 0
  accumulated = 0
  last = performance.now()
}
function toggle() {
  paused.value = !paused.value
}
function tick(now: number) {
  const delta = Math.min(now - last, 100)
  last = now
  if (visible.value && !document.hidden && !paused.value && !reduced.value) {
    accumulated += delta
    if (accumulated >= 50) {
      elapsed.value = (elapsed.value + accumulated) % SESSION_DURATION
      accumulated = 0
    }
  }
  frame = requestAnimationFrame(tick)
}
watch(elapsed, async () => {
  await nextTick()
  if (terminal.value) terminal.value.scrollTop = terminal.value.scrollHeight
})
watch(reduced, replay)
onMounted(() => {
  elapsed.value = reduced.value ? RESULTS_START : FIRST_ENTRY_START
  last = performance.now()
  frame = requestAnimationFrame(tick)
})
onUnmounted(() => cancelAnimationFrame(frame))
</script>

<template>
  <div ref="root" data-testid="native-cli-session">
    <div
      class="relative h-88 overflow-hidden rounded-3xl bg-[#2a2230] focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none sm:h-144 lg:h-160"
      tabindex="0"
      role="group"
      :aria-label="
        zh
          ? 'CLI 会话动画；按空格键暂停或继续'
          : 'CLI session animation. Press Space to pause or resume.'
      "
      :data-phase="resultsVisible ? 'results' : 'terminal'"
      :data-paused="paused"
      :data-elapsed="Math.floor(elapsed)"
      @keydown.space.prevent="toggle"
    >
      <div
        v-show="!resultsVisible"
        ref="terminal"
        class="absolute inset-0 scrollbar-none overflow-auto p-6 font-mono text-2xs/relaxed wrap-break-word whitespace-pre-wrap text-primary-comfy-canvas sm:p-8 sm:text-xs/relaxed lg:text-sm/relaxed"
        aria-hidden="true"
      >
        <p v-for="(line, index) in lines" :key="index" class="mb-5">
          <span
            v-for="(token, i) in line.tokens"
            :key="i"
            :style="token.color ? { color: token.color } : undefined"
            >{{ token.content }}</span
          >
        </p>
        <span
          class="inline-block h-4 w-2 bg-primary-comfy-yellow"
          :class="!paused && !reduced && 'animate-cursor-blink'"
        />
      </div>
      <div
        v-show="resultsVisible"
        class="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6 sm:gap-8 sm:p-10"
      >
        <p class="font-mono text-sm text-primary-comfy-yellow">
          ✓ {{ zh ? '已保存 2 个文件' : '2 files saved' }}
        </p>
        <div class="grid w-full max-w-3xl grid-cols-2 gap-4 sm:gap-8">
          <figure
            v-for="output in [
              {
                src: 'cat.png',
                name: 'cat.png',
                alt: zh
                  ? '月光下的猫咪，来自所提供的录屏'
                  : 'Cat in moonlight, extracted from the supplied recording'
              },
              {
                src: 'lighthouse.png',
                name: 'f5308bc5_000.png',
                alt: zh
                  ? '黄昏灯塔，来自所提供的录屏'
                  : 'Lighthouse at dusk, extracted from the supplied recording'
              }
            ]"
            :key="output.src"
            class="min-w-0"
          >
            <img
              :src="`/images/cli/session/${output.src}`"
              :alt="output.alt"
              width="400"
              height="400"
              loading="eager"
              decoding="async"
              class="aspect-square w-full rounded-2xl object-cover sm:rounded-3xl"
            />
            <figcaption
              class="mt-4 text-center font-mono text-xs text-primary-comfy-canvas sm:text-sm"
            >
              {{ output.name }}
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
    <div
      v-if="showFooter"
      class="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p class="text-xs text-smoke-700">
        {{
          reduced
            ? zh
              ? '已减少动态效果：展示最终输出'
              : 'Reduced motion: final outputs shown'
            : zh
              ? '录制示例 · 不执行命令'
              : 'Recorded example · no commands execute'
        }}
      </p>
      <div class="flex gap-2">
        <BrandButton
          v-if="!reduced"
          class="uppercase"
          variant="outline"
          :aria-pressed="paused"
          @click="toggle"
          >{{
            paused ? (zh ? '继续' : 'Resume') : zh ? '暂停' : 'Pause'
          }}</BrandButton
        >
        <BrandButton
          v-if="!reduced"
          class="uppercase"
          variant="outline"
          @click="replay"
          >{{ zh ? '重播' : 'Replay' }}</BrandButton
        >
      </div>
    </div>
    <pre class="sr-only">{{ transcript }}</pre>
  </div>
</template>
