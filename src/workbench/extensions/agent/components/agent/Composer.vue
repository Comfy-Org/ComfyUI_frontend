<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, inject, nextTick, ref, useTemplateRef, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildTooltipConfig } from '@/composables/useTooltipConfig'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  getAssetDisplayName,
  getAssetUrlFilename
} from '@/platform/assets/utils/assetMetadataUtils'

import Textarea from '@/components/ui/textarea/Textarea.vue'
import type { ComposerAttachment } from '../../composables/agent/useComposer'
import { useComposer } from '../../composables/agent/useComposer'
import type { SelectedNode } from '../../composables/agent/useCanvasSelection'
import { cn } from '@comfyorg/tailwind-utils'

import AttachmentChip from './composer/AttachmentChip.vue'
import RunModePopover from './composer/RunModePopover.vue'

const {
  streaming = false,
  submitting = false,
  canAttach = false,
  canOpenAssets = false,
  selectionTags = [],
  getMentionNodes = () => [],
  getMentionAssets = async () => []
} = defineProps<{
  streaming?: boolean
  submitting?: boolean
  canAttach?: boolean
  canOpenAssets?: boolean
  selectionTags?: SelectedNode[]
  getMentionNodes?: () => SelectedNode[]
  getMentionAssets?: () => AssetItem[] | Promise<AssetItem[]>
}>()
const emit = defineEmits<{
  send: [text: string, attachments: ComposerAttachment[]]
  stop: []
  attach: []
  openAssets: []
  selectNodes: []
  removeTag: [id: string]
  mentionPick: [node: SelectedNode]
}>()

const assetDragActive = inject<Readonly<Ref<boolean>>>(
  'agentAssetDragActive',
  ref(false)
)

const duplicateIdClass =
  'shrink-0 rounded-[26px] bg-charcoal-400 px-2 py-0.5 font-mono text-xs/4 font-medium text-smoke-800'

const mentionNodes = ref<SelectedNode[]>([])
const mentionAssets = ref<AssetItem[]>([])
function loadMentionNodes(): void {
  mentionNodes.value = getMentionNodes().toSorted((a, b) =>
    a.title.localeCompare(b.title)
  )
}

async function loadMentionAssets(): Promise<void> {
  try {
    mentionAssets.value = (await getMentionAssets()).toSorted((a, b) =>
      getAssetDisplayName(a).localeCompare(getAssetDisplayName(b))
    )
  } catch {
    mentionAssets.value = []
  }
}

const mentionOpen = ref(false)
const mentionQuery = ref('')
const mentionStart = ref(-1)
const mentionActive = ref(0)

type MentionMatch =
  | { kind: 'node'; id: string; label: string; node: SelectedNode }
  | { kind: 'asset'; id: string; label: string; asset: AssetItem }

const mentionMatches = computed<MentionMatch[]>(() => {
  if (!mentionOpen.value) return []
  const query = mentionQuery.value.toLowerCase()
  return [
    ...mentionNodes.value
      .filter(
        (node) =>
          node.title.toLowerCase().includes(query) || node.id.includes(query)
      )
      .map(
        (node): MentionMatch => ({
          kind: 'node',
          id: node.id,
          label: node.title,
          node
        })
      ),
    ...mentionAssets.value
      .filter((asset) => {
        const label = getAssetDisplayName(asset).toLowerCase()
        return label.includes(query) || asset.name.toLowerCase().includes(query)
      })
      .map(
        (asset): MentionMatch => ({
          kind: 'asset',
          id: asset.id,
          label: getAssetDisplayName(asset),
          asset
        })
      )
  ].toSorted((a, b) => a.label.localeCompare(b.label))
})

const mentionVisible = computed(() => mentionMatches.value.length > 0)

function duplicatedTitles(nodes: SelectedNode[]): Set<string> {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const node of nodes) {
    if (seen.has(node.title)) dupes.add(node.title)
    else seen.add(node.title)
  }
  return dupes
}

const graphDupes = computed(() => duplicatedTitles(mentionNodes.value))
const tagDupes = computed(() => duplicatedTitles(selectionTags))

