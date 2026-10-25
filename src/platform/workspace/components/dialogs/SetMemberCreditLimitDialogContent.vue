<template>
  <AppDialogPanel body-class="flex flex-col gap-6 text-sm" @close="onClose">
    <template #title>
      {{
        $t('workspacePanel.members.creditLimitDialog.title', {
          name: memberName
        })
      }}
    </template>

    <p class="m-0 text-muted-foreground">
      {{ $t('workspacePanel.members.creditLimitDialog.description') }}
    </p>
    <div class="flex cursor-pointer flex-col gap-2 text-muted-foreground">
      <div
        class="flex items-start gap-2 rounded-lg p-2 transition-colors hover:bg-accent/30"
        @click="mode = 'limited'"
      >
        <input
          :id="`${modeGroupName}-limited`"
          v-model="mode"
          type="radio"
          :name="modeGroupName"
          value="limited"
          class="mt-0.5 size-4 appearance-none rounded-full border border-muted checked:border-3 checked:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <span class="flex flex-1 flex-col gap-2">
          <label :for="`${modeGroupName}-limited`">
            {{ $t('workspacePanel.members.creditLimitDialog.limitOption') }}
          </label>
          <span
            class="flex h-10 items-center gap-2 rounded-lg bg-secondary px-4"
          >
            <i class="icon-[lucide--coins] shrink-0 text-credit" />
            <input
              v-model="limitModel"
              inputmode="numeric"
              :aria-label="
                $t('workspacePanel.members.creditLimitDialog.limitOption')
              "
              class="w-full border-none bg-transparent text-foreground tabular-nums outline-none"
              @focus="mode = 'limited'"
            />
          </span>
        </span>
      </div>
      <div
        class="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-accent/30"
        @click="mode = 'unlimited'"
      >
        <input
          :id="`${modeGroupName}-unlimited`"
          v-model="mode"
          type="radio"
          :name="modeGroupName"
          value="unlimited"
          class="size-4 appearance-none rounded-full border border-muted checked:border-3 checked:bg-white focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <label :for="`${modeGroupName}-unlimited`">
          {{ $t('workspacePanel.members.creditLimitDialog.noLimit') }}
        </label>
      </div>
    </div>
    <p v-if="showWarning" class="m-0 flex gap-1 text-credit">
      <i class="mt-0.5 icon-[lucide--triangle-alert] shrink-0" />
      {{
        $t('workspacePanel.members.creditLimitDialog.warning', {
          credits: $n(creditsUsed ?? 0)
        })
      }}
    </p>
    <p v-if="showError" class="m-0 text-destructive">
      {{ $t('workspacePanel.members.creditLimitDialog.invalidLimit') }}
    </p>

    <template #footer>
      <Button variant="muted-textonly" @click="onClose">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        :disabled="!canUpdate"
        @click="onUpdate"
      >
        {{ $t('workspacePanel.members.creditLimitDialog.update') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { memberId, currentLimit, creditsUsed } = defineProps<{
  memberId: string
  memberName: string
  creditsUsed?: number
  currentLimit?: number | null
}>()

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const { n } = useI18n()
const modeGroupName = useId()
const mode = ref<'limited' | 'unlimited'>(
  currentLimit !== null && currentLimit !== undefined ? 'limited' : 'unlimited'
)
const limitInput = ref(currentLimit?.toString() ?? '')
const limitModel = computed({
  get: () => {
    if (!limitInput.value) return ''
    const value = Number(limitInput.value)
    return Number.isSafeInteger(value) ? n(value) : limitInput.value
  },
  set: (value: string) => {
    limitInput.value = value.replace(/[^0-9]/g, '')
  }
})
const parsedLimit = computed(() => Number(limitInput.value))
const hasValidLimit = computed(
  () => Number.isSafeInteger(parsedLimit.value) && parsedLimit.value > 0
)
const canUpdate = computed(
  () => mode.value === 'unlimited' || hasValidLimit.value
)
const showError = computed(
  () =>
    mode.value === 'limited' &&
    limitInput.value.length > 0 &&
    !hasValidLimit.value
)
const showWarning = computed(
  () =>
    mode.value === 'limited' &&
    creditsUsed !== undefined &&
    hasValidLimit.value &&
    parsedLimit.value <= creditsUsed
)

function onClose() {
  dialogStore.closeDialog({ key: 'set-member-credit-limit' })
}

function onUpdate() {
  if (!canUpdate.value) return
  workspaceStore.setMemberCreditLimit(
    memberId,
    mode.value === 'limited' ? parsedLimit.value : null
  )
  onClose()
}
</script>
