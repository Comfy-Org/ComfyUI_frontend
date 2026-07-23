<template>
  <footer
    data-testid="publish-footer"
    class="flex shrink items-center justify-end gap-4 border-t border-border-default px-6 py-4"
  >
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
      <i
        :class="
          cn(
            'size-4',
            isUpdate ? 'icon-[lucide--refresh-cw]' : 'icon-[lucide--upload]'
          )
        "
      />
      {{
        isUpdate
          ? $t('comfyHubPublish.updateButton')
          : $t('comfyHubPublish.publishButton')
      }}
    </Button>
  </footer>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'

defineProps<{
  isFirstStep: boolean
  isLastStep: boolean
  isPublishDisabled?: boolean
  isPublishing?: boolean
  isUpdate?: boolean
}>()

defineEmits<{
  back: []
  next: []
  publish: []
}>()
</script>
