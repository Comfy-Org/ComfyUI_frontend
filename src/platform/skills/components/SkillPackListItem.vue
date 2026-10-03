<template>
  <div
    class="bg-base-raised-surface flex items-start justify-between gap-4 rounded-lg border border-border-default p-4"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <span class="truncate font-medium text-base-foreground">
        {{ pack.name }}
      </span>
      <span class="line-clamp-2 text-sm text-muted">
        {{ pack.description }}
      </span>
      <span class="text-xs text-muted">{{ sizeLabel }}</span>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <i
        v-if="loading"
        class="icon-[lucide--loader-circle] size-4 animate-spin text-muted"
      />
      <template v-else>
        <Button
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="editLabel"
          :disabled="disabled"
          @click="emit('edit')"
        >
          <i class="icon-[lucide--square-pen] size-4" />
        </Button>
        <Button
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="deleteLabel"
          :disabled="disabled"
          @click="emit('delete')"
        >
          <i class="icon-[lucide--trash-2] size-4" />
        </Button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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

const sizeLabel = computed(() =>
  t('skillPacks.packSize', { bytes: packByteSize(pack) })
)
const editLabel = computed(() => t('g.edit'))
const deleteLabel = computed(() => t('g.delete'))
</script>
