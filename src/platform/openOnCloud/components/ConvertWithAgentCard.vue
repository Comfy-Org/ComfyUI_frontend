<template>
  <DeploymentDialogFrame
    data-testid="convert-with-agent-card"
    @dismiss="emit('dismiss')"
  >
    <section class="flex flex-col gap-4 px-9 pt-9 pb-8">
      <h2
        :id="titleId"
        class="my-0 pr-8 text-2xl/8 font-bold tracking-tight text-foreground"
      >
        {{ $t('openOnCloud.convertDialog.title') }}
      </h2>
      <p class="my-0 text-sm/5 text-muted-foreground">
        {{
          localAgent.isFound
            ? $t('openOnCloud.convertDialog.bodyAgentFound')
            : $t('openOnCloud.convertDialog.bodyAgentNotFound')
        }}
      </p>
      <footer class="flex items-center gap-2.5 pt-3">
        <template v-if="localAgent.isFound">
          <Button
            variant="link"
            size="link"
            class="mr-auto gap-2"
            @click="copyPrompt"
          >
            <i class="icon-[lucide--copy]" aria-hidden="true" />
            {{ $t('openOnCloud.convertDialog.copyPrompt') }}
          </Button>
          <Button variant="secondary" size="lg" @click="emit('dismiss')">
            {{ $t('g.cancel') }}
          </Button>
          <Button
            variant="inverted"
            size="lg"
            data-testid="convert-with-agent-go"
            @click="convert"
          >
            {{ $t('openOnCloud.convertDialog.letsGo') }}
          </Button>
        </template>
        <template v-else>
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
            {{ $t('openOnCloud.convertDialog.openInPlatform') }}
            <i class="icon-[lucide--external-link]" aria-hidden="true" />
          </Button>
          <Button variant="inverted" size="lg" @click="copyPrompt">
            <i class="icon-[lucide--copy]" aria-hidden="true" />
            {{ $t('openOnCloud.convertDialog.copyPrompt') }}
          </Button>
        </template>
      </footer>
    </section>
  </DeploymentDialogFrame>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { CloudWorkflowGaps } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { runOnCloudPrompt } from '@/platform/openOnCloud/runOnCloudPrompt'
import { useLocalAgentStore } from '@/platform/openOnCloud/stores/localAgentStore'
import DeploymentDialogFrame from '@/platform/workspace/components/DeploymentDialogFrame.vue'

const { gaps } = defineProps<{
  titleId?: string
  gaps: CloudWorkflowGaps
}>()

const emit = defineEmits<{
  done: []
  dismiss: []
}>()

defineOptions({ inheritAttrs: false })

const localAgent = useLocalAgentStore()
const { copyToClipboard } = useCopyToClipboard()
const platformUrl = getComfyPlatformBaseUrl()

function copyPrompt() {
  void copyToClipboard(runOnCloudPrompt(gaps))
}

function convert() {
  localAgent.convert()
  emit('done')
}
</script>
