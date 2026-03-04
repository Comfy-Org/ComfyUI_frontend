<template>
  <div class="flex gap-3">
    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-muted">
        {{ t('templateWorkflows.publish.before') }}
      </span>
      <div
        v-if="files[0]"
        class="group relative size-24 overflow-hidden rounded-lg border border-border-default"
      >
        <img :src="files[0]" class="size-full object-cover" />
        <button
          class="absolute top-1 right-1 rounded-full bg-base-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          @click="emit('remove', 0)"
        >
          <i class="icon-[lucide--x] size-3" />
        </button>
      </div>
      <div
        v-else-if="uploadingIndices.has(0)"
        class="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-border-default bg-base-background/80 text-xs text-muted"
      >
        <i class="icon-[lucide--loader-2] size-5 animate-spin" />
        {{ uploadingIndices.get(0) }}%
      </div>
      <button
        v-else
        class="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-default text-xs text-muted transition-colors hover:border-primary-background hover:text-foreground"
        @click="beforeInput?.click()"
      >
        <i class="icon-[lucide--plus] size-5" />
        {{ t('templateWorkflows.publish.addFile') }}
      </button>
      <input
        ref="beforeInput"
        type="file"
        class="hidden"
        accept="image/*"
        @change="onSelected(0)"
      />
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-xs font-medium text-muted">
        {{ t('templateWorkflows.publish.after') }}
      </span>
      <div
        v-if="files[1]"
        class="group relative size-24 overflow-hidden rounded-lg border border-border-default"
      >
        <img :src="files[1]" class="size-full object-cover" />
        <button
          class="absolute top-1 right-1 rounded-full bg-base-background/80 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
          @click="emit('remove', 1)"
        >
          <i class="icon-[lucide--x] size-3" />
        </button>
      </div>
      <div
        v-else-if="uploadingIndices.has(1)"
        class="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border border-border-default bg-base-background/80 text-xs text-muted"
      >
        <i class="icon-[lucide--loader-2] size-5 animate-spin" />
        {{ uploadingIndices.get(1) }}%
      </div>
      <button
        v-else
        class="flex size-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-default text-xs text-muted transition-colors hover:border-primary-background hover:text-foreground"
        @click="afterInput?.click()"
      >
        <i class="icon-[lucide--plus] size-5" />
        {{ t('templateWorkflows.publish.addFile') }}
      </button>
      <input
        ref="afterInput"
        type="file"
        class="hidden"
        accept="image/*"
        @change="onSelected(1)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const { uploadingIndices = new Map() } = defineProps<{
  files: string[]
  uploadingIndices?: Map<number, number>
}>()

const emit = defineEmits<{
  add: [file: File]
  remove: [index: number]
}>()

const beforeInput = ref<HTMLInputElement | null>(null)
const afterInput = ref<HTMLInputElement | null>(null)

function onSelected(slot: 0 | 1) {
  const input = slot === 0 ? beforeInput.value : afterInput.value
  const file = input?.files?.[0]
  if (file) {
    emit('add', file)
    input.value = ''
  }
}
</script>
