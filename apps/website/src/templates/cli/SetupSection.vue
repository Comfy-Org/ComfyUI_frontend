<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { ref } from 'vue'

import SectionHeader from '../../components/common/SectionHeader.vue'
import SurfaceToggle from '../../components/common/SurfaceToggle.vue'
import CopyableField from '../../components/ui/copyable-field/CopyableField.vue'
import { externalLinks, getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  captureCliClientTabClick,
  captureCliConnectionTabClick
} from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

type ConnectionId = 'cloud' | 'local'

// Commands are verbatim from docs.comfy.org/agent-tools/cli and
// docs.comfy.org/comfy-cli/getting-started.
const INSTALL_COMMAND = 'pip install comfy-cli'

interface ShellCard {
  title: string
  step: Record<ConnectionId, string>
  commands: Record<ConnectionId, string[]>
  showKeyLink: boolean
}

interface CliClient {
  name: string
  kind: 'agent' | 'shell'
  shell?: ShellCard
}

const clients: Record<string, CliClient> = {
  'claude-code': { name: 'Claude Code', kind: 'agent' },
  codex: { name: 'Codex', kind: 'agent' },
  cursor: { name: 'Cursor', kind: 'agent' },
  'gemini-cli': { name: 'Gemini CLI', kind: 'agent' },
  openclaw: { name: 'OpenClaw', kind: 'agent' },
  hermes: { name: 'Hermes', kind: 'agent' },
  terminal: {
    name: t('cli.setup.clients.terminal.name', locale),
    kind: 'shell',
    shell: {
      title: t('cli.setup.shell.terminal.title', locale),
      step: {
        cloud: t('cli.setup.shell.terminal.stepCloud', locale),
        local: t('cli.setup.shell.terminal.stepLocal', locale)
      },
      commands: {
        cloud: [
          'comfy setup --where cloud',
          'comfy generate nano-banana --prompt "a watercolor of a sleeping fox" --download fox.png'
        ],
        local: ['comfy setup', 'comfy launch']
      },
      showKeyLink: false
    }
  },
  ci: {
    name: 'CI / Headless',
    kind: 'shell',
    shell: {
      title: t('cli.setup.shell.ci.title', locale),
      step: {
        cloud: t('cli.setup.shell.ci.stepCloud', locale),
        local: t('cli.setup.shell.ci.stepLocal', locale)
      },
      commands: {
        cloud: [
          'comfy setup --where cloud --api-key comfyui-... --non-interactive',
          'comfy run --workflow my_workflow.json --wait | comfy download'
        ],
        local: ['comfy setup -y']
      },
      showKeyLink: true
    }
  }
}

interface CliConnection {
  name: string
  tagline: string
  installDescription: string
  manualCommand: string
  agentCommand: string
}

const connections: Record<ConnectionId, CliConnection> = {
  cloud: {
    name: t('cli.setup.connections.cloud.name', locale),
    tagline: t('cli.setup.connections.cloud.tagline', locale),
    installDescription: t('cli.setup.install.cloudDescription', locale),
    manualCommand: 'comfy setup --where cloud\ncomfy skills install',
    agentCommand: t('cli.setup.agent.commandCloud', locale).replace(
      '{url}',
      externalLinks.docsCliMd
    )
  },
  local: {
    name: t('cli.setup.connections.local.name', locale),
    tagline: t('cli.setup.connections.local.tagline', locale),
    installDescription: t('cli.setup.install.localDescription', locale),
    manualCommand: 'comfy setup\ncomfy skills install',
    agentCommand: t('cli.setup.agent.commandLocal', locale).replace(
      '{url}',
      externalLinks.docsCliMd
    )
  }
}

const DEFAULT_CLIENT_ID = 'claude-code'

const activeConnectionId = ref<ConnectionId>('cloud')
const activeClientIds = ref<Record<ConnectionId, string>>({
  cloud: DEFAULT_CLIENT_ID,
  local: DEFAULT_CLIENT_ID
})

function activeClientFor(connId: ConnectionId): CliClient {
  return clients[activeClientIds.value[connId]] ?? clients[DEFAULT_CLIENT_ID]
}

function agentTitleFor(connId: ConnectionId): string {
  return t('cli.setup.agent.title', locale).replace(
    '{client}',
    activeClientFor(connId).name
  )
}

function agentDescriptionFor(connId: ConnectionId): string {
  return t('cli.setup.agent.description', locale).replace(
    '{client}',
    activeClientFor(connId).name
  )
}

// reka-ui re-emits update:modelValue even when the value is unchanged
// (re-clicking the active tab), so dedupe before capturing.
let lastTrackedConnectionId: string | undefined
function onConnectionTabChange(value: string | number | undefined) {
  if (!value) return
  const id = String(value)
  if (id === lastTrackedConnectionId) return
  lastTrackedConnectionId = id
  captureCliConnectionTabClick(id)
}

