<template>
  <PopoverRoot :open @update:open="setOpen">
    <PopoverTrigger as-child>
      <Button
        variant="secondary"
        size="md"
        class="w-full justify-between font-mono"
        :aria-label="
          $t('buildCustomNodes.picker.versionLabel', {
            pack: pack.name,
            version: currentText
          })
        "
      >
        <span class="truncate">{{ currentText }}</span>
        <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-60 p-1">
      <p
        v-if="versions === null"
        class="m-0 px-2 py-1.5 text-xs text-muted-foreground"
      >
        {{ $t('buildCustomNodes.picker.loadingVersions') }}
      </p>
      <ul
        v-else
        :aria-label="
          $t('buildCustomNodes.picker.versionsOf', { pack: pack.name })
        "
        class="m-0 max-h-60 list-none overflow-y-auto p-0"
      >
        <li v-for="option in options" :key="option.key">
          <Button
            variant="textonly"
            size="md"
            :aria-pressed="option.selected"
            class="w-full justify-between font-mono"
            @click="choose(option.choice)"
          >
            {{ option.text }}
            <span
              v-if="option.hint"
              class="font-inter text-xs text-muted-foreground"
            >
              {{ option.hint }}
            </span>
          </Button>
        </li>
      </ul>
      <NodePackCommitPin
        v-if="pack.repository"
        :pack-name="pack.name"
        @pin="pinCommit"
      />
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildCustomNodesService } from '@/platform/workspace/buildCustomNodes/buildCustomNodesService'
import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import NodePackCommitPin from '@/platform/workspace/buildCustomNodes/components/NodePackCommitPin.vue'
import type { NodePackVersionChoice } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import { choiceLabel } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import { useNodePackListItems } from '@/platform/workspace/buildCustomNodes/useNodePackListItems'

const { pack, choice } = defineProps<{
  pack: NodePack
  choice: NodePackVersionChoice
}>()

const emit = defineEmits<{
  choose: [choice: NodePackVersionChoice]
}>()

const { t } = useI18n()
const { versionText } = useNodePackListItems()

const open = ref(false)
const versions = ref<readonly string[] | null>(null)

const currentText = computed(() => versionText(choiceLabel(choice)))

const options = computed(() => {
  const listed = (versions.value ?? []).map((version, index) => ({
    key: version,
    text: version,
    hint: index === 0 ? t('buildCustomNodes.picker.latest') : '',
    choice:
      index === 0
        ? ({ kind: 'latest', version } as const)
        : ({ kind: 'version', version } as const),
    selected: 'version' in choice && choice.version === version
  }))
  if (listed.length > 0 || !pack.repository) return listed
  return [
    {
      key: 'defaultBranch',
      text: t('buildCustomNodes.defaultBranch'),
      hint: '',
      choice: { kind: 'defaultBranch', repository: pack.repository } as const,
      selected: choice.kind === 'defaultBranch'
    }
  ]
})

async function loadVersions() {
  const outcome = await buildCustomNodesService.getNodePackVersions(pack.id)
  versions.value = outcome.ok ? outcome.value : []
}

function setOpen(isOpen: boolean) {
  open.value = isOpen
  if (isOpen && versions.value === null) void loadVersions()
}

function choose(next: NodePackVersionChoice) {
  emit('choose', next)
  open.value = false
}

function pinCommit(hash: string) {
  if (!pack.repository) return
  choose({ kind: 'commit', hash, repository: pack.repository })
}
</script>
