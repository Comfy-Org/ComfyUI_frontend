<template>
  <div class="flex shrink items-center justify-between py-2">
    <div>
      <Button v-if="!isFirstStep" size="lg" @click="$emit('back')">
        {{ $t('comfyHubPublish.back') }}
      </Button>
    </div>
    <div class="flex gap-4">
      <Button v-if="!isLastStep" size="lg" @click="$emit('next')">
        {{ $t('comfyHubPublish.next') }}
        <i class="icon-[lucide--chevron-right] size-4" />
      </Button>
      <Button variant="primary" size="lg" @click="$emit('publish')">
        <i class="icon-[lucide--upload] size-4" />
        {{ $t('comfyHubPublish.publishButton') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  isFirstStep: boolean
  isLastStep: boolean
}>()

defineEmits<{
  back: []
  next: []
  publish: []
}>()
</script>
