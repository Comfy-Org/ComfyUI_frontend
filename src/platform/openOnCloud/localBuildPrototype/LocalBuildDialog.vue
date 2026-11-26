<template>
  <div
    class="relative flex h-120 w-[min(780px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-charcoal-500 bg-background text-sm/5 shadow-2xl"
    data-testid="local-build-dialog"
  >
    <aside
      class="flex w-70 shrink-0 flex-col border-r border-charcoal-500 bg-charcoal-900 bg-[radial-gradient(120%_70%_at_30%_0%,--alpha(var(--color-foreground)/13%),transparent_70%)] p-7"
    >
      <LocalBuildCloud
        class="mt-2 -ml-3"
        :floating="store.isRunning || store.phase === 'fixing'"
      />
      <b
        class="mt-auto text-[40px]/11 font-semibold tracking-[-0.03em] tabular-nums"
      >
        {{ formatSize(shownBuildGb) }}
      </b>
      <span class="text-muted-foreground">
        {{ $t('localBuildPrototype.buildSize') }}
      </span>
    </aside>

    <section class="relative min-w-0 flex-1 overflow-hidden">
      <Transition
        mode="out-in"
        :enter-from-class="
          direction === 'forward'
            ? 'translate-x-4 opacity-0'
            : '-translate-x-4 opacity-0'
        "
        :leave-to-class="
          direction === 'forward'
            ? '-translate-x-4 opacity-0'
            : 'translate-x-4 opacity-0'
        "
        enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
        leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
      >
        <div
          v-if="store.view === 'start'"
          key="start"
          class="flex h-full flex-col p-8"
        >
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
              class="border border-solid border-charcoal-400 bg-charcoal-950 px-3 transition-colors focus-visible:border-foreground focus-visible:ring-0"
              :placeholder="$t('localBuildPrototype.start.namePlaceholder')"
            />
          </label>
          <div class="mt-5 overflow-hidden rounded-[10px] bg-charcoal-700">
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
                class="icon-[lucide--chevron-right] text-charcoal-100"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              :class="cn(rowClass, 'border-t border-charcoal-500')"
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
                class="icon-[lucide--chevron-right] text-charcoal-100"
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
        </div>

        <div
          v-else-if="store.view === 'nodes' || store.view === 'models'"
          :key="store.view"
          class="flex h-full flex-col p-8"
        >
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
            <Transition
              mode="out-in"
              enter-from-class="opacity-0"
              leave-to-class="opacity-0"
              enter-active-class="transition-opacity duration-150"
              leave-active-class="transition-opacity duration-100"
            >
              <span :key="unusedHint" class="tabular-nums">
                {{ unusedHint }}
              </span>
            </Transition>
            <Button
              variant="secondary"
              size="sm"
              class="h-7 bg-charcoal-500 px-2.5"
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
                'relative min-h-0 flex-1 scrollbar-thin overflow-y-auto rounded-[10px] bg-charcoal-700 pt-1',
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
                    'min-w-0 truncate transition-colors duration-200',
                    store.isRemoved(item) && 'text-charcoal-100 line-through'
                  )
                "
              >
                {{ item.name }}
              </span>
              <Transition
                enter-from-class="scale-90 opacity-0"
                leave-to-class="scale-90 opacity-0"
                enter-active-class="transition duration-150 ease-out"
                leave-active-class="transition duration-100 ease-in"
              >
                <span
                  v-if="item.unused && !store.isRemoved(item)"
                  class="shrink-0 rounded-md bg-charcoal-500 px-2 text-xs/5 text-foreground/80"
                >
                  {{ $t('localBuildPrototype.list.unused') }}
                </span>
              </Transition>
              <span
                :class="
                  cn(
                    'ml-auto whitespace-nowrap text-muted-foreground tabular-nums transition-colors duration-200',
                    store.isRemoved(item) && 'text-charcoal-100 line-through'
                  )
                "
              >
                {{ formatSize(item.gb) }}
              </span>
              <Button
                variant="muted-textonly"
                :size="store.isRemoved(item) ? 'sm' : 'icon-sm'"
                class="h-7 min-w-7 shrink-0 rounded-md px-1"
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
              class="pointer-events-none sticky bottom-0 h-3.5 bg-linear-to-b from-transparent to-charcoal-700/85"
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
        </div>

        <div
          v-else-if="store.view === 'gpu'"
          key="gpu"
          class="flex h-full flex-col p-8"
        >
          <BackTitle
            :title="$t('localBuildPrototype.gpu.title')"
            @back="store.view = 'start'"
          />
          <p class="my-0 mt-1.5 text-muted-foreground">
            {{ $t('localBuildPrototype.gpu.subtitle') }}
          </p>
          <div class="mt-5 overflow-hidden rounded-[10px] bg-charcoal-700">
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
                    'h-10 cursor-pointer border-t border-charcoal-500 text-muted-foreground tabular-nums transition-colors duration-150 hover:bg-foreground/4',
                    index === store.gpuIndex && 'bg-foreground/6'
                  )
                "
              >
                <RadioGroupItem
                  :value="String(index)"
                  class="border-[1.5px] border-charcoal-100 transition-[border-width,border-color] duration-150 data-[state=checked]:border-[5px]"
                >
                  <span />
                </RadioGroupItem>
                <span class="text-foreground">{{ gpu.name }}</span>
                <span
                  :class="
                    cn(
                      'text-right',
                      index === store.gpuIndex && 'text-foreground'
                    )
                  "
                >
                  {{ gpu.vramGb }} GB
                </span>
                <span
                  :class="
                    cn(
                      'text-right',
                      index === store.gpuIndex && 'text-foreground'
                    )
                  "
                >
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
                    price: formatPrice(shownPrice)
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
                    price: formatPrice(
                      store.buildGb * STORAGE_PRICE_PER_GB_MONTH
                    )
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
        </div>

        <div v-else key="progress" class="flex h-full flex-col p-8">
          <Transition
            mode="out-in"
            enter-from-class="translate-y-1 opacity-0"
            leave-to-class="-translate-y-1 opacity-0"
            enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
            leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
          >
            <div :key="progressTitle + progressSubtitle">
              <DialogTitle class="my-0 text-xl">
                {{ progressTitle }}
              </DialogTitle>
              <p class="my-0 mt-1.5 text-muted-foreground" aria-live="polite">
                {{ progressSubtitle }}
              </p>
            </div>
          </Transition>
          <div class="mt-6 overflow-hidden rounded-[10px] bg-charcoal-700">
            <StepRow
              :label="$t('localBuildPrototype.progress.uploadStep')"
              :note="uploadNote"
              :state="store.phase === 'upload' ? 'running' : 'done'"
            />
            <TransitionCollapse :duration="250">
              <div
                v-if="store.phase === 'upload'"
                class="-mb-px h-0.5 bg-charcoal-500"
              >
                <div
                  class="h-full bg-foreground transition-[width] duration-200 ease-linear"
                  :style="{ width: `${store.uploadPercent}%` }"
                />
              </div>
            </TransitionCollapse>
            <StepRow
              class="border-t border-charcoal-500"
              :label="$t('localBuildPrototype.progress.buildStep')"
              :note="buildNote"
              :state="buildState"
            />
            <StepRow
              class="border-t border-charcoal-500"
              :label="$t('localBuildPrototype.progress.deployStep')"
              :note="deployNote"
              :state="deployState"
            />
          </div>
          <TransitionCollapse :duration="250">
            <div v-if="store.phase === 'failed'">
              <div
                class="mt-3 rounded-lg border border-charcoal-500 bg-charcoal-900 px-3 py-2.5 font-mono text-xs/[18px] text-foreground/80"
              >
                {{ BUILD_ERROR }}
              </div>
            </div>
          </TransitionCollapse>
          <Transition
            mode="out-in"
            enter-from-class="translate-y-1 opacity-0"
            leave-to-class="opacity-0"
            enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
            leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
          >
            <footer
              v-if="store.isRunning"
              key="running"
              class="mt-auto flex items-center gap-2 pt-7"
            >
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
            </footer>
            <footer
              v-else-if="store.phase === 'ready'"
              key="ready"
              class="mt-auto flex items-center gap-2 pt-7"
            >
              <Button
                variant="inverted"
                size="lg"
                class="ml-auto"
                @click="store.openComfyCloud()"
              >
                {{ $t('localBuildPrototype.openComfyCloud') }}
                <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
              </Button>
            </footer>
            <footer
              v-else-if="store.phase === 'failed'"
              key="failed"
              class="mt-auto flex items-center gap-2 pt-7"
            >
              <Button variant="muted-textonly" size="lg" class="-ml-3">
                {{ $t('localBuildPrototype.progress.viewLog') }}
                <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
              </Button>
              <Menu side="top" align="end" :side-offset="6" class="min-w-49">
                <template #trigger>
                  <Button
                    variant="inverted"
                    size="lg"
                    class="ml-auto"
                    data-testid="local-build-fix-with-agent"
                  >
                    <DesktopAgentMarks />
                    {{ $t('localBuildPrototype.progress.fixWithAgent') }}
                    <i class="icon-[lucide--chevron-down]" aria-hidden="true" />
                  </Button>
                </template>
                <MenuItem @select="store.fixWithAgent()">
                  <i class="icon-[lucide--sparkle]" aria-hidden="true" />
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
            </footer>
          </Transition>
        </div>
      </Transition>
    </section>

    <Button
      variant="muted-textonly"
      size="icon"
      :aria-label="$t('g.close')"
      class="absolute top-3 right-3 z-10"
      @click="emit('dismiss')"
    >
      <i class="icon-[lucide--x]" aria-hidden="true" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { TransitionPresets, useTransition } from '@vueuse/core'
