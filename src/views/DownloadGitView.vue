<template>
  <BaseViewTemplate>
    <div
      class="col-start-1 h-screen row-start-1 place-content-center mx-auto overflow-y-auto"
    >
      <div
        class="max-w-screen-sm flex flex-col gap-8 p-8 bg-[url('/assets/images/Git-Logo-White.svg')] bg-no-repeat bg-right-top bg-origin-padding"
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
        <div class="flex gap-4 flex-row-reverse">
          <Button
            :label="$t('downloadGit.gitWebsite')"
            icon="pi pi-external-link"
            icon-pos="right"
            @click="openGitDownloads"
            severity="primary"
          />
          <Button
            :label="$t('downloadGit.skip')"
            icon="pi pi-exclamation-triangle"
            @click="skipGit"
            severity="secondary"
          />
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

const openGitDownloads = () => {
  window.open('https://git-scm.com/downloads/', '_blank')
}

const skipGit = () => {
  console.warn('pushing')
  const router = useRouter()
  router.push('install')
}
</script>
