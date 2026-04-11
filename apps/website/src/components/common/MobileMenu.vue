<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'

import BrandButton from './BrandButton.vue'
import type { NavLink } from './NavDesktopLink.vue'

interface CtaLink {
  label: string
  href: string
  primary: boolean
}

const {
  open = false,
  links = [],
  ctaLinks = []
} = defineProps<{
  open?: boolean
  links?: NavLink[]
  ctaLinks?: CtaLink[]
}>()

const emit = defineEmits<{
  close: []
}>()

const activeSection = defineModel<string | null>('activeSection', {
  default: null
})

const activeSectionItems = computed(
  () => links.find((l) => l.label === activeSection.value)?.items
)

function onNavigate() {
  activeSection.value = null
  emit('close')
}

watch(
  () => open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }
)

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <div
    v-show="open"
    id="site-mobile-menu"
    class="bg-primary-comfy-ink fixed inset-0 z-40 flex flex-col px-6 pt-24 pb-8 md:hidden"
  >
    <!-- Main list -->
    <template v-if="!activeSection">
      <div class="flex flex-1 flex-col gap-2">
        <template v-for="link in links" :key="link.label">
          <button
            v-if="link.items"
            class="text-primary-warm-gray text-left text-3xl font-medium"
            @click="activeSection = link.label"
          >
            {{ link.label }}
          </button>
          <a
            v-else
            :href="link.href"
            class="text-primary-warm-gray text-3xl font-medium"
            @click="onNavigate"
          >
            {{ link.label }}
          </a>
        </template>
      </div>

      <div class="flex flex-col gap-3">
        <BrandButton
          v-for="cta in ctaLinks"
          :key="cta.href"
          :href="cta.href"
          :label="cta.label"
          :variant="cta.primary ? 'solid' : 'outline'"
          class-name="w-full py-4 text-center"
        />
      </div>
    </template>

    <!-- Drill-down sub-menu -->
    <template v-else>
      <div class="flex flex-1 flex-col">
        <button
          class="text-primary-comfy-yellow mb-6 flex items-center gap-2 text-sm font-bold tracking-wide uppercase"
          @click="activeSection = null"
        >
          <span aria-hidden="true">&lsaquo;</span>
          BACK
        </button>

        <p class="text-primary-warm-gray mb-4 text-sm">
          {{ activeSection }}
        </p>

        <div class="flex flex-col gap-2">
          <a
            v-for="item in activeSectionItems"
            :key="item.href"
            :href="item.href"
            class="text-primary-warm-gray flex items-center gap-3 text-3xl font-medium"
            @click="onNavigate"
          >
            {{ item.label }}
            <span
              v-if="item.badge"
              class="bg-primary-comfy-yellow text-primary-comfy-ink -skew-x-12 rounded-sm px-1 py-0.5 text-xs font-bold"
            >
              <span class="inline-block skew-x-12">{{ item.badge }}</span>
            </span>
            <img
              v-if="item.external"
              src="/icons/arrow-up-right.svg"
              alt=""
              class="size-5"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </template>
  </div>
</template>
