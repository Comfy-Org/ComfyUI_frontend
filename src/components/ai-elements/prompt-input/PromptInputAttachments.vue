<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Attachment from '@/components/ui/attachment/Attachment.vue'
import AttachmentAction from '@/components/ui/attachment/AttachmentAction.vue'
import AttachmentActions from '@/components/ui/attachment/AttachmentActions.vue'
import AttachmentContent from '@/components/ui/attachment/AttachmentContent.vue'
import AttachmentMedia from '@/components/ui/attachment/AttachmentMedia.vue'
import AttachmentTitle from '@/components/ui/attachment/AttachmentTitle.vue'
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
    <Attachment v-for="(file, i) in attachments" :key="i" size="xs">
      <AttachmentMedia>
        <img
          v-if="file.type.startsWith('image/')"
          :src="objectUrls[i]"
          :alt="file.name"
          class="size-full rounded-sm object-cover"
        />
        <i v-else :class="fileTypeIcon(file)" class="size-3.5" />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{{ file.name }}</AttachmentTitle>
      </AttachmentContent>
      <AttachmentActions>
        <Tooltip :delay-duration="500">
          <TooltipTrigger>
            <AttachmentAction
              :aria-label="t('g.remove')"
              @click="emit('remove', i)"
            >
              <i class="icon-[lucide--x]" />
            </AttachmentAction>
          </TooltipTrigger>
          <TooltipContent side="top">{{ t('g.remove') }}</TooltipContent>
        </Tooltip>
      </AttachmentActions>
    </Attachment>
  </div>
</template>
