<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useIntersectionObserver, useTemplateRefsList } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/site'

import { prefersReducedMotion } from '../../composables/useReducedMotion'
import { t } from '../../i18n/site'
import en from '../../locales/en/main.json' with { type: 'json' }
import { scrollTo } from '../../scripts/smoothScroll'
import SafeRichText from '@/components/common/SafeRichTextContent'

const {
  prefix,
  locale = 'en',
  tocLabelKey
} = defineProps<{
  prefix: string
  locale?: Locale
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

interface MessageGroup {
  [key: string]: string | MessageGroup
}

function isMessageGroup(value: unknown): value is MessageGroup {
  return typeof value === 'object' && value !== null
}

function buildSections(): LegalSection[] {
  const catalog: unknown = en
  if (!isMessageGroup(catalog) || !isMessageGroup(catalog[prefix])) return []

  return Object.entries(catalog[prefix]).flatMap(([id, section]) => {
    if (!isMessageGroup(section) || typeof section.label !== 'string') return []
    const blocks: Block[] = isMessageGroup(section.block)
      ? Object.entries(section.block)
          .sort(([a], [b]) => Number(a) - Number(b))
          .flatMap(([index, message]): Block[] => {
            if (typeof message !== 'string') return []
            const key = `${prefix}.${id}.block.${index}` as TranslationKey
            return [
              {
                type: t(key, {}, { locale }).includes('\n')
                  ? 'list'
                  : 'paragraph',
                key
              }
            ]
          })
      : []
    const labelKey = `${prefix}.${id}.label` as TranslationKey
    const titleKey = `${prefix}.${id}.title` as TranslationKey
    return [
      {
        id,
        title: t(
          typeof section.title === 'string' ? titleKey : labelKey,
          {},
          { locale }
        ),
        blocks
      }
    ]
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
  const nextHash = `#${id}`
  if (window.location.hash !== nextHash) {
    history.replaceState(null, '', nextHash)
  }
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
  return t(key, {}, { locale: locale }).split('\n')
}
</script>

<template>
  <section class="px-4 pt-8 pb-24 lg:px-20 lg:pt-12 lg:pb-32">
    <div class="mx-auto max-w-7xl lg:flex lg:gap-16">
      <aside class="lg:w-64 lg:shrink-0">
        <details
          :open="mobileTocOpen"
          class="mb-8 rounded-2xl border border-transparency-white-t4 bg-(--site-bg-soft) lg:hidden"
          @toggle="
            (e) => (mobileTocOpen = (e.target as HTMLDetailsElement).open)
          "
        >
          <summary
            class="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold tracking-wide text-primary-comfy-canvas select-none"
          >
            <span>{{ t(tocLabelKey, {}, { locale: locale }) }}</span>
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
          <ul class="border-t border-transparency-white-t4 p-2">
            <li v-for="item in tocItems" :key="item.id">
              <a
                :href="`#${item.id}`"
                :aria-current="activeSection === item.id ? 'true' : undefined"
                :class="
                  cn(
                    'block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-transparency-white-t4',
                    activeSection === item.id
                      ? 'font-semibold text-primary-comfy-yellow'
                      : 'text-primary-warm-gray'
                  )
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
          :aria-label="t(tocLabelKey, {}, { locale: locale })"
        >
          <p
            class="mb-4 text-xs font-semibold tracking-widest text-primary-warm-gray uppercase"
          >
            {{ t(tocLabelKey, {}, { locale: locale }) }}
          </p>
          <ul class="space-y-2">
            <li v-for="item in tocItems" :key="item.id">
              <a
                :href="`#${item.id}`"
                :aria-current="activeSection === item.id ? 'true' : undefined"
                class="block text-sm/snug transition-colors hover:text-primary-comfy-canvas"
                :class="
                  activeSection === item.id
                    ? 'font-semibold text-primary-comfy-yellow'
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
            class="mb-6 text-2xl font-light text-primary-comfy-canvas lg:text-3xl"
          >
            {{ section.title }}
          </h2>

          <template v-for="block in section.blocks" :key="block.key">
            <SafeRichText
              v-if="block.type === 'paragraph'"
              as="p"
              class="mt-4 text-sm/relaxed text-primary-comfy-canvas lg:text-base/relaxed"
              :html="t(block.key, {}, { locale: locale })"
            />
            <ul
              v-else
              class="mt-4 space-y-2 pl-5 text-sm/relaxed lg:text-base/relaxed"
            >
              <li
                v-for="(item, j) in listItems(block.key)"
                :key="j"
                class="flex items-start gap-2 text-primary-comfy-canvas"
              >
                <span
                  class="mt-2 size-1.5 shrink-0 rounded-full bg-primary-comfy-yellow"
                  aria-hidden="true"
                />
                <SafeRichText as="span" :html="item" />
              </li>
            </ul>
          </template>
        </section>
      </article>
    </div>
  </section>
</template>
