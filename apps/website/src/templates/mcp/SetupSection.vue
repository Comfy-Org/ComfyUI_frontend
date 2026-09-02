<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { ref } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import SurfaceToggle from '../../components/common/SurfaceToggle.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import CopyableField from '../../components/ui/copyable-field/CopyableField.vue'
import type {
  ConnectionId,
  McpClient,
  McpClientId,
  McpConnections
} from '../../config/mcpClients'
import {
  createMcpConnections,
  isConnectionId,
  isMcpClientId
} from '../../config/mcpClients'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  captureMcpClientTabClick,
  captureMcpConnectionTabClick
} from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const connections: McpConnections = createMcpConnections(locale)

const DEFAULT_CLIENT_IDS: Record<ConnectionId, McpClientId> = {
  cloud: 'claude-desktop',
  local: 'local-claude-code'
}

const activeConnectionId = ref<ConnectionId>('cloud')
const activeClientIds = ref<Record<ConnectionId, McpClientId>>({
  ...DEFAULT_CLIENT_IDS
})

function activeClientFor(connId: ConnectionId): McpClient {
  const conn = connections[connId]
  return conn.clients[activeClientIds.value[connId]]!
}

// `clients` is `Partial<Record<McpClientId, McpClient>>` (cloud and local
// don't share the same client id space), but every entry a connection
// actually enumerates its own keys with is present by construction. Narrow
// away the `| undefined` here once instead of asserting at each template
// read site.
function clientEntriesFor(connId: ConnectionId): [McpClientId, McpClient][] {
  return Object.entries(connections[connId].clients).filter(
    (entry): entry is [McpClientId, McpClient] => entry[1] !== undefined
  )
}

function manualTitleFor(connId: ConnectionId): string {
  return activeClientFor(connId).manualTitle ?? connections[connId].manualTitle
}

// reka-ui re-emits update:modelValue even when the value is unchanged
// (re-clicking the active tab), so dedupe before capturing.
let lastTrackedConnectionId: ConnectionId | undefined
function onConnectionTabChange(value: string | number | undefined) {
  if (!isConnectionId(value, connections) || value === lastTrackedConnectionId)
    return
  lastTrackedConnectionId = value
  captureMcpConnectionTabClick(value)
}

let lastTrackedClientId: McpClientId | undefined
function onClientTabChange(value: string | number | undefined) {
  if (!isMcpClientId(value, connections) || value === lastTrackedClientId)
    return
  lastTrackedClientId = value
  captureMcpClientTabClick(value)
}

function walkthroughLabelFor(connId: ConnectionId): string {
  return t('mcp.setup.walkthroughAlt', locale).replace(
    '{client}',
    activeClientFor(connId).name
  )
}

const copyLabel = t('ui.copy', locale)
const copiedLabel = t('ui.copied', locale)
</script>