watch(
  () => selectionTags,
  (tags) => {
    if (tags.length) loadMentionNodes()
  },
  { immediate: true }
)

function closeMention(): void {
  mentionOpen.value = false
  mentionQuery.value = ''
  mentionStart.value = -1
  mentionActive.value = 0
}

function syncMention(event: Event): void {
  const el = event.target as HTMLTextAreaElement
  const caret = el.selectionStart ?? 0
  const text = el.value
  const at = text.lastIndexOf('@', caret - 1)
  const atValid =
    at !== -1 && at < caret && (at === 0 || /\s/.test(text[at - 1]))
  if (!atValid) {
    closeMention()
    return
  }
  const query = text.slice(at + 1, caret)
  if (query.includes('\n')) {
    closeMention()
    return
  }
  if (!mentionOpen.value) {
    loadMentionNodes()
    void loadMentionAssets()
  }
  mentionOpen.value = true
  mentionStart.value = at
  mentionQuery.value = query
  mentionActive.value = 0
}

function pickMention(match: MentionMatch): void {
  if (match.kind === 'node') emit('mentionPick', match.node)
  else {
    const attachmentId = `asset:${match.asset.id}`
    if (!composer.attachments.value.some((item) => item.id === attachmentId)) {
      composer.addAttachment({
        id: attachmentId,
        name: match.label,
        ref: getAssetUrlFilename(match.asset),
        previewUrl: match.asset.thumbnail_url ?? match.asset.preview_url
      })
    }
  }
  const draft = composer.draft.value
  const before = draft.slice(0, mentionStart.value)
  const end = mentionStart.value + 1 + mentionQuery.value.length
  let after = draft.slice(end)
  if (after.startsWith(' ') && (before === '' || before.endsWith(' ')))
    after = after.slice(1)
  composer.draft.value = before + after
  closeMention()
  textareaRef.value?.focus()
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (mentionVisible.value && !event.isComposing && !event.shiftKey) {
    const matches = mentionMatches.value
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      mentionActive.value = (mentionActive.value + 1) % matches.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      mentionActive.value =
        (mentionActive.value - 1 + matches.length) % matches.length
      return
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      pickMention(matches[mentionActive.value])
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeMention()
      return
    }
  }
  if (event.key === 'Enter') onEnter(event)
}

const CARET_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End']

function onComposerKeyup(event: KeyboardEvent): void {
  if (mentionOpen.value && CARET_KEYS.includes(event.key)) syncMention(event)
}

const mentionListRef = useTemplateRef<HTMLDivElement>('mentionListRef')
watch(mentionActive, async () => {
  await nextTick()
  mentionListRef.value
    ?.querySelector('[aria-selected="true"]')
    ?.scrollIntoView?.({ block: 'nearest' })
})

const { t } = useI18n()

const placeholderHint = computed(() => {
  const [firstLine = '', secondLine = ''] = t('agent.placeholder').split('\n')
  const addNodes = t('agent.addNodesFromGraph').toLocaleLowerCase()
  return {
    firstLine,
    addNodes,
    dragAssets: secondLine.slice(addNodes.length).trim()
  }
})

const composer = useComposer({
  onSend: (text, attachments) => emit('send', text, attachments),
  isStreaming: () => streaming,
  onStop: () => emit('stop')
})

function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.shiftKey) return
  event.preventDefault()
  composer.submit()
}

const running = computed(() => streaming || submitting)

function onPrimaryAction(): void {
  if (running.value) emit('stop')
  else composer.submit()
}

const textareaRef = useTemplateRef<InstanceType<typeof Textarea>>('textareaRef')

function insert(text: string): void {
  composer.insert(text)
  textareaRef.value?.focus()
}

defineExpose({
  insert,
  addAttachment: composer.addAttachment,
  updateAttachment: composer.updateAttachment,
  removeAttachment: composer.removeAttachment
})
</script>

