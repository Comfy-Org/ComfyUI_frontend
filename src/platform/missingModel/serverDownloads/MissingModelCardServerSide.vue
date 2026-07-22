<template>
  <div class="px-4 pb-2" data-testid="missing-model-card-server-side">
    <!-- HF login banner: shown when there's at least one gated row and
         the deployment is eligible but not yet logged in. -->
    <div
      v-if="showLoginBanner"
      data-testid="missing-model-hf-login-banner"
      class="my-2 flex items-start gap-2 rounded-lg border border-primary-background/40 bg-primary-background/10 p-3"
    >
      <div class="flex size-5 shrink-0 items-center justify-center">
        <i
          aria-hidden="true"
          class="icon-[lucide--log-in] size-5 text-primary-background"
        />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex flex-col gap-0.5">
          <p class="text-foreground text-sm font-semibold">
            {{ t('rightSidePanel.missingModels.hfLoginRequired') }}
          </p>
          <p class="text-xs/tight text-muted-foreground">
            {{ t('rightSidePanel.missingModels.hfLoginPrompt') }}
          </p>
        </div>
        <Button
          data-testid="missing-model-hf-login"
          variant="primary"
          size="sm"
          class="self-start rounded-lg text-sm"
          @click="handleLogin"
        >
          <i aria-hidden="true" class="icon-[lucide--log-in] size-4 shrink-0" />
          {{ t('rightSidePanel.missingModels.logInWithHf') }}
        </Button>
      </div>
    </div>

    <div
      v-if="hasAnyDownloadableMissing"
      data-testid="missing-model-actions"
      class="flex items-center gap-2 border-b border-interface-stroke py-2"
    >
      <Button
        data-testid="missing-model-download-all"
        variant="secondary"
        size="sm"
        class="h-8 min-w-0 flex-1 rounded-lg text-sm"
        @click="handleDownloadAll"
      >
        <i aria-hidden="true" class="icon-[lucide--download] size-4 shrink-0" />
        <span class="truncate">{{ downloadAllLabel }}</span>
      </Button>
    </div>

    <div
      v-for="{ group, rows } in groupViews"
      :key="`server-side::${group.directory ?? '__unknown__'}`"
      class="flex w-full flex-col border-t border-interface-stroke py-2 first:border-t-0 first:pt-0"
    >
      <div class="flex h-8 w-full items-center">
        <p
          class="min-w-0 flex-1 truncate text-sm font-medium text-destructive-background-hover"
        >
          {{
            group.directory ?? t('rightSidePanel.missingModels.unknownCategory')
          }}
          ({{ group.models.length }})
        </p>
      </div>

      <div class="flex flex-col gap-1 overflow-hidden pl-2">
        <div
          v-for="row in rows"
          :key="row.model.name"
          class="flex w-full flex-col py-1"
        >
          <div class="flex h-8 w-full items-center gap-2">
            <i
              aria-hidden="true"
              class="text-foreground icon-[lucide--file-check] size-4 shrink-0"
            />
            <p
              class="text-foreground min-w-0 flex-1 truncate text-sm font-medium"
              :title="row.model.name"
            >
              {{ row.model.name }}
            </p>
          </div>

          <p v-if="row.id === null" class="px-1 text-xs text-muted-foreground">
            {{ t('rightSidePanel.missingModels.unknownCategory') }}
          </p>

          <p
            v-else-if="row.status === 'gated'"
            class="flex items-start gap-1.5 p-1 text-xs text-warning-background"
            data-testid="missing-model-gated-notice"
          >
            <i
              aria-hidden="true"
              class="mt-0.5 icon-[lucide--lock] size-3.5 shrink-0"
            />
            <!-- Three sub-states, by (eligible, logged-in):
                 - not eligible: manual-download instructions (legacy text)
                 - eligible, not logged in: pointer to the login banner above
                 - eligible, logged in: accept-license-and-come-back -->
            <i18n-t
              v-if="gatedMode === 'manual'"
              keypath="rightSidePanel.missingModels.gatedManual"
              tag="span"
            >
              <template #repositoryPage>
                <a
                  :href="row.browseUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline"
                >
                  {{ t('rightSidePanel.missingModels.repositoryPage') }}
                </a>
              </template>
              <template #modelPath>
                <code class="font-mono">models/{{ group.directory }}/</code>
              </template>
            </i18n-t>
            <span v-else-if="gatedMode === 'need-login'">
              {{ t('rightSidePanel.missingModels.gatedNeedLogin') }}
            </span>
            <i18n-t
              v-else
              keypath="rightSidePanel.missingModels.gatedAccept"
              tag="span"
            >
              <template #repositoryPage>
                <a
                  :href="row.browseUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline"
                >
                  {{ t('rightSidePanel.missingModels.repositoryPage') }}
                </a>
              </template>
            </i18n-t>
          </p>

          <div
            v-else-if="row.status === 'downloading'"
            class="flex items-center gap-2 py-1"
            data-testid="missing-model-downloading"
          >
            <div
              class="h-2 flex-1 overflow-hidden rounded-full bg-secondary-background"
            >
              <div
                class="h-full bg-primary transition-all"
                :style="{
                  width: `${Math.round((row.progress ?? 0) * 100)}%`
                }"
              />
            </div>
            <span class="w-16 text-right text-xs text-muted-foreground">
              {{ row.progressLabel }}
            </span>
            <Button
              data-testid="missing-model-cancel"
              variant="textonly"
              size="icon-sm"
              class="size-7 shrink-0"
              :aria-label="t('g.cancel')"
              @click="handleCancel(row)"
            >
              <i
                aria-hidden="true"
                class="icon-[lucide--x] size-4 text-muted-foreground"
              />
            </Button>
          </div>

          <p
            v-else-if="row.status === 'available'"
            class="flex items-center gap-1.5 p-1 text-xs text-success-background"
          >
            <i
              aria-hidden="true"
              class="icon-[lucide--check] size-3.5 shrink-0"
            />
            <span>{{ t('g.downloaded') }}</span>
          </p>

          <Button
            v-else
            data-testid="missing-model-download"
            variant="secondary"
            size="md"
            class="flex w-full flex-1"
            :aria-label="`${t('g.download')} ${row.model.name}`"
            @click="handleSingleDownload(row)"
          >
            <i
              aria-hidden="true"
              class="text-foreground mr-1 icon-[lucide--download] size-4 shrink-0"
            />
            <span class="text-foreground min-w-0 truncate text-sm">
              {{ row.downloadLabel }}
            </span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  MissingModelGroup,
  MissingModelViewModel
} from '@/platform/missingModel/types'
import { toBrowsableUrl } from '@/platform/missingModel/missingModelDownload'
import { useServerSideDownloadsStore } from '@/platform/missingModel/serverDownloads/useServerSideDownloads'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { modelIdFor } from '@/platform/missingModel/serverDownloads/serverDownloadsApi'
import type { ServerDownloadStatus } from '@/platform/missingModel/serverDownloads/serverDownloadsApi'
import { formatSize } from '@/utils/formatUtil'

