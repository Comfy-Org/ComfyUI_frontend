<script setup lang="ts">
import { computed, nextTick, onMounted, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import {
  SKILL_CATALOG_STATUS_LABELS,
  useSkillCatalogStatus
} from '@/platform/skills/composables/useSkillCatalogStatus'
import { useSkillPacks } from '@/platform/skills/composables/useSkillPacks'
import { useSkillDraftStore } from '@/platform/skills/stores/skillDraftStore'
import type { SkillDraftTarget } from '@/platform/skills/stores/skillDraftStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import { useDialogStore } from '@/stores/dialogStore'

import AgentSkillDraftRow from './AgentSkillDraftRow.vue'
import AgentSkillRow from './AgentSkillRow.vue'

const { initialFocus } = defineProps<{
  initialFocus?: 'add' | { pack: string }
}>()

const emit = defineEmits<{
  back: []
  add: []
  edit: [pack: SkillPack]
}>()

const { t } = useI18n()
const skills = useSkillPacksStore()
const drafts = useSkillDraftStore()
const dialogStore = useDialogStore()
const { operatingPackName, deleteSkillPack } = useSkillPacks()
const status = useSkillCatalogStatus()
const backButtonId = useId()
const addButtonId = useId()
const draftButtonId = useId()
const rowButtonIdPrefix = useId()

const canAdd = computed(() => skills.enabled && skills.catalogConfirmed)

const newDraftTitle = computed(
  () => drafts.newSkillDraft?.name.trim() || t('agent.untitledSkill')
)

function rowButtonId(name: string): string {
  return `${rowButtonIdPrefix}-${name}`
}

function initialFocusId(): string {
  if (initialFocus === 'add') return addButtonId
  if (initialFocus) return rowButtonId(initialFocus.pack)
  return backButtonId
}

async function removeSkill(pack: SkillPack): Promise<void> {
  const scope = skills.scope
  await deleteSkillPack(pack)
  await nextTick()
  const removed = !skills.packs.some((existing) => existing.name === pack.name)
  if (removed) drafts.setDraft(scope, { kind: 'edit', name: pack.name }, null)
  document
    .getElementById(removed ? addButtonId : rowButtonId(pack.name))
    ?.focus()
}

function confirmDelete(pack: SkillPack): void {
  const dialog = showConfirmDialog({
    headerProps: { title: t('agent.deleteSkillTitle') },
    props: { promptText: t('agent.deleteSkillMessage', { name: pack.name }) },
    footerProps: {
      cancelText: t('g.cancel'),
      confirmText: t('g.delete'),
      confirmVariant: 'destructive',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        dialogStore.closeDialog(dialog)
        await removeSkill(pack)
      }
    }
  })
}

function confirmDiscardDraft(target: SkillDraftTarget): void {
  const scope = skills.scope
  const dialog = showConfirmDialog({
    headerProps: { title: t('agent.discardDraftTitle') },
    props: { promptText: t('agent.discardDraftMessage') },
    footerProps: {
      cancelText: t('g.cancel'),
      confirmText: t('agent.discardDraft'),
      confirmVariant: 'destructive',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        dialogStore.closeDialog(dialog)
        drafts.setDraft(scope, target, null)
        await nextTick()
        document
          .getElementById(
            target.kind === 'new' ? addButtonId : rowButtonId(target.name)
          )
          ?.focus()
      }
    }
  })
}

void skills.refreshPacks()

onMounted(async () => {
  await nextTick()
  document.getElementById(initialFocusId())?.focus()
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex h-10 shrink-0 items-center gap-1 px-2">
      <Button
        :id="backButtonId"
        :tooltip="t('agent.backToChat')"
        tooltip-side="bottom"
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.backToChat')"
        class="size-6 shrink-0"
        @click="emit('back')"
      >
        <i aria-hidden="true" class="icon-[lucide--chevron-left]" />
      </Button>
      <h2 class="m-0 flex-1 text-xs font-normal text-muted-foreground">
        {{ t('agent.skills') }}
      </h2>
      <Button
        v-if="skills.enabled"
        :id="addButtonId"
        type="button"
        variant="secondary"
        size="sm"
        :aria-label="t('agent.addSkill')"
        :disabled="!canAdd"
        @click="emit('add')"
      >
        <i aria-hidden="true" class="icon-[lucide--plus]" />
        {{ t('g.add') }}
      </Button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <ul
        v-if="skills.enabled && drafts.newSkillDraft"
        :aria-label="t('agent.skillDrafts')"
        class="m-0 flex list-none flex-col p-0"
      >
        <AgentSkillDraftRow
          :title="newDraftTitle"
          :button-id="draftButtonId"
          :disabled="!canAdd"
          @open="emit('add')"
          @discard="confirmDiscardDraft({ kind: 'new' })"
        />
      </ul>
      <p
        v-if="!skills.enabled"
        class="m-0 px-2 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t('agent.skillsUnavailable') }}
      </p>
      <p
        v-else-if="status === 'loading'"
        role="status"
        class="m-0 px-2 py-8 text-center text-sm text-muted-foreground"
      >
        {{ t(SKILL_CATALOG_STATUS_LABELS.loading) }}
      </p>
      <div
        v-else-if="status === 'failed'"
        class="flex flex-col items-center gap-3 px-2 py-8"
      >
        <p role="alert" class="m-0 text-center text-sm text-muted-foreground">
          {{ t(SKILL_CATALOG_STATUS_LABELS.failed) }}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          @click="skills.ensurePacks()"
        >
          {{ t('g.retry') }}
        </Button>
      </div>
      <div
        v-else-if="status === 'empty'"
        class="flex flex-col items-center gap-3 px-2 py-8 text-center"
      >
        <div class="flex flex-col gap-1">
          <p class="m-0 text-sm text-foreground">
            {{ t(SKILL_CATALOG_STATUS_LABELS.empty) }}
          </p>
          <p class="m-0 text-xs text-muted-foreground">
            {{ t('agent.noSkillsHint') }}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          :aria-label="t('agent.addSkill')"
          @click="emit('add')"
        >
          <i aria-hidden="true" class="icon-[lucide--plus]" />
          {{ t('g.add') }}
        </Button>
      </div>
      <ul
        v-else
        :aria-label="t('agent.skills')"
        class="m-0 flex list-none flex-col p-0"
      >
        <AgentSkillRow
          v-for="pack in skills.packs"
          :key="pack.name"
          :pack
          :button-id="rowButtonId(pack.name)"
          :busy="operatingPackName === pack.name"
          :disabled="operatingPackName !== null"
          :has-draft="drafts.editDraftFor(pack.name) !== undefined"
          @edit="emit('edit', pack)"
          @delete="confirmDelete(pack)"
          @discard-draft="
            confirmDiscardDraft({ kind: 'edit', name: pack.name })
          "
        />
      </ul>
    </div>
  </div>
</template>
