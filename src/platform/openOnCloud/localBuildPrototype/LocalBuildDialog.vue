<template>
  <div
    class="relative flex h-150 w-[min(780px,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-background text-sm/5 shadow-2xl"
    data-testid="local-build-dialog"
  >
    <aside
      class="flex w-70 shrink-0 flex-col border-r bg-[radial-gradient(120%_70%_at_30%_0%,--alpha(var(--color-foreground)/13%),transparent_70%)] p-7"
    >
      <i
        class="mt-2 icon-[lucide--cloud] size-12 text-foreground"
        aria-hidden="true"
      />
      <b
        class="mt-auto text-[40px]/11 font-semibold tracking-tight tabular-nums"
      >
        {{ formatSize(store.buildGb) }}
      </b>
      <span class="text-muted-foreground">
        {{ $t('localBuildPrototype.buildSize') }}
      </span>
    </aside>

    <section class="flex min-w-0 flex-1 flex-col p-8">
      <template v-if="store.view === 'start'">
        <DialogTitle class="my-0 text-xl">
          {{ $t('localBuildPrototype.start.title') }}
        </DialogTitle>
        <p class="my-0 mt-1.5 text-muted-foreground">
          {{ $t('localBuildPrototype.start.subtitle') }}
        </p>
        <label class="mt-6 flex flex-col gap-1.5">
          <span class="text-xs font-medium text-muted-foreground">
            {{ $t('localBuildPrototype.start.nameLabel') }}
          </span>
          <Input
            v-model="store.name"
            :placeholder="$t('localBuildPrototype.start.namePlaceholder')"
          />
        </label>
        <div class="mt-5 overflow-hidden rounded-lg bg-secondary">
          <button
            type="button"
            :class="rowClass"
            data-testid="local-build-nodes-row"
            @click="store.view = 'nodes'"
          >
            <span class="flex-1">
              {{ $t('localBuildPrototype.start.customNodes') }}
            </span>
            <span class="text-muted-foreground tabular-nums">
              {{
                $t(
                  'localBuildPrototype.start.packs',
                  { count: store.keptNodes.length },
                  store.keptNodes.length
                )
              }}
            </span>
            <i
              class="icon-[lucide--chevron-right] text-muted-foreground"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            :class="cn(rowClass, 'border-t')"
            data-testid="local-build-models-row"
            @click="store.view = 'models'"
          >
            <span class="flex-1">
              {{ $t('localBuildPrototype.start.models') }}
            </span>
            <span class="text-muted-foreground tabular-nums">
              {{
                $t(
                  'localBuildPrototype.start.modelCount',
                  {
                    count: store.keptModels.length,
                    size: formatSize(store.modelsGb)
                  },
                  store.keptModels.length
                )
              }}
            </span>
            <i
              class="icon-[lucide--chevron-right] text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        </div>
        <footer class="mt-auto flex items-center pt-7">
          <Button
            variant="inverted"
            size="lg"
            class="ml-auto"
            @click="store.view = 'gpu'"
          >
            {{ $t('localBuildPrototype.start.chooseGpu') }}
            <i class="icon-[lucide--chevron-right]" aria-hidden="true" />
          </Button>
        </footer>
      </template>

      <template v-else-if="store.view === 'nodes' || store.view === 'models'">
        <BackTitle
          :title="
            store.view === 'models'
              ? $t('localBuildPrototype.start.models')
              : $t('localBuildPrototype.start.customNodes')
          "
          @back="store.view = 'start'"
        />
        <div
          v-if="store.view === 'models'"
          class="mt-2 flex min-h-7 items-center gap-2.5 text-[13px] text-foreground/80"
        >
          <span class="tabular-nums">{{ unusedHint }}</span>
          <Button
            variant="secondary"
            size="sm"
            data-testid="local-build-remove-unused"
            @click="store.toggleUnusedModels()"
          >
            {{
              allUnusedRemoved
                ? $t('localBuildPrototype.list.undo')
                : $t('localBuildPrototype.list.removeUnused')
            }}
          </Button>
        </div>
        <div
          :class="
            cn(
              'relative min-h-0 flex-1 scrollbar-thin overflow-y-auto rounded-lg bg-secondary pt-1',
              store.view === 'models' ? 'mt-3' : 'mt-5'
            )
          "
        >
          <div
            v-for="item in listItems"
            :key="item.name"
            class="flex h-10 items-center gap-2.5 pr-2 pl-3.5"
          >
            <span
              :class="
                cn(
                  'min-w-0 truncate',
                  store.isRemoved(item) &&
                    'text-muted-foreground/60 line-through'
                )
              "
            >
              {{ item.name }}
            </span>
            <span
              v-if="item.unused && !store.isRemoved(item)"
              class="shrink-0 rounded-md bg-background/60 px-2 text-xs/5 text-foreground/80"
            >
              {{ $t('localBuildPrototype.list.unused') }}
            </span>
            <span
              :class="
                cn(
                  'ml-auto whitespace-nowrap text-muted-foreground tabular-nums',
                  store.isRemoved(item) &&
                    'text-muted-foreground/60 line-through'
                )
              "
            >
              {{ formatSize(item.gb) }}
            </span>
            <Button
              :variant="store.isRemoved(item) ? 'textonly' : 'muted-textonly'"
              :size="store.isRemoved(item) ? 'sm' : 'icon-sm'"
              :class="cn('shrink-0', !store.isRemoved(item) && 'size-7')"
              :aria-label="
                store.isRemoved(item)
                  ? $t('localBuildPrototype.list.undoRemove', {
                      name: item.name
                    })
                  : $t('localBuildPrototype.list.remove', { name: item.name })
              "
              @click="store.toggleItem(item)"
            >
              <template v-if="store.isRemoved(item)">
                {{ $t('localBuildPrototype.list.undo') }}
              </template>
              <i v-else class="icon-[lucide--x]" aria-hidden="true" />
            </Button>
          </div>
          <div
            class="pointer-events-none sticky bottom-0 h-8 bg-linear-to-b from-transparent to-secondary"
            aria-hidden="true"
          />
        </div>
        <footer class="flex items-center pt-7">
          <Button
            variant="secondary"
            size="lg"
            class="ml-auto"
            @click="store.view = 'start'"
          >
            {{ $t('localBuildPrototype.list.done') }}
          </Button>
        </footer>
      </template>

      <template v-else-if="store.view === 'gpu'">
        <BackTitle
          :title="$t('localBuildPrototype.gpu.title')"
          @back="store.view = 'start'"
        />
        <p class="my-0 mt-1.5 text-muted-foreground">
          {{ $t('localBuildPrototype.gpu.subtitle') }}
        </p>
        <div class="mt-5 overflow-hidden rounded-lg bg-secondary">
          <div
            :class="cn(gpuGrid, 'h-8 text-xs text-muted-foreground')"
            aria-hidden="true"
          >
            <span />
            <span>{{ $t('localBuildPrototype.gpu.name') }}</span>
            <span class="text-right">
              {{ $t('localBuildPrototype.gpu.vram') }}
            </span>
            <span class="text-right">
              {{ $t('localBuildPrototype.gpu.price') }}
            </span>
          </div>
          <RadioGroupRoot
            v-model="gpuValue"
            :aria-label="$t('localBuildPrototype.gpu.name')"
          >
            <label
              v-for="(gpu, index) in GPUS"
              :key="gpu.name"
              :class="
                cn(
                  gpuGrid,
                  'h-10 cursor-pointer border-t text-muted-foreground hover:bg-foreground/4',
                  index === store.gpuIndex && 'bg-foreground/6 text-foreground'
                )
              "
            >
              <RadioGroupItem :value="String(index)" />
              <span>{{ gpu.name }}</span>
              <span class="text-right">{{ gpu.vramGb }} GB</span>
              <span class="text-right">
                {{ formatPrice(gpu.pricePerHour) }}
              </span>
            </label>
          </RadioGroupRoot>
        </div>
        <dl class="my-0 mt-4 px-3.5">
          <div
            class="flex h-7 items-baseline justify-between gap-3 text-muted-foreground"
          >
            <dt>{{ $t('localBuildPrototype.gpu.gpuTime') }}</dt>
            <dd class="m-0 font-semibold text-foreground tabular-nums">
              {{
                $t('localBuildPrototype.gpu.perHour', {
                  price: formatPrice(store.gpu.pricePerHour)
                })
              }}
            </dd>
          </div>
          <div
            class="flex h-7 items-baseline justify-between gap-3 text-muted-foreground"
          >
            <dt>
              {{
                $t('localBuildPrototype.gpu.storage', {
                  size: formatSize(store.buildGb)
                })
              }}
            </dt>
            <dd class="m-0 font-semibold text-foreground tabular-nums">
              {{
                $t('localBuildPrototype.gpu.perMonth', {
                  price: formatPrice(store.buildGb * STORAGE_PRICE_PER_GB_MONTH)
                })
              }}
            </dd>
          </div>
        </dl>
        <footer class="mt-auto flex items-center pt-7">
          <Button
            variant="inverted"
            size="lg"
            class="ml-auto"
            data-testid="local-build-create"
            @click="store.createBuild()"
          >
            <i class="icon-[lucide--rocket]" aria-hidden="true" />
            {{ $t('localBuildPrototype.gpu.create') }}
          </Button>
        </footer>
      </template>

      <template v-else>
        <DialogTitle class="my-0 text-xl">
          {{ progressTitle }}
        </DialogTitle>
        <p class="my-0 mt-1.5 text-muted-foreground" aria-live="polite">
          {{ progressSubtitle }}
        </p>
        <div class="mt-6 overflow-hidden rounded-lg bg-secondary">
          <StepRow
            :label="$t('localBuildPrototype.progress.uploadStep')"
            :note="uploadNote"
            :state="store.phase === 'upload' ? 'running' : 'done'"
          />
          <div v-if="store.phase === 'upload'" class="h-0.5 bg-background/60">
            <div
              class="h-full bg-foreground transition-[width] duration-200 ease-linear"
              :style="{ width: `${store.uploadPercent}%` }"
            />
          </div>
          <StepRow
            :class="store.phase !== 'upload' && 'border-t'"
            :label="$t('localBuildPrototype.progress.buildStep')"
            :note="buildNote"
            :state="buildState"
          />
          <StepRow
            class="border-t"
            :label="$t('localBuildPrototype.progress.deployStep')"
            :note="deployNote"
            :state="deployState"
          />
        </div>
        <div
          v-if="store.phase === 'failed'"
          class="mt-3 rounded-lg border bg-muted px-3 py-2.5 font-mono text-xs/[18px] text-foreground/80"
        >
          {{ BUILD_ERROR }}
        </div>
        <footer class="mt-auto flex items-center gap-2 pt-7">
          <template v-if="store.isRunning">
            <Button
              variant="muted-textonly"
              size="lg"
              class="-ml-3"
              data-testid="local-build-cancel"
              @click="store.cancelBuild()"
            >
              {{ $t('localBuildPrototype.progress.cancel') }}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              class="ml-auto"
              @click="store.closeDialog()"
            >
              {{ $t('localBuildPrototype.progress.close') }}
            </Button>
          </template>
          <Button
            v-else-if="store.phase === 'ready'"
            variant="inverted"
            size="lg"
            class="ml-auto"
            @click="store.openComfyCloud()"
          >
            {{ $t('localBuildPrototype.openComfyCloud') }}
            <i
              class="icon-[lucide--square-arrow-out-up-right]"
              aria-hidden="true"
            />
          </Button>
          <template v-else-if="store.phase === 'failed'">
            <Button variant="muted-textonly" size="lg" class="-ml-3">
              {{ $t('localBuildPrototype.progress.viewLog') }}
              <i
                class="icon-[lucide--square-arrow-out-up-right]"
                aria-hidden="true"
              />
            </Button>
            <Menu side="top" align="end" :side-offset="6" class="min-w-52">
              <template #trigger>
                <Button
                  variant="inverted"
                  size="lg"
                  class="ml-auto gap-3"
                  data-testid="local-build-fix-with-agent"
                >
                  <DesktopAgentMarks />
                  {{ $t('localBuildPrototype.progress.fixWithAgent') }}
                  <i class="icon-[lucide--chevron-up]" aria-hidden="true" />
                </Button>
              </template>
              <MenuItem @select="store.fixWithAgent()">
                <i class="icon-[comfy--comfy-c]" aria-hidden="true" />
                {{ $t('localBuildPrototype.progress.comfyAgent') }}
              </MenuItem>
              <MenuItem @select="store.fixWithAgent()">
                <AgentMark agent="claude" />
                {{ $t('localBuildPrototype.progress.claudeCode') }}
              </MenuItem>
              <MenuItem @select="store.fixWithAgent()">
                <AgentMark agent="codex" />
                {{ $t('localBuildPrototype.progress.codex') }}
              </MenuItem>
              <MenuItem @select="store.fixWithAgent()">
                <i class="icon-[lucide--copy]" aria-hidden="true" />
                {{ $t('localBuildPrototype.progress.copyPrompt') }}
              </MenuItem>
            </Menu>
          </template>
        </footer>
      </template>
    </section>

    <Button
      variant="muted-textonly"
      size="icon"
      :aria-label="$t('g.close')"
      class="absolute top-3 right-3"
      @click="emit('dismiss')"
    >
      <i class="icon-[lucide--x]" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { RadioGroupRoot } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import Input from '@comfyorg/design-system/input/Input'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import RadioGroupItem from '@comfyorg/design-system/radio-group/RadioGroupItem'
