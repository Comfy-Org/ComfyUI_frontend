<template>
  <footer
    class="flex shrink items-center gap-4 border-t border-border-default px-6 py-4"
  >
    <Button variant="textonly" size="lg" @click="$emit('cancel')">
      {{ $t('comfyHubPublish.cancel') }}
    </Button>
    <div class="flex-1" />
    <Button v-if="!isFirstStep" size="lg" @click="$emit('back')">
      {{ $t('comfyHubPublish.back') }}
    </Button>
    <Button
      v-if="!isLastStep"
      variant="primary"
      size="lg"
      @click="$emit('next')"
    >
      {{ $t('comfyHubPublish.next') }}
      <i class="icon-[lucide--chevron-right] size-4" />
    </Button>
    <Button
      v-else
      variant="primary"
      size="lg"
      :disabled="isPublishDisabled || isPublishing"
      :loading="isPublishing"
      @click="$emit('publish')"
    >
      <i class="icon-[lucide--upload] size-4" />
      {{ $t('comfyHubPublish.publishButton') }}
    </Button>
  </footer>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  isFirstStep: boolean
  isLastStep: boolean
  isPublishDisabled?: boolean
  isPublishing?: boolean
}>()

defineEmits<{
  back: []
  cancel: []
  next: []
  publish: []
}>()
</script>
