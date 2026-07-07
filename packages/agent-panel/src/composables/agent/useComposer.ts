import { computed, ref } from 'vue'

// A staged attachment (image dropped/picked or an @-tagged cloud asset). `ref` is the
// server-facing reference the send path forwards (e.g. a LoadImage filename); previewUrl
// is a local/object URL only for the chip thumbnail.
export interface ComposerAttachment {
  id: string
  name: string
  ref: string
  previewUrl?: string
}

export interface UseComposerOptions {
  // Send the composed message. Called only when there is text or at least one attachment
  // and the agent is not mid-turn.
  onSend: (text: string, attachments: ComposerAttachment[]) => void
  // Whether a turn is streaming — the primary button becomes Stop and submit() aborts.
  isStreaming: () => boolean
  onStop: () => void
}

/**
 * useComposer — the composer's draft/attachment state and submit semantics.
 *
 * send-enable is text OR attachment (an image-only send is valid), and while a turn
 * streams the same action stops it instead of sending (the send<->stop toggle). Suggested
 * prompts and @-tags insert into the draft, they do not send.
 */
export function useComposer(options: UseComposerOptions) {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])

  const canSend = computed(
    () => draft.value.trim().length > 0 || attachments.value.length > 0
  )

  function submit(): void {
    if (options.isStreaming()) {
      options.onStop()
      return
    }
    if (!canSend.value) return
    options.onSend(draft.value.trim(), attachments.value)
    draft.value = ''
    attachments.value = []
  }

  // Insert text at the composer (suggested prompt / @-tag), never send.
  function insert(text: string): void {
    draft.value = draft.value ? `${draft.value} ${text}` : text
  }

  function addAttachment(attachment: ComposerAttachment): void {
    attachments.value = [...attachments.value, attachment]
  }

  function removeAttachment(id: string): void {
    attachments.value = attachments.value.filter((item) => item.id !== id)
  }

  return {
    draft,
    attachments,
    canSend,
    submit,
    insert,
    addAttachment,
    removeAttachment
  }
}
