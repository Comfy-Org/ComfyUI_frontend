<template>
  <TabPanel value="PartnerNodes" class="h-full">
    <div class="flex h-full flex-col">
      <div>
        <h2 class="text-2xl font-bold">
          {{ $t('workspacePanel.partnerNodes.title') }}
        </h2>
        <div class="mt-1 flex items-center justify-between gap-4">
          <p class="my-0 text-sm text-muted">
            {{ $t('workspacePanel.partnerNodes.description') }}
          </p>
          <div class="flex shrink-0 gap-2">
            <Button variant="textonly" size="sm" @click="setAllFiltered(true)">
              {{ $t('workspacePanel.partnerNodes.enableAll') }}
            </Button>
            <Button variant="textonly" size="sm" @click="setAllFiltered(false)">
              {{ $t('workspacePanel.partnerNodes.disableAll') }}
            </Button>
          </div>
        </div>
      </div>

      <Divider class="my-4" />

      <SearchInput
        v-model="searchQuery"
        :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
        class="mb-4"
      />

      <div
        v-if="!accessStore.partnerNodes.length"
        class="py-8 text-center text-sm text-muted"
      >
        {{ $t('workspacePanel.partnerNodes.empty') }}
      </div>

      <div v-else class="min-h-0 flex-1 overflow-y-auto">
        <section
          v-for="group in groupedNodes"
          :key="group.partner"
          class="mb-6"
        >
          <h3 class="mb-1 text-sm font-semibold">
            {{ group.partner }}
            <span class="ml-2 font-normal text-muted">
              {{
                $t('workspacePanel.partnerNodes.enabledCount', {
                  enabled: group.enabledCount,
                  total: group.nodes.length
                })
              }}
            </span>
          </h3>
          <ul class="m-0 list-none p-0">
            <li
              v-for="node in group.nodes"
              :key="node.name"
              class="flex items-center justify-between py-1.5"
            >
              <span
                :class="
                  cn(
                    'text-sm',
                    !accessStore.isNodeTypeEnabled(node.name) && 'opacity-40'
                  )
                "
              >
                {{ node.displayName }}
              </span>
              <ToggleSwitch
                :model-value="accessStore.isNodeTypeEnabled(node.name)"
                @update:model-value="
                  accessStore.setEnabled([node.name], $event)
                "
              />
            </li>
          </ul>
        </section>
      </div>

      <div class="mt-4 flex items-center gap-2 pt-2">
        <ToggleSwitch
          :model-value="accessStore.autoEnableNew"
          @update:model-value="accessStore.setAutoEnableNew($event)"
        />
        <span
          :class="cn('text-sm', !accessStore.autoEnableNew && 'text-muted')"
        >
          {{ $t('workspacePanel.partnerNodes.autoEnableLabel') }}
        </span>
      </div>
    </div>
  </TabPanel>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import Divider from 'primevue/divider'
import TabPanel from 'primevue/tabpanel'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import type { PartnerNodeEntry } from '@/platform/workspace/partnerNodeAccess/partnerNodeAccessStore'
import { usePartnerNodeAccessStore } from '@/platform/workspace/partnerNodeAccess/partnerNodeAccessStore'

interface PartnerGroup {
  partner: string
  nodes: PartnerNodeEntry[]
  enabledCount: number
}

const accessStore = usePartnerNodeAccessStore()
const searchQuery = ref('')

const filteredNodes = computed<PartnerNodeEntry[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return accessStore.partnerNodes
  return accessStore.partnerNodes.filter(
    (node) =>
      node.displayName.toLowerCase().includes(query) ||
      node.name.toLowerCase().includes(query) ||
      node.partner.toLowerCase().includes(query)
  )
})

const groupedNodes = computed<PartnerGroup[]>(() => {
  const byPartner = new Map<string, PartnerNodeEntry[]>()
  for (const node of filteredNodes.value) {
    const nodes = byPartner.get(node.partner) ?? []
    nodes.push(node)
    byPartner.set(node.partner, nodes)
  }
  return [...byPartner.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([partner, nodes]) => ({
      partner,
      nodes: nodes.toSorted((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
      enabledCount: nodes.filter((node) =>
        accessStore.isNodeTypeEnabled(node.name)
      ).length
    }))
})

function setAllFiltered(enabled: boolean) {
  accessStore.setEnabled(
    filteredNodes.value.map((node) => node.name),
    enabled
  )
}
</script>