let lastTrackedClientKey: string | undefined
function onClientTabChange(connId: string, value: string | number | undefined) {
  if (!value) return
  const id = String(value)
  const key = `${connId}:${id}`
  if (key === lastTrackedClientKey) return
  lastTrackedClientKey = key
  captureCliClientTabClick(id)
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
      :label="t('cli.setup.label', locale)"
      align="start"
    >
      {{ t('cli.setup.heading', locale) }}
      <template #subtitle>
        <p
          class="mt-4 max-w-xl text-sm whitespace-pre-line text-smoke-700 lg:text-base"
        >
          {{ t('cli.setup.subtitle', locale) }}
        </p>
        <p
          v-if="activeConnectionId === 'cloud'"
          class="mt-4 max-w-xl text-xs text-primary-warm-gray"
        >
          {{ t('cli.setup.requirementPrefix', locale)
          }}<a
            :href="getRoutes(locale).cloudPricing"
            class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >{{ t('cli.setup.requirementLinkLabel', locale) }}</a
          >{{ t('cli.setup.requirementSuffix', locale)
          }}{{ t('cli.setup.requirementFootnote', locale) }}
        </p>
        <p v-else class="mt-4 max-w-xl text-xs text-primary-warm-gray">
          {{ t('cli.setup.local.requirementPrefix', locale)
          }}<a
            :href="externalLinks.comfyCliRepo"
            target="_blank"
            rel="noopener noreferrer"
            class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
            >{{ t('cli.setup.local.requirementLinkLabel', locale) }}</a
          >{{ t('cli.setup.local.requirementSuffix', locale) }}
        </p>
      </template>
    </SectionHeader>

    <SurfaceToggle :locale="locale" active="cli" class="mt-10" />

    <TabsRoot
      v-model="activeConnectionId"
      activation-mode="manual"
      class="mt-6 block"
      @update:model-value="onConnectionTabChange"
    >
      <TabsList
        :aria-label="t('cli.setup.connections.tabsLabel', locale)"
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
          @update:model-value="(value) => onClientTabChange(connId, value)"
        >
          <TabsList
            :aria-label="t('cli.setup.manual.tabsLabel', locale)"
            class="grid grid-cols-1 gap-px rounded-2xl border border-white/15 bg-primary-comfy-ink p-1 min-[360px]:grid-cols-2 lg:inline-flex lg:flex-nowrap"
          >
            <TabsTrigger
              v-for="(client, clientId) in clients"
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
                {{ t('cli.setup.install.title', locale) }}
              </h3>
              <p class="mt-3 text-sm text-smoke-700">
                {{ conn.installDescription }}
              </p>
              <div class="mt-6">
                <CopyableField
                  :value="INSTALL_COMMAND"
                  :copy-label="copyLabel"
                  :copied-label="copiedLabel"
                />
              </div>
              <div class="mt-6 flex min-h-36 flex-col gap-3">
                <p class="text-sm text-smoke-700">
                  {{ t('cli.setup.manual.step', locale) }}
                </p>
                <CopyableField
                  :value="conn.manualCommand"
                  :copy-label="copyLabel"
                  :copied-label="copiedLabel"
                />
              </div>
            </div>

            <div
              class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
            >
              <template v-if="activeClientFor(connId).kind === 'agent'">
                <h3
                  class="text-xl font-light text-primary-comfy-canvas lg:text-2xl"
                >
                  {{ agentTitleFor(connId) }}
                </h3>
                <p class="mt-3 text-sm text-smoke-700">
                  {{ agentDescriptionFor(connId) }}
                </p>
                <div class="mt-6">
                  <CopyableField
                    :value="conn.agentCommand"
                    :copy-label="copyLabel"
                    :copied-label="copiedLabel"
                  />
                </div>
              </template>
              <template v-else>
                <h3
                  class="text-xl font-light text-primary-comfy-canvas lg:text-2xl"
                >
                  {{ activeClientFor(connId).shell?.title }}
                </h3>
                <p class="mt-3 text-sm text-smoke-700">
                  {{ activeClientFor(connId).shell?.step[connId] }}
                </p>
                <div class="mt-6 flex flex-col gap-3">
                  <CopyableField
                    v-for="command in activeClientFor(connId).shell?.commands[
                      connId
                    ]"
                    :key="command"
                    :value="command"
                    :copy-label="copyLabel"
                    :copied-label="copiedLabel"
                  />
                </div>
                <p
                  v-if="activeClientFor(connId).shell?.showKeyLink"
                  class="mt-6 text-sm text-smoke-700"
                >
                  {{ t('cli.setup.shell.ci.keyLinkPrefix', locale)
                  }}<a
                    :href="externalLinks.apiKeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                    >{{ t('cli.setup.shell.ci.keyLinkLabel', locale) }}</a
                  >
                </p>
              </template>
            </div>
          </div>
        </TabsRoot>
      </TabsContent>
    </TabsRoot>

    <div class="mt-8 flex max-w-2xl flex-col gap-2">
      <p class="text-xs text-primary-warm-gray">
        {{ t('cli.setup.betaNote', locale) }}
      </p>
      <p class="text-xs text-primary-warm-gray">
        {{ t('cli.setup.docsPrefix', locale)
        }}<a
          :href="externalLinks.docsCliReference"
          target="_blank"
          rel="noopener noreferrer"
          class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >{{ t('cli.setup.docsLinkLabel', locale) }}</a
        >{{ t('cli.setup.docsSuffix', locale) }}
      </p>
    </div>
  </section>
</template>
