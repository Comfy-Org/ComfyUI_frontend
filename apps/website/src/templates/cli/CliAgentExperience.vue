<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { ArrowUpRight, X } from '@lucide/vue'
import Button from '@/components/ui/button/Button.vue'
import { TabsRoot, TabsContent } from 'reka-ui'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import IconButton from '@/components/ui/icon-button/IconButton.vue'
import CodeTabsPicker from '@/templates/platform/CodeTabsPicker.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'
import CliSetupInstall from './CliSetupInstall.vue'
import CliSetupRun from './CliSetupRun.vue'
import NativeCliSession from '@/templates/cli/NativeCliSession.vue'
import AgentSetupClientTabs from '@/components/common/AgentSetupClientTabs.vue'
import SectionHeader from '@/components/common/SectionHeader.vue'
import BrandButton from '@/components/common/BrandButton.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import { externalLinks } from '@/config/routes'
import { translationsFor } from '@/i18n/translations'
import {
  captureCliClientTabClick,
  captureCliConnectionTabClick
} from '@/scripts/posthog'
import type { Locale } from '@/i18n/translations'
import type { CliClientId } from '@/scripts/posthog'
const { headingTag = 'h1', locale = 'en' } = defineProps<{
  headingTag?: 'h1' | 'h2'
  locale?: Locale
}>()
const { t } = translationsFor(locale)
type ConnectionId = 'cloud' | 'local'

const INSTALL_COMMAND = 'pip install comfy-cli'
const codeFieldClass =
  '[&>span]:text-2xs/relaxed sm:[&>span]:text-xs/relaxed lg:[&>span]:text-sm/relaxed'

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

