<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

const { attachments } = defineProps<{
  attachments: File[]
}>()

const emit = defineEmits<{
  remove: [index: number]
}>()

const objectUrls = ref<string[]>([])

watch(
  () => attachments,
  (files) => {
    objectUrls.value.forEach(URL.revokeObjectURL)
    objectUrls.value = files.map((f) =>
      f.type.startsWith('image/') ? URL.createObjectURL(f) : ''
    )
  },
  { immediate: true }
)

onUnmounted(() => {
  objectUrls.value.forEach(URL.revokeObjectURL)
})
</script>

<template>
  <div v-if="attachments.length" class="flex flex-wrap gap-2 px-4 pt-3">
    <div v-for="(file, i) in attachments" :key="i" class="relative">
      <img
        v-if="file.type.startsWith('image/')"
        :src="objectUrls[i]"
        :alt="file.name"
        class="size-16 rounded-lg object-cover"
      />
      <div
        v-else
        class="flex h-16 w-36 items-center gap-2 rounded-lg border border-border-default bg-secondary-background-hover px-3"
      >
        <i class="icon-[lucide--file] size-5 shrink-0 text-muted-foreground" />
        <span class="truncate text-xs text-base-foreground">{{
          file.name
        }}</span>
      </div>
      <button
        type="button"
        class="absolute -top-1.5 -right-1.5 flex size-4 cursor-pointer items-center justify-center rounded-full border border-border-default bg-secondary-background text-muted-foreground hover:bg-secondary-background-hover hover:text-base-foreground"
        @click="emit('remove', i)"
      >
        <i class="icon-[lucide--x] size-2.5" />
      </button>
    </div>
  </div>
</template>
