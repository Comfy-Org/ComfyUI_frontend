<script setup lang="ts">
import { useIntersectionObserver, useTemplateRefsList } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { hasKey, t, translationKeys } from '../../i18n/translations'
import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { scrollTo } from '../../scripts/smoothScroll'

const {
  prefix,
  locale = 'en',
  effectiveDateKey,
  effectiveDateLabelKey,
  tocLabelKey
} = defineProps<{
  prefix: string
  locale?: Locale
  effectiveDateKey: TranslationKey
  effectiveDateLabelKey: TranslationKey
  tocLabelKey: TranslationKey
}>()

interface Block {
  type: 'paragraph' | 'list'
  key: TranslationKey
}

interface LegalSection {
  id: string
  title: string
  blocks: Block[]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSections(): LegalSection[] {
  const labelRegex = new RegExp(`^${escapeRegex(prefix)}\\.([^.]+)\\.label$`)
  const sectionIds: string[] = []
  for (const key of translationKeys) {
    const match = key.match(labelRegex)
    if (match && !sectionIds.includes(match[1])) sectionIds.push(match[1])
  }

  return sectionIds.map((id) => {
    const blockRegex = new RegExp(
      `^${escapeRegex(prefix)}\\.${escapeRegex(id)}\\.block\\.(\\d+)$`
    )
    const indices: number[] = []
    for (const key of translationKeys) {
      const match = key.match(blockRegex)
      if (match) indices.push(parseInt(match[1]))
    }
    indices.sort((a, b) => a - b)

    const blocks: Block[] = indices.map((i) => {
      const key = `${prefix}.${id}.block.${i}` as TranslationKey
      const value = t(key, locale)
      return { type: value.includes('\n') ? 'list' : 'paragraph', key }
    })

    const titleKey = `${prefix}.${id}.title` as TranslationKey
    return {
      id,
      title: hasKey(titleKey)
        ? t(titleKey, locale)
        : t(`${prefix}.${id}.label` as TranslationKey, locale),
      blocks
    }
  })
}

const sections = buildSections()
const tocItems = computed(() =>
  sections.map((s) => ({ id: s.id, title: s.title }))
)
const activeSection = ref(sections[0]?.id ?? '')
const sectionRefs = useTemplateRefsList<HTMLElement>()
const mobileTocOpen = ref(false)

let isScrolling = false
const HEADER_OFFSET = -144

useIntersectionObserver(
  sectionRefs,
  (entries) => {
    if (isScrolling) return
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

function scrollToSection(id: string) {
  activeSection.value = id
  isScrolling = true
  mobileTocOpen.value = false
  const el = document.getElementById(id)
  if (el) {
    scrollTo(el, {
      offset: HEADER_OFFSET,
      duration: 0.8,
      immediate: prefersReducedMotion(),
      onComplete: () => {
        isScrolling = false
      }
    })
    return
  }
  isScrolling = false
}

function listItems(key: TranslationKey): string[] {
  return t(key, locale).split('\n')
}
</script>

<template>
  <section class="px-4 pt-8 pb-24 lg:px-20 lg:pt-12 lg:pb-32">
    <div class="mx-auto max-w-7xl lg:flex lg:gap-16">
      <aside class="lg:w-64 lg:shrink-0">
        <details
          :open="mobileTocOpen"
          class="border-transparency-white-t4 mb-8 rounded-2xl border bg-(--site-bg-soft) lg:hidden"
          @toggle="
            (e) => (mobileTocOpen = (e.target as HTMLDetailsElement).open)
          "
        >
          <summary
            class="text-primary-comfy-canvas flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold tracking-wide select-none"
          >
            <span>{{ t(tocLabelKey, locale) }}</span>
            <span
              :class="
                mobileTocOpen
                  ? 'rotate-180 transition-transform'
                  : 'transition-transform'
              "
              aria-hidden="true"
            >
              ▾
            </span>
          </summary>
          <ul class="border-transparency-white-t4 border-t p-2">
            <li v-for="item in tocItems" :key="item.id">
              <a
                :href="`#${item.id}`"
                :aria-current="activeSection === item.id ? 'true' : undefined"
                class="text-primary-comfy-canvas hover:bg-transparency-white-t4 block rounded-lg px-3 py-2 text-sm transition-colors"
                :class="
                  activeSection === item.id
                    ? 'text-primary-comfy-yellow font-semibold'
                    : 'text-primary-warm-gray'
                "
                @click.prevent="scrollToSection(item.id)"
              >
                {{ item.title }}
              </a>
            </li>
          </ul>
        </details>

        <nav
          class="hidden lg:sticky lg:top-32 lg:block"
          :aria-label="t(tocLabelKey, locale)"
        >
          <p
            class="text-primary-warm-gray mb-4 text-xs font-semibold tracking-widest uppercase"
          >
            {{ t(tocLabelKey, locale) }}
          </p>
          <ul class="space-y-2">
            <li v-for="item in tocItems" :key="item.id">
              <a
                :href="`#${item.id}`"
                :aria-current="activeSection === item.id ? 'true' : undefined"
                class="hover:text-primary-comfy-canvas block text-sm/snug transition-colors"
                :class="
                  activeSection === item.id
                    ? 'text-primary-comfy-yellow font-semibold'
                    : 'text-primary-warm-gray'
                "
                @click.prevent="scrollToSection(item.id)"
              >
                {{ item.title }}
              </a>
            </li>
          </ul>
        </nav>
      </aside>

      <article class="flex-1 lg:max-w-3xl">
        <section
          v-for="section in sections"
          :id="section.id"
          :ref="sectionRefs.set"
          :key="section.id"
          class="mb-16 scroll-mt-24 lg:scroll-mt-36"
        >
          <h2
            class="text-primary-comfy-canvas mb-6 text-2xl font-light lg:text-3xl"
          >
            {{ section.title }}
          </h2>

          <template v-for="block in section.blocks" :key="block.key">
            <p
              v-if="block.type === 'paragraph'"
              class="text-primary-comfy-canvas mt-4 text-sm/relaxed lg:text-base/relaxed"
              v-html="t(block.key, locale)"
            />
            <ul
              v-else
              class="mt-4 space-y-2 pl-5 text-sm/relaxed lg:text-base/relaxed"
            >
              <li
                v-for="(item, j) in listItems(block.key)"
                :key="j"
                class="text-primary-comfy-canvas flex items-start gap-2"
              >
                <span
                  class="bg-primary-comfy-yellow mt-2 size-1.5 shrink-0 rounded-full"
                  aria-hidden="true"
                />
                <span v-html="item" />
              </li>
            </ul>
          </template>
        </section>

        <footer
          class="border-transparency-white-t4 text-primary-warm-gray mt-16 border-t pt-6 text-sm"
        >
          <p>
            <span class="font-semibold"
              >{{ t(effectiveDateLabelKey, locale) }}:</span
            >
            {{ t(effectiveDateKey, locale) }}
          </p>
        </footer>
      </article>
    </div>
  </section>
</template>