<template>
  <div
    class="border-agent-border-strong bg-agent-surface relative flex flex-col rounded-[10px] border"
  >
    <div
      v-if="mentionVisible"
      id="agent-mention-listbox"
      ref="mentionListRef"
      role="listbox"
      :aria-label="t('agent.addToPrompt')"
      class="bg-agent-surface-raised absolute inset-x-0 bottom-full z-1100 mb-[-35px] max-h-64 overflow-y-auto rounded-[10px] border border-[rgba(10,10,10,0.1)] p-1 shadow-md"
      @mousedown.prevent
    >
      <div
        v-for="(match, index) in mentionMatches"
        :id="`agent-mention-opt-${index}`"
        :key="`${match.kind}:${match.id}`"
        role="option"
        :aria-selected="index === mentionActive"
        :class="
          cn(
            'text-agent-fg flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm/5',
            index === mentionActive && 'bg-charcoal-500/50'
          )
        "
        @mouseenter="mentionActive = index"
        @click="pickMention(match)"
      >
        <img
          v-if="
            match.kind === 'asset' &&
            (match.asset.thumbnail_url || match.asset.preview_url)
          "
          :src="match.asset.thumbnail_url ?? match.asset.preview_url"
          alt=""
          class="size-3.5 shrink-0 rounded-sm object-cover"
        />
        <span
          v-else-if="match.kind === 'asset'"
          class="icon-[lucide--image] size-3.5 shrink-0"
        />
        <span class="truncate">{{ match.label }}</span>
        <span
          v-if="match.kind === 'node' && graphDupes.has(match.node.title)"
          :class="cn(duplicateIdClass, 'ml-auto')"
        >
          #{{ match.node.id }}
        </span>
      </div>
    </div>

    <div
      v-if="$slots.header"
      class="bg-agent-surface flex h-11 shrink-0 items-center rounded-t-[10px] px-2"
    >
      <slot name="header" />
    </div>

    <div
      :class="
        cn(
          'relative flex flex-col border transition-colors',
          assetDragActive
            ? 'border-agent-border h-28 rounded-lg border-dashed bg-charcoal-500'
            : 'bg-agent-surface-raised focus-within:border-agent-fg-muted min-h-28 rounded-[10px] border-white/15'
        )
      "
    >
      <div
        v-if="assetDragActive"
        role="status"
        class="absolute inset-px z-20 flex flex-col items-center justify-center gap-2 rounded-[7px] bg-charcoal-500 font-inter text-[14px] leading-[normal] font-normal text-smoke-600"
      >
        <span
          aria-hidden="true"
          class="icon-[lucide--upload] size-6 shrink-0 text-muted-foreground"
        />
        <span>{{ t('agent.dragAndDropAssets') }}</span>
      </div>
      <div v-if="selectionTags.length" class="flex flex-wrap gap-2 p-3">
        <span
          v-for="tag in selectionTags"
          :key="tag.id"
          class="bg-agent-surface-hover text-agent-fg inline-flex h-7 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-xs/4 font-medium"
        >
          <span class="icon-[comfy--node] size-3.5" />
          <span class="max-w-40 truncate">{{ tag.title }}</span>
          <span
            v-if="graphDupes.has(tag.title) || tagDupes.has(tag.title)"
            :class="duplicateIdClass"
            >#{{ tag.id }}</span
          >
          <button
            type="button"
            :aria-label="t('agent.remove')"
            class="text-agent-fg-muted hover:text-agent-fg flex size-3.5 cursor-pointer items-center justify-center transition-colors"
            @click="emit('removeTag', tag.id)"
          >
            <span class="icon-[lucide--x] size-3.5" />
          </button>
        </span>
      </div>

      <div
        v-if="composer.attachments.value.length"
        class="flex flex-wrap gap-2 px-3 pt-3"
      >
        <AttachmentChip
          v-for="item in composer.attachments.value"
          :key="item.id"
          :name="item.name"
          :preview-url="item.previewUrl"
          :uploading="item.uploading"
          @remove="composer.removeAttachment(item.id)"
        />
      </div>

      <div class="relative min-h-16">
        <Textarea
          ref="textareaRef"
          v-model="composer.draft.value"
          :aria-label="t('agent.placeholder')"
          rows="1"
          class="text-agent-fg field-sizing-content max-h-50 min-h-16 w-full min-w-0 resize-none overflow-x-hidden overflow-y-auto rounded-none bg-transparent px-3 py-2 font-inter text-[14px]/5 font-normal wrap-break-word whitespace-pre-wrap focus-visible:ring-0"
          :aria-expanded="mentionVisible"
          aria-controls="agent-mention-listbox"
          :aria-activedescendant="
            mentionVisible ? `agent-mention-opt-${mentionActive}` : undefined
          "
          @keydown="onComposerKeydown"
          @keyup="onComposerKeyup"
          @input="syncMention"
          @click="syncMention"
          @blur="closeMention"
        />

        <div
          v-if="!composer.draft.value"
          class="text-agent-fg-muted pointer-events-none absolute inset-x-[12px] top-[8px] z-10 font-inter text-[14px]/[20px] font-normal"
        >
          <span class="block h-[20px]">{{ placeholderHint.firstLine }}</span>
          <div class="-mt-px flex h-[20px] items-center">
            <button
              type="button"
              class="hover:text-agent-fg focus-visible:text-agent-fg focus-visible:outline-agent-fg pointer-events-auto mr-[4px] ml-[-5px] inline-flex h-[20px] shrink-0 cursor-pointer items-center gap-[4px] rounded-[8px] px-[4px] text-[14px]/[20px] transition-colors focus-visible:outline-1"
              @click="emit('selectNodes')"
            >
              <span
                class="icon-[lucide--square-mouse-pointer] size-[14px] shrink-0"
              />
              <span>{{ placeholderHint.addNodes }},</span>
            </button>
            <span>{{ placeholderHint.dragAssets }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between px-3 py-2">
        <DropdownMenuRoot>
          <DropdownMenuTrigger
            v-tooltip.top="buildTooltipConfig(t('agent.addToPrompt'))"
            :aria-label="t('agent.addToPrompt')"
            class="rounded-agent text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg flex size-8 cursor-pointer items-center justify-center transition-colors"
          >
            <span class="icon-[lucide--plus] size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="top"
              align="start"
              :side-offset="4"
              class="agent-scope bg-agent-surface-raised z-1100 box-border w-[186px] rounded-[10px] border border-white/10 p-1 font-inter shadow-lg"
            >
              <DropdownMenuItem
                class="text-agent-fg data-highlighted:bg-agent-surface-hover mb-0.5 box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                @select="emit('selectNodes')"
              >
                <span
                  class="icon-[lucide--mouse-pointer-click] size-4 shrink-0"
                />
                <span class="whitespace-nowrap">
                  {{ t('agent.addNodesFromGraph') }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canOpenAssets"
                class="text-agent-fg data-highlighted:bg-agent-surface-hover box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                @select="emit('openAssets')"
              >
                <span class="icon-[comfy--image-ai-edit] size-4 shrink-0" />
                <span class="whitespace-nowrap">
                  {{ t('agent.addFromAssets') }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator
                v-if="canAttach && canOpenAssets"
                class="mt-0 mb-px h-px bg-white/10"
              />
              <DropdownMenuItem
                v-if="canAttach"
                class="text-agent-fg data-highlighted:bg-agent-surface-hover box-border flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1 text-[14px]/5 font-normal outline-none"
                @select="emit('attach')"
              >
                <span class="icon-[lucide--paperclip] size-4 shrink-0" />
                <span class="whitespace-nowrap">{{
                  t('agent.attachFiles')
                }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>

        <div class="flex items-center gap-1">
          <RunModePopover />
          <button
            type="button"
            :aria-label="running ? t('agent.stop') : t('agent.send')"
            :disabled="!running && !composer.canSend.value"
            :class="
              cn(
                'flex size-8 items-center justify-center rounded-xl transition-colors',
                running
                  ? 'bg-agent-surface-hover text-agent-fg hover:bg-agent-border cursor-pointer'
                  : 'bg-agent-fg text-agent-surface hover:bg-agent-fg/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50'
              )
            "
            @click="onPrimaryAction"
          >
            <span
              :class="
                cn(
                  'size-4',
                  running ? 'icon-[lucide--square]' : 'icon-[lucide--arrow-up]'
                )
              "
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
