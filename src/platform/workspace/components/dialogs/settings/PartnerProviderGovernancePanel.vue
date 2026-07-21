<template>
  <div class="grow overflow-auto pt-6">
    <div
      class="flex min-h-full flex-col gap-5 rounded-2xl border border-interface-stroke p-6"
    >
      <div class="flex items-start gap-6">
        <div class="min-w-0 flex-1">
          <h2 class="m-0 text-base font-semibold text-base-foreground">
            {{ $t('workspacePanel.providerGovernance.title') }}
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted-foreground">
            {{ $t('workspacePanel.providerGovernance.description') }}
          </p>
        </div>
        <SearchInput
          v-if="status === 'configured'"
          v-model="searchQuery"
          :placeholder="
            $t('workspacePanel.providerGovernance.searchPlaceholder')
          "
          size="lg"
          class="w-64 shrink-0"
          :disabled="isSaving"
        />
      </div>

      <div
        v-if="status === 'loading'"
        role="status"
        class="flex min-h-48 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <i class="icon-[lucide--loader-circle] size-4 animate-spin" />
        {{ $t('workspacePanel.providerGovernance.loading') }}
      </div>

      <div
        v-else-if="status === 'error' || status === 'unavailable'"
        role="alert"
        class="flex min-h-48 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <span>{{ $t('workspacePanel.providerGovernance.loadError') }}</span>
        <Button variant="muted-textonly" @click="loadPolicy">
          {{ $t('workspacePanel.providerGovernance.retry') }}
        </Button>
      </div>

      <div
        v-else-if="status === 'unconfigured'"
        class="flex min-h-56 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-interface-stroke/60 px-8 text-center"
      >
        <div class="max-w-lg">
          <h3 class="m-0 text-base font-semibold text-base-foreground">
            {{ $t('workspacePanel.providerGovernance.setup.title') }}
          </h3>
          <p class="mt-2 mb-0 text-sm text-muted-foreground">
            {{ $t('workspacePanel.providerGovernance.setup.description') }}
          </p>
        </div>
        <span v-if="saveError" role="alert" class="text-destructive text-sm">
          {{ $t('workspacePanel.providerGovernance.saveError') }}
        </span>
        <Button
          variant="primary"
          size="lg"
          :loading="isSaving"
          @click="enableGovernance"
        >
          {{ $t('workspacePanel.providerGovernance.setup.action') }}
        </Button>
      </div>

      <template v-else-if="status === 'configured'">
        <div
          class="flex min-h-16 items-center gap-4 rounded-xl border border-interface-stroke/60 px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-base-foreground">
              {{ $t('workspacePanel.providerGovernance.enforcement.title') }}
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">
              {{ enforcementDescription }}
            </div>
          </div>
          <ProviderPolicySwitch
            :model-value="draftEnforcementEnabled"
            :disabled="isSaving"
            :label="$t('workspacePanel.providerGovernance.enforcement.toggle')"
            @update:model-value="confirmEnforcementChange"
          />
        </div>

        <div
          v-if="draftEnforcementEnabled"
          class="rounded-xl bg-warning-background/20 px-4 py-3 text-xs text-base-foreground"
        >
          {{ $t('workspacePanel.providerGovernance.newProviderDefault') }}
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="m-0 text-xs text-muted-foreground">
            {{
              $t('workspacePanel.providerGovernance.propagation', {
                minutes: propagationMinutes
              })
            }}
          </p>
          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              :disabled="isSaving"
              @click="setAllProviders(true)"
            >
              {{ $t('workspacePanel.providerGovernance.allowAll') }}
            </Button>
            <Button
              variant="secondary"
              :disabled="isSaving"
              @click="setAllProviders(false)"
            >
              {{ $t('workspacePanel.providerGovernance.blockAll') }}
            </Button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <div
            v-if="visibleProviders.length === 0"
            class="flex min-h-32 items-center justify-center text-sm text-muted-foreground"
          >
            {{
              searchQuery
                ? $t('workspacePanel.providerGovernance.noMatches')
                : $t('workspacePanel.providerGovernance.empty')
            }}
          </div>

          <div
            v-else
            class="overflow-hidden rounded-xl border border-interface-stroke/60"
          >
            <div
              v-for="provider in visibleProviders"
              :key="provider.id"
              class="flex min-h-16 items-center gap-4 border-b border-interface-stroke/40 px-4 last:border-b-0"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm text-base-foreground">
                  {{ provider.displayName }}
                </div>
                <div class="truncate text-xs text-muted-foreground">
                  {{ provider.nodeCategories.join(', ') }}
                </div>
              </div>
              <ProviderPolicySwitch
                :model-value="draftProviders[provider.id] === true"
                :disabled="isSaving"
                :label="
                  $t('workspacePanel.providerGovernance.providerToggle', {
                    name: provider.displayName
                  })
                "
                @update:model-value="
                  (enabled: boolean) => setProviderEnabled(provider.id, enabled)
                "
              />
            </div>
          </div>
        </div>

        <div class="flex min-h-10 items-center justify-end gap-3">
          <span v-if="saveError" role="alert" class="text-destructive text-sm">
            {{ $t('workspacePanel.providerGovernance.saveError') }}
          </span>
          <Button
            variant="primary"
            size="lg"
            :disabled="!hasChanges"
            :loading="isSaving"
            @click="save"
          >
            {{ $t('g.save') }}
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import type { PartnerProviderPolicy } from '@/platform/workspace/api/partnerNodePolicyApi'
import ProviderPolicySwitch from '@/platform/workspace/components/dialogs/settings/ProviderPolicySwitch.vue'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useDialogStore } from '@/stores/dialogStore'

