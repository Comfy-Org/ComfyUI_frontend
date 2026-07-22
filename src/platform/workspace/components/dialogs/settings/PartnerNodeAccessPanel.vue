<template>
  <section
    v-if="status !== 'ineligible' && status !== 'inactive'"
    class="flex min-h-0 grow flex-col gap-6 overflow-auto pt-6"
    aria-labelledby="partner-node-access-title"
  >
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="max-w-2xl">
        <h2
          id="partner-node-access-title"
          class="text-xl font-semibold text-base-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.title') }}
        </h2>
        <p v-if="isPolicyLoaded" class="mt-1 text-sm text-muted-foreground">
          {{
            $t(
              isRestricted
                ? 'workspacePanel.partnerNodes.restrictedDescription'
                : 'workspacePanel.partnerNodes.unrestrictedDescription'
            )
          }}
        </p>
      </div>
      <span
        v-if="isPolicyLoaded"
        class="rounded-lg bg-secondary-background px-3 py-2 text-sm font-medium text-base-foreground"
      >
        {{
          $t(
            isRestricted
              ? 'workspacePanel.partnerNodes.restricted'
              : 'workspacePanel.partnerNodes.unrestricted'
          )
        }}
      </span>
    </div>

    <div
      v-if="status === 'loading'"
      :aria-label="$t('workspacePanel.partnerNodes.loading')"
      class="space-y-3"
    >
      <Skeleton class="h-10 w-full" />
      <Skeleton v-for="index in 5" :key="index" class="h-12 w-full" />
    </div>

    <div
      v-else-if="status === 'error'"
      role="alert"
      class="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-interface-stroke p-6 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ $t('workspacePanel.partnerNodes.loadError') }}
      </p>
      <Button variant="secondary" @click="loadPolicy">
        {{ $t('workspacePanel.partnerNodes.retry') }}
      </Button>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <label class="w-full max-w-80">
          <span class="sr-only">
            {{ $t('workspacePanel.partnerNodes.searchPlaceholder') }}
          </span>
          <SearchInput
            v-model="searchQuery"
            :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
            size="lg"
            class="w-full"
          />
        </label>
        <div class="flex items-center gap-2">
          <Button
            variant="secondary"
            :loading="pendingBulkAction === 'enable'"
            :disabled="isSaving"
            @click="handleEnableAll"
          >
            {{ $t('workspacePanel.partnerNodes.enableAll') }}
          </Button>
          <Button
            variant="secondary"
            :disabled="isSaving"
            @click="confirmDisableAll"
          >
            {{ $t('workspacePanel.partnerNodes.disableAll') }}
          </Button>
        </div>
      </div>

      <p
        v-if="saveError"
        role="alert"
        class="rounded-lg bg-destructive-background/10 px-4 py-3 text-sm text-destructive-background"
      >
        {{ $t('workspacePanel.partnerNodes.saveError') }}
      </p>

      <div
        role="table"
        :aria-label="$t('workspacePanel.partnerNodes.tableLabel')"
        class="min-h-0 overflow-auto rounded-2xl border border-interface-stroke"
      >
        <div
          role="row"
          class="grid grid-cols-[minmax(0,1fr)_8rem_7rem] items-center border-b border-interface-stroke px-4 py-3 text-xs font-medium text-muted-foreground"
        >
          <span role="columnheader">
            {{ $t('workspacePanel.partnerNodes.columns.provider') }}
          </span>
          <span role="columnheader">
            {{ $t('workspacePanel.partnerNodes.columns.nodes') }}
          </span>
          <span role="columnheader">
            {{ $t('workspacePanel.partnerNodes.columns.enabled') }}
          </span>
        </div>

        <template v-for="provider in filteredProviders" :key="provider.id">
          <div
            role="row"
            class="grid grid-cols-[minmax(0,1fr)_8rem_7rem] items-center border-b border-interface-stroke px-4 py-2 last:border-b-0"
          >
            <div role="cell" class="min-w-0">
              <Button
                variant="textonly"
                size="unset"
                class="w-full justify-start p-2 text-left"
                :aria-expanded="isProviderExpanded(provider.id)"
                @click="toggleExpanded(provider.id)"
              >
                <i
                  :class="
                    cn(
                      'size-4 shrink-0 transition-transform',
                      isProviderExpanded(provider.id) && 'rotate-90',
                      'icon-[lucide--chevron-right]'
                    )
                  "
                />
                <span class="truncate">{{ provider.displayName }}</span>
              </Button>
            </div>
            <span role="cell" class="text-sm text-muted-foreground">
              {{
                $t(
                  'workspacePanel.partnerNodes.nodeCount',
                  provider.nodes.length
                )
              }}
            </span>
            <div role="cell" class="flex items-center">
              <SwitchRoot
                :model-value="provider.enabled"
                :disabled="isSaving"
                :aria-label="
                  $t('workspacePanel.partnerNodes.toggleProvider', {
                    provider: provider.displayName
                  })
                "
                class="focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-secondary-background outline-hidden transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary-background"
                @update:model-value="handleProviderChange(provider.id, $event)"
              >
                <SwitchThumb
                  class="block size-4 translate-x-0.5 rounded-full bg-base-foreground transition-transform data-[state=checked]:translate-x-4"
                />
              </SwitchRoot>
            </div>
          </div>

          <div
            v-for="node in isProviderExpanded(provider.id)
              ? provider.nodes
              : []"
            :key="node.id"
            role="row"
            class="grid grid-cols-[minmax(0,1fr)_8rem_7rem] items-center border-b border-interface-stroke bg-secondary-background/40 px-4 py-3 text-sm last:border-b-0"
          >
            <span role="cell" class="truncate pl-10 text-muted-foreground">
              {{ node.name }}
            </span>
            <span role="cell" />
            <span role="cell" class="text-muted-foreground">
              {{
                $t(
                  provider.enabled
                    ? 'workspacePanel.partnerNodes.enabled'
                    : 'workspacePanel.partnerNodes.disabled'
                )
              }}
            </span>
          </div>
        </template>

        <div
          v-if="filteredProviders.length === 0"
          class="flex min-h-40 items-center justify-center p-6 text-sm text-muted-foreground"
        >
          {{ $t('workspacePanel.partnerNodes.noResults') }}
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SwitchRoot, SwitchThumb } from 'reka-ui'

