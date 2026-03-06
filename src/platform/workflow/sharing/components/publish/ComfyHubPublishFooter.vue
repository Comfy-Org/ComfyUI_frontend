<template>
  <footer class="flex shrink items-center justify-between py-2">
    <div>
      <Button v-if="!isFirstStep" size="lg" @click="$emit('back')">
        {{ $t('sharing.publish.back') }}
      </Button>
    </div>
    <div class="flex gap-4">
      <Button v-if="!isLastStep" size="lg" @click="$emit('next')">
        {{ $t('sharing.publish.next') }}
        <i class="icon-[lucide--chevron-right] size-4" />
      </Button>
      <Button
        v-else
        variant="primary"
        size="lg"
        :disabled="isPublishDisabled"
        @click="$emit('publish')"
      >
        <i class="icon-[lucide--upload] size-4" />
        {{ $t('sharing.publish.publishButton') }}
      </Button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  isFirstStep: boolean
  isLastStep: boolean
  isPublishDisabled?: boolean
}>()

defineEmits<{
  back: []
  next: []
  publish: []
}>()
</script>
