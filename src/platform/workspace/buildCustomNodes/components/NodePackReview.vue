<template>
  <BuildDialogStep
    :title="
      $t(
        'buildCustomNodes.review.title',
        {
          count: session.picks.length,
          build: buildName
        },
        session.picks.length
      )
    "
    :description="
      $t('buildCustomNodes.review.body', {
        build: buildName,
        deployment: session.deploymentName
      })
    "
  >
    <NodePackList
      :label="$t('buildCustomNodes.review.listLabel')"
      :items="session.picks.map(pickItem)"
    />
    <p
      v-if="refusal"
      role="alert"
      class="m-0 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {{ refusal }}
    </p>
    <p class="m-0 text-sm text-muted-foreground">
      {{
        $t('buildCustomNodes.review.note', {
          version: session.build.release.version
        })
      }}
    </p>
    <template #actions>
      <Button
        variant="secondary"
        size="lg"
        class="mr-auto"
        :aria-label="$t('buildCustomNodes.review.backLabel')"
        :disabled="submitting"
        @click="emit('back')"
      >
        <i class="icon-[lucide--chevron-left]" aria-hidden="true" />
        {{ $t('g.back') }}
      </Button>
      <Button
        variant="inverted"
        size="lg"
        :loading="submitting"
        @click="emit('submit')"
      >
        {{ $t('buildCustomNodes.review.submit') }}
      </Button>
    </template>
  </BuildDialogStep>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { computed } from 'vue'

import type { BuildSession } from '@/platform/workspace/buildCustomNodes/buildCustomNodesFlow'
import BuildDialogStep from '@/platform/workspace/buildCustomNodes/components/BuildDialogStep.vue'
import NodePackList from '@/platform/workspace/buildCustomNodes/components/NodePackList.vue'
import { useNodePackListItems } from '@/platform/workspace/buildCustomNodes/useNodePackListItems'

const {
  session,
  refusal = null,
  submitting = false
} = defineProps<{
  session: BuildSession
  refusal?: string | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  back: []
  submit: []
}>()

const buildName = computed(() => session.build.build.name)

const { pickItem } = useNodePackListItems()
</script>