import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getProviderName } from '@/utils/categoryUtil'
import { cn } from '@comfyorg/tailwind-utils'

const governanceStore = usePartnerNodeGovernanceStore()
const { isSaving, policy, providers, status } = storeToRefs(governanceStore)
const {
  isProviderEnabled,
  loadPolicy,
  setAllProvidersEnabled,
  setProviderEnabled
} = governanceStore
const nodeDefStore = useNodeDefStore()
const { nodeDefsByName } = storeToRefs(nodeDefStore)
const dialogStore = useDialogStore()
const { t } = useI18n()

const searchQuery = ref('')
const expandedProviderIds = ref(new Set<string>())
const pendingBulkAction = ref<'enable' | null>(null)
const saveError = ref(false)

const isRestricted = computed(() => policy.value?.enforcementEnabled === true)
const isPolicyLoaded = computed(
  () => status.value === 'configured' || status.value === 'unconfigured'
)

const providerRows = computed(() =>
  providers.value
    .filter(({ nodeCategories }) => nodeCategories.length > 0)
    .map((provider) => {
      const nodes = Object.values(nodeDefsByName.value)
        .filter(
          (nodeDef) =>
            nodeDef.api_node &&
            provider.nodeCategories.includes(getProviderName(nodeDef.category))
        )
        .map((nodeDef) => ({
          id: nodeDef.name,
          name: nodeDef.display_name || nodeDef.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      return {
        ...provider,
        enabled: isProviderEnabled(provider.id),
        nodes
      }
    })
)

const filteredProviders = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return providerRows.value

  return providerRows.value
    .map((provider) => {
      if (provider.displayName.toLocaleLowerCase().includes(query)) {
        return provider
      }
      return {
        ...provider,
        nodes: provider.nodes.filter(({ name }) =>
          name.toLocaleLowerCase().includes(query)
        )
      }
    })
    .filter(
      ({ displayName, nodes }) =>
        displayName.toLocaleLowerCase().includes(query) || nodes.length > 0
    )
})

function toggleExpanded(providerId: string) {
  const nextIds = new Set(expandedProviderIds.value)
  if (nextIds.has(providerId)) nextIds.delete(providerId)
  else nextIds.add(providerId)
  expandedProviderIds.value = nextIds
}

function isProviderExpanded(providerId: string) {
  return (
    searchQuery.value.trim().length > 0 ||
    expandedProviderIds.value.has(providerId)
  )
}

async function performSave(action: () => Promise<void>) {
  saveError.value = false
  try {
    await action()
  } catch {
    saveError.value = true
  }
}

function handleProviderChange(providerId: string, enabled: boolean) {
  void performSave(() => setProviderEnabled(providerId, enabled))
}

async function handleEnableAll() {
  pendingBulkAction.value = 'enable'
  await performSave(() => setAllProvidersEnabled(true))
  pendingBulkAction.value = null
}

function confirmDisableAll() {
  const dialog = showConfirmDialog({
    headerProps: { title: t('workspacePanel.partnerNodes.disableAllTitle') },
    props: { promptText: t('workspacePanel.partnerNodes.disableAllMessage') },
    footerProps: {
      confirmText: t('workspacePanel.partnerNodes.disableAll'),
      confirmVariant: 'destructive',
      optionsDisabled: isSaving,
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm: async () => {
        await performSave(() => setAllProvidersEnabled(false))
        dialogStore.closeDialog(dialog)
      }
    }
  })
}
</script>
