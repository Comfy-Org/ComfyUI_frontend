<template>
  <CompanionBubble
    ref="bubble"
    role="dialog"
    data-testid="point-at-it-companion-tips"
    :aria-label="messages.tipsLabel"
    class="pointer-events-auto flex w-72 flex-col gap-3"
    :anchor
    :order="TIPS_SIDES"
    @pointerenter="emit('enter')"
    @pointerleave="emit('leave')"
    @focus.capture="emit('engage')"
  >
    <div class="flex items-center gap-2">
      <p class="m-0 min-w-0 flex-1 text-sm font-medium">
        {{ messages.tipsTitle }}
      </p>
      <Button
        type="button"
        variant="textonly"
        size="icon-sm"
        class="shrink-0"
        :aria-label="messages.close"
        @click="emit('close', 'button')"
      >
        <i class="icon-[lucide--x] size-3" aria-hidden="true" />
      </Button>
    </div>
    <span
      v-if="options.context"
      class="self-start rounded-md border border-dashed border-primary px-2 py-0.5 text-xs text-primary"
      data-testid="point-at-it-companion-context"
    >
      {{ options.context }}
    </span>
    <Button
      type="button"
      variant="secondary"
      size="unset"
      class="h-14 w-full justify-between rounded-xl px-4 text-left text-sm font-medium whitespace-normal"
      @click="emit('send', options.lead)"
    >
      {{ options.lead }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </Button>
    <ul
      v-if="options.more.length > 0"
      class="m-0 flex list-none flex-col items-start gap-1 p-0"
    >
      <li v-for="option in options.more" :key="option" class="max-w-full">
        <Button
          type="button"
          variant="textonly"
          size="unset"
          class="min-h-9 max-w-full px-3 text-left text-xs whitespace-normal"
          @click="emit('send', option)"
        >
          {{ option }}
        </Button>
      </li>
    </ul>
    <div
      class="flex items-end gap-2 rounded-xl border border-border bg-background py-1.5 pr-1.5 pl-3 focus-within:border-muted-foreground"
    >
      <textarea
        ref="field"
        v-model="text"
        rows="1"
        class="field-sizing-content max-h-32 min-h-6 flex-1 resize-none border-none bg-transparent py-0.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        :aria-label="messages.tipsField"
        :placeholder="options.placeholder"
        @keydown.enter="onEnter"
      />
      <Button
        type="button"
        variant="textonly"
        size="icon-sm"
        class="shrink-0"
        :aria-label="messages.tipsStart"
        :title="`${messages.tipsStart} (${messages.tipsStartKey})`"
        :aria-keyshortcuts="MARK_KEY"
        @click="emit('point')"
      >
        <i class="icon-[lucide--mouse-pointer-click]" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="primary"
        size="icon-sm"
        class="shrink-0 rounded-full"
        :aria-label="messages.tipsSend"
        :title="messages.followUpHint(sendKey)"
        :disabled="!text.trim()"
        @click="sendText"
      >
        <i class="icon-[lucide--arrow-up]" aria-hidden="true" />
      </Button>
    </div>
  </CompanionBubble>
</template>

<script setup lang="ts">
import { onKeyStroke, unrefElement, useEventListener } from '@vueuse/core'
import { onMounted, ref, useTemplateRef, watch } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import CompanionBubble from './CompanionBubble.vue'
import type { CardOptions } from './cardOptions'
import type { Rect, Side } from './geometry'
import { MARK_KEY, messages, sendNowKeyLabel } from './messages'
import { takeEnter } from './textEntry'
import type { CardDismissal } from './useCompanionMenu'

/** At home her card goes to her right, or above her when it is too tall for that. */
const TIPS_SIDES: Side[] = ['right', 'above', 'left', 'below']
/** Her own button toggles her card, so a press on it is not a press outside. */
const COMPANION_BUTTON = '[data-point-at-it-companion-button]'

const { takesFocus = false } = defineProps<{
  /** Her head, in window coordinates, which her card comes from. */
  anchor: Rect
  /** What the card offers on top of the field: it knows what is selected. */
  options: CardOptions
  /**
   * Whether the field has the keyboard: when the card is opened or kept by a
   * click or the keyboard, and not while it is only a peek, which must not
   * swallow the keys the page uses.
   */
  takesFocus?: boolean
}>()

const emit = defineEmits<{
  /** Say this to her, which is sent at once: the typed message or a question to try. */
  send: [text: string]
  /** Start asking about something on the canvas instead of typing. */
  point: []
  /** Esc, the close button, or a press anywhere else. */
  close: [by: CardDismissal]
  /** The pointer came onto the card. */
  enter: []
  /** The pointer left the card. */
  leave: []
  /** The person is using the card: a press or the focus inside it. */
  engage: []
}>()

const sendKey = sendNowKeyLabel(navigator.userAgent)
const text = ref('')
const bubble = useTemplateRef('bubble')
const field = useTemplateRef('field')

function focusField() {
  field.value?.focus({ preventScroll: true })
}

/** The card is where she is spoken to, so a card that takes focus has the field ready to type in. */
onMounted(() => {
  if (takesFocus) focusField()
})
/** A peek that is kept by a click on her gets the field then. */
watch(
  () => takesFocus,
  (takes) => {
    if (takes) focusField()
  }
)

function sendText() {
  if (text.value.trim()) emit('send', text.value)
}

function onEnter(event: KeyboardEvent) {
  const meaning = takeEnter(event)
  if (meaning === 'enter' || meaning === 'sendNow') sendText()
}

/**
 * A press anywhere else puts her card away, and a press on the card itself
 * keeps it. It is heard on the way down, because the layer stops presses
 * inside it from reaching the window. A press on her is neither: her click
 * decides what the card does then.
 */
useEventListener(
  window,
  'pointerdown',
  (event) => {
    const own = unrefElement(bubble)
    const path = event.composedPath()
    if (path.some((node) => node === own)) emit('engage')
    else if (
      !path.some(
        (node) => node instanceof Element && node.matches(COMPANION_BUTTON)
      )
    )
      emit('close', 'outside')
  },
  { capture: true, passive: true }
)
onKeyStroke('Escape', () => emit('close', 'key'))
</script>
