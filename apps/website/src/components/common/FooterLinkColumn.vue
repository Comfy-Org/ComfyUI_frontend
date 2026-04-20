<script setup lang="ts">
export interface FooterLink {
  label: string
  href: string
  external?: boolean
}

const { title, links } = defineProps<{
  title: string
  links: FooterLink[]
}>()
</script>

<template>
  <nav :aria-label="title" class="flex flex-col gap-4">
    <h3 class="text-sm font-bold">{{ title }}</h3>
    <div class="flex flex-col">
      <a
        v-for="link in links"
        :key="link.href"
        :href="link.href"
        class="hover:text-primary-warm-white block py-1.5 text-sm transition-colors"
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
