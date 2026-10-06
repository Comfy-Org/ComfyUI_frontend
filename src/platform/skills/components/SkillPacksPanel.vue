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
      <Button @click="openCreateDialog">
        <i class="mr-1 icon-[lucide--plus] size-4" />
        {{ $t('skillPacks.addPack') }}
      </Button>
    </div>

    <div
      v-if="loading && !hasLoaded"
      class="flex items-center justify-center py-8"
    >
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
        :keyboard-navigation="keyboardNavigation"
        @edit="openEditDialog(pack)"
        @delete="confirmDelete(pack)"
      />
    </div>

    <SkillPackFormDialog v-model:visible="editorVisible" :pack="selectedPack" />
  </div>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

import { useSkillPacks } from '../composables/useSkillPacks'
import type { SkillPack } from '../types'
import SkillPackFormDialog from './SkillPackFormDialog.vue'
import SkillPackListItem from './SkillPackListItem.vue'

const { t } = useI18n()
const dialogStore = useDialogStore()

const {
  packs,
  loading,
  hasLoaded,
  operatingPackName,
  fetchSkillPacks,
  deleteSkillPack
} = useSkillPacks()

const editorVisible = ref(false)
const selectedPack = ref<SkillPack | undefined>()
const keyboardNavigation = ref(false)

useEventListener(
  'keydown',
  (event) => {
    if (event.key !== 'Escape') keyboardNavigation.value = true
  },
  { capture: true }
)
useEventListener(
  ['pointerdown', 'pointermove'],
  () => (keyboardNavigation.value = false),
  { capture: true, passive: true }
)

function openCreateDialog() {
  selectedPack.value = undefined
  editorVisible.value = true
}

function openEditDialog(pack: SkillPack) {
  selectedPack.value = pack
  editorVisible.value = true
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
