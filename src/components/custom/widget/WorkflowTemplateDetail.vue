<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Badge from '@/components/common/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import type {
  TemplateDetailGroup,
  TemplateDetailRow
} from '@/platform/workflow/templates/types/templateDetail'
import type { TemplateModelDownloadState } from '@/platform/workflow/templates/utils/templateModelDownloadState'
import { formatSize } from '@/utils/formatUtil'

const {
  title,
  description,
  groups,
  cloudUrl,
  isPartnerNode = false,
  openPending = false,
  modelSetupEnabled = false,
  setupPending = false,
  requirementsMet = false,
  modelDownloadsAvailable = false
} = defineProps<{
  title: string
  description: string
  groups: readonly TemplateDetailGroup[]
  cloudUrl?: string
  isPartnerNode?: boolean
  openPending?: boolean
  modelSetupEnabled?: boolean
  setupPending?: boolean
  requirementsMet?: boolean
  modelDownloadsAvailable?: boolean
}>()

const emit = defineEmits<{
  'open-template': []
  'download-models-and-open': []
  'download-model': [rowId: string]
}>()

const { t } = useI18n()
const detailRoot = ref<HTMLElement | null>(null)
const detailId = useId()
const cloudTitleId = `${detailId}-cloud-title`
const groupTitleId = (groupId: string) => `${detailId}-group-${groupId}`
const offerDownloadAndOpen = computed(
  () =>
    modelSetupEnabled &&
    !requirementsMet &&
    (setupPending || modelDownloadsAvailable)
)

defineExpose({
  focus: () => detailRoot.value?.focus()
})

const showFullDescription = ref(false)

type DownloadingState = Extract<
  TemplateModelDownloadState,
  { status: 'downloading' }
>

function getPassiveDownloadLabel(
  state: TemplateModelDownloadState | undefined
): string | undefined {
  switch (state?.status) {
    case 'queued':
      return t('templateWorkflows.detail.downloadQueued')
    case 'starting':
      return t('templateWorkflows.detail.downloadStarting')
    default:
      return undefined
  }
}

function getProgressPercent(state: DownloadingState): number | undefined {
  if (state.fraction === null) return undefined
  return Math.round(Math.min(1, Math.max(0, state.fraction)) * 100)
}

function getKnownProgressText(state: DownloadingState): string | undefined {
  if (state.receivedBytes !== null && state.totalBytes !== null) {
    return `${formatSize(state.receivedBytes)} / ${formatSize(state.totalBytes)}`
  }
  if (state.receivedBytes !== null) return formatSize(state.receivedBytes)
  if (state.totalBytes !== null) return formatSize(state.totalBytes)
  return undefined
}

function getProgressText(state: DownloadingState): string {
  const knownProgress = getKnownProgressText(state)
  if (state.activity === 'paused') {
    return knownProgress
      ? t('templateWorkflows.detail.downloadPausedProgress', {
          progress: knownProgress
        })
      : t('templateWorkflows.detail.downloadPaused')
  }
  return knownProgress ?? t('templateWorkflows.detail.downloading')
}

function getProgressAriaLabel(
  row: TemplateDetailRow,
  state: DownloadingState
): string {
  return t(
    state.activity === 'paused'
      ? 'templateWorkflows.detail.downloadPausedModel'
      : 'templateWorkflows.detail.downloadingModel',
    { model: row.name },
    { escapeParameter: false }
  )
}

function getDownloadAriaLabel(row: TemplateDetailRow): string {
  return t(
    'templateWorkflows.detail.downloadModelNamed',
    { model: row.name },
    { escapeParameter: false }
  )
}

function getRetryAriaLabel(row: TemplateDetailRow): string {
  return t(
    'templateWorkflows.detail.retryDownloadNamed',
    { model: row.name },
    { escapeParameter: false }
  )
}

