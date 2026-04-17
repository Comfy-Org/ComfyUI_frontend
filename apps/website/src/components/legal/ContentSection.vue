<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { Locale, TranslationKey } from '../../i18n/translations'

import { t } from '../../i18n/translations'
import CategoryNav from '../common/CategoryNav.vue'
import type { SectionConfig } from './types'

const {
  prefix,
  sections,
  locale = 'en'
} = defineProps<{
  prefix: string
  sections: SectionConfig[]
  locale?: Locale
}>()

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
    <!-- Mobile nav -->
    <div class="mb-8 lg:hidden">
      <CategoryNav
        :categories="categories"
        :model-value="activeSection"
        @update:model-value="scrollToSection"
      />
    </div>

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
          class="mb-16"
        >
          <h2
            v-if="section.hasTitle"
            class="text-primary-comfy-canvas mb-6 text-2xl font-light"
          >
            {{ t(key(section.id, 'title'), locale) }}
          </h2>
          <template v-for="(block, i) in section.blocks" :key="i">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <p
              v-if="block.type === 'paragraph'"
              class="text-primary-warm-gray mt-4 text-sm/relaxed"
              v-html="t(key(section.id, `block.${i}`), locale)"
            />
            <ul
              v-else-if="block.type === 'list'"
              class="text-primary-warm-gray mt-4 list-disc space-y-1 pl-5 text-sm"
            >
              <li
                v-for="(item, j) in t(
                  key(section.id, `block.${i}`),
                  locale
                ).split('\n')"
                :key="j"
              >
                {{ item }}
              </li>
            </ul>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