<template>
  <section
    id="setup"
    class="max-w-9xl mx-auto scroll-mt-24 px-6 py-16 lg:scroll-mt-36 lg:py-24"
  >
    <SectionHeader
      max-width="xl"
      :label="t('mcp.setup.label', locale)"
      align="start"
    >
      {{ t('mcp.setup.heading', locale) }}
      <template #subtitle>
        <p
          class="mt-4 max-w-xl text-sm whitespace-pre-line text-smoke-700 lg:text-base"
        >
          {{ t('mcp.setup.subtitle', locale) }}
        </p>
        <p
          v-if="activeConnectionId === 'cloud'"
          class="mt-4 max-w-xl text-xs text-primary-warm-gray"
        >
          {{ t('mcp.setup.requirementPrefix', locale)
          }}<a
            :href="getRoutes(locale).pricing"
            class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >{{ t('mcp.setup.requirementLinkLabel', locale) }}</a
          >{{ t('mcp.setup.requirementSuffix', locale)
          }}{{ t('mcp.setup.requirementFootnote', locale) }}
        </p>
        <p v-else class="mt-4 max-w-xl text-xs text-primary-warm-gray">
          {{ t('mcp.setup.local.requirementPrefix', locale)
          }}<a
            :href="externalLinks.comfyMcpRepo"
            target="_blank"
            rel="noopener noreferrer"
            class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >{{ t('mcp.setup.local.requirementLinkLabel', locale) }}</a
          >{{ t('mcp.setup.local.requirementSuffix', locale) }}
        </p>
      </template>
    </SectionHeader>

    <SurfaceToggle :locale="locale" active="mcp" class="mt-10" />

    <TabsRoot
      v-model="activeConnectionId"
      activation-mode="manual"
      class="mt-6 block"
      @update:model-value="onConnectionTabChange"
    >
      <TabsList
        :aria-label="t('mcp.setup.connections.tabsLabel', locale)"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-3xl"
      >
        <TabsTrigger
          v-for="(conn, connId) in connections"
          :key="connId"
          :value="connId"
          class="focus-visible:ring-primary-comfy-yellow/50 data-[state=active]:border-primary-comfy-yellow cursor-pointer rounded-2xl border border-white/15 bg-white/4 p-5 text-left transition-colors hover:bg-white/8 focus-visible:ring-2 focus-visible:outline-none data-[state=active]:bg-white/8"
        >
          <span
            class="block text-sm font-bold tracking-wider text-primary-comfy-canvas uppercase"
          >
            {{ conn.name }}
          </span>
          <span class="mt-1.5 block text-xs text-smoke-700">
            {{ conn.tagline }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="(conn, connId) in connections"
        :key="connId"
        :value="connId"
        class="mt-10 block"
      >
        <TabsRoot
          v-model="activeClientIds[connId]"
          activation-mode="manual"
          class="block"
          @update:model-value="onClientTabChange"
        >
          <TabsList
            :aria-label="t('mcp.setup.manual.tabsLabel', locale)"
            class="grid grid-cols-1 gap-px rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 min-[360px]:grid-cols-2 lg:inline-flex lg:flex-nowrap"
          >
            <TabsTrigger
              v-for="[clientId, client] in clientEntriesFor(connId)"
              :key="clientId"
              :value="clientId"
              class="focus-visible:ring-primary-comfy-yellow/50 data-[state=active]:bg-primary-comfy-yellow shrink-0 cursor-pointer rounded-lg bg-white/8 px-2 py-2.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:outline-none data-[state=active]:text-primary-comfy-ink lg:rounded-none lg:px-6 lg:text-xs lg:first:rounded-l-xl lg:last:rounded-r-xl"
            >
              {{ client.name }}
            </TabsTrigger>
          </TabsList>

          <div class="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
              class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
            >
              <h3
                class="text-xl font-light text-primary-comfy-canvas lg:text-2xl"
              >
                {{ manualTitleFor(connId) }}
              </h3>
              <p class="mt-3 text-sm text-smoke-700">
                {{ conn.manualDescription }}
              </p>
              <div class="mt-6">
                <CopyableField
                  :value="conn.copyValue"
                  :copy-label="copyLabel"
                  :copied-label="copiedLabel"
                />
              </div>
              <TabsContent
                v-for="[clientId, client] in clientEntriesFor(connId)"
                :key="clientId"
                :value="clientId"
                class="mt-6 flex min-h-36 flex-col gap-3"
              >
                <p class="text-sm text-smoke-700">
                  {{ client.step
                  }}<a
                    v-if="client.link"
                    :href="client.link.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                    >{{ client.link.label }}</a
                  >
                </p>
                <CopyableField
                  v-if="client.command"
                  :value="client.command"
                  :copy-label="copyLabel"
                  :copied-label="copiedLabel"
                />
              </TabsContent>
            </div>

            <div
              :class="
                cn(
                  'bg-transparency-white-t4 flex flex-col rounded-3xl',
                  activeClientFor(connId).showAgentCard
                    ? 'p-6 lg:p-8'
                    : 'relative overflow-hidden max-lg:aspect-video'
                )
              "
            >
              <template v-if="activeClientFor(connId).showAgentCard">
                <h3
                  class="flex flex-wrap items-center gap-2.5 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
                >
                  {{ t('mcp.setup.agent.title', locale) }}
                  <span
                    v-if="conn.agentRecommended"
                    class="bg-primary-comfy-yellow rounded-md px-2 py-1 text-[10px] font-bold tracking-wider text-primary-comfy-ink uppercase"
                  >
                    {{ t('mcp.setup.agent.recommended', locale) }}
                  </span>
                </h3>
                <p class="mt-3 text-sm text-smoke-700">
                  {{ t('mcp.setup.agent.description', locale) }}
                </p>
                <div class="mt-6">
                  <CopyableField
                    :value="conn.agentCommand"
                    :copy-label="copyLabel"
                    :copied-label="copiedLabel"
                  />
                </div>
                <p
                  v-if="conn.showSkillsNote"
                  class="mt-6 text-sm text-smoke-700"
                >
                  {{ t('mcp.setup.skillsNote', locale)
                  }}<a
                    :href="externalLinks.mcpSkills"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                    >{{ t('mcp.setup.skillsLink', locale) }}</a
                  >
                </p>
              </template>
              <VideoPlayer
                v-else-if="activeClientFor(connId).video"
                :key="activeClientIds[connId]"
                :locale="locale"
                :aria-label="walkthroughLabelFor(connId)"
                :src="activeClientFor(connId).video"
                autoplay
                loop
                hide-controls
                fit="contain"
                class="absolute inset-0 size-full bg-transparent"
              />
            </div>
          </div>
        </TabsRoot>
      </TabsContent>
    </TabsRoot>
  </section>
</template>
