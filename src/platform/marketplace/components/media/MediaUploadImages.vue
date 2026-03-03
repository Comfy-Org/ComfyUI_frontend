<template>
  <div class="flex flex-wrap gap-3">
    <div
      v-for="(url, index) in files"
      :key="url"
      class="group relative size-24 overflow-hidden rounded-lg border border-border-default"
    >
      <img :src="url" class="size-full object-cover" />
      <button
        class="absolute top-1 right-1 rounded-full bg-base-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
        @click="emit('remove', index)"
      >
        <i class="icon-[lucide--x] size-3" />
      </button>
    </div>

    <button
      v-if="files.length < 6"
      class="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-default text-xs text-muted transition-colors hover:border-primary-background hover:text-foreground"
      @click="fileInput?.click()"
    >
      <i class="icon-[lucide--plus] size-5" />
      {{ t('templateWorkflows.publish.addFile') }}
    </button>

    <input
      ref="fileInput"
      type="file"
      class="hidden"
      accept="image/*"
      @change="onFileSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  files: string[]
}>()

const emit = defineEmits<{
  add: [file: File]
  remove: [index: number]
}>()

const fileInput = ref<HTMLInputElement | null>(null)

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('add', file)
    input.value = ''
  }
}
</script>