const { t } = useI18n()
const governanceStore = usePartnerNodeGovernanceStore()
const { governedWorkspaceId, policy, providers, status } =
  storeToRefs(governanceStore)
const toastStore = useToastStore()
const dialogStore = useDialogStore()

const searchQuery = ref('')
const draftProviders = ref<Record<string, boolean>>({})
const draftEnforcementEnabled = ref(false)
const isSaving = ref(false)
const saveError = ref(false)
let saveGeneration = 0

const propagationMinutes = computed(() =>
  Math.max(
    1,
    Math.ceil(
      api.getServerFeature<number>(
        'partner_node_governance_propagation_seconds',
        1200
      ) / 60
    )
  )
)

const enforcementDescription = computed(() =>
  draftEnforcementEnabled.value
    ? t('workspacePanel.providerGovernance.enforcement.restricted')
    : t('workspacePanel.providerGovernance.enforcement.unrestricted')
)

function originalProviderValue(providerId: string): boolean {
  return policy.value ? governanceStore.isProviderEnabled(providerId) : true
}

function resetDraft(): void {
  draftEnforcementEnabled.value = policy.value?.enforcementEnabled ?? false
  draftProviders.value = Object.fromEntries(
    providers.value.map((provider) => [
      provider.id,
      originalProviderValue(provider.id)
    ])
  )
  saveError.value = false
}

watch([governedWorkspaceId, policy, providers], resetDraft, { immediate: true })

watch(
  governedWorkspaceId,
  () => {
    saveGeneration += 1
    isSaving.value = false
  },
  { flush: 'sync' }
)

const hasChanges = computed(
  () =>
    !!policy.value &&
    (draftEnforcementEnabled.value !== policy.value.enforcementEnabled ||
      providers.value.some(
        (provider) =>
          draftProviders.value[provider.id] !==
          originalProviderValue(provider.id)
      ))
)

const visibleProviders = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  return providers.value
    .filter((provider) => provider.nodeCategories.length > 0)
    .filter(
      (provider) =>
        !query ||
        [provider.id, provider.displayName, ...provider.nodeCategories].some(
          (value) => value.toLocaleLowerCase().includes(query)
        )
    )
    .toSorted((left, right) =>
      left.displayName.localeCompare(right.displayName)
    )
})

function setProviderEnabled(providerId: string, enabled: boolean): void {
  draftProviders.value[providerId] = enabled
  saveError.value = false
}

function setAllProviders(enabled: boolean): void {
  draftProviders.value = Object.fromEntries(
    providers.value.map((provider) => [provider.id, enabled])
  )
  saveError.value = false
}

function confirmEnforcementChange(enabled: boolean): void {
  if (enabled === draftEnforcementEnabled.value) return

  const dialog = showConfirmDialog({
    headerProps: {
      title: t(
        enabled
          ? 'workspacePanel.providerGovernance.confirmRestrict.title'
          : 'workspacePanel.providerGovernance.confirmUnrestrict.title'
      )
    },
    props: {
      promptText: t(
        enabled
          ? 'workspacePanel.providerGovernance.confirmRestrict.description'
          : 'workspacePanel.providerGovernance.confirmUnrestrict.description'
      )
    },
    footerProps: {
      confirmText: t(
        enabled
          ? 'workspacePanel.providerGovernance.confirmRestrict.action'
          : 'workspacePanel.providerGovernance.confirmUnrestrict.action'
      ),
      confirmVariant: 'primary',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: () => {
        draftEnforcementEnabled.value = enabled
        saveError.value = false
        dialogStore.closeDialog(dialog)
      }
    }
  })
}

function buildDraftPolicy(): PartnerProviderPolicy {
  return {
    enforcementEnabled: draftEnforcementEnabled.value,
    providers: providers.value.map((provider) => ({
      providerId: provider.id,
      enabled:
        draftProviders.value[provider.id] ?? originalProviderValue(provider.id)
    }))
  }
}

async function persistPolicy(
  nextPolicy: PartnerProviderPolicy = buildDraftPolicy()
): Promise<void> {
  const generation = saveGeneration
  isSaving.value = true
  saveError.value = false
  try {
    const applied = await governanceStore.savePolicy(nextPolicy)
    if (!applied || generation !== saveGeneration) return
    toastStore.add({
      severity: 'success',
      summary: t('workspacePanel.providerGovernance.saved'),
      life: 2000
    })
  } catch {
    if (generation !== saveGeneration) return
    saveError.value = true
  } finally {
    if (generation === saveGeneration) isSaving.value = false
  }
}

async function enableGovernance(): Promise<void> {
  await persistPolicy(governanceStore.createInitialPolicy())
}

async function save(): Promise<void> {
  if (!hasChanges.value || isSaving.value) return
  await persistPolicy()
}

function loadPolicy(): void {
  void governanceStore.loadPolicy()
}
</script>
