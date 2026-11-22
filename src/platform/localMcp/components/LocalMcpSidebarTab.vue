<template>
  <SidebarTabTemplate :title="$t('localMcp.title')">
    <template #body>
      <div class="flex flex-col gap-4 p-4">
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('localMcp.description') }}
        </p>

        <div
          v-if="store.connected"
          role="status"
          class="flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm"
        >
          <i
            class="icon-[lucide--circle-check] text-success"
            aria-hidden="true"
          />
          {{ $t('localMcp.connected') }}
        </div>

        <section class="flex flex-col gap-2">
          <h3 class="m-0 text-sm font-semibold">
            {{ $t('localMcp.step1') }}
          </h3>
          <pre
            class="m-0 overflow-x-auto rounded-lg bg-secondary p-3 text-xs"
            data-testid="local-mcp-install"
            >{{ LOCAL_MCP_INSTALL_COMMAND }}</pre>
        </section>

        <section class="flex flex-col gap-2">
          <h3 class="m-0 text-sm font-semibold">
            {{ $t('localMcp.step2') }}
          </h3>
          <div
            v-for="client in clients"
            :key="client.id"
            class="flex flex-col gap-2 rounded-lg border p-3"
            :data-testid="`local-mcp-client-${client.id}`"
          >
            <span class="text-sm font-medium">{{ $t(client.labelKey) }}</span>
            <p
              v-if="client.locationKey"
              class="m-0 text-xs text-muted-foreground"
            >
              {{ $t(client.locationKey) }}
            </p>
            <pre
              class="m-0 overflow-x-auto rounded-lg bg-secondary p-3 text-xs"
              >{{ client.config }}</pre>
            <Button
              variant="secondary"
              size="sm"
              @click="copyConfig(client.id, client.config)"
            >
              {{ $t('localMcp.copyConfig') }}
              <i class="icon-[lucide--copy] size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </section>

        <section class="flex flex-col gap-2">
          <h3 class="m-0 text-sm font-semibold">
            {{ $t('localMcp.step3') }}
          </h3>
          <p class="m-0 text-xs text-muted-foreground">
            {{ $t('localMcp.step3Hint') }}
          </p>
        </section>

        <Button
          as="a"
          variant="textonly"
          size="sm"
          :href="LOCAL_MCP_DOCS_URL"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="local-mcp-docs"
          @click="store.trackPathSelected(undefined, 'open_docs')"
        >
          {{ $t('localMcp.openDocs') }}
          <i class="icon-[lucide--external-link] size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </template>
  </SidebarTabTemplate>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import type { LocalMcpClient } from '@comfyorg/telemetry/types'

import SidebarTabTemplate from '@/components/sidebar/tabs/SidebarTabTemplate.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import {
  getLocalMcpAddress,
  getLocalMcpClients,
  LOCAL_MCP_DOCS_URL,
  LOCAL_MCP_INSTALL_COMMAND
} from '@/platform/localMcp/localMcpClients'
import { useLocalMcpStore } from '@/platform/localMcp/useLocalMcpStore'

const clients = getLocalMcpClients(getLocalMcpAddress(window.location))
const store = useLocalMcpStore()
const { copyToClipboard } = useCopyToClipboard()

onMounted(() => store.trackOpened())

async function copyConfig(client: LocalMcpClient, config: string) {
  await copyToClipboard(config)
  store.trackPathSelected(client, 'copy_config')
}
</script>
