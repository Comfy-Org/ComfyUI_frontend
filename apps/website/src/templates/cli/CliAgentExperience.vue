<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef } from 'vue'
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
import { cliSetupFor, INSTALL_COMMAND } from './cliSetup'
import type { ConnectionId } from './cliSetup'
import type { CliClientId } from '@/scripts/posthog'
const { headingTag = 'h1', locale = 'en' } = defineProps<{
  headingTag?: 'h1' | 'h2'
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const { clients, connections } = cliSetupFor(locale)

const DEFAULT_CLIENT_ID = 'claude-code'

const activeConnectionId = ref<ConnectionId>('cloud')
const activeClientId = ref<CliClientId>(DEFAULT_CLIENT_ID)

const connection = computed(() => connections[activeConnectionId.value])
const agentPrompt = computed(() => connection.value.agentCommand)
const client = computed(() => clients[activeClientId.value])
const isHeadless = computed(() => activeClientId.value === 'ci')
const connectCommand = computed(() =>
  client.value.kind === 'shell' && isHeadless.value
    ? client.value.shell.commands[activeConnectionId.value][0]
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
    activeConnectionId.value = value
  }
}
function selectClient(value: unknown) {
  if (typeof value !== 'string' || !Object.hasOwn(clients, value)) return
  const id = value as CliClientId
  if (id === activeClientId.value) return
  activeClientId.value = id
  captureCliClientTabClick(id)
}
const copyLabel = t('ui.copy')
const copiedLabel = t('ui.copied')

const setupOpen = ref(false)
const dialogTop = ref<string>()
const manualMode = ref(false)
const usesManualSetup = computed(
  () => manualMode.value || client.value.kind === 'shell'
)
const setupMode = computed({
  get: () => (usesManualSetup.value ? 'manual' : 'agent'),
  set: (value: string) => {
    manualMode.value = value === 'manual'
  }
})
const setupModes = {
  agent: { name: t('cli.experience.agentMode') },
  manual: { name: t('cli.experience.manualMode') }
}
const opener = shallowRef<HTMLElement>()
const setupButton =
  useTemplateRef<InstanceType<typeof BrandButton>>('setupButton')
function focusDialog(event: Event) {
  event.preventDefault()
  const dialog = event.target as HTMLElement
  dialogTop.value = `${Math.max(window.innerHeight * 0.075, (window.innerHeight - dialog.getBoundingClientRect().height) / 2)}px`
  dialog.scrollTop = 0
  dialog.focus({ preventScroll: true })
}
function restoreFocus(event: Event) {
  event.preventDefault()
  const target = opener.value?.isConnected
    ? opener.value
    : setupButton.value?.$el
  if (target instanceof HTMLElement) target.focus()
}
function openSetup(event: MouseEvent, { manual = false } = {}) {
  dialogTop.value = undefined
  opener.value = event.currentTarget as HTMLElement
  manualMode.value = manual || client.value.kind === 'shell'
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
        :model-value="activeClientId"
        activation-mode="manual"
        class="text-center"
        @update:model-value="selectClient"
      >
        <AgentSetupClientTabs
          :clients="clients"
          :label="t('cli.experience.clientLabel')"
        />
        <TabsContent :value="activeClientId">
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
              ref="setupButton"
              class="px-8 py-4 text-base uppercase focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none"
              @click="openSetup($event)"
              >{{
                t('cli.experience.setup', { client: client.name })
              }}</BrandButton
            >
            <BrandButton
              v-if="client.kind === 'agent'"
              class="px-8 py-4 text-base uppercase focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow focus-visible:outline-none"
              variant="outline"
              @click="openSetup($event, { manual: true })"
              >{{ t('cli.experience.manual') }}</BrandButton
            >
          </div>
          <div class="mx-auto mt-8 max-w-md">
            <CopyableField
              variant="cli"
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
          :model-value="activeClientId"
          activation-mode="manual"
          class="mt-4"
          @update:model-value="selectClient"
        >
          <AgentSetupClientTabs
            :clients="clients"
            :label="t('cli.experience.setupClientLabel')" />
          <TabsContent :value="activeClientId">
            <TabsRoot v-model="setupMode" activation-mode="manual">
              <div class="mt-4 flex flex-wrap items-center gap-4">
                <ToggleGroup
                  type="single"
                  :model-value="activeConnectionId"
                  :aria-label="t('cli.experience.connectionLabel')"
                  @update:model-value="selectConnection"
                >
                  <ToggleGroupItem value="cloud">{{
                    connections.cloud.name
                  }}</ToggleGroupItem
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
                    :href="externalLinks.docsCliLocalInstall"
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
