<template>
  <div class="flex flex-wrap justify-end gap-2 w-full">
    <a
      href="https://blog.comfy.org/p/comfy-cloud-new-features-and-pricing"
      target="_blank"
      rel="noopener noreferrer"
      class="text-muted-foreground mr-auto underline flex items-center gap-2"
    >
      <i class="icon-[lucide--external-link]" />
      <span>{{ $t('g.learnMore') }}</span>
    </a>
    <TextButton
      :label="$t('g.close')"
      type="transparent"
      size="md"
      @click="emit('close')"
    />
    <TextButton
      :label="$t('subscription.required.subscribe')"
      type="secondary"
      size="md"
      @click="emit('subscribe')"
    />
  </div>
</template>

<script setup lang="ts">
import TextButton from '@/components/button/TextButton.vue'

const emit = defineEmits<{
  close: []
  subscribe: []
}>()
</script>
