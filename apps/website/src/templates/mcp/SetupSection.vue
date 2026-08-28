<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { ref } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import SurfaceToggle from '../../components/common/SurfaceToggle.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import CopyableField from '../../components/ui/copyable-field/CopyableField.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  captureMcpClientTabClick,
  captureMcpConnectionTabClick
} from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type ConnectionId = 'cloud' | 'local'

interface McpClient {
  name: string
  step: string
  command?: string
  link?: { label: string; href: string }
  manualTitle?: string
  showAgentCard: boolean
  // Walkthrough clip shown in place of the agent card (source: docs.comfy.org/agent-tools/mcp)
  video?: string
}

interface McpConnection {
  name: string
  tagline: string
  /** Value surfaced in the manual card's copy field (server URL or install command). */
  copyValue: string
  manualTitle: string
  manualDescription: string
  agentCommand: string
  /** Badge the agent card as the recommended path (local setup is fiddlier by hand). */
  agentRecommended: boolean
  /** The comfy-skills plugin ships cloud slash commands only. */
  showSkillsNote: boolean
  /** Client id → client; insertion order is the tab order. */
  clients: Record<string, McpClient>
}

const cloudClients: Record<string, McpClient> = {
  'claude-desktop': {
    name: 'Claude Desktop',
    step: t('mcp.setup.clients.claudeDesktop.step', locale),
    manualTitle: t('mcp.setup.clients.claudeDesktop.manualTitle', locale),
    showAgentCard: false,
    video: 'https://media.comfy.org/website/mcp/setup-claude-desktop-v2.mp4'
  },
  'claude-code': {
    name: 'Claude Code Terminal',
    step: t('mcp.setup.clients.claudeCode.step', locale),
    command: `claude mcp add --transport http comfy-cloud ${externalLinks.mcpEndpoint}`,
    showAgentCard: true
  },
  codex: {
    name: 'Codex',
    step: t('mcp.setup.clients.codex.step', locale),
    command: `codex mcp add comfy-cloud --url ${externalLinks.mcpEndpoint}`,
    showAgentCard: false,
    video: 'https://media.comfy.org/website/mcp/setup-codex-oauth-v2.mp4'
  },
  cursor: {
    name: 'Cursor',
    step: t('mcp.setup.clients.cursor.step', locale),
    link: {
      label: t('mcp.setup.clients.cursor.linkLabel', locale),
      href: externalLinks.apiKeys
    },
    showAgentCard: true
  },
  openclaw: {
    name: 'OpenClaw',
    step: t('mcp.setup.clients.openclaw.step', locale),
    command: `openclaw skills install @comfy-org/comfy\nopenclaw mcp set comfy '{"url":"${externalLinks.mcpEndpoint}","transport":"streamable-http","auth":"oauth"}'`,
    showAgentCard: true
  },
  other: {
    name: t('mcp.setup.clients.other.name', locale),
    step: t('mcp.setup.clients.other.step', locale),
    link: {
      label: t('mcp.setup.clients.other.linkLabel', locale),
      href: externalLinks.docsMcp
    },
    showAgentCard: true
  }
}

// Same stdio registration for every JSON-config client (source:
// docs.comfy.org/agent-tools/mcp#manual-configuration).
const LOCAL_CONFIG_SNIPPET =
  '{ "mcpServers": { "comfy-mcp": { "command": "comfy-mcp" } } }'

const localClients: Record<string, McpClient> = {
  'local-claude-code': {
    name: 'Claude Code Terminal',
    step: t('mcp.setup.local.clients.claudeCode.step', locale),
    command: 'claude mcp add comfy-mcp -- comfy-mcp',
    showAgentCard: true
  },
  'local-claude-desktop': {
    name: 'Claude Desktop',
    step: t('mcp.setup.local.clients.claudeDesktop.step', locale),
    command: LOCAL_CONFIG_SNIPPET,
    showAgentCard: true
  },
  'local-cursor': {
    name: 'Cursor',
    step: t('mcp.setup.local.clients.cursor.step', locale),
    command: LOCAL_CONFIG_SNIPPET,
    showAgentCard: true
  },
  'local-other': {
    name: t('mcp.setup.clients.other.name', locale),
    step: t('mcp.setup.local.clients.other.step', locale),
    link: {
      label: t('mcp.setup.clients.other.linkLabel', locale),
      href: externalLinks.docsMcpLocal
    },
    showAgentCard: true
  }
}

const connections: Record<ConnectionId, McpConnection> = {
  cloud: {
    name: t('mcp.setup.connections.cloud.name', locale),
    tagline: t('mcp.setup.connections.cloud.tagline', locale),
    copyValue: externalLinks.mcpEndpoint,
    manualTitle: t('mcp.setup.manual.title', locale),
    manualDescription: t('mcp.setup.manual.description', locale),
    agentCommand: t('mcp.setup.agent.command', locale).replace(
      '{url}',
      externalLinks.docsMcpMd
    ),
    agentRecommended: false,
    showSkillsNote: true,
    clients: cloudClients
  },
  local: {
    name: t('mcp.setup.connections.local.name', locale),
    tagline: t('mcp.setup.connections.local.tagline', locale),
    copyValue: 'pip install comfy-mcp',
    manualTitle: t('mcp.setup.local.manual.title', locale),
    manualDescription: t('mcp.setup.local.manual.description', locale),
    agentCommand: t('mcp.setup.local.agent.command', locale).replace(
      '{url}',
      externalLinks.docsMcpLocalMd
    ),
    agentRecommended: true,
    showSkillsNote: false,
    clients: localClients
  }
}

const DEFAULT_CLIENT_IDS: Record<ConnectionId, string> = {
  cloud: 'claude-desktop',
  local: 'local-claude-code'
}

const activeConnectionId = ref<ConnectionId>('cloud')
const activeClientIds = ref<Record<ConnectionId, string>>({
  ...DEFAULT_CLIENT_IDS
})

function activeClientFor(connId: ConnectionId): McpClient {
  const conn = connections[connId]
  return (
    conn.clients[activeClientIds.value[connId]] ??
    conn.clients[DEFAULT_CLIENT_IDS[connId]]
  )
}

function manualTitleFor(connId: ConnectionId): string {
  return activeClientFor(connId).manualTitle ?? connections[connId].manualTitle
}

// reka-ui re-emits update:modelValue even when the value is unchanged
// (re-clicking the active tab), so dedupe before capturing.
let lastTrackedConnectionId: string | undefined
function onConnectionTabChange(value: string | number | undefined) {
  if (!value) return
  const id = String(value)
  if (id === lastTrackedConnectionId) return
  lastTrackedConnectionId = id
  captureMcpConnectionTabClick(id)
}

let lastTrackedClientId: string | undefined
function onClientTabChange(value: string | number | undefined) {
  if (!value) return
  const id = String(value)
  if (id === lastTrackedClientId) return
  lastTrackedClientId = id
  captureMcpClientTabClick(id)
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
            :href="getRoutes(locale).cloudPricing"
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
              v-for="(client, clientId) in conn.clients"
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
                v-for="(client, clientId) in conn.clients"
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