/** ``huggingface.co/<org>/<repo>/resolve/<rev>/<path>``
 *      → ``huggingface.co/<org>/<repo>``.
 *
 * The license-accept page lives at the repo root, not at the file
 * blob URL. For non-HF URLs we fall back to ``toBrowsableUrl`` which
 * is fine for Civitai (its public model page) and a no-op otherwise. */
function repoHomeUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname !== 'huggingface.co') return toBrowsableUrl(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return toBrowsableUrl(url)
    return `https://huggingface.co/${parts[0]}/${parts[1]}`
  } catch {
    return toBrowsableUrl(url)
  }
}

const props = defineProps<{
  missingModelGroups: MissingModelGroup[]
}>()

const { t } = useI18n()
const store = useServerSideDownloadsStore()

function flattenRegistrations(
  groups: MissingModelGroup[]
): { modelId: string; url: string }[] {
  const out: { modelId: string; url: string }[] = []
  for (const group of groups) {
    if (!group.directory) continue
    for (const model of group.models) {
      const rep = model.representative
      if (!rep.url) continue
      out.push({
        modelId: modelIdFor(group.directory, rep.name),
        url: rep.url
      })
    }
  }
  return out
}

watch(
  () => props.missingModelGroups,
  (next) => store.setRegistered(flattenRegistrations(next)),
  { deep: true, immediate: true }
)
onBeforeUnmount(() => store.clear())

