<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

export interface FooterLink {
  label: string
  href: string
  external?: boolean
}

const {
  title,
  links,
  splitLinks = false
} = defineProps<{
  title: string
  links: FooterLink[]
  splitLinks?: boolean
}>()
</script>

<template>
  <nav
    :aria-label="title"
    :class="cn('flex flex-col gap-4', splitLinks && 'lg:col-span-2')"
  >
    <h3 class="text-sm font-bold">{{ title }}</h3>
    <div
      :class="
        cn('flex flex-col', splitLinks && 'block lg:columns-2 lg:gap-x-6')
      "
    >
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
        :target="link.external ? '_blank' : undefined"
        :rel="link.external ? 'noopener' : undefined"
        class="block py-1.5 text-sm transition-colors hover:text-primary-warm-white"
      >
        {{ link.label }}
        <img
          v-if="link.external"
          src="/icons/arrow-up-right.svg"
          alt=""
          class="inline-block size-3"
          aria-hidden="true"
        />
      </a>
    </div>
  </nav>
</template>
