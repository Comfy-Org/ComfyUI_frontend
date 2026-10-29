<template>
  <DeploymentDialogFrame
    data-testid="run-on-cloud-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <h2
        :id="titleId"
        class="my-0 pr-8 text-2xl/8 font-bold tracking-tight text-foreground"
      >
        {{ $t('openOnCloud.runDialog.title') }}
      </h2>
      <p class="my-0 text-sm/5 text-muted-foreground">{{ body }}</p>
      <footer class="flex items-center gap-2.5 pt-3">
        <template
          v-if="state.kind === 'nodePacksMissing' && !localAgent.isFound"
        >
          <Button
            variant="secondary"
            size="lg"
            class="ml-auto no-underline"
            as="a"
            :href="platformUrl"
            target="_blank"
            rel="noopener noreferrer"
            @click="emit('done')"
          >
            {{ $t('openOnCloud.runDialog.openInPlatform') }}
            <i class="icon-[lucide--external-link]" aria-hidden="true" />
          </Button>
          <Button variant="inverted" size="lg" @click="copyPrompt(state.gaps)">
            <i class="icon-[lucide--copy]" aria-hidden="true" />
            {{ $t('openOnCloud.runDialog.copyPrompt') }}
          </Button>
        </template>
        <template v-else>
          <Button
            v-if="state.kind === 'nodePacksMissing'"
            variant="link"
            size="link"
            class="gap-2"
            @click="copyPrompt(state.gaps)"
          >
            <i class="icon-[lucide--copy]" aria-hidden="true" />
            {{ $t('openOnCloud.runDialog.copyPrompt') }}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            class="ml-auto"
            @click="emit('dismiss')"
          >
            {{ $t('g.cancel') }}
          </Button>
          <Button
            variant="inverted"
            size="lg"
            :disabled="state.kind === 'checking'"
            data-testid="run-on-cloud-primary"
            @click="runPrimary"
          >
            {{ primary.label }}
            <i
              v-if="primary.opensTab"
              class="icon-[lucide--external-link]"
              aria-hidden="true"
            />
          </Button>
        </template>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { CloudWorkflowGaps } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { runOnCloudPrompt } from '@/platform/openOnCloud/runOnCloudPrompt'
import type { RunOnCloudModalState } from '@/platform/openOnCloud/runOnCloudModalState'
import { useLocalAgentStore } from '@/platform/openOnCloud/stores/localAgentStore'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const { state } = defineProps<{
  titleId?: string
  state: Exclude<RunOnCloudModalState, { kind: 'uploadModels' | 'uploading' }>
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const { t, locale } = useI18n()
const { showSignInDialog } = useAuthDialogs()
const localAgent = useLocalAgentStore()
const { copyToClipboard } = useCopyToClipboard()
const platformUrl = getComfyPlatformBaseUrl()

function listOf(names: string[]): string {
  return new Intl.ListFormat(locale.value).format(names)
}

function missingSentence({ nodePacks, models }: CloudWorkflowGaps): string {
  const packs = t('openOnCloud.runDialog.nodePacks', nodePacks.length)
  if (models.length === 0)
    return t('openOnCloud.runDialog.missingNodePacks', {
      nodePacks: packs,
      names: listOf(nodePacks)
    })
  return t('openOnCloud.runDialog.missingNodePacksAndModels', {
    nodePacks: packs,
    nodePackNames: listOf(nodePacks),
    models: t('openOnCloud.runDialog.models', models.length),
    modelNames: listOf(models.map((model) => model.name))
  })
}

const body = computed(() => {
  switch (state.kind) {
    case 'ready':
      return t('openOnCloud.runDialog.ready')
    case 'checking':
      return t('openOnCloud.runDialog.checking')
    case 'signedOut':
      return t('openOnCloud.runDialog.signedOut')
    case 'nodePacksMissing':
      return localAgent.isFound
        ? t('openOnCloud.runDialog.startAgentBody', {
            missing: missingSentence(state.gaps)
          })
        : t('openOnCloud.runDialog.agentNotFound')
  }
})

const primary = computed(() => {
  switch (state.kind) {
    case 'ready':
    case 'checking':
      return { label: t('openOnCloud.runDialog.openOnCloud'), opensTab: true }
    case 'nodePacksMissing':
      return { label: t('openOnCloud.runDialog.startAgent'), opensTab: false }
    case 'signedOut':
      return { label: t('openOnCloud.runDialog.signIn'), opensTab: false }
  }
})

function copyPrompt(gaps: CloudWorkflowGaps) {
  void copyToClipboard(runOnCloudPrompt(gaps))
}

function runPrimary() {
  switch (state.kind) {
    case 'checking':
      return
    case 'ready':
      void openWorkflowOnCloud()
      break
    case 'nodePacksMissing':
      localAgent.convert()
      break
    case 'signedOut':
      void showSignInDialog()
      break
  }
  emit('done')
}
</script>
