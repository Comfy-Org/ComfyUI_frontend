<template>
  <div class="flex flex-col gap-12 p-2 w-96">
    <img src="@/assets/images/api-nodes-news.webp" alt="API Nodes News" />
    <div class="flex flex-col gap-2 justify-center items-center">
      <div class="text-xl">
        {{ $t('apiNodesNews.introducing') }}
        <span class="text-amber-500">API NODES</span>
      </div>
      <div class="text-muted">{{ $t('apiNodesNews.subtitle') }}</div>
    </div>

    <div class="flex flex-col gap-4">
      <div
        v-for="(step, index) in steps"
        :key="index"
        class="grid grid-cols-[auto_1fr] gap-2 items-center"
      >
        <Tag class="w-8 h-8" :value="index + 1" rounded />
        <div class="flex flex-col gap-2">
          <div>{{ step.title }}</div>
          <div v-if="step.subtitle" class="text-muted">
            {{ step.subtitle }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-row justify-between">
      <Button label="Learn More" text @click="handleLearnMore" />
      <Button label="Close" @click="onClose" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const steps: {
  title: string
  subtitle?: string
}[] = [
  {
    title: t('apiNodesNews.steps.step1.title'),
    subtitle: t('apiNodesNews.steps.step1.subtitle')
  },
  {
    title: t('apiNodesNews.steps.step2.title'),
    subtitle: t('apiNodesNews.steps.step2.subtitle')
  },
  {
    title: t('apiNodesNews.steps.step3.title')
  },
  {
    title: t('apiNodesNews.steps.step4.title')
  }
]

const { onClose } = defineProps<{
  onClose: () => void
}>()

const handleLearnMore = () => {
  window.open('https://blog.comfy.org/p/comfyui-native-api-nodes', '_blank')
}

onBeforeUnmount(() => {
  localStorage.setItem('api-nodes-news-seen', 'true')
})
</script>
