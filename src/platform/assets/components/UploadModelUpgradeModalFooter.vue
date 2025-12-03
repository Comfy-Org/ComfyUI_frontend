<template>
  <div class="flex justify-end gap-2 w-full">
    <span
      class="text-muted-foreground mr-auto underline flex items-center gap-2"
    >
      <i class="icon-[lucide--circle-question-mark]" />
      <a
        href="https://blog.comfy.org/p/comfy-cloud-new-features-and-pricing"
        target="_blank"
        class="text-muted-foreground"
        >{{ $t('Learn more') }}</a
      >
    </span>
    <TextButton
      :label="$t('g.close')"
      type="transparent"
      size="md"
      @click="emit('close')"
    />
    <TextButton
      :label="$t('Subscribe')"
      type="secondary"
      size="md"
      @click="emit('subscribe')"
    />
  </div>
</template>

<script setup lang="ts">
import TextButton from '@/components/button/TextButton.vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'subscribe'): void
}>()
</script>
