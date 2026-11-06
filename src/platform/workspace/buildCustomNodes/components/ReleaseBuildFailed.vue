<template>
  <BuildDialogStep
    :title="$t('buildCustomNodes.failed.title', { version: release.version })"
    :description="
      $t('buildCustomNodes.failed.body', {
        deployment: session.deploymentName,
        version: session.build.release.version
      })
    "
  >
    <div class="flex flex-col overflow-hidden rounded-lg border border-border">
      <div
        class="flex h-9 items-center justify-between gap-3 bg-secondary pr-2 pl-3 text-xs"
      >
        <span class="text-muted-foreground">
          {{ $t('buildCustomNodes.failed.messageHeading') }}
        </span>
        <span class="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            :aria-label="$t('buildCustomNodes.failed.copyLabel')"
            @click="copy(message)"
          >
            <i
              :class="copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'"
              aria-hidden="true"
            />
            {{ copied ? $t('g.copied') : $t('g.copy') }}
          </Button>
          <Button
            variant="link"
            size="sm"
            as="a"
            :href="fullLogUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ $t('buildCustomNodes.failed.openLog') }}
            <i
              class="icon-[lucide--square-arrow-out-up-right]"
              aria-hidden="true"
            />
          </Button>
        </span>
      </div>
      <pre
        tabindex="0"
        :aria-label="$t('buildCustomNodes.failed.messageHeading')"
        class="m-0 max-h-60 overflow-auto bg-background p-3 font-mono text-xs/5 whitespace-pre-wrap"
        >{{ message }}</pre>
    </div>
    <template #actions>
      <Button variant="secondary" size="lg" @click="emit('change')">
        {{ $t('buildCustomNodes.failed.change') }}
      </Button>
      <Button variant="inverted" size="lg" @click="emit('retry')">
        {{ $t('buildCustomNodes.failed.retry') }}
      </Button>
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import type { ReleaseBuild } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'
import { platformLink } from '@/platform/workspace/utils/platformLink'

const { session, release } = defineProps<{
  session: BuildSession
  release: ReleaseBuild
}>()

const emit = defineEmits<{
  change: []
  retry: []
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ legacy: true })

const message = computed(
  () =>
    release.target.failure_reason ??
    release.timeline.findLast((entry) => entry.level === 'error')?.message ??
    t('buildCustomNodes.failed.noMessage')
)
const fullLogUrl = computed(() =>
  platformLink(`/profile/builds/${session.build.build.build_id}`)
)
</script>
