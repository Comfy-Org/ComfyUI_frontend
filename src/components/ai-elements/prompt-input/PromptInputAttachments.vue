<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'

const { attachments } = defineProps<{
  attachments: File[]
}>()

const emit = defineEmits<{
  remove: [index: number]
}>()

const { t } = useI18n()

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

function fileTypeIcon(file: File): string {
  if (file.type.startsWith('audio/')) return 'icon-[lucide--music]'
  if (file.type.startsWith('video/')) return 'icon-[lucide--video]'
  if (file.type === 'application/pdf') return 'icon-[lucide--file-text]'
  if (file.type.startsWith('text/')) return 'icon-[lucide--file-text]'
  return 'icon-[lucide--paperclip]'
}
</script>

<template>
  <div v-if="attachments.length" class="flex flex-wrap gap-1.5 px-4 pt-3">
    <div
      v-for="(file, i) in attachments"
      :key="i"
      :class="
        cn(
          'flex h-8 items-center gap-1.5 rounded-md border border-border-default select-none',
          'bg-secondary-background px-1.5 text-sm font-medium transition-colors'
        )
      "
    >
      <div class="size-5 shrink-0 overflow-hidden rounded-sm">
        <img
          v-if="file.type.startsWith('image/')"
          :src="objectUrls[i]"
          :alt="file.name"
          class="size-full object-cover"
        />
        <div
          v-else
          class="flex size-full items-center justify-center bg-secondary-background-hover"
        >
          <i :class="fileTypeIcon(file)" class="size-3 text-muted-foreground" />
        </div>
      </div>

      <span class="max-w-36 truncate text-xs text-base-foreground">{{
        file.name
      }}</span>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            size="icon-sm"
            variant="muted-textonly"
            class="size-4 shrink-0"
            :aria-label="t('g.remove')"
            @click="emit('remove', i)"
          >
            <i class="icon-[lucide--x] size-2.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{{ t('g.remove') }}</TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>