import DesktopAgentMarks from '@/platform/openOnCloud/components/DesktopAgentMarks.vue'
import BackTitle from '@/platform/openOnCloud/localBuildPrototype/LocalBuildBackTitle.vue'
import StepRow from '@/platform/openOnCloud/localBuildPrototype/LocalBuildStepRow.vue'
import { useLocalBuildPrototypeStore } from '@/platform/openOnCloud/localBuildPrototype/localBuildPrototypeStore'
import {
  BUILD_ERROR,
  CUSTOM_NODES,
  GPUS,
  MODELS,
  STORAGE_PRICE_PER_GB_MONTH,
  formatPrice,
  formatSize,
  sortForReview
} from '@/platform/openOnCloud/localBuildPrototype/mockLocalBuild'
import AgentMark from '@/platform/workflow/deploy/components/AgentMark.vue'

const emit = defineEmits<{ dismiss: [] }>()
const { t } = useI18n()
const store = useLocalBuildPrototypeStore()

const rowClass =
  'flex h-11 w-full cursor-pointer items-center gap-3 border-0 bg-transparent pr-3 pl-3.5 text-left text-sm text-foreground hover:bg-foreground/4'
const gpuGrid = 'grid grid-cols-[16px_1fr_64px_64px] items-center gap-3 px-3.5'

