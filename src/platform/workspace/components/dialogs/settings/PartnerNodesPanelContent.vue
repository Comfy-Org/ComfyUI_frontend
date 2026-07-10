<template>
  <div class="flex size-full flex-col gap-4">
    <header>
      <h2 class="m-0 text-2xl font-semibold text-base-foreground">
        {{ $t('workspacePanel.partnerNodes.title') }}
      </h2>
      <p class="mt-1 mb-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.partnerNodes.description') }}
      </p>
    </header>

    <div
      role="note"
      class="flex gap-3 rounded-lg bg-secondary-background p-3 text-sm text-base-foreground"
    >
      <i
        class="mt-0.5 icon-[lucide--flask-conical] size-4 shrink-0"
        aria-hidden="true"
      />
      <div>
        <p class="m-0 font-semibold">
          {{ $t('workspacePanel.partnerNodes.prototypeTitle') }}
        </p>
        <p class="mt-1 mb-0 text-muted-foreground">
          {{ $t('workspacePanel.partnerNodes.prototypeDescription') }}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <SearchInput
        v-model="searchQuery"
        :placeholder="$t('workspacePanel.partnerNodes.searchPlaceholder')"
        class="min-w-64 flex-1"
      />
      <Button
        variant="textonly"
        :disabled="!filteredNodes.length"
        @click="setAllFiltered(true)"
      >
        {{ $t('workspacePanel.partnerNodes.enableFiltered') }}
      </Button>
      <Button
        variant="textonly"
        :disabled="!filteredNodes.length"
        @click="setAllFiltered(false)"
      >
        {{ $t('workspacePanel.partnerNodes.disableFiltered') }}
      </Button>
    </div>

    <p
      v-if="!prototypeStore.partnerNodes.length"
      class="my-8 text-center text-sm text-muted-foreground"
    >
      {{ $t('workspacePanel.partnerNodes.empty') }}
    </p>

    <p
      v-else-if="!filteredNodes.length"
      class="my-8 text-center text-sm text-muted-foreground"
    >
      {{ $t('workspacePanel.partnerNodes.noResults') }}
    </p>

    <div v-else class="min-h-0 flex-1 overflow-y-auto pr-1">
      <section
        v-for="group in groupedNodes"
        :key="group.provider"
        class="mb-4 overflow-hidden rounded-lg border border-interface-stroke"
      >
        <h3
          class="m-0 flex items-center justify-between bg-secondary-background px-4 py-2 text-sm font-semibold text-base-foreground"
        >
          <span>{{ group.provider }}</span>
          <span class="font-normal text-muted-foreground">
            {{
              $t('workspacePanel.partnerNodes.enabledCount', {
                enabled: group.enabledCount,
                total: group.nodes.length
              })
            }}
          </span>
        </h3>
        <ul class="m-0 list-none divide-y divide-interface-stroke p-0">
          <li
            v-for="node in group.nodes"
            :key="node.name"
            class="flex min-h-12 items-center justify-between gap-4 px-4 py-1"
          >
            <div class="min-w-0">
              <p class="m-0 truncate text-sm text-base-foreground">
                {{ node.displayName }}
              </p>
              <p class="m-0 truncate text-xs text-muted-foreground">
                {{ node.name }}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="prototypeStore.isEnabled(node.name)"
              :aria-label="
                $t('workspacePanel.partnerNodes.toggleLabel', {
                  node: node.displayName
                })
              "
              class="group focus-visible:ring-ring flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent focus-visible:ring-1 focus-visible:outline-none"
              @click="toggleNode(node.name)"
            >
              <span
                :class="
                  cn(
                    'relative h-6 w-11 rounded-full border border-interface-stroke transition-colors',
                    prototypeStore.isEnabled(node.name)
                      ? 'bg-primary-background group-hover:bg-primary-background-hover'
                      : 'bg-secondary-background group-hover:bg-secondary-background-hover'
                  )
                "
                aria-hidden="true"
              >
                <span
                  :class="
                    cn(
                      'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform',
                      prototypeStore.isEnabled(node.name) && 'translate-x-5'
                    )
                  "
                />
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <p class="m-0 text-xs text-muted-foreground">
      {{ $t('workspacePanel.partnerNodes.defaultDeny') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import SearchInput from '@/components/ui/search-input/SearchInput.vue'
import type { PartnerNodePrototypeEntry } from '@/platform/workspace/partnerNodePrototype/partnerNodePrototypeStore'
import { usePartnerNodePrototypeStore } from '@/platform/workspace/partnerNodePrototype/partnerNodePrototypeStore'

interface PartnerNodePrototypeGroup {
  provider: string
  nodes: PartnerNodePrototypeEntry[]
  enabledCount: number
}

const prototypeStore = usePartnerNodePrototypeStore()
const searchQuery = ref('')

const filteredNodes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return prototypeStore.partnerNodes
  return prototypeStore.partnerNodes.filter(
    (node) =>
      node.displayName.toLowerCase().includes(query) ||
      node.name.toLowerCase().includes(query) ||
      node.provider.toLowerCase().includes(query)
  )
})

const groupedNodes = computed<PartnerNodePrototypeGroup[]>(() => {
  const nodesByProvider = new Map<string, PartnerNodePrototypeEntry[]>()
  for (const node of filteredNodes.value) {
    const nodes = nodesByProvider.get(node.provider) ?? []
    nodes.push(node)
    nodesByProvider.set(node.provider, nodes)
  }
  return [...nodesByProvider.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([provider, nodes]) => ({
      provider,
      nodes: nodes.toSorted((first, second) =>
        first.displayName.localeCompare(second.displayName)
      ),
      enabledCount: nodes.filter((node) => prototypeStore.isEnabled(node.name))
        .length
    }))
})

function setAllFiltered(enabled: boolean) {
  prototypeStore.setEnabled(
    filteredNodes.value.map((node) => node.name),
    enabled
  )
}

function toggleNode(nodeType: string) {
  prototypeStore.setEnabled([nodeType], !prototypeStore.isEnabled(nodeType))
}
</script>
