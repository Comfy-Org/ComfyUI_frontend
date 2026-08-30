<template>
  <Dialog v-model:open="visible" :modal="false">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent size="md" :aria-labelledby="titleId">
        <DialogHeader>
          <DialogTitle :id="titleId">
            {{ $t('g.customizeFolder') }}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <div class="flex flex-col gap-4 px-4 py-2">
          <div class="flex flex-col gap-2">
            <label for="customization-icon" class="text-sm font-medium">
              {{ $t('g.icon') }}
            </label>
            <ToggleGroup
              id="customization-icon"
              v-model="selectedIconValue"
              type="single"
              class="justify-start"
            >
              <ToggleGroupItem
                v-for="option in iconOptions"
                :key="option.value"
                :value="option.value"
                :aria-label="option.name"
                class="flex-none p-2"
              >
                <i
                  :class="cn('pi text-lg', option.value)"
                  :style="{ color: finalColor }"
                />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <hr class="border-t border-border-subtle" />
          <div class="flex flex-col gap-2">
            <label for="customization-color" class="text-sm font-medium">
              {{ $t('g.color') }}
            </label>
            <ColorCustomizationSelector
              id="customization-color"
              v-model="finalColor"
              :color-options="colorOptions"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="textonly" @click="resetCustomization">
            <i class="pi pi-refresh" />
            {{ $t('g.reset') }}
          </Button>
          <Button autofocus @click="confirmCustomization">
            <i class="pi pi-check" />
            {{ $t('g.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ColorCustomizationSelector from '@/components/common/ColorCustomizationSelector.vue'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useNodeBookmarkStore } from '@/stores/nodeBookmarkStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t } = useI18n()

const { initialIcon, initialColor } = defineProps<{
  initialIcon?: string
  initialColor?: string
}>()

const visible = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  (e: 'confirm', icon: string, color: string): void
}>()

const titleId = useId()

const nodeBookmarkStore = useNodeBookmarkStore()

const iconOptions = [
  { name: t('icon.bookmark'), value: nodeBookmarkStore.defaultBookmarkIcon },
  { name: t('icon.folder'), value: 'pi-folder' },
  { name: t('icon.star'), value: 'pi-star' },
  { name: t('icon.heart'), value: 'pi-heart' },
  { name: t('icon.file'), value: 'pi-file' },
  { name: t('icon.inbox'), value: 'pi-inbox' },
  { name: t('icon.box'), value: 'pi-box' },
  { name: t('icon.briefcase'), value: 'pi-briefcase' }
]

const colorOptions = [
  { name: t('color.default'), value: nodeBookmarkStore.defaultBookmarkColor },
  { name: t('color.blue'), value: '#007bff' },
  { name: t('color.green'), value: '#28a745' },
  { name: t('color.red'), value: '#dc3545' },
  { name: t('color.pink'), value: '#e83e8c' },
  { name: t('color.yellow'), value: '#ffc107' }
]

const defaultIcon = iconOptions.find(
  (option) => option.value === nodeBookmarkStore.defaultBookmarkIcon
)

const selectedIconValue = ref((defaultIcon ?? iconOptions[0]).value)
const finalColor = ref(initialColor || nodeBookmarkStore.defaultBookmarkColor)

const resetCustomization = () => {
  selectedIconValue.value =
    iconOptions.find((option) => option.value === initialIcon)?.value ??
    iconOptions[0].value
  finalColor.value = initialColor || nodeBookmarkStore.defaultBookmarkColor
}

const confirmCustomization = () => {
  emit('confirm', selectedIconValue.value, finalColor.value)
  visible.value = false
}

watch(
  visible,
  (newValue) => {
    if (newValue) {
      resetCustomization()
    }
  },
  { immediate: true }
)
</script>