const clients: Record<CliClientId, CliClient> = {
  'claude-code': { name: 'Claude Code', kind: 'agent' },
  codex: { name: 'Codex', kind: 'agent' },
  cursor: { name: 'Cursor', kind: 'agent' },
  'gemini-cli': { name: 'Gemini CLI', kind: 'agent' },
  openclaw: { name: 'OpenClaw', kind: 'agent' },
  hermes: { name: 'Hermes', kind: 'agent' },
  terminal: {
    name: t('cli.setup.clients.terminal.name'),
    kind: 'shell',
    shell: {
      title: t('cli.setup.shell.terminal.title'),
      step: {
        cloud: t('cli.setup.shell.terminal.stepCloud'),
        local: t('cli.setup.shell.terminal.stepLocal')
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
      title: t('cli.setup.shell.ci.title'),
      step: {
        cloud: t('cli.setup.shell.ci.stepCloud'),
        local: t('cli.setup.shell.ci.stepLocal')
      },
      commands: {
        cloud: [
          'comfy setup --where cloud --api-key comfyui-... --non-interactive',
          'comfy run --workflow my_workflow.json --wait | comfy download'
        ],
        local: ['comfy setup --where local --non-interactive']
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
    name: t('cli.setup.connections.cloud.name'),
    tagline: t('cli.setup.connections.cloud.tagline'),
    installDescription: t('cli.setup.install.cloudDescription'),
    manualCommand: 'comfy setup --where cloud\ncomfy skills install',
    agentCommand: t('cli.setup.agent.commandCloud', {
      url: externalLinks.docsCliMd
    })
  },
  local: {
    name: t('cli.experience.localLabel'),
    tagline: t('cli.setup.connections.local.tagline'),
    installDescription: t('cli.setup.install.localDescription'),
    manualCommand: 'comfy setup --where local\ncomfy skills install',
    agentCommand: t('cli.setup.agent.commandLocal', {
      url: externalLinks.docsCliMd
    })
  }
}

const DEFAULT_CLIENT_ID = 'claude-code'

const activeConnectionId = ref<ConnectionId>('cloud')
const activeClientIds = ref<Record<ConnectionId, CliClientId>>({
  cloud: DEFAULT_CLIENT_ID,
  local: DEFAULT_CLIENT_ID
})

function activeClientFor(connId: ConnectionId): CliClient {
  return clients[activeClientIds.value[connId]] ?? clients[DEFAULT_CLIENT_ID]
}

const connection = computed(() => connections[activeConnectionId.value])
const agentPrompt = computed(() => connection.value.agentCommand)
const client = computed(() => activeClientFor(activeConnectionId.value))
const isHeadless = computed(
  () => activeClientIds.value[activeConnectionId.value] === 'ci'
)
const connectCommand = computed(() =>
  isHeadless.value
    ? client.value.shell!.commands[activeConnectionId.value][0]
    : connection.value.manualCommand
)
const runCommands = computed(
  () => client.value.shell?.commands[activeConnectionId.value].slice(1) ?? []
)
function selectConnection(value: unknown) {
  if (
    (value === 'cloud' || value === 'local') &&
    value !== activeConnectionId.value
  ) {
    captureCliConnectionTabClick(value)
    const selectedClient = activeClientIds.value[activeConnectionId.value]
    activeClientIds.value[value] = selectedClient
    activeConnectionId.value = value
  }
}
function selectClient(value: unknown) {
  if (typeof value !== 'string' || !Object.hasOwn(clients, value)) return
  const id = value as CliClientId
  if (id === activeClientIds.value[activeConnectionId.value]) return
  activeClientIds.value[activeConnectionId.value] = id
  captureCliClientTabClick(id)
}
const copyLabel = t('ui.copy')
const copiedLabel = t('ui.copied')

const setupOpen = ref(false)
const dialogTop = ref<string>()
const manual = ref(false)
const usesManualSetup = computed(
  () => manual.value || client.value.kind === 'shell'
)
const setupMode = computed({
  get: () => (usesManualSetup.value ? 'manual' : 'agent'),
  set: (value: string) => {
    manual.value = value === 'manual'
  }
})
const setupModes = {
  agent: { name: t('cli.experience.agentMode') },
  manual: { name: t('cli.experience.manualMode') }
}
const opener = shallowRef<HTMLElement>()
function focusDialog(event: Event) {
  event.preventDefault()
  const dialog = event.target as HTMLElement
  dialogTop.value = `${Math.max(window.innerHeight * 0.075, (window.innerHeight - dialog.getBoundingClientRect().height) / 2)}px`
  dialog.scrollTop = 0
  dialog.focus({ preventScroll: true })
}
function restoreFocus(event: Event) {
  event.preventDefault()
  opener.value?.focus()
}
function openSetup(event: MouseEvent, manualMode = false) {
  dialogTop.value = undefined
  opener.value = event.currentTarget as HTMLElement
  manual.value = manualMode || client.value.kind === 'shell'
  setupOpen.value = true
}
</script>
<template>
  <div>
    <section
      id="setup"
      class="mx-auto max-w-6xl scroll-mt-36 px-6 py-12 lg:py-20"
    >
      <TabsRoot
        :model-value="activeClientIds[activeConnectionId]"
        activation-mode="manual"
        class="text-center"
        @update:model-value="selectClient"
      >
        <AgentSetupClientTabs
          :clients="clients"
          :label="t('cli.experience.clientLabel')"
        />
        <TabsContent :value="activeClientIds[activeConnectionId]">
          <div class="mt-12 lg:mt-16">
            <SectionHeader
              :heading-tag="headingTag"
              heading-size="hero"
              max-width="xl"
            >
              {{ t('cli.experience.heading') }}<br class="hidden sm:block" />
              {{
                t('cli.experience.headingWith', {
                  client:
                    client.kind === 'agent'
                      ? client.name
                      : t('cli.experience.terminal')
                })
              }}
              <template #subtitle
                ><p
                  class="mx-auto mt-6 max-w-2xl text-base text-smoke-700 lg:text-lg"
                >
                  {{ t('cli.experience.subtitle') }}
                </p></template
              >
            </SectionHeader>
          </div>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <BrandButton
              class="px-8 py-4 text-base uppercase focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none"
              @click="openSetup($event, false)"
              >{{
                t('cli.experience.setup', { client: client.name })
              }}</BrandButton
            >
            <BrandButton
              v-if="client.kind === 'agent'"
              class="px-8 py-4 text-base uppercase focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none"
              variant="outline"
              @click="openSetup($event, true)"
              >{{ t('cli.experience.manual') }}</BrandButton
            >
          </div>
          <div class="mx-auto mt-8 max-w-md">
            <CopyableField
              :class="codeFieldClass"
              :value="INSTALL_COMMAND"
              :copy-label="copyLabel"
              :copied-label="copiedLabel"
            />
          </div>
          <p class="mt-4 text-center text-xs text-primary-warm-gray">
            {{ t('cli.experience.summary') }}
          </p>
        </TabsContent></TabsRoot
      >
    </section>
    <section
      id="session"
      class="mx-auto max-w-6xl scroll-mt-36 px-6 py-12 lg:py-16"
      aria-labelledby="session-preview-heading"
    >
      <SectionHeader
        heading-tag="h2"
        heading-size="compact"
        :label="t('cli.experience.sessionLabel')"
        ><span id="session-preview-heading">{{
          t('cli.experience.sessionHeading')
        }}</span></SectionHeader
      >
      <div class="mt-8">
        <NativeCliSession :locale="locale" :show-footer="false" />
      </div>
    </section>
    <Dialog v-model:open="setupOpen">
      <DialogContent
        hide-close
        :close-label="t('cli.experience.close')"
        :style="{
          top: dialogTop,
          maxHeight: dialogTop
            ? `calc(100dvh - ${dialogTop} - 1.5rem)`
            : undefined
        }"
        class="top-[7.5vh] -translate-x-1/2 translate-y-0 rounded-3xl sm:max-w-6xl lg:p-8"
        @close-auto-focus="restoreFocus"
        @open-auto-focus="focusDialog"
      >
        <DialogClose as-child
          ><IconButton
            variant="outline"
            class="absolute top-6 right-6 size-12 border-0 bg-transparency-white-t8 text-primary-warm-white hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink"
            :aria-label="t('cli.experience.close')"
            ><X class="size-6" aria-hidden="true" /></IconButton
        ></DialogClose>
        <DialogTitle class="pr-16 text-2xl font-light">{{
          usesManualSetup
            ? t('cli.experience.dialogManual')
            : t('cli.experience.dialogAgent', { client: client.name })
        }}</DialogTitle>
        <DialogDescription class="mt-2 pr-12 text-xs">{{
          t('cli.experience.dialogDescription')
        }}</DialogDescription>
        <TabsRoot
          :model-value="activeClientIds[activeConnectionId]"
          activation-mode="manual"
          class="mt-4"
          @update:model-value="selectClient"
        >
          <AgentSetupClientTabs
            :clients="clients"
            :label="t('cli.experience.setupClientLabel')" />
          <TabsContent :value="activeClientIds[activeConnectionId]">
            <TabsRoot v-model="setupMode" activation-mode="manual">
              <div class="mt-4 flex flex-wrap items-center gap-4">
                <ToggleGroup
                  type="single"
                  :model-value="activeConnectionId"
                  :aria-label="t('cli.experience.connectionLabel')"
                  @update:model-value="selectConnection"
                >
                  <ToggleGroupItem value="cloud">Comfy Cloud</ToggleGroupItem
                  ><ToggleGroupItem value="local">{{
                    t('cli.experience.localLabel')
                  }}</ToggleGroupItem>
                </ToggleGroup>
                <CodeTabsPicker
                  v-if="client.kind === 'agent'"
                  v-model="setupMode"
                  :tabs="setupModes"
                  :label="t('cli.experience.methodLabel')"
                />
              </div>
              <component
                :is="client.kind === 'agent' ? TabsContent : 'div'"
                :value="client.kind === 'agent' ? setupMode : undefined"
              >
                <CliSetupInstall
                  :locale="locale"
                  :client="client"
                  :uses-manual-setup="usesManualSetup"
                  :is-headless="isHeadless"
                  :active-connection-id="activeConnectionId"
                  :agent-prompt="agentPrompt"
                  :connect-command="connectCommand"
                />
                <CliSetupRun
                  :locale="locale"
                  :client="client"
                  :uses-manual-setup="usesManualSetup"
                  :is-headless="isHeadless"
                  :active-connection-id="activeConnectionId"
                  :run-commands="runCommands"
                />
                <p class="mt-5 text-xs text-primary-warm-gray">
                  {{
                    activeConnectionId === 'local'
                      ? t('cli.experience.localBilling')
                      : t('cli.experience.cloudBilling', {
                          tagline: connection.tagline
                        })
                  }}
                </p>
                <div class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Button
                    v-if="activeConnectionId === 'local'"
                    variant="underlineLink"
                    size="sm"
                    href="https://docs.comfy.org/comfy-cli/getting-started#install-comfyui-local"
                    >{{ t('cli.experience.localGuide')
                    }}<template #append
                      ><ArrowUpRight
                        class="size-4"
                        aria-hidden="true" /></template></Button
                  ><Button
                    variant="underlineLink"
                    size="sm"
                    :href="externalLinks.docsCliReference"
                    >{{ t('cli.experience.reference')
                    }}<template #append
                      ><ArrowUpRight
                        class="size-4"
                        aria-hidden="true" /></template
                  ></Button>
                </div> </component
            ></TabsRoot> </TabsContent
        ></TabsRoot>
      </DialogContent>
    </Dialog>
  </div>
</template>
