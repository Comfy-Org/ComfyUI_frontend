<template>
  <div class="flex w-full items-center justify-between gap-2 py-2 px-4">
    <IconTextButton
      :label="$t('cloud.missingNodes.learnMore')"
      type="transparent"
      size="sm"
      icon-position="left"
      @click="handleLearnMoreClick"
    >
      <template #icon>
        <i class="icon-[lucide--info]"></i>
      </template>
    </IconTextButton>
    <TextButton
      :label="$t('cloud.missingNodes.gotIt')"
      type="secondary"
      size="md"
      @click="handleGotItClick"
    />
  </div>
</template>

<script setup lang="ts">
import IconTextButton from '@/components/button/IconTextButton.vue'
import TextButton from '@/components/button/TextButton.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

const handleLearnMoreClick = () => {
  window.open('https://www.comfy.org/cloud', '_blank')
}

const handleGotItClick = () => {
  dialogStore.closeDialog({ key: 'global-cloud-missing-nodes' })
}
</script>
