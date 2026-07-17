<template>
  <div class="grow overflow-auto pt-6">
    <div
      class="flex size-full min-h-0 flex-col gap-5 rounded-2xl border border-interface-stroke p-6"
    >
      <div class="flex items-start gap-6">
        <div class="min-w-0 flex-1">
          <h2 class="m-0 text-base font-semibold text-base-foreground">
            {{ $t('workspacePanel.allowlist.title') }}
          </h2>
          <p class="mt-1 mb-0 text-sm text-muted-foreground">
            {{ $t('workspacePanel.allowlist.description') }}
          </p>
        </div>
        <SearchInput
          v-model="searchQuery"
          :placeholder="$t('workspacePanel.allowlist.searchPlaceholder')"
          size="lg"
          class="w-64 shrink-0"
          :disabled="!isReady"
        />
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

      <div v-else-if="isReady" class="min-h-0 flex-1 overflow-y-auto">
        <div
          v-if="groups.length === 0"
          class="flex min-h-32 items-center justify-center text-sm text-muted-foreground"
        >
          {{ $t('workspacePanel.allowlist.noMatches') }}
        </div>

        <template v-else>
          <section
            v-for="group in groups"
            :key="group.provider"
            class="mb-5 last:mb-0"
          >
            <div
              class="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground"
            >
              <span>{{ group.provider }}</span>
              <span>
                {{
                  $t('workspacePanel.allowlist.allowedCount', {
                    enabled: group.enabledCount,
                    total: group.nodes.length
                  })
                }}
              </span>
            </div>

            <div
              class="overflow-hidden rounded-xl border border-interface-stroke/60"
            >
              <div
                v-for="node in group.nodes"
                :key="node.id"
                class="flex min-h-14 items-center gap-4 border-b border-interface-stroke/40 px-4 last:border-b-0"
              >
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm text-base-foreground">
                    {{ node.name }}
                  </div>
                  <div
                    v-if="node.name !== node.id"
                    class="truncate text-xs text-muted-foreground"
                  >
                    {{ node.id }}
                  </div>
                </div>
                <ToggleSwitch
                  :model-value="draftNodes[node.id]"
                  :disabled="isSaving"
                  :aria-label="
                    $t('workspacePanel.allowlist.nodeToggle', {
                      name: node.name
                    })
                  "
                  @update:model-value="
                    (enabled: boolean) => setNodeEnabled(node.id, enabled)
                  "
                />
              </div>
            </div>
          </section>
        </template>
      </div>

      <div v-if="isReady" class="flex min-h-10 items-center justify-end gap-3">
        <span v-if="saveError" role="alert" class="text-destructive text-sm">
          {{ $t('workspacePanel.allowlist.saveError') }}
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
    </div>
  </div>
</template>

<script setup lang="ts">
import ToggleSwitch from 'primevue/toggleswitch'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import type { PartnerNodeCatalogItem } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { useToastStore } from '@/platform/updates/common/toastStore'

interface PartnerNodeGroup {
  provider: string
  nodes: PartnerNodeCatalogItem[]
  enabledCount: number
}

const { t } = useI18n()
const governanceStore = usePartnerNodeGovernanceStore()
const { governedWorkspaceId, partnerNodes, policy, status } =
  storeToRefs(governanceStore)
const toastStore = useToastStore()

const searchQuery = ref('')
const draftNodes = ref<Record<string, boolean>>({})
const isSaving = ref(false)
const saveError = ref(false)
let saveGeneration = 0

const isReady = computed(
  () => status.value === 'configured' || status.value === 'unconfigured'
)

function originalNodeValue(nodeId: string): boolean {
  return policy.value ? policy.value.nodes[nodeId] === true : true
}

function resetDraft(): void {
  draftNodes.value = Object.fromEntries(
    partnerNodes.value.map((node) => [node.id, originalNodeValue(node.id)])
  )
  saveError.value = false
}

watch([governedWorkspaceId, partnerNodes, policy], resetDraft, {
  immediate: true
})

watch(
  governedWorkspaceId,
  () => {
    saveGeneration += 1
    isSaving.value = false
  },
  { flush: 'sync' }
)

const hasChanges = computed(() =>
  partnerNodes.value.some(
    (node) => draftNodes.value[node.id] !== originalNodeValue(node.id)
  )
)

const groups = computed<PartnerNodeGroup[]>(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase()
  const byProvider = new Map<string, PartnerNodeCatalogItem[]>()

  for (const node of partnerNodes.value) {
    if (
      query &&
      ![node.name, node.id, node.provider].some((value) =>
        value.toLocaleLowerCase().includes(query)
      )
    ) {
      continue
    }
    const nodes = byProvider.get(node.provider) ?? []
    nodes.push(node)
    byProvider.set(node.provider, nodes)
  }

  return [...byProvider.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([provider, nodes]) => {
      const sortedNodes = nodes.sort((left, right) =>
        left.name.localeCompare(right.name)
      )
      return {
        provider,
        nodes: sortedNodes,
        enabledCount: sortedNodes.filter(
          (node) => draftNodes.value[node.id] === true
        ).length
      }
    })
})

function setNodeEnabled(nodeId: string, enabled: boolean): void {
  draftNodes.value[nodeId] = enabled
  saveError.value = false
}

async function save(): Promise<void> {
  if (!hasChanges.value || isSaving.value) return

  const generation = saveGeneration
  isSaving.value = true
  saveError.value = false
  try {
    const applied = await governanceStore.savePolicy({
      enforcementEnabled: policy.value?.enforcementEnabled ?? false,
      nodes: {
        ...(policy.value?.nodes ?? {}),
        ...draftNodes.value
      }
    })
    if (!applied || generation !== saveGeneration) return
    toastStore.add({
      severity: 'success',
      summary: t('workspacePanel.allowlist.saved'),
      life: 2000
    })
  } catch {
    if (generation !== saveGeneration) return
    saveError.value = true
  } finally {
    if (generation === saveGeneration) {
      isSaving.value = false
    }
  }
}

function loadPolicy(): void {
  void governanceStore.loadPolicy()
}
</script>