function getFailedDownloadLabel(
  state: Extract<TemplateModelDownloadState, { status: 'failed' }>
): string {
  return t(
    state.reason === 'cancelled'
      ? 'templateWorkflows.detail.downloadCancelled'
      : 'templateWorkflows.detail.downloadFailed'
  )
}
</script>

<template>
  <article
    ref="detailRoot"
    :aria-label="title"
    tabindex="-1"
    class="template-detail-enter @container/template-detail flex size-full min-h-0 flex-1 flex-col overflow-hidden bg-base-background text-base-foreground"
  >
    <div
      class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-t border-border-subtle @[48rem]/template-detail:grid-cols-[minmax(20rem,5fr)_minmax(0,6fr)] @[48rem]/template-detail:grid-rows-[auto_minmax(0,1fr)]"
    >
      <aside
        class="flex min-h-0 shrink-0 flex-col gap-6 overflow-y-auto border-b border-border-subtle p-6 @[48rem]/template-detail:row-span-2 @[48rem]/template-detail:gap-8 @[48rem]/template-detail:border-r @[48rem]/template-detail:border-b-0 @[48rem]/template-detail:p-8"
      >
        <div class="w-full shrink-0 overflow-hidden rounded-lg">
          <slot name="preview" />
        </div>

        <section
          v-if="cloudUrl"
          :aria-labelledby="cloudTitleId"
          class="flex shrink-0 flex-col gap-4 rounded-lg bg-secondary-background/50 p-4"
        >
          <div class="flex min-w-0 flex-col gap-2">
            <h3 :id="cloudTitleId" class="m-0 text-sm/5 font-semibold">
              {{
                t(
                  isPartnerNode
                    ? 'templateWorkflows.detail.partnerNodeTitle'
                    : 'templateWorkflows.detail.cloudUpsellTitle'
                )
              }}
            </h3>
            <p class="m-0 text-xs/4 font-normal text-muted-foreground">
              {{
                t(
                  isPartnerNode
                    ? 'templateWorkflows.detail.partnerNodeDescription'
                    : 'templateWorkflows.detail.cloudUpsellDescription'
                )
              }}
            </p>
          </div>
          <Button
            as="a"
            :href="cloudUrl"
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="md"
            class="w-full text-base-foreground no-underline"
          >
            {{ t('templateWorkflows.detail.openInCloud') }}
          </Button>
        </section>
      </aside>

      <div
        class="flex shrink-0 flex-col gap-2 p-6 @[48rem]/template-detail:p-8"
      >
        <h2 class="m-0 text-base font-semibold wrap-break-word">
          {{ title }}
        </h2>
        <p
          :class="
            cn(
              'm-0 max-w-2xl text-sm/relaxed wrap-break-word text-muted-foreground',
              !showFullDescription && 'line-clamp-3'
            )
          "
        >
          {{ description }}
        </p>
        <button
          v-if="description.length > 220"
          type="button"
          class="m-0 w-fit cursor-pointer border-0 bg-transparent p-0 text-sm text-base-foreground hover:underline"
          :aria-expanded="showFullDescription"
          @click="showFullDescription = !showFullDescription"
        >
          {{
            t(
              showFullDescription
                ? 'templateWorkflows.detail.descriptionLess'
                : 'templateWorkflows.detail.descriptionMore'
            )
          }}
        </button>
      </div>

      <div
        v-if="groups.length > 0"
        role="region"
        :aria-label="t('templateWorkflows.detail.requirements')"
        tabindex="0"
        class="min-h-0 overflow-y-auto border-t border-border-subtle px-4 py-2 @[48rem]/template-detail:px-6"
      >
        <section
          v-for="group in groups"
          :key="group.id"
          :aria-labelledby="groupTitleId(group.id)"
          class="border-t border-border-subtle/60 pb-2 first:border-t-0"
        >
          <div class="flex h-10 items-center gap-2 px-2">
            <h3 :id="groupTitleId(group.id)" class="m-0 text-sm font-medium">
              {{ group.label }}
            </h3>
            <Badge
              :label="group.rows.length"
              severity="secondary"
              variant="circle"
              class="size-5 text-xs"
            />
            <span
              v-if="group.total"
              class="ml-auto text-sm text-muted-foreground"
            >
              {{ group.total }}
            </span>
          </div>

          <ul class="m-0 list-none p-0">
            <li
              v-for="row in group.rows"
              :key="row.id"
              :class="
                cn(
                  'flex min-h-14 items-center gap-3 rounded-md p-2',
                  row.status?.kind === 'installed' && 'opacity-60'
                )
              "
            >
              <span
                class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary-background text-muted-foreground"
              >
                <img
                  v-if="
                    row.kind === 'input' && row.preview?.mediaType === 'image'
                  "
                  :src="row.preview.src"
                  alt=""
                  loading="lazy"
                  class="size-full object-cover"
                />
                <video
                  v-else-if="
                    row.kind === 'input' && row.preview?.mediaType === 'video'
                  "
                  :src="row.preview.src"
                  aria-hidden="true"
                  muted
                  playsinline
                  preload="metadata"
                  class="size-full object-cover"
                />
                <i
                  v-else
                  aria-hidden="true"
                  :class="
                    row.kind === 'input'
                      ? 'icon-[lucide--file-input] size-4'
                      : 'icon-[comfy--ai-model] size-4'
                  "
                />
              </span>

              <span class="flex min-w-0 flex-1 flex-col gap-0.5">
                <span class="truncate text-sm" :title="row.name">
                  {{ row.name }}
                </span>
                <span
                  class="truncate text-xs text-muted-foreground"
                  :title="row.description"
                >
                  {{ row.description }}
                </span>
              </span>

              <a
                v-if="row.status?.kind === 'manual'"
                :href="row.status.href"
                target="_blank"
                rel="noopener noreferrer"
                class="focus-visible:ring-ring shrink-0 text-xs text-base-foreground no-underline hover:underline focus-visible:rounded-sm focus-visible:ring-1 focus-visible:outline-none"
              >
                {{ row.status.label }}
                <span aria-hidden="true">↗</span>
              </a>

              <Button
                v-else-if="
                  row.status?.kind === 'downloadable' &&
                  (!row.status.downloadState ||
                    row.status.downloadState.status === 'idle')
                "
                v-tooltip.top="{
                  value: row.status.label,
                  class: 'template-detail-tooltip'
                }"
                :aria-label="getDownloadAriaLabel(row)"
                variant="textonly"
                size="unset"
                class="size-8 shrink-0 rounded-md p-1.5"
                @click="emit('download-model', row.id)"
              >
                <i aria-hidden="true" class="icon-[tabler--download] size-4" />
              </Button>

              <span
                v-else-if="
                  row.status?.kind === 'downloadable' &&
                  (row.status.downloadState?.status === 'queued' ||
                    row.status.downloadState?.status === 'starting')
                "
                role="status"
                class="shrink-0 text-xs text-muted-foreground"
              >
                {{ getPassiveDownloadLabel(row.status.downloadState) }}
              </span>

              <span
                v-else-if="
                  row.status?.kind === 'downloadable' &&
                  row.status.downloadState?.status === 'downloading'
                "
                class="flex shrink-0 items-center gap-2"
              >
                <span
                  role="progressbar"
                  :aria-label="
                    getProgressAriaLabel(row, row.status.downloadState)
                  "
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="getProgressPercent(row.status.downloadState)"
                  :aria-valuetext="getProgressText(row.status.downloadState)"
                  class="block h-1 w-24 overflow-hidden rounded-full bg-secondary-background"
                >
                  <span
                    :class="
                      cn(
                        'block h-full rounded-full bg-primary-background',
                        row.status.downloadState.fraction === null && 'w-1/3',
                        row.status.downloadState.fraction === null &&
                          row.status.downloadState.activity === 'active' &&
                          'animate-pulse'
                      )
                    "
                    :style="
                      getProgressPercent(row.status.downloadState) === undefined
                        ? undefined
                        : {
                            width: `${getProgressPercent(row.status.downloadState)}%`
                          }
                    "
                  />
                </span>
                <span class="text-xs text-muted-foreground">
                  {{ getProgressText(row.status.downloadState) }}
                </span>
              </span>

              <Badge
                v-else-if="
                  row.status?.kind === 'downloadable' &&
                  row.status.downloadState?.status === 'done'
                "
                role="status"
                :aria-label="t('templateWorkflows.detail.installed')"
                :label="t('templateWorkflows.detail.installed')"
                variant="label"
                class="h-5 bg-success-background/20 px-2 py-0.5 text-xs font-medium text-success-background normal-case"
              />

              <span
                v-else-if="
                  row.status?.kind === 'downloadable' &&
                  row.status.downloadState?.status === 'failed'
                "
                class="flex shrink-0 items-center gap-2"
              >
                <Badge
                  v-tooltip.top="{
                    value:
                      row.status.downloadState.reason === 'error'
                        ? t('templateWorkflows.detail.downloadFailedHint')
                        : undefined,
                    class: 'template-detail-tooltip'
                  }"
                  role="status"
                  :aria-label="getFailedDownloadLabel(row.status.downloadState)"
                  :label="getFailedDownloadLabel(row.status.downloadState)"
                  severity="danger"
                  variant="label"
                  class="h-5 px-2 py-0.5 text-xs font-medium normal-case"
                />
                <Button
                  :aria-label="getRetryAriaLabel(row)"
                  variant="outline"
                  size="unset"
                  class="h-6 rounded-md bg-secondary-background px-2 text-xs"
                  @click="emit('download-model', row.id)"
                >
                  {{ t('templateWorkflows.detail.retryDownload') }}
                </Button>
              </span>

              <span
                v-else-if="row.status?.kind === 'installed'"
                role="img"
                :aria-label="row.status.label"
                :title="row.status.label"
                class="flex size-6 shrink-0 items-center justify-center"
              >
                <i
                  aria-hidden="true"
                  class="icon-[lucide--circle-check] size-4 text-success-background"
                />
              </span>

              <span
                v-else-if="row.status"
                class="flex shrink-0 items-center gap-2"
              >
                <Badge
                  :label="row.status.label"
                  severity="secondary"
                  variant="label"
                  class="h-5 px-2 py-0.5 text-xs font-medium text-muted-foreground normal-case"
                />
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <footer
      class="flex min-h-15 shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border-subtle px-6 py-4"
    >
      <div class="ml-auto flex flex-wrap items-center justify-end gap-3">
        <Button
          v-if="offerDownloadAndOpen"
          variant="outline"
          size="lg"
          :disabled="openPending"
          @click="emit('open-template')"
        >
          {{ t('templateWorkflows.detail.openNow') }}
        </Button>
        <Button
          variant="inverted"
          size="lg"
          :loading="openPending"
          :disabled="offerDownloadAndOpen && setupPending"
          @click="
            offerDownloadAndOpen
              ? emit('download-models-and-open')
              : emit('open-template')
          "
        >
          {{
            t(
              offerDownloadAndOpen
                ? 'templateWorkflows.detail.downloadModelsAndOpen'
                : 'templateWorkflows.detail.openNow'
            )
          }}
        </Button>
      </div>
    </footer>
  </article>
</template>

<style>
.template-detail-enter {
  animation: template-detail-enter 180ms cubic-bezier(0.215, 0.61, 0.355, 1);
}

@keyframes template-detail-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .template-detail-enter {
    animation: none;
  }
}

.template-detail-tooltip .p-tooltip-text {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 16px;
}
</style>
