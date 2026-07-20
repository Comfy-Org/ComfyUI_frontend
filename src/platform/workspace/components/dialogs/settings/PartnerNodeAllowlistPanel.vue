<template>
  <div class="grow overflow-auto pt-6">
    <div
      class="flex size-full min-h-0 flex-col gap-5 rounded-2xl border border-interface-stroke p-6"
    >
      <div>
        <h2 class="m-0 text-base font-semibold text-base-foreground">
          {{ $t('workspacePanel.allowlist.title') }}
        </h2>
        <p class="mt-1 mb-0 text-sm text-muted-foreground">
          {{ $t('workspacePanel.allowlist.description') }}
        </p>
      </div>

      <div
        v-if="isReady"
        class="flex flex-col gap-3 rounded-xl border border-interface-stroke/60 p-4"
      >
        <div>
          <div class="text-sm font-medium text-base-foreground">
            {{ $t('workspacePanel.allowlist.mode.title') }}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground">
            {{ $t('workspacePanel.allowlist.mode.description') }}
          </div>
        </div>
        <div
          role="group"
          :aria-label="$t('workspacePanel.allowlist.mode.title')"
          class="grid w-full max-w-md grid-cols-2 rounded-lg bg-secondary-background p-1"
        >
          <button
            type="button"
            :aria-pressed="!isRestricted"
            :disabled="isSaving"
            class="h-9 cursor-pointer rounded-md border-0 bg-transparent px-4 text-sm text-muted-foreground transition-colors hover:bg-interface-menu-component-surface-selected/50 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-interface-menu-component-surface-selected aria-pressed:text-base-foreground"
            @click="requestMode('unrestricted')"
          >
            {{ $t('workspacePanel.allowlist.mode.unrestricted') }}
          </button>
          <button
            type="button"
            :aria-pressed="isRestricted"
            :disabled="isSaving"
            class="h-9 cursor-pointer rounded-md border-0 bg-transparent px-4 text-sm text-muted-foreground transition-colors hover:bg-interface-menu-component-surface-selected/50 disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-interface-menu-component-surface-selected aria-pressed:text-base-foreground"
            @click="requestMode('restricted')"
          >
            {{ $t('workspacePanel.allowlist.mode.restricted') }}
          </button>
        </div>
      </div>

      <div
        v-if="status === 'loading'"
        role="status"
        class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <i class="icon-[lucide--loader-circle] size-4 animate-spin" />
        {{ $t('workspacePanel.allowlist.loading') }}
      </div>

      <div
        v-else-if="status === 'error' || status === 'unavailable'"
        role="alert"
        class="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
      >
        <span>{{ $t('workspacePanel.allowlist.loadError') }}</span>
        <Button variant="muted-textonly" @click="loadPolicy">
          {{ $t('workspacePanel.allowlist.retry') }}
        </Button>
      </div>

      <div
        v-else-if="isReady && partnerNodes.length === 0"
        class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
      >
        {{ $t('workspacePanel.allowlist.empty') }}
      </div>

      <template v-else-if="isReady">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            v-model="searchQuery"
            :placeholder="$t('workspacePanel.allowlist.searchPlaceholder')"
            size="lg"
            class="w-64"
            :disabled="isSaving"
          />
          <div v-if="isRestricted" class="flex items-center gap-2">
            <Button
              variant="secondary"
              :disabled="isSaving || allProvidersEnabled"
              @click="setAllProviders(true)"
            >
              {{ $t('workspacePanel.allowlist.enableAll') }}
            </Button>
            <Button
              variant="secondary"
              :disabled="isSaving || allProvidersDisabled"
              @click="setAllProviders(false)"
            >
              {{ $t('workspacePanel.allowlist.disableAll') }}
            </Button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-auto">
          <div
            v-if="groups.length === 0"
            class="flex min-h-32 items-center justify-center text-sm text-muted-foreground"
          >
            {{ $t('workspacePanel.allowlist.noMatches') }}
          </div>

          <div
            v-else
            role="table"
            :aria-label="$t('workspacePanel.allowlist.table.label')"
            class="min-w-2xl overflow-hidden rounded-xl border border-interface-stroke/60"
          >
            <div
              role="row"
              class="grid min-h-11 grid-cols-[minmax(14rem,1fr)_10rem_10rem_5rem] items-center border-b border-interface-stroke/60 bg-secondary-background px-4 text-xs font-medium text-muted-foreground"
            >
              <button
                role="columnheader"
                type="button"
                class="flex h-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left text-inherit hover:text-base-foreground"
                @click="toggleSortDirection"
              >
                {{ $t('workspacePanel.allowlist.table.provider') }}
                <i
                  :class="
                    sortDirection === 'asc'
                      ? 'icon-[lucide--arrow-up] size-3.5'
                      : 'icon-[lucide--arrow-down] size-3.5'
                  "
                />
              </button>
              <div role="columnheader">
                {{ $t('workspacePanel.allowlist.table.allowed') }}
              </div>
              <div role="columnheader">
                {{ $t('workspacePanel.allowlist.table.lastModified') }}
              </div>
              <div role="columnheader" class="text-right">
                {{ $t('workspacePanel.allowlist.table.access') }}
              </div>
            </div>

            <section
              v-for="group in groups"
              :key="group.provider"
              role="rowgroup"
              class="border-b border-interface-stroke/40 last:border-b-0"
            >
              <div
                role="row"
                class="grid min-h-14 grid-cols-[minmax(14rem,1fr)_10rem_10rem_5rem] items-center px-4"
              >
                <div role="cell" class="min-w-0">
                  <button
                    type="button"
                    :aria-expanded="expandedProviders.has(group.provider)"
                    class="group flex h-full min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-sm font-medium text-base-foreground hover:text-muted-foreground"
                    @click="toggleProviderExpanded(group.provider)"
                  >
                    <i
                      class="icon-[lucide--chevron-right] size-4 shrink-0 transition-transform group-aria-expanded:rotate-90"
                    />
                    <span class="truncate">{{ group.provider }}</span>
                  </button>
                </div>
                <div role="cell" class="text-sm text-muted-foreground">
                  {{
                    $t('workspacePanel.allowlist.allowedCount', {
                      enabled: group.enabledCount,
                      total: group.allNodes.length
                    })
                  }}
                </div>
                <div role="cell" class="text-sm text-muted-foreground">
                  {{ $t('workspacePanel.allowlist.table.notAvailable') }}
                </div>
                <div role="cell" class="flex justify-end">
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="group.enabledCount === group.allNodes.length"
                    :disabled="!isRestricted || isSaving"
                    :aria-label="
                      $t('workspacePanel.allowlist.providerToggle', {
                        provider: group.provider
                      })
                    "
                    :class="
                      cn(
                        'focus-visible:ring-ring relative h-5 w-9 cursor-pointer rounded-full border-0 p-0 transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        group.enabledCount === group.allNodes.length
                          ? 'bg-primary-background'
                          : 'bg-tertiary-background'
                      )
                    "
                    @click="
                      setProviderEnabled(
                        group,
                        group.enabledCount !== group.allNodes.length
                      )
                    "
                  >
                    <span
                      :class="
                        cn(
                          'block size-4 translate-x-0.5 rounded-full bg-base-foreground transition-transform',
                          group.enabledCount === group.allNodes.length &&
                            'translate-x-4'
                        )
                      "
                    />
                  </button>
                </div>
              </div>

              <div
                v-if="expandedProviders.has(group.provider)"
                class="border-t border-interface-stroke/40 bg-secondary-background/40 py-1"
              >
                <div
                  v-for="node in group.nodes"
                  :key="node.id"
                  role="row"
                  class="grid min-h-10 grid-cols-[minmax(14rem,1fr)_10rem_10rem_5rem] items-center px-4 text-sm"
                >
                  <div role="cell" class="min-w-0 pl-6 text-muted-foreground">
                    <div class="truncate">{{ node.name }}</div>
                    <div v-if="node.name !== node.id" class="truncate text-xs">
                      {{ node.id }}
                    </div>
                  </div>
                  <div role="cell" class="text-xs text-muted-foreground">
                    {{
                      draftNodes[node.id]
                        ? $t('workspacePanel.allowlist.enabled')
                        : $t('workspacePanel.allowlist.disabled')
                    }}
                  </div>
                  <div role="cell" />
                  <div role="cell" />
                </div>
              </div>
            </section>
          </div>
        </div>

        <div
          v-if="saveError"
          role="alert"
          class="text-destructive flex min-h-10 items-center justify-end gap-3 text-sm"
        >
          <span>{{ $t('workspacePanel.allowlist.saveError') }}</span>
          <Button
            variant="muted-textonly"
            :disabled="isSaving"
            @click="persistDraft"
          >
            {{ $t('workspacePanel.allowlist.retry') }}
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import type { PartnerNodeCatalogItem } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useDialogService } from '@/services/dialogService'

