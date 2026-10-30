<template>
  <footer
    data-testid="publish-footer"
    class="flex items-center justify-end gap-4 border-t px-6 py-4"
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
      <i class="icon-[lucide--chevron-right]" />
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
          isUpdate ? 'icon-[lucide--refresh-cw]' : 'icon-[lucide--upload]'
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
import Button from '@comfyorg/design-system/button/Button'

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
