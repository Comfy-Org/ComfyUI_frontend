<template>
  <div class="flex h-full flex-col">
    <div>
      <h2 class="text-2xl font-bold">{{ $t('skillPacks.title') }}</h2>
      <p class="mt-1 text-sm text-muted">
        {{ $t('skillPacks.panelDescription') }}
      </p>
    </div>

    <div class="my-4 border-t border-border-default" />

    <div class="my-4 flex items-center justify-between">
      <h3 class="my-0 text-lg font-semibold">
        {{ $t('skillPacks.yourPacks') }}
      </h3>
      <Button :disabled="atPackLimit || atByteLimit" @click="openCreateDialog">
        <i class="mr-1 icon-[lucide--plus] size-4" />
        {{ $t('skillPacks.addPack') }}
      </Button>
    </div>

    <p
      v-if="atPackLimit || atByteLimit"
      data-testid="skill-packs-at-limit"
      class="mb-4 text-sm text-muted"
    >
      {{ atLimitMessage }}
    </p>

    <div v-if="loading" class="flex items-center justify-center py-8">
      <i class="icon-[lucide--loader-circle] size-8 animate-spin text-muted" />
    </div>

    <div
      v-else-if="packs.length === 0"
      class="py-4 text-center text-sm text-muted"
    >
      {{ $t('skillPacks.noPacks') }}
    </div>

    <div v-else class="flex flex-col gap-3">
      <SkillPackListItem
        v-for="pack in packs"
        :key="pack.id"
        :pack="pack"
        :loading="operatingPackName === pack.name"
        :disabled="operatingPackName !== null"
        @edit="openEditDialog(pack)"
        @delete="confirmDelete(pack)"
      />
    </div>

    <SkillPackFormDialog
      v-model:visible="createDialogVisible"
      @saved="fetchSkillPacks"
    />

    <SkillPackFormDialog
      v-model:visible="editDialogVisible"
      :pack="selectedPack"
      @saved="fetchSkillPacks"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

import { useSkillPacks } from '../composables/useSkillPacks'
import type { SkillPack } from '../types'
import { MAX_PACK_COUNT, MAX_TOTAL_BYTES } from '../types'
import SkillPackFormDialog from './SkillPackFormDialog.vue'
import SkillPackListItem from './SkillPackListItem.vue'

const { t } = useI18n()
const dialogStore = useDialogStore()

const {
  packs,
  loading,
  atPackLimit,
  atByteLimit,
  operatingPackName,
  fetchSkillPacks,
  deleteSkillPack
} = useSkillPacks()

const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const selectedPack = ref<SkillPack | undefined>()

const atLimitMessage = computed(() =>
  atPackLimit.value
    ? t('skillPacks.errors.tooManyPacks', { max: MAX_PACK_COUNT })
    : t('skillPacks.errors.totalAtLimit', { max: MAX_TOTAL_BYTES })
)

function openCreateDialog() {
  createDialogVisible.value = true
}

/**
 * The list response carries the full `body` on every row, so the editor opens
 * straight from it — there is no fetch-one endpoint and none is needed.
 */
function openEditDialog(pack: SkillPack) {
  selectedPack.value = pack
  editDialogVisible.value = true
}

function confirmDelete(pack: SkillPack) {
  const dialog = showConfirmDialog({
    headerProps: { title: t('skillPacks.deleteConfirmTitle') },
    props: {
      promptText: t('skillPacks.deleteConfirmMessage', { name: pack.name })
    },
    footerProps: {
      confirmText: t('g.delete'),
      confirmVariant: 'destructive',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        dialogStore.closeDialog(dialog)
        await deleteSkillPack(pack)
      }
    }
  })
}

void fetchSkillPacks()
</script>
