<script setup lang="ts">
const {
  name,
  previewUrl,
  uploading = false
} = defineProps<{
  name: string
  previewUrl?: string
  uploading?: boolean
}>()
const emit = defineEmits<{ remove: [] }>()
</script>

<template>
  <span
    class="rounded-agent bg-agent-pill text-agent-fg inline-flex items-center gap-1.5 py-1 pr-2 pl-1 text-xs"
  >
    <span
      v-if="uploading"
      :aria-label="$t('agent.uploading')"
      class="text-agent-fg-subtle icon-[lucide--loader-circle] size-4 animate-spin"
    />
    <img
      v-else-if="previewUrl"
      :src="previewUrl"
      :alt="name"
      class="size-5 rounded-sm object-cover"
    />
    <span v-else class="text-agent-fg-subtle icon-[lucide--paperclip] size-4" />
    <span class="max-w-32 truncate">{{ name }}</span>
    <button
      type="button"
      :aria-label="$t('agent.remove')"
      class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg -my-1 -mr-1 flex size-5 cursor-pointer items-center justify-center rounded-full transition-colors"
      @click="emit('remove')"
    >
      <span class="icon-[lucide--x] size-3.5" />
    </button>
  </span>
</template>