import { RadioGroupRoot } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import Input from '@comfyorg/design-system/input/Input'
import Menu from '@comfyorg/design-system/menu/Menu'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import RadioGroupItem from '@comfyorg/design-system/radio-group/RadioGroupItem'
import TransitionCollapse from '@comfyorg/design-system/transition/TransitionCollapse'
import DesktopAgentMarks from '@/platform/openOnCloud/components/DesktopAgentMarks.vue'
import BackTitle from '@/platform/openOnCloud/localBuildPrototype/LocalBuildBackTitle.vue'
import LocalBuildCloud from '@/platform/openOnCloud/localBuildPrototype/LocalBuildCloud.vue'
import StepRow from '@/platform/openOnCloud/localBuildPrototype/LocalBuildStepRow.vue'
import { useLocalBuildPrototypeStore } from '@/platform/openOnCloud/localBuildPrototype/localBuildPrototypeStore'
import type { LocalBuildView } from '@/platform/openOnCloud/localBuildPrototype/localBuildPrototypeStore'
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
  'flex h-11 w-full cursor-pointer items-center gap-3 border-0 bg-transparent pr-3 pl-3.5 text-left text-sm text-foreground transition-colors duration-150 hover:bg-foreground/4'
const gpuGrid = 'grid grid-cols-[16px_1fr_64px_64px] items-center gap-3 px-3.5'

const VIEW_DEPTH: Record<LocalBuildView, number> = {
  start: 0,
  nodes: 1,
  models: 1,
  gpu: 1,
  progress: 2
}
const direction = ref<'forward' | 'back'>('forward')
watch(
  () => store.view,
  (next, previous) => {
    direction.value =
      VIEW_DEPTH[next] >= VIEW_DEPTH[previous] ? 'forward' : 'back'
  }
)

const numberMotion = {
  duration: 450,
  transition: TransitionPresets.easeOutCubic
}
const shownBuildGb = useTransition(() => store.buildGb, numberMotion)
const shownPrice = useTransition(() => store.gpu.pricePerHour, numberMotion)

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
