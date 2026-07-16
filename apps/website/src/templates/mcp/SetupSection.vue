<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import SectionHeader from '../../components/common/SectionHeader.vue'
import SectionLabel from '../../components/common/SectionLabel.vue'
import CopyableField from '../../components/ui/copyable-field/CopyableField.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { captureMcpClientTabClick } from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const agentCommand = t('mcp.setup.agent.command', locale).replace(
  '{url}',
  externalLinks.docsMcp
)

interface McpClient {
  id: string
  name: string
  step: string
  command?: string
  link?: { label: string; href: string }
}

const clients: McpClient[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    step: t('mcp.setup.clients.claudeCode.step', locale),
    command: `claude mcp add --transport http comfy-cloud ${externalLinks.mcpEndpoint}`
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    step: t('mcp.setup.clients.claudeDesktop.step', locale)
  },
  {
    id: 'cursor',
    name: 'Cursor',
    step: t('mcp.setup.clients.cursor.step', locale),
    link: {
      label: t('mcp.setup.clients.cursor.linkLabel', locale),
      href: externalLinks.apiKeys
    }
  },
  {
    id: 'codex',
    name: 'Codex',
    step: t('mcp.setup.clients.codex.step', locale),
    command: `codex mcp add comfy-cloud --url ${externalLinks.mcpEndpoint}`
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    step: t('mcp.setup.clients.openclaw.step', locale),
    command: `openclaw skills install @comfy-org/comfy\nopenclaw mcp set comfy '{"url":"${externalLinks.mcpEndpoint}","transport":"streamable-http","auth":"oauth"}'`
  },
  {
    id: 'other',
    name: t('mcp.setup.clients.other.name', locale),
    step: t('mcp.setup.clients.other.step', locale),
    link: {
      label: t('mcp.setup.clients.other.linkLabel', locale),
      href: externalLinks.docsMcp
    }
  }
]

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
        <p class="mt-4 max-w-xl text-sm text-smoke-700 lg:text-base">
          {{ t('mcp.setup.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <TabsRoot default-value="claude-code" class="mt-10 block">
      <TabsList
        :aria-label="t('mcp.setup.manual.tabsLabel', locale)"
        class="inline-flex flex-wrap gap-1 rounded-2xl border border-white/10 p-1"
      >
        <TabsTrigger
          v-for="client in clients"
          :key="client.id"
          :value="client.id"
          class="focus-visible:ring-primary-comfy-yellow/50 data-[state=active]:bg-primary-comfy-yellow cursor-pointer rounded-xl px-4 py-2 text-xs font-bold tracking-wider text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas focus-visible:ring-2 focus-visible:outline-none data-[state=active]:text-primary-comfy-ink"
          @click="captureMcpClientTabClick(client.id)"
        >
          {{ client.name }}
        </TabsTrigger>
      </TabsList>

      <div class="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div
          class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
        >
          <SectionLabel>{{ t('mcp.setup.manual.label', locale) }}</SectionLabel>
          <h3
            class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
          >
            {{ t('mcp.setup.manual.title', locale) }}
          </h3>
          <p class="mt-3 text-sm text-smoke-700">
            {{ t('mcp.setup.manual.description', locale) }}
          </p>
          <div class="mt-6">
            <CopyableField
              :value="externalLinks.mcpEndpoint"
              :copy-label="copyLabel"
              :copied-label="copiedLabel"
            />
          </div>
          <TabsContent
            v-for="client in clients"
            :key="client.id"
            :value="client.id"
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
          class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
        >
          <SectionLabel>{{ t('mcp.setup.agent.label', locale) }}</SectionLabel>
          <h3
            class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
          >
            {{ t('mcp.setup.agent.title', locale) }}
          </h3>
          <p class="mt-3 text-sm text-smoke-700">
            {{ t('mcp.setup.agent.description', locale) }}
          </p>
          <div class="mt-6">
            <CopyableField
              :value="agentCommand"
              :copy-label="copyLabel"
              :copied-label="copiedLabel"
            />
          </div>
          <p class="mt-6 text-sm text-smoke-700">
            {{ t('mcp.setup.skillsNote', locale)
            }}<a
              :href="externalLinks.mcpSkills"
              target="_blank"
              rel="noopener noreferrer"
              class="focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-primary-comfy-canvas underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
              >{{ t('mcp.setup.skillsLink', locale) }}</a
            >
          </p>
        </div>
      </div>
    </TabsRoot>
  </section>
</template>
