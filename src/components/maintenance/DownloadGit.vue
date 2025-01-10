<template>
  <!-- Never run -->
  <a
    class="w-full h-full flex items-center justify-center"
    @click="openGitDownloadUrl"
  >
    <i class="pi pi-external-link text-6xl"></i>
  </a>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const commandFailed = ref<boolean>(false)

const openGitDownloadUrl = () => {
  window.open('https://git-scm.com/downloads/', '_blank')
}
</script>
