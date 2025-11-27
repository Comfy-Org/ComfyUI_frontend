<template>
  <div
    data-component-id="AssetCard"
    :data-asset-id="asset.id"
    :aria-labelledby="titleId"
    :aria-describedby="descId"
    tabindex="1"
    :class="
      cn(
        'rounded-2xl overflow-hidden transition-all duration-200 bg-modal-card-background p-2 gap-2 flex flex-col',
        interactive &&
          'group appearance-none bg-transparent m-0 outline-none text-left hover:bg-secondary-background focus:bg-secondary-background border-none focus:outline-solid outline-base-foreground outline-4'
      )
    "
    @keydown.enter.self="interactive && $emit('select', asset)"
  >
    <div class="relative aspect-square w-full overflow-hidden rounded-xl">
      <div
        v-if="isLoading || error"
        class="flex size-full cursor-pointer items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
        role="button"
        @click="interactive && $emit('select', asset)"
      />
      <img
        v-else
        :src="asset.preview_url"
        class="size-full object-contain cursor-pointer"
        role="button"
        @click="interactive && $emit('select', asset)"
      />

      <AssetBadgeGroup :badges="asset.badges" />
      <IconGroup
        ref="card-buttons"
        :class="
          cn(
            'absolute top-2 right-2 invisible group-hover:visible',
            dropdownMenuButton?.isOpen && 'visible'
          )
        "
      >
        <IconButton>
          <i class="icon-[lucide--file-text]" />
        </IconButton>
        <MoreButton ref="dropdown-menu-button" size="sm">
          <template #default="{}">
            <IconTextButton
              :label="$t('g.rename')"
              type="secondary"
              size="md"
              @click="startAssetRename"
            >
              <template #icon>
                <i class="icon-[lucide--pencil]" />
              </template>
            </IconTextButton>
            <IconTextButton
              :label="$t('g.delete')"
              type="secondary"
              size="md"
              @click="confirmDeletion"
            >
              <template #icon>
                <i class="icon-[lucide--trash-2]" />
              </template>
            </IconTextButton>
          </template>
        </MoreButton>
      </IconGroup>
    </div>
    <div :class="cn('max-h-32 flex flex-col gap-2 justify-between')">
      <h3
        :id="titleId"
        v-tooltip.top="{ value: asset.name, showDelay: tooltipDelay }"
        :class="
          cn(
            'mb-2 m-0 text-base font-semibold line-clamp-2 wrap-anywhere',
            'text-base-foreground'
          )
        "
      >
        <EditableText
          :model-value="newNameRef ?? asset.name"
          :is-editing="isEditing"
          :input-attrs="{ 'data-testid': 'asset-name-input' }"
          @edit="assetRename"
          @cancel="assetRename()"
        />
      </h3>
      <p
        :id="descId"
        v-tooltip.top="{ value: asset.description, showDelay: tooltipDelay }"
        :class="
          cn(
            'm-0 text-sm leading-6 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box] text-muted-foreground'
          )
        "
      >
        {{ asset.description }}
      </p>
      <div :class="cn('flex gap-4 text-xs text-muted-foreground')">
        <span v-if="asset.stats.stars" class="flex items-center gap-1">
          <i class="icon-[lucide--star] size-3" />
          {{ asset.stats.stars }}
        </span>
        <span v-if="asset.stats.downloadCount" class="flex items-center gap-1">
          <i class="icon-[lucide--download] size-3" />
          {{ asset.stats.downloadCount }}
        </span>
        <span v-if="asset.stats.formattedDate" class="flex items-center gap-1">
          <i class="icon-[lucide--clock] size-3" />
          {{ asset.stats.formattedDate }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useImage } from '@vueuse/core'
import { computed, ref, useId, useTemplateRef } from 'vue'

import IconButton from '@/components/button/IconButton.vue'
import IconGroup from '@/components/button/IconGroup.vue'
import IconTextButton from '@/components/button/IconTextButton.vue'
import MoreButton from '@/components/button/MoreButton.vue'
import EditableText from '@/components/common/EditableText.vue'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import AssetBadgeGroup from '@/platform/assets/components/AssetBadgeGroup.vue'
import type { AssetDisplayItem } from '@/platform/assets/composables/useAssetBrowser'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@/utils/tailwindUtil'

const { asset, interactive } = defineProps<{
  asset: AssetDisplayItem
  interactive?: boolean
}>()

defineEmits<{
  select: [asset: AssetDisplayItem]
}>()

const settingStore = useSettingStore()
const { closeDialog } = useDialogStore()

const dropdownMenuButton = useTemplateRef<InstanceType<typeof MoreButton>>(
  'dropdown-menu-button'
)

const titleId = useId()
const descId = useId()

const isEditing = ref(false)
const newNameRef = ref<string>() // TEMPORARY: Replace with actual response from API

const tooltipDelay = computed<number>(() =>
  settingStore.get('LiteGraph.Node.TooltipDelay')
)

const { isLoading, error } = useImage({
  src: asset.preview_url ?? '',
  alt: asset.name
})

async function confirmDeletion() {
  dropdownMenuButton.value?.hide()
  const confirmDialog = showConfirmDialog({
    headerProps: {
      title: 'Delete this model?'
    },
    props: {
      confirmationText:
        'This model will be permanently removed from your library.'
    },
    footerProps: {
      confirmText: 'Delete',
      // TODO: These need to be put into the new Button Variants once we have them.
      confirmClass: cn(
        'bg-danger-200 text-base-foreground hover:bg-danger-200/80 focus:bg-danger-200/80 focus:ring ring-base-foreground'
      ),
      onCancel: () => {
        closeDialog(confirmDialog)
      },
      onConfirm: () => {
        closeDialog(confirmDialog)
      }
    }
  })
}

function startAssetRename() {
  dropdownMenuButton.value?.hide()
  isEditing.value = true
}

function assetRename(newName?: string) {
  isEditing.value = false
  if (newName) {
    newNameRef.value = newName
  }
}
</script>
