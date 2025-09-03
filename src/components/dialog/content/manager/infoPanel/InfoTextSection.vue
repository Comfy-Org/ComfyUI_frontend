<template>
  <div class="flex flex-col gap-4 text-sm">
    <div v-for="(section, index) in sections" :key="index" class="mb-4">
      <div class="mb-1">
        {{ section.title }}
      </div>
      <div class="text-muted break-words">
        <a
          v-if="section.isUrl"
          :href="section.text"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2"
        >
          <i v-if="isGitHubLink(section.text)" class="pi pi-github text-base" />
          <span class="break-all">{{ section.text }}</span>
        </a>
        <MarkdownText v-else :text="section.text" class="text-muted" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownText from '@/components/dialog/content/manager/infoPanel/MarkdownText.vue'

export interface TextSection {
  title: string
  text: string
  isUrl?: boolean
}

defineProps<{
  sections: TextSection[]
}>()

const isGitHubLink = (url: string): boolean => url.includes('github.com')
</script>
