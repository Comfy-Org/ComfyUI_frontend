<template>
  <Dialog v-model:open="visible">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent size="md" :aria-labelledby="titleId">
        <DialogHeader>
          <DialogTitle :id="titleId">
            {{ pack ? $t('skillPacks.editPack') : $t('skillPacks.addPack') }}
          </DialogTitle>
          <DialogClose :aria-label="$t('g.close')" />
        </DialogHeader>
        <form
          class="flex flex-col gap-4 px-4 py-2"
          @submit.prevent="handleSubmit"
        >
          <div class="flex flex-col gap-1">
            <label :for="nameId" class="text-sm font-medium">
              {{ $t('skillPacks.name') }}
            </label>
            <Input
              :id="nameId"
              v-model="form.name"
              :placeholder="$t('skillPacks.namePlaceholder')"
              :disabled="pack !== undefined || loading"
              :aria-invalid="!!errors.name || undefined"
              :aria-describedby="`${nameId}-help`"
              :maxlength="MAX_NAME_LENGTH"
            />
            <small
              v-if="errors.name"
              :id="`${nameId}-help`"
              role="alert"
              class="text-destructive"
            >
              {{ errors.name }}
            </small>
            <small v-else :id="`${nameId}-help`" class="text-muted-foreground">
              {{ $t('skillPacks.nameHint') }}
            </small>
          </div>

          <div class="flex flex-col gap-1">
            <label :for="descriptionId" class="text-sm font-medium">
              {{ $t('skillPacks.triggerLine') }}
            </label>
            <Input
              :id="descriptionId"
              v-model="form.description"
              :placeholder="$t('skillPacks.triggerLinePlaceholder')"
              :disabled="loading"
              :aria-invalid="!!errors.description || undefined"
              :aria-describedby="`${descriptionId}-help`"
            />
            <small
              v-if="errors.description"
              :id="`${descriptionId}-help`"
              role="alert"
              class="text-destructive"
            >
              {{ errors.description }}
            </small>
            <small
              v-else
              :id="`${descriptionId}-help`"
              class="text-muted-foreground"
            >
              {{ $t('skillPacks.triggerLineHint') }}
            </small>
          </div>

          <div class="flex flex-col gap-1">
            <label :for="bodyId" class="text-sm font-medium">
              {{ $t('skillPacks.body') }}
            </label>
            <Textarea
              :id="bodyId"
              v-model="form.body"
              class="min-h-48 font-mono"
              :placeholder="$t('skillPacks.bodyPlaceholder')"
              :disabled="loading"
              :aria-invalid="!!errors.body || undefined"
              :aria-describedby="`${bodyId}-help`"
            />
            <small
              v-if="errors.body"
              :id="`${bodyId}-help`"
              role="alert"
              class="text-destructive"
            >
              {{ errors.body }}
            </small>
            <small
              v-else
              :id="`${bodyId}-help`"
              class="text-muted-foreground"
              >{{ bodySizeLabel }}</small
            >
          </div>

          <div
            v-if="budgetError"
            data-testid="skill-pack-budget-error"
            role="alert"
            class="flex flex-col gap-1 rounded-lg border border-destructive p-3 text-sm text-muted-foreground"
          >
            <span class="font-medium text-destructive">
              {{ $t('skillPacks.atLimitTitle') }}
            </span>
            <span>{{ budgetError }}</span>
            <span>
              {{ $t('skillPacks.atLimitHint') }}
            </span>
          </div>

          <span
            v-else-if="fieldError"
            data-testid="skill-pack-field-error"
            role="alert"
            class="text-sm text-destructive"
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

import Button from '@comfyorg/design-system/button/Button'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogHeader from '@comfyorg/design-system/dialog/DialogHeader'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import Input from '@comfyorg/design-system/input/Input'
import Textarea from '@comfyorg/design-system/textarea/Textarea'

import { useSkillPackForm } from '@/platform/skills/composables/useSkillPackForm'
import type { SkillPack } from '@/platform/skills/types'
import { MAX_NAME_LENGTH } from '@/platform/skills/types'

const { pack } = defineProps<{
  pack?: SkillPack
}>()

const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const titleId = useId()
const nameId = useId()
const descriptionId = useId()
const bodyId = useId()

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
  visible
})

const bodySizeLabel = computed(() =>
  t('skillPacks.bodySize', {
    bytes: bodyBytes.value
  })
)
</script>
