<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import SectionHeader from '../../components/common/SectionHeader.vue'
import CopyableField from '../../components/ui/copyable-field/CopyableField.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const agentCommand = t('mcp.setup.option1.command', locale).replace(
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

    <div class="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ t('mcp.setup.option1.label', locale) }}
        </p>
        <h3
          class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
        >
          {{ t('mcp.setup.option1.title', locale) }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ t('mcp.setup.option1.description', locale) }}
        </p>
        <div class="mt-6">
          <CopyableField
            :value="agentCommand"
            :copy-label="copyLabel"
            :copied-label="copiedLabel"
          />
        </div>
      </div>

      <div
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ t('mcp.setup.option2.label', locale) }}
        </p>
        <h3
          class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
        >
          {{ t('mcp.setup.option2.title', locale) }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ t('mcp.setup.option2.description', locale) }}
        </p>
        <div class="mt-6">
          <CopyableField
            :value="externalLinks.mcpEndpoint"
            :copy-label="copyLabel"
            :copied-label="copiedLabel"
          />
        </div>

        <TabsRoot default-value="claude-code" class="mt-6">
          <TabsList
            :aria-label="t('mcp.setup.option2.tabsLabel', locale)"
            class="flex flex-wrap gap-2"
          >
            <TabsTrigger
              v-for="client in clients"
              :key="client.id"
              :value="client.id"
              class="data-[state=active]:border-primary-comfy-yellow cursor-pointer rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-bold tracking-widest text-smoke-700 uppercase transition-colors hover:text-primary-comfy-canvas data-[state=active]:text-primary-comfy-canvas"
            >
              {{ client.name }}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            v-for="client in clients"
            :key="client.id"
            :value="client.id"
            class="mt-4 flex flex-col gap-3"
          >
            <p class="text-sm text-smoke-700">
              {{ client.step }}
              <a
                v-if="client.link"
                :href="client.link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-comfy-canvas underline underline-offset-4"
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
        </TabsRoot>
      </div>
    </div>

    <p class="mt-8 text-sm text-smoke-700">
      {{ t('mcp.setup.skillsNote', locale) }}
      <a
        :href="externalLinks.mcpSkills"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-canvas underline underline-offset-4"
        >{{ t('mcp.setup.skillsLink', locale) }}</a
      >
    </p>
  </section>
</template>