/** Per-row state computed once and used everywhere — saves re-deriving
 *  the same fields 4-7× per render from the template. */
interface RowView {
  model: MissingModelViewModel
  /** Null when the row has no usable url+directory and can't be driven. */
  id: string | null
  status: ServerDownloadStatus
  progress: number | null
  progressLabel: string
  downloadLabel: string
  browseUrl: string
}

interface GroupView {
  group: MissingModelGroup
  rows: RowView[]
}

function buildRow(
  model: MissingModelViewModel,
  group: MissingModelGroup
): RowView {
  const rep = model.representative
  const id =
    rep.url && group.directory ? modelIdFor(group.directory, rep.name) : null

  const entry = id ? store.entryOf(id) : undefined

  let status: ServerDownloadStatus = 'missing'
  if (entry) {
    if (entry.state === 'available') status = 'available'
    else if (entry.state === 'downloading') status = 'downloading'
    else if (entry.is_hf_downloadable === false) status = 'gated'
  }

  const dp = entry?.progress ?? null
  const progress = dp?.progress ?? null
  const progressLabel = dp
    ? dp.progress !== null
      ? `${Math.round(dp.progress * 100)}%`
      : formatSize(dp.bytes_downloaded)
    : ''

  const baseDownload = t('g.download')
  const size = entry?.file_size ?? null
  const downloadLabel = size
    ? `${baseDownload} (${formatSize(size)})`
    : baseDownload

  return {
    model,
    id,
    status,
    progress,
    progressLabel,
    downloadLabel,
    browseUrl: rep.url ? repoHomeUrl(rep.url) : '#'
  }
}

const groupViews = computed<GroupView[]>(() =>
  props.missingModelGroups.map((g) => ({
    group: g,
    rows: g.models.map((m) => buildRow(m, g))
  }))
)

const hasAnyDownloadableMissing = computed(
  () => store.downloadableMissingIds.length > 0
)

/** Show the HF login banner iff:
 *   - there's at least one row gated to us, AND
 *   - the deployment is eligible for interactive login, AND
 *   - we don't already have a stored token.
 *
 * Once the user logs in (token_available flips true), the store
 * re-probes metadata and gated rows that the token unlocks flip
 * to ``downloadable`` automatically. */
const showLoginBanner = computed(
  () =>
    store.hasAnyGated && store.hfAuth.eligible && !store.hfAuth.token_available
)

/** Which message variant to show on a gated row.
 *
 * - ``manual``     — multi-tenant / public-IP deployment; user must
 *                    acquire the file out-of-band.
 * - ``need-login`` — eligible deployment but not logged in yet.
 * - ``accept``     — logged in but token doesn't grant access; user
 *                    must accept the license on huggingface.co. */
const gatedMode = computed<'manual' | 'need-login' | 'accept'>(() => {
  if (!store.hfAuth.eligible) return 'manual'
  if (!store.hfAuth.token_available) return 'need-login'
  return 'accept'
})

async function handleLogin() {
  try {
    await store.beginHfLogin()
  } catch {
    // Errors are logged inside the store; nothing else to surface here.
  }
}

const downloadAllLabel = computed(() => {
  const base = store.hasAnyGated
    ? t('rightSidePanel.missingModels.downloadAllAvailable')
    : t('rightSidePanel.missingModels.downloadAll')
  const total = store.downloadableMissingIds.reduce(
    (sum: number, id: string) => sum + (store.entryOf(id)?.file_size ?? 0),
    0
  )
  return total > 0 ? `${base} (${formatSize(total)})` : base
})

async function handleDownloadAll() {
  await store.startDownload(store.downloadableMissingIds.slice())
}

async function handleSingleDownload(row: RowView) {
  if (!row.id) return
  await store.startSingleDownload(row.id)
}

async function handleCancel(row: RowView) {
  if (!row.id) return
  try {
    await store.cancelDownload(row.id)
  } catch (err) {
    console.warn('[serverSideDownloads] cancel failed:', err)
    useToastStore().add({
      severity: 'error',
      summary: t('rightSidePanel.missingModels.cancelFailed')
    })
  }
}
</script>
