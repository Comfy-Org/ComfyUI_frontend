<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import BrandButton from './BrandButton.vue'
import CategoryNav from './CategoryNav.vue'
import { deriveSections } from '../../config/contentSections'

const {
  prefix,
  locale = 'en',
  readMoreHref
} = defineProps<{
  prefix: string
  locale?: Locale
  readMoreHref?: string
}>()

const sections = deriveSections(prefix)

function key(sectionId: string, suffix: string): TranslationKey {
  return `${prefix}.${sectionId}.${suffix}` as TranslationKey
}

const categories = computed(() =>
  sections.map((s) => ({
    label: t(key(s.id, 'label'), locale),
    value: s.id
  }))
)

const activeSection = ref(sections[0]?.id ?? '')

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeSection.value = entry.target.id
        }
      }
    },
    { rootMargin: '-20% 0px -60% 0px' }
  )

  for (const section of sections) {
    const el = document.getElementById(section.id)
    if (el) observer.observe(el)
  }
})

onUnmounted(() => {
  observer?.disconnect()
})

function scrollToSection(id: string) {
  activeSection.value = id
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="px-4 pt-8 pb-24 lg:px-20 lg:pt-24 lg:pb-40">
    <div class="lg:flex lg:gap-16">
      <!-- Desktop sticky nav -->
      <aside class="hidden lg:block lg:w-48 lg:shrink-0">
        <div class="sticky top-32">
          <CategoryNav
            :categories="categories"
            :model-value="activeSection"
            @update:model-value="scrollToSection"
          />
        </div>
      </aside>

      <!-- Content -->
      <div class="flex-1">
        <div
          v-for="section in sections"
          :id="section.id"
          :key="section.id"
          class="mb-16 scroll-mt-24 lg:scroll-mt-36"
        >
          <h2
            v-if="section.hasTitle"
            class="text-primary-comfy-canvas mb-6 text-2xl font-light"
          >
            {{ t(key(section.id, 'title'), locale) }}
          </h2>

          <template v-for="(block, i) in section.blocks" :key="i">
            <!-- Paragraph -->
            <p
              v-if="block.type === 'paragraph'"
              class="text-primary-comfy-canvas mt-4 text-sm/relaxed"
              v-html="t(key(section.id, `block.${i}`), locale)"
            />

            <!-- Heading (h3) -->
            <h3
              v-else-if="block.type === 'heading'"
              class="text-primary-comfy-yellow mt-6 mb-2 text-lg font-semibold italic"
            >
              {{ t(key(section.id, `block.${i}.heading`), locale) }}
            </h3>

            <!-- Bullet list -->
            <ul
              v-else-if="block.type === 'list'"
              class="mt-4 space-y-1 pl-5 text-sm"
            >
              <li
                v-for="(item, j) in t(
                  key(section.id, `block.${i}`),
                  locale
                ).split('\n')"
                :key="j"
                class="text-primary-comfy-canvas flex items-start gap-2"
              >
                <span
                  class="bg-primary-comfy-yellow mt-1.5 size-1.5 shrink-0 rounded-full"
                />
                {{ item }}
              </li>
            </ul>

            <!-- Ordered list -->
            <ol
              v-else-if="block.type === 'ordered-list'"
              class="mt-4 space-y-1 pl-1 text-sm"
            >
              <li
                v-for="(item, j) in t(
                  key(section.id, `block.${i}.ol`),
                  locale
                ).split('\n')"
                :key="j"
                class="text-primary-comfy-canvas flex items-start gap-3"
              >
                <span
                  class="text-primary-comfy-yellow shrink-0 font-semibold tabular-nums"
                >
                  {{ String(j + 1).padStart(2, '0') }}
                </span>
                {{ item }}
              </li>
            </ol>

            <!-- Image with caption -->
            <figure v-else-if="block.type === 'image'" class="my-8">
              <img
                :src="t(key(section.id, `block.${i}.src`), locale)"
                :alt="t(key(section.id, `block.${i}.alt`), locale)"
                class="w-full rounded-2xl object-cover"
              />
              <figcaption class="text-primary-comfy-canvas mt-3 text-xs">
                {{ t(key(section.id, `block.${i}.caption`), locale) }}
              </figcaption>
            </figure>

            <!-- Blockquote -->
            <blockquote
              v-else-if="block.type === 'blockquote'"
              :class="
                cn(
                  'border-primary-comfy-yellow my-8 rounded-2xl border-l-4 p-8',
                  'bg-(--site-bg-soft)'
                )
              "
            >
              <p
                class="text-primary-comfy-canvas text-lg/relaxed font-light italic"
              >
                "{{ t(key(section.id, `block.${i}.text`), locale) }}"
              </p>
              <p class="text-primary-comfy-yellow mt-4 text-sm font-semibold">
                {{ t(key(section.id, `block.${i}.name`), locale) }}
              </p>
            </blockquote>

            <!-- Author card -->
            <div
              v-else-if="block.type === 'author'"
              :class="cn('mt-8 rounded-2xl p-6', 'bg-(--site-bg-soft)')"
            >
              <span
                class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
              >
                {{ t(key(section.id, `block.${i}.label`), locale) }}
              </span>
              <p class="text-primary-comfy-canvas mt-2 text-sm font-semibold">
                {{ t(key(section.id, `block.${i}.name`), locale) }}
              </p>
              <p class="text-primary-comfy-canvas text-xs">
                {{ t(key(section.id, `block.${i}.role`), locale) }}
              </p>
            </div>
          </template>
        </div>

        <!-- Read more CTA -->
        <div v-if="readMoreHref" class="mt-8 flex justify-center">
          <BrandButton :href="readMoreHref" variant="solid" size="lg">
            <span class="ppformula-text-center flex items-center gap-2">
              {{ t('customers.story.readMore' as TranslationKey, locale) }}
              <span class="text-base">↗</span>
            </span>
          </BrandButton>
        </div>
      </div>
    </div>
  </section>
</template>