const sortedNodes = sortForReview(CUSTOM_NODES)
const sortedModels = sortForReview(MODELS)
const listItems = computed(() =>
  store.view === 'models' ? sortedModels : sortedNodes
)

const allUnusedRemoved = computed(() => store.unusedModelsLeft.length === 0)
const unusedHint = computed(() => {
  if (allUnusedRemoved.value) {
    const count = store.unusedModels.length
    return t(
      'localBuildPrototype.list.removedModels',
      { count, size: formatSize(store.unusedModelsGb) },
      count
    )
  }
  const left = store.unusedModelsLeft
  return t(
    'localBuildPrototype.list.unusedModels',
    {
      count: left.length,
      size: formatSize(left.reduce((total, item) => total + item.gb, 0))
    },
    left.length
  )
})

const gpuValue = computed({
  get: () => String(store.gpuIndex),
  set: (value: string) => (store.gpuIndex = Number(value))
})

const progressTitle = computed(() => {
  if (store.phase === 'ready')
    return t('localBuildPrototype.progress.readyTitle', {
      name: store.buildName
    })
  if (store.phase === 'failed')
    return t('localBuildPrototype.progress.failedTitle')
  return t('localBuildPrototype.progress.creatingTitle', {
    name: store.buildName
  })
})

const progressSubtitle = computed(() => {
  switch (store.phase) {
    case 'upload':
      return t('localBuildPrototype.progress.uploadingSubtitle')
    case 'ready':
      return t('localBuildPrototype.progress.readySubtitle')
    case 'failed':
      return t('localBuildPrototype.progress.failedSubtitle')
    default:
      return t('localBuildPrototype.progress.buildingSubtitle')
  }
})