interface PartnerNodeGroup {
  provider: string
  nodes: PartnerNodeCatalogItem[]
  allNodes: PartnerNodeCatalogItem[]
  enabledCount: number
}

type AccessMode = 'unrestricted' | 'restricted'
type SortDirection = 'asc' | 'desc'

const { t } = useI18n()
const governanceStore = usePartnerNodeGovernanceStore()
const { governedWorkspaceId, partnerNodes, policy, status } =
  storeToRefs(governanceStore)
const dialogService = useDialogService()

const searchQuery = ref('')
const draftNodes = ref<Record<string, boolean>>({})
const draftEnforcementEnabled = ref(false)
const expandedProviders = shallowRef(new Set<string>())
const sortDirection = ref<SortDirection>('asc')
const isSaving = ref(false)
const saveError = ref(false)
let saveGeneration = 0

const isReady = computed(
  () => status.value === 'configured' || status.value === 'unconfigured'
)
const isRestricted = computed(() => draftEnforcementEnabled.value)
const allProvidersEnabled = computed(() =>
  partnerNodes.value.every((node) => draftNodes.value[node.id] === true)
)
const allProvidersDisabled = computed(() =>
  partnerNodes.value.every((node) => draftNodes.value[node.id] === false)
)

function originalNodeValue(nodeId: string): boolean {
  return policy.value ? policy.value.nodes[nodeId] === true : true
}

