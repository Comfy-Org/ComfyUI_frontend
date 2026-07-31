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
    class="text-agent-fg inline-flex h-7 items-center gap-1 rounded-lg border border-white/15 bg-white/4.5 px-2.5 text-xs/4 font-medium"
  >
    <span
      v-if="uploading"
      :aria-label="$t('agent.uploading')"
      class="text-agent-fg-subtle icon-[lucide--loader-circle] size-3.5 animate-spin"
    />
    <img
      v-else-if="previewUrl"
      :src="previewUrl"
      :alt="name"
      class="size-3.5 shrink-0 rounded-sm object-cover"
    />
    <span v-else class="icon-[lucide--image] size-3.5 shrink-0" />
    <span class="max-w-32 truncate">{{ name }}</span>
    <button
      type="button"
      :aria-label="$t('agent.remove')"
      class="text-agent-fg-muted hover:text-agent-fg flex size-3.5 cursor-pointer items-center justify-center transition-colors"
      @click="emit('remove')"
    >
      <span class="icon-[lucide--x] size-3.5" />
    </button>
  </span>
</template>
