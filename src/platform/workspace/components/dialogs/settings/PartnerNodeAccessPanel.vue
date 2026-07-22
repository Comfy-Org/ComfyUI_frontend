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
            <span
              role="cell"
              :class="
                cn(
                  'flex items-center gap-2 text-sm',
                  provider.enabled
                    ? 'text-base-foreground'
                    : 'text-muted-foreground'
                )
              "
            >
              <i
                :class="
                  cn(
                    'size-4',
                    provider.enabled
                      ? 'icon-[lucide--circle-check]'
                      : 'icon-[lucide--circle-x]'
                  )
                "
              />
              {{
                $t(
                  provider.enabled
                    ? 'workspacePanel.partnerNodes.enabled'
                    : 'workspacePanel.partnerNodes.disabled'
                )
              }}
            </span>
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

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getProviderName } from '@/utils/categoryUtil'
import { cn } from '@comfyorg/tailwind-utils'

const governanceStore = usePartnerNodeGovernanceStore()
const { policy, providers, status } = storeToRefs(governanceStore)
const { isProviderEnabled, loadPolicy } = governanceStore
const nodeDefStore = useNodeDefStore()
const { nodeDefsByName } = storeToRefs(nodeDefStore)

const searchQuery = ref('')
const expandedProviderIds = ref(new Set<string>())

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
        enabled: !isRestricted.value || isProviderEnabled(provider.id),
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
</script>
