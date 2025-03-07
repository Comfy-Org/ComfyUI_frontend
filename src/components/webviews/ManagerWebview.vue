<template>
  <div class="mx-auto flex flex-col" aria-labelledby="manager-title">
    <header class="flex flex-col mb-4 px-7">
      <h2 id="manager-title" class="text-4xl mb-0">
        {{ $t('manager.title') }}
      </h2>
    </header>

    <Divider
      class="m-0 [&::before]:border-surface-border/70 [&::before]:border-t-2"
    />

    <div class="relative w-full px-7 pb-0 mb-0 pt-10">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          placeholder="Search nodes"
          class="w-5/12 rounded-xl"
        />
      </IconField>
      <small
        v-if="searchQuery.trim() && searchResults.length"
        class="text-gray-500 mt-1 block"
      >
        Found {{ searchResults.length }} results
      </small>
    </div>

    <ScrollPanel class="h-0 flex-1 max-w-full px-6 pt-6">
      <NoResultsPlaceholder
        v-if="searchResults.length === 0"
        title="No results found matching your search."
        message="Please try a different search query."
      />
      <NoResultsPlaceholder
        v-else-if="error"
        title="Error connecting to the Comfy Node Registry."
        message="Please try again later."
      />
      <div
        v-else-if="isLoading"
        class="flex justify-center items-center h-full"
      >
        <ProgressSpinner />
      </div>
      <div v-else>
        <VirtualGrid
          :items="
            searchResults.map((item) => ({
              ...item,
              key: item.id || item.name
            }))
          "
          :defaultItemSize="CARD_SIZE"
          class="p-0 m-0 max-w-full"
          :buffer-rows="4"
          :gridStyle="{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_SIZE}px, 1fr))`,
            padding: '0.5rem',
            gap: '0.75rem',
            justifyContent: 'stretch'
          }"
        >
          <template #item="{ item }">
            <div class="relative w-full aspect-square">
              <Card
                class="absolute inset-0 flex flex-col overflow-hidden rounded-2xl cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.1),0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.05)] [&_.p-card-body]:p-0 [&_.p-card-content]:rounded-2xl [&_.p-card-body]:rounded-2xl [&_.p-card-body]:flex [&_.p-card-body]:flex-col [&_.p-card-body]:h-full [&_.p-card-content]:flex-1 [&_.p-card-content]:flex [&_.p-card-content]:flex-col"
                :pt="{
                  body: 'p-0 flex flex-col h-full',
                  content: 'flex-1 flex flex-col'
                }"
              >
                <template #title>
                  <div class="flex justify-between p-5 text-muted text-xs">
                    <span class="text-lg">
                      <i class="pi pi-box"></i>
                      Node Pack
                    </span>
                    <div
                      v-if="item.downloads"
                      class="flex items-center gap-2 text-muted text-xs"
                    >
                      <i class="pi pi-download"></i>
                      {{ item.downloads?.toLocaleString() ?? 'N/A' }}
                    </div>
                  </div>
                </template>
                <template #content>
                  <ContentDivider />
                  <div class="flex flex-col flex-1 p-5">
                    <span
                      class="text-lg font-bold pb-4 truncate overflow-hidden text-ellipsis"
                      >{{ item.name }}</span
                    >
                    <div class="flex flex-col gap-3 flex-1">
                      <p
                        v-if="item.description"
                        class="text-sm text-color-secondary m-0 line-clamp-3"
                      >
                        {{ item.description }}
                      </p>
                    </div>
                  </div>
                </template>
                <template #footer>
                  <ContentDivider />
                  <div class="flex justify-between p-5 text-muted text-xs">
                    <div class="flex items-center gap-2">
                      <span v-if="item.publisher?.name">
                        {{ item.publisher.name }}
                      </span>
                      <span v-if="item.latest_version">
                        {{ item.latest_version.version }}
                      </span>
                    </div>
                    <div
                      v-if="item.latest_version"
                      class="flex items-center gap-2"
                    >
                      Updated
                      {{ formatDate(item.latest_version.createdAt) }}
                    </div>
                  </div>
                </template>
              </Card>
            </div>
          </template>
        </VirtualGrid>
      </div>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card'
import Divider from 'primevue/divider'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import ScrollPanel from 'primevue/scrollpanel'

import ContentDivider from '@/components/common/ContentDivider.vue'
import NoResultsPlaceholder from '@/components/common/NoResultsPlaceholder.vue'
import VirtualGrid from '@/components/common/VirtualGrid.vue'
import { useRegistrySearch } from '@/composables/useRegistrySearch'
import { components } from '@/types/comfyRegistryTypes'

const CARD_SIZE = 462
const { searchQuery, pageNumber, isLoading, error, searchResults } =
  useRegistrySearch()
pageNumber.value = 1

const isNodePack = (item: unknown): item is components['schemas']['Node'] =>
  typeof item === 'object' && 'latest_version' in item
const formatDate = (date: string) => new Date(date).toLocaleDateString()
</script>
