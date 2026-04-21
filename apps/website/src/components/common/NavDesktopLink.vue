<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

export type NavDropdownItem = {
  label: string
  href: string
  badge?: string
  external?: boolean
}

export type NavLink = {
  label: string
  href?: string
  items?: NavDropdownItem[]
}

const {
  link,
  currentPath,
  isOpen = false
} = defineProps<{
  link: NavLink
  currentPath: string
  isOpen?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', label: string): void
  (e: 'close'): void
  (e: 'toggle', label: string): void
}>()
</script>

<template>
  <div
    class="relative"
    @mouseenter="link.items?.length && emit('open', link.label)"
    @mouseleave="emit('close')"
    @focusin="link.items?.length && emit('open', link.label)"
    @focusout="emit('close')"
  >
    <button
      v-if="link.items?.length"
      type="button"
      :class="
        cn(
          'group flex cursor-pointer items-center gap-1.5 py-3 text-sm font-bold tracking-wide uppercase transition-colors',
          link.items.some((item) => currentPath === item.href)
            ? 'text-primary-comfy-yellow'
            : 'text-primary-comfy-canvas hover:text-primary-warm-gray'
        )
      "
      aria-haspopup="true"
      :aria-expanded="isOpen"
      @click="emit('toggle', link.label)"
    >
      {{ link.label }}
      <span
        aria-hidden="true"
        :class="
          cn(
            'text-base leading-none transition-colors',
            link.items.some((item) => currentPath === item.href)
              ? 'text-primary-comfy-yellow'
              : 'text-primary-comfy-canvas group-hover:text-primary-warm-gray'
          )
        "
      >
        ▾
      </span>
    </button>

    <a
      v-else
      :href="link.href"
      :aria-current="currentPath === link.href ? 'page' : undefined"
      :class="
        cn(
          'flex items-center gap-1.5 py-3 text-sm font-bold tracking-wide uppercase transition-colors',
          currentPath === link.href
            ? 'text-primary-comfy-yellow'
            : 'text-primary-comfy-canvas hover:text-primary-warm-gray'
        )
      "
    >
      {{ link.label }}
    </a>

    <div
      v-if="link.items?.length"
      v-show="isOpen"
      data-testid="nav-dropdown"
      class="bg-transparency-ink-t80 absolute top-full left-0 w-max rounded-xl p-2 shadow-lg backdrop-blur-2xl backdrop-saturate-150"
    >
      <a
        v-for="item in link.items"
        :key="item.href"
        :href="item.href"
        :aria-current="currentPath === item.href ? 'page' : undefined"
        :class="
          cn(
            'flex items-center gap-2 rounded-sm p-2 text-xs font-medium tracking-wide transition-colors',
            currentPath === item.href
              ? 'text-primary-comfy-yellow'
              : 'text-primary-comfy-canvas hover:bg-transparency-white-t4 hover:text-white'
          )
        "
        @click="emit('close')"
      >
        {{ item.label }}
        <span
          v-if="item.badge"
          class="bg-primary-comfy-yellow text-primary-comfy-ink -skew-x-12 rounded-sm px-1 py-0.5 text-[9px]/3 leading-none font-bold"
        >
          <span class="ppformula-text-center inline-block skew-x-12">{{
            item.badge
          }}</span>
        </span>
        <img
          v-if="item.external"
          src="/icons/arrow-up-right.svg"
          alt=""
          class="ml-auto size-4"
          aria-hidden="true"
        />
      </a>
    </div>
  </div>
</template>