function resetDraft(): void {
  draftEnforcementEnabled.value = policy.value?.enforcementEnabled ?? false
  draftNodes.value = Object.fromEntries(
    partnerNodes.value.map((node) => [node.id, originalNodeValue(node.id)])
  )
  saveError.value = false
}

watch([governedWorkspaceId, policy], resetDraft, { immediate: true })

watch(partnerNodes, (nodes) => {
  draftNodes.value = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      draftNodes.value[node.id] ?? originalNodeValue(node.id)
    ])
  )
})

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
    draftEnforcementEnabled.value !==
      (policy.value?.enforcementEnabled ?? false) ||
    partnerNodes.value.some(
      (node) => draftNodes.value[node.id] !== originalNodeValue(node.id)
    )
)

const groups = computed<PartnerNodeGroup[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const byProvider = new Map<string, PartnerNodeCatalogItem[]>()
  for (const node of partnerNodes.value) {
    const nodes = byProvider.get(node.provider) ?? []
    nodes.push(node)
    byProvider.set(node.provider, nodes)
  }

  return [...byProvider.entries()]
    .map(([provider, allNodes]) => {
      const providerMatches = provider.toLocaleLowerCase().includes(query)
      const nodes = allNodes
        .filter(
          (node) =>
            !query ||
            providerMatches ||
            [node.name, node.id].some((value) =>
              value.toLocaleLowerCase().includes(query)
            )
        )
        .sort((left, right) => left.name.localeCompare(right.name))
      return {
        provider,
        nodes,
        allNodes,
        enabledCount: allNodes.filter(
          (node) => draftNodes.value[node.id] === true
        ).length
      }
    })
    .filter((group) => group.nodes.length > 0)
    .sort((left, right) => {
      const result = left.provider.localeCompare(right.provider)
      return sortDirection.value === 'asc' ? result : -result
    })
})

function toggleProviderExpanded(provider: string): void {
  const nextExpandedProviders = new Set(expandedProviders.value)
  if (nextExpandedProviders.has(provider)) {
    nextExpandedProviders.delete(provider)
  } else {
    nextExpandedProviders.add(provider)
  }
  expandedProviders.value = nextExpandedProviders
}

function toggleSortDirection(): void {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

async function persistDraft(): Promise<void> {
  if (!hasChanges.value) {
    saveError.value = false
    return
  }
  if (isSaving.value) return

  const generation = saveGeneration
  isSaving.value = true
  saveError.value = false
  try {
    await governanceStore.savePolicy({
      enforcementEnabled: draftEnforcementEnabled.value,
      nodes: {
        ...(policy.value?.nodes ?? {}),
        ...draftNodes.value
      }
    })
  } catch {
    if (generation === saveGeneration) saveError.value = true
  } finally {
    if (generation === saveGeneration) isSaving.value = false
  }
}

async function requestMode(mode: AccessMode): Promise<void> {
  if ((mode === 'restricted') === isRestricted.value || isSaving.value) return

  const generation = saveGeneration
  const needsConfirmation =
    mode === 'restricted' ||
    partnerNodes.value.some((node) => draftNodes.value[node.id] !== true)
  if (needsConfirmation) {
    const confirmed = await dialogService.confirm({
      title: t(`workspacePanel.allowlist.mode.${mode}ConfirmTitle`),
      message: t(`workspacePanel.allowlist.mode.${mode}ConfirmMessage`)
    })
    if (!confirmed || generation !== saveGeneration) return
  }

  draftEnforcementEnabled.value = mode === 'restricted'
  await persistDraft()
}

async function setProviderEnabled(
  group: PartnerNodeGroup,
  enabled: boolean
): Promise<void> {
  for (const node of group.allNodes) draftNodes.value[node.id] = enabled
  await persistDraft()
}

async function setAllProviders(enabled: boolean): Promise<void> {
  for (const node of partnerNodes.value) draftNodes.value[node.id] = enabled
  await persistDraft()
}

function loadPolicy(): void {
  void governanceStore.loadPolicy()
}
</script>
