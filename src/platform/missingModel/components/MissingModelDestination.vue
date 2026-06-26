<template>
  <div class="flex min-w-0 flex-col gap-0.5 text-2xs/tight">
    <span v-if="!local" class="text-muted-foreground">
      {{ t('rightSidePanel.missingModels.remoteServerNotice') }}
    </span>

    <span class="flex min-w-0 items-center gap-1">
      <span v-if="local" class="shrink-0 text-muted-foreground">
        {{ t('rightSidePanel.missingModels.placeFileIn') }}
      </span>
      <span
        class="min-w-0 flex-1 truncate font-mono text-base-foreground"
        :title="fullPath ?? undefined"
      >
        {{ shortPath }}
      </span>
      <Button
        v-if="fullPath"
        data-testid="missing-model-copy-path"
        variant="textonly"
        size="unset"
        class="flex shrink-0 items-center gap-0.5 p-0.5 text-muted-foreground hover:bg-transparent hover:text-base-foreground focus-visible:ring-inset"
        @click="copyPath"
      >
        <i aria-hidden="true" class="icon-[lucide--copy] size-3" />
        {{ t('rightSidePanel.missingModels.copyPath') }}
      </Button>
    </span>

    <template v-if="extraPaths.length">
      <Button
        data-testid="missing-model-more-folders"
        variant="textonly"
        size="unset"
        class="self-start p-0.5 text-muted-foreground hover:bg-transparent hover:text-base-foreground focus-visible:ring-inset"
        :aria-expanded="showExtras"
        @click="showExtras = !showExtras"
      >
        {{
          showExtras
            ? t('rightSidePanel.missingModels.hideExtraFolders')
            : t('rightSidePanel.missingModels.moreFolders', extraPaths.length)
        }}
      </Button>
      <span
        v-for="path in extraPaths"
        v-show="showExtras"
        :key="path"
        class="truncate pl-1 font-mono text-muted-foreground"
        :title="path"
      >
        {{ shorten(path) }}
      </span>
    </template>

    <span v-if="downloadTriggered" class="text-muted-foreground">
      {{ t('rightSidePanel.missingModels.afterDownloadInstruction') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import { useI18n } from 'vue-i18n'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isLocalHost } from '@/platform/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const { directory, downloadTriggered = false } = defineProps<{
  directory: string
  downloadTriggered?: boolean
}>()

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()
const store = useMissingModelStore()

const local = isLocalHost()
const showExtras = ref(false)

const configuredPaths = computed(() => store.folderPaths[directory] ?? [])
const fullPath = computed<string | null>(() => configuredPaths.value[0] ?? null)
const extraPaths = computed(() => configuredPaths.value.slice(1))

function shorten(path: string): string {
  const segments = path
    .replace(/[/\\]+$/, '')
    .split(/[/\\]/)
    .filter(Boolean)
  if (segments.length <= 2) return path
  return `…/${segments.slice(-2).join('/')}/`
}

const shortPath = computed(() =>
  fullPath.value ? shorten(fullPath.value) : `models/${directory}/`
)

function copyPath() {
  if (fullPath.value) copyToClipboard(fullPath.value)
}
</script>
