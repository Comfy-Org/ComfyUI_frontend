<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main
    class="dark-theme fixed inset-0 overflow-auto bg-charcoal-950 px-4 py-6 font-inter sm:px-6 sm:py-10"
  >
    <section class="mx-auto flex min-h-full max-w-7xl items-center">
      <h1 class="m-0 text-xl font-semibold text-base-foreground">
        {{ t('hosted.title.checkout') }}
      </h1>
    </section>
  </main>
</template>
