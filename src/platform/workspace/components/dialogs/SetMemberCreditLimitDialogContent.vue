<template>
  <div
    class="flex w-lg max-w-full flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{
          $t('workspacePanel.members.creditLimitDialog.title', {
            name: memberName
          })
        }}
      </h2>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-1 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onClose"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <div class="flex flex-col gap-6 p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.members.creditLimitDialog.description') }}
      </p>
      <div class="flex flex-col gap-2">
        <div
          class="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover/30"
          @click="mode = 'limited'"
        >
          <input
            :id="`${modeGroupName}-limited`"
            v-model="mode"
            type="radio"
            :name="modeGroupName"
            value="limited"
            class="mt-0.5 size-4 appearance-none rounded-full border border-muted-background checked:border-3 checked:bg-white focus-visible:ring-2 focus-visible:ring-border-default focus-visible:outline-none"
          />
          <span class="flex flex-1 flex-col gap-2">
            <label :for="`${modeGroupName}-limited`" class="cursor-pointer">
              {{ $t('workspacePanel.members.creditLimitDialog.limitOption') }}
            </label>
            <span
              class="flex h-10 items-center gap-2 rounded-lg bg-secondary-background px-4"
            >
              <i class="icon-[lucide--coins] size-4 shrink-0 text-credit" />
              <input
                v-model="limitModel"
                inputmode="numeric"
                :aria-label="
                  $t('workspacePanel.members.creditLimitDialog.limitOption')
                "
                class="w-full border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none"
                @focus="mode = 'limited'"
              />
            </span>
          </span>
        </div>
        <div
          class="flex cursor-pointer items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground transition-colors hover:bg-secondary-background-hover/30"
          @click="mode = 'unlimited'"
        >
          <input
            :id="`${modeGroupName}-unlimited`"
            v-model="mode"
            type="radio"
            :name="modeGroupName"
            value="unlimited"
            class="size-4 appearance-none rounded-full border border-muted-background checked:border-3 checked:bg-white focus-visible:ring-2 focus-visible:ring-border-default focus-visible:outline-none"
          />
          <label :for="`${modeGroupName}-unlimited`" class="cursor-pointer">
            {{ $t('workspacePanel.members.creditLimitDialog.noLimit') }}
          </label>
        </div>
      </div>
      <p v-if="showWarning" class="m-0 flex gap-1 text-sm text-credit">
        <i class="mt-0.5 icon-[lucide--triangle-alert] size-4 shrink-0" />
        {{
          $t('workspacePanel.members.creditLimitDialog.warning', {
            credits: creditsUsed.toLocaleString()
          })
        }}
      </p>
      <p v-if="showError" class="m-0 text-sm text-destructive-background">
        {{ $t('workspacePanel.members.creditLimitDialog.invalidLimit') }}
      </p>
    </div>

    <div class="flex items-center justify-end gap-4 p-4">
      <Button variant="muted-textonly" @click="onClose">{{
        $t('g.cancel')
      }}</Button>
      <Button
        variant="secondary"
        size="lg"
        :disabled="!canUpdate"
        @click="onUpdate"
      >
        {{ $t('workspacePanel.members.creditLimitDialog.update') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { memberId, currentLimit, creditsUsed } = defineProps<{
  memberId: string
  memberName: string
  creditsUsed: number
  currentLimit: number | null
}>()

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const modeGroupName = useId()
const mode = ref<'limited' | 'unlimited'>(
  currentLimit ? 'limited' : 'unlimited'
)
const limitInput = ref(currentLimit?.toString() ?? '')
const limitModel = computed({
  get: () => {
    if (!limitInput.value) return ''
    const value = Number(limitInput.value)
    return Number.isSafeInteger(value)
      ? value.toLocaleString()
      : limitInput.value
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
