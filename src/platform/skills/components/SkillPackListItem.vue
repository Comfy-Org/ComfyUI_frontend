<template>
  <div
    class="bg-base-raised-surface group relative rounded-lg border border-border-default"
  >
    <Button
      variant="textonly"
      size="unset"
      class="flex w-full min-w-0 flex-col items-start gap-1 rounded-lg p-4 pr-24 text-left font-normal whitespace-normal hover:bg-transparent"
      :aria-label="pack.name"
      :aria-describedby="descriptionId"
      :disabled="disabled || loading"
      @click="emit('edit')"
    >
      <span class="w-full truncate font-medium text-base-foreground">
        {{ pack.name }}
      </span>
      <span :id="descriptionId" class="line-clamp-2 text-sm text-muted">
        {{ pack.description }}
      </span>
      <span class="text-xs text-muted">{{ sizeLabel }}</span>
    </Button>
    <div class="absolute top-4 right-4">
      <i
        v-if="loading"
        class="icon-[lucide--loader-circle] size-4 animate-spin text-muted"
      />
      <div
        v-else
        class="pointer-events-none flex items-center gap-2 opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 touch:pointer-events-auto touch:opacity-100"
      >
        <Button
          variant="muted-textonly"
          size="icon"
          :aria-label="editLabel"
          :disabled="disabled"
          @click="emit('edit')"
        >
          <i class="icon-[lucide--square-pen] size-4" />
        </Button>
        <Button
          variant="muted-textonly"
          size="icon"
          :aria-label="deleteLabel"
          :disabled="disabled"
          @click="emit('delete')"
        >
          <i class="icon-[lucide--trash-2] size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

import type { SkillPack } from '../types'
import { packByteSize } from '../types'

const {
  pack,
  loading = false,
  disabled = false
} = defineProps<{
  pack: SkillPack
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  edit: []
  delete: []
}>()

const { t } = useI18n()
const descriptionId = useId()

const sizeLabel = computed(() =>
  t('skillPacks.packSize', { bytes: packByteSize(pack) })
)
const editLabel = computed(() => t('g.edit'))
const deleteLabel = computed(() => t('g.delete'))
</script>
