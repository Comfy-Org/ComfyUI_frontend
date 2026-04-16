<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
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
  ctaLinks = [],
  locale = 'en'
} = defineProps<{
  open?: boolean
  links?: NavLink[]
  ctaLinks?: CtaLink[]
  locale?: Locale
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement | undefined>()
const activeSection = ref<string | null>(null)

const activeSectionItems = computed(
  () => links.find((l) => l.label === activeSection.value)?.items
)

function onNavigate() {
  activeSection.value = null
  emit('close')
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab') return
  const menu = menuRef.value
  if (!menu) return
  const focusable = [...menu.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

let savedScrollY = 0

function lockScroll() {
  savedScrollY = window.scrollY
  document.body.style.position = 'fixed'
  document.body.style.top = `-${savedScrollY}px`
  document.body.style.left = '0'
  document.body.style.right = '0'
}

function unlockScroll() {
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  window.scrollTo(0, savedScrollY)
}

watch(
  () => open,
  async (isOpen) => {
    if (isOpen) {
      lockScroll()
      await nextTick()
      const menu = menuRef.value
      const firstFocusable = menu?.querySelector<HTMLElement>(FOCUSABLE)
      firstFocusable?.focus()
      menu?.addEventListener('keydown', trapFocus)
    } else {
      menuRef.value?.removeEventListener('keydown', trapFocus)
      unlockScroll()
    }
  }
)

onUnmounted(() => {
  menuRef.value?.removeEventListener('keydown', trapFocus)
  unlockScroll()
})
</script>

<template>
  <div
    v-show="open"
    id="site-mobile-menu"
    ref="menuRef"
    role="dialog"
    aria-modal="true"
    :aria-label="t('nav.menu', locale)"
    class="bg-primary-comfy-ink fixed inset-0 z-40 flex flex-col px-6 pt-24 pb-8 lg:hidden"
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
          {{ t('nav.back', locale) }}
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
              <span class="ppformula-text-center inline-block skew-x-12">{{
                item.badge
              }}</span>
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
