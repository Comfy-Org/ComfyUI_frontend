<template>
  <li class="flex flex-col gap-1 rounded-lg bg-secondary px-2.5 py-2 text-xs">
    <div class="flex items-center gap-2">
      <i
        class="icon-[lucide--package] text-muted-foreground"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 break-all text-foreground">{{
        model.name
      }}</span>
      <span class="shrink-0 text-muted-foreground">{{ model.folder }}</span>
      <span v-if="size !== undefined" class="shrink-0 text-muted-foreground">{{
        formatSize(size)
      }}</span>
      <i
        v-if="pick.status === 'stored'"
        class="icon-[lucide--check] text-foreground"
        :aria-label="$t('openOnCloud.missingModels.uploaded')"
      />
      <label
        v-else-if="choosable"
        class="shrink-0 cursor-pointer rounded-md px-2 py-1 text-foreground hover:bg-accent has-disabled:cursor-default has-disabled:opacity-50"
      >
        <i
          v-if="pick.status === 'chosen'"
          class="icon-[lucide--check] align-middle"
          :aria-label="$t('openOnCloud.missingModels.chosen')"
        />
        <template v-else>{{
          $t('openOnCloud.missingModels.chooseFile')
        }}</template>
        <input
          type="file"
          accept=".safetensors"
          class="sr-only"
          :disabled="locked"
          :data-testid="`choose-model-${model.name}`"
          @change="onChoose"
        />
      </label>
    </div>
    <p v-if="note" :class="cn('my-0', note.tone)">{{ note.text }}</p>
  </li>
</template>

<script setup lang="ts">
import { formatSize } from '@comfyorg/shared-frontend-utils/formatUtil'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  MissingModel,
  ModelPick,
  ModelUploadBlock
} from '@/platform/openOnCloud/stores/localModelUploadStore'

const { model, pick, size, choosable, blocked, locked } = defineProps<{
  model: MissingModel
  pick: ModelPick
  size?: number
  choosable: boolean
  blocked?: ModelUploadBlock
  locked: boolean
}>()

const emit = defineEmits<{ choose: [file: File] }>()

const { t } = useI18n()

const BLOCKED_COPY = {
  folder: 'openOnCloud.missingModels.folderUnsupported',
  subfolder: 'openOnCloud.missingModels.subfolderUnsupported',
  size: 'openOnCloud.missingModels.sizeUnavailable'
} as const satisfies Record<ModelUploadBlock, string>

const note = computed(() => {
  if (blocked)
    return { tone: 'text-muted-foreground', text: t(BLOCKED_COPY[blocked]) }
  if (pick.status === 'wrongFile')
    return {
      tone: 'text-destructive',
      text: t('openOnCloud.missingModels.wrongFile', { name: model.name })
    }
  return null
})

function onChoose(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('choose', file)
}
</script>
