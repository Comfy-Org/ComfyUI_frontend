<template>
  <BaseViewTemplate>
    <div
      class="flex max-w-(--breakpoint-sm) flex-col gap-8 bg-[url('/assets/images/Git-Logo-White.svg')] bg-top-right bg-no-repeat bg-origin-padding p-8"
    >
      <!-- Header -->
      <h1 class="mt-24 text-4xl font-bold text-red-500">
        {{ $t('downloadGit.title') }}
      </h1>

      <!-- Message -->
      <div class="space-y-4">
        <p class="text-xl">
          {{ $t('downloadGit.message') }}
        </p>
        <p class="text-xl">
          {{ $t('downloadGit.instructions') }}
        </p>
        <p class="text-m">
          {{ $t('downloadGit.warning') }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex flex-row-reverse gap-4">
        <Button
          :label="$t('downloadGit.gitWebsite')"
          icon="pi pi-external-link"
          icon-pos="right"
          severity="primary"
          @click="openGitDownloads"
        />
        <Button
          :label="$t('downloadGit.skip')"
          icon="pi pi-exclamation-triangle"
          severity="secondary"
          @click="skipGit"
        />
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const openGitDownloads = () => {
  window.open('https://git-scm.com/downloads/', '_blank')
}

const skipGit = async () => {
  console.warn('pushing')
  const router = useRouter()
  await router.push('install')
}
</script>
