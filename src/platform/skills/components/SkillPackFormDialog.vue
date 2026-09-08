<template>
  <Dialog v-model:open="visible">
    <DialogPortal>
      <DialogOverlay v-reka-z-index data-reka-nested-dialog-overlay />
      <DialogContent v-reka-z-index size="md" :aria-labelledby="titleId">
        <DialogHeader>
          <DialogTitle :id="titleId">
            {{ pack ? $t('skillPacks.editPack') : $t('skillPacks.addPack') }}
          </DialogTitle>
          <DialogClose />
        </DialogHeader>
        <form
          class="flex flex-col gap-4 px-4 py-2"
          @submit.prevent="handleSubmit"
        >
          <div class="flex flex-col gap-1">
            <label for="skill-pack-name" class="text-sm font-medium">
              {{ $t('skillPacks.name') }}
            </label>
            <Input
              id="skill-pack-name"
              v-model="form.name"
              :placeholder="$t('skillPacks.namePlaceholder')"
              :disabled="pack !== undefined"
            />
            <small v-if="errors.name" class="text-destructive">
              {{ errors.name }}
            </small>
            <small v-else class="text-muted">
              {{ $t('skillPacks.nameHint') }}
            </small>
          </div>

          <div class="flex flex-col gap-1">
            <label for="skill-pack-description" class="text-sm font-medium">
              {{ $t('skillPacks.triggerLine') }}
            </label>
            <Input
              id="skill-pack-description"
              v-model="form.description"
              :placeholder="$t('skillPacks.triggerLinePlaceholder')"
            />
            <small v-if="errors.description" class="text-destructive">
              {{ errors.description }}
            </small>
            <small v-else class="text-muted">
              {{ $t('skillPacks.triggerLineHint') }}
            </small>
          </div>

          <div class="flex flex-col gap-1">
            <label for="skill-pack-body" class="text-sm font-medium">
              {{ $t('skillPacks.body') }}
            </label>
            <Textarea
              id="skill-pack-body"
              v-model="form.body"
              class="min-h-48 font-mono"
              :placeholder="$t('skillPacks.bodyPlaceholder')"
            />
            <small v-if="errors.body" class="text-destructive">
              {{ errors.body }}
            </small>
            <small v-else class="text-muted">{{ bodySizeLabel }}</small>
          </div>

          <div
            v-if="budgetError"
            data-testid="skill-pack-budget-error"
            class="border-destructive flex flex-col gap-1 rounded-lg border p-3"
          >
            <span class="text-destructive text-sm font-medium">
              {{ $t('skillPacks.atLimitTitle') }}
            </span>
            <span class="text-sm text-muted">{{ budgetError }}</span>
            <span class="text-sm text-muted">
              {{ $t('skillPacks.atLimitHint') }}
            </span>
          </div>

          <span
            v-else-if="fieldError"
            data-testid="skill-pack-field-error"
            class="text-destructive text-sm"
          >
            {{ fieldError }}
          </span>

          <div class="flex justify-end gap-2 py-2">
            <Button variant="secondary" type="button" @click="visible = false">
              {{ $t('g.cancel') }}
            </Button>
            <Button type="submit" :loading="loading">
              {{ $t('skillPacks.publish') }}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { vRekaZIndex } from '@/components/dialog/vRekaZIndex'
import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogClose from '@/components/ui/dialog/DialogClose.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogOverlay from '@/components/ui/dialog/DialogOverlay.vue'
import DialogPortal from '@/components/ui/dialog/DialogPortal.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

import { useSkillPackForm } from '../composables/useSkillPackForm'
import type { SkillPack } from '../types'
import { MAX_PACK_BODY_BYTES } from '../types'

const { pack } = defineProps<{
  pack?: SkillPack
}>()

const visible = defineModel<boolean>('visible', { default: false })

const emit = defineEmits<{
  saved: []
}>()

const { t } = useI18n()
const titleId = useId()

const {
  form,
  errors,
  loading,
  fieldError,
  budgetError,
  bodyBytes,
  handleSubmit
} = useSkillPackForm({
  pack: () => pack,
  visible,
  onSaved: () => emit('saved')
})

const bodySizeLabel = computed(() =>
  t('skillPacks.bodySize', {
    bytes: bodyBytes.value,
    max: MAX_PACK_BODY_BYTES
  })
)
</script>
