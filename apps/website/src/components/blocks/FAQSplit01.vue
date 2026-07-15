<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, reactive, watch } from 'vue'

type Faq = { id: string; question: string; answer: string }

const { faqs } = defineProps<{
  heading: string
  faqs: readonly Faq[]
}>()

type AnswerPart = { type: 'text' | 'link'; value: string }

function parseAnswer(answer: string): AnswerPart[] {
  const urlPattern = /https?:\/\/[\w\-./?=&#%~:@+,;]+/g
  const parts: AnswerPart[] = []
  let lastIndex = 0
  for (const match of answer.matchAll(urlPattern)) {
    const start = match.index ?? 0
    const url = match[0].replace(/[.,;:]+$/, '')
    if (start > lastIndex) {
      parts.push({ type: 'text', value: answer.slice(lastIndex, start) })
    }
    parts.push({ type: 'link', value: url })
    lastIndex = start + url.length
  }
  if (lastIndex < answer.length) {
    parts.push({ type: 'text', value: answer.slice(lastIndex) })
  }
  return parts
}

const parsedFaqs = computed(() =>
  faqs.map((faq) => ({ ...faq, answerParts: parseAnswer(faq.answer) }))
)

const expanded = reactive<boolean[]>(faqs.map(() => false))

watch(
  () => faqs.length,
  (length) => {
    if (length === expanded.length) return
    expanded.length = 0
    for (let i = 0; i < length; i += 1) expanded.push(false)
  }
)

function toggle(index: number) {
  expanded[index] = !expanded[index]
}
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <div class="flex flex-col gap-6 md:flex-row md:gap-16">
      <!-- Left heading -->
      <div
        class="sticky top-20 z-10 w-full shrink-0 self-start bg-primary-comfy-ink py-4 md:top-28 md:w-80 md:py-0"
      >
        <h2 class="text-4xl font-light text-primary-comfy-canvas md:text-5xl">
          {{ heading }}
        </h2>
      </div>

      <!-- Right FAQ list -->
      <div class="flex-1">
        <div
          v-for="(faq, index) in parsedFaqs"
          :key="faq.id"
          class="border-b border-primary-comfy-canvas/20"
        >
          <button
            :id="`faq-trigger-${faq.id}`"
            type="button"
            :aria-expanded="expanded[index]"
            :aria-controls="`faq-panel-${faq.id}`"
            :class="
              cn(
                'flex w-full cursor-pointer items-center justify-between text-left',
                index === 0 ? 'pb-6' : 'py-6'
              )
            "
            @click="toggle(index)"
          >
            <span
              :class="
                cn(
                  'text-lg font-light md:text-xl',
                  expanded[index]
                    ? 'text-primary-comfy-yellow'
                    : 'text-primary-comfy-canvas'
                )
              "
            >
              {{ faq.question }}
            </span>
            <span
              class="text-primary-comfy-yellow ml-4 shrink-0 text-2xl"
              aria-hidden="true"
            >
              {{ expanded[index] ? '−' : '+' }}
            </span>
          </button>
          <section
            v-show="expanded[index]"
            :id="`faq-panel-${faq.id}`"
            role="region"
            :aria-labelledby="`faq-trigger-${faq.id}`"
            class="pb-6"
          >
            <p
              class="text-sm wrap-break-word whitespace-pre-line text-primary-comfy-canvas/70"
            >
              <template
                v-for="(part, partIndex) in faq.answerParts"
                :key="partIndex"
              >
                <a
                  v-if="part.type === 'link'"
                  :href="part.value"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary-comfy-yellow underline underline-offset-2 transition-opacity hover:opacity-70"
                  >{{ part.value }}</a
                >
                <template v-else>{{ part.value }}</template>
              </template>
            </p>
          </section>
        </div>
      </div>
    </div>
  </section>
</template>
