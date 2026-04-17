<script setup lang="ts">
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
      class="group text-primary-comfy-canvas hover:text-primary-warm-gray flex cursor-pointer items-center gap-1.5 py-3 text-sm font-bold tracking-wide uppercase transition-colors"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      @click="emit('toggle', link.label)"
    >
      {{ link.label }}
      <span
        aria-hidden="true"
        class="text-primary-comfy-canvas group-hover:text-primary-warm-gray text-base leading-none transition-colors"
      >
        ▾
      </span>
    </button>

    <a
      v-else
      :href="link.href"
      :aria-current="currentPath === link.href ? 'page' : undefined"
      class="text-primary-comfy-canvas hover:text-primary-warm-gray flex items-center gap-1.5 py-3 text-sm font-bold tracking-wide uppercase transition-colors"
    >
      {{ link.label }}
    </a>

    <div
      v-if="link.items?.length"
      v-show="isOpen"
      data-testid="nav-dropdown"
      class="bg-transparency-white-t4 absolute top-full left-0 w-max rounded-xl p-2 shadow-lg backdrop-blur-md"
    >
      <a
        v-for="item in link.items"
        :key="item.href"
        :href="item.href"
        class="text-primary-comfy-canvas hover:bg-transparency-white-t4 flex items-center gap-2 rounded-sm p-2 text-xs font-medium tracking-wide transition-colors hover:text-white"
        @click="emit('close')"
      >
        {{ item.label }}
        <span
          v-if="item.badge"
          class="bg-primary-comfy-yellow text-primary-comfy-ink -skew-x-12 rounded-sm px-1 py-0.5 text-[9px]/3 leading-none font-bold"
        >
          <span class="inline-block skew-x-12">{{ item.badge }}</span>
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