const uploadNote = computed(() =>
  store.phase === 'upload'
    ? t('localBuildPrototype.progress.uploaded', {
        done: formatSize((store.modelsGb * store.uploadPercent) / 100),
        total: formatSize(store.modelsGb)
      })
    : t('localBuildPrototype.progress.stepDone')
)

const buildState = computed(() => {
  if (store.phase === 'build') return 'running'
  if (store.phase === 'failed') return 'failed'
  if (store.phase === 'deploy' || store.phase === 'ready') return 'done'
  return 'waiting'
})

const buildNote = computed(() => {
  switch (store.phase) {
    case 'upload':
      return t('localBuildPrototype.progress.afterUpload')
    case 'build':
      return t('localBuildPrototype.progress.buildTime')
    case 'failed':
      return t('localBuildPrototype.progress.failed')
    default:
      return t('localBuildPrototype.progress.stepDone')
  }
})

const deployState = computed(() => {
  if (store.phase === 'deploy') return 'running'
  if (store.phase === 'ready') return 'done'
  return 'waiting'
})

const deployNote = computed(() => {
  switch (store.phase) {
    case 'deploy':
      return t('localBuildPrototype.progress.onGpu', { gpu: store.gpu.name })
    case 'ready':
      return t('localBuildPrototype.progress.stepDone')
    case 'failed':
      return ''
    default:
      return t('localBuildPrototype.progress.afterBuild')
  }
})
</script>
