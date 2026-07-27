<template>
  <SidebarTabTemplate :title="$t('modelManager.title')">
    <template #tool-buttons>
      <Button
        variant="textonly"
        size="icon"
        :title="$t('modelManager.downloadAuth.title')"
        @click="openAuth()"
      >
        <i class="icon-[lucide--key-round] size-4" />
      </Button>
      <Button
        variant="textonly"
        size="icon"
        :title="$t('modelManager.addModel')"
        @click="addOpen = true"
      >
        <i class="icon-[lucide--plus] size-4" />
      </Button>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-3">
        <section v-if="activeDownloads.length" class="flex flex-col gap-2">
          <h3 class="text-xs font-semibold text-muted-foreground uppercase">
            {{ $t('modelManager.active') }}
          </h3>
          <ModelDownloadRow
            v-for="download in activeDownloads"
            :key="download.download_id"
            :download
            @open-auth="openAuth"
          />
        </section>

        <section v-if="historyDownloads.length" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold text-muted-foreground uppercase">
              {{ $t('modelManager.history') }}
            </h3>
            <Button variant="link" size="sm" @click="actions.clearHistory()">
              {{ $t('modelManager.clearHistory') }}
            </Button>
          </div>
          <ModelDownloadRow
            v-for="download in historyDownloads"
            :key="download.download_id"
            :download
            @open-auth="openAuth"
          />
        </section>

        <div
          v-if="!store.downloadList.length"
          class="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground"
        >
          <i class="icon-[lucide--download] size-8" />
          <p class="text-sm">{{ $t('modelManager.empty') }}</p>
          <Button variant="primary" size="sm" @click="addOpen = true">
            {{ $t('modelManager.addModel') }}
          </Button>
        </div>
      </div>
    </template>
  </SidebarTabTemplate>

  <AddModelByUrlDialog v-model:open="addOpen" @auth-required="openAuth" />
  <DownloadAuthDialog v-model:open="authOpen" :focus-provider="focusProvider" />
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'

import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import Button from '@/components/ui/button/Button.vue'

import AddModelByUrlDialog from './AddModelByUrlDialog.vue'
import DownloadAuthDialog from './DownloadAuthDialog.vue'
import ModelDownloadRow from './ModelDownloadRow.vue'
import { useModelDownloadActions } from '../composables/useModelDownloadActions'
import { useModelDownloadStore } from '../stores/modelDownloadStore'
import type { DownloadProvider } from '../types'

const store = useModelDownloadStore()
const actions = useModelDownloadActions()
const { activeDownloads, historyDownloads } = storeToRefs(store)

const addOpen = ref(false)
const authOpen = ref(false)
const focusProvider = ref<DownloadProvider | undefined>(undefined)

function openAuth(provider?: DownloadProvider) {
  focusProvider.value = provider
  authOpen.value = true
}

onMounted(() => {
  void store.hydrate()
})
</script>
