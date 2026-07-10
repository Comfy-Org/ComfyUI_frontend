import { computed, ref } from 'vue'

export interface ComposerAttachment {
  id: string
  name: string
  ref: string
  previewUrl?: string
  uploading?: boolean
}

export interface UseComposerOptions {
  onSend: (text: string, attachments: ComposerAttachment[]) => void
  isStreaming: () => boolean
  onStop: () => void
}

export function useComposer(options: UseComposerOptions) {
  const draft = ref('')
  const attachments = ref<ComposerAttachment[]>([])

  const canSend = computed(
    () =>
      (draft.value.trim().length > 0 || attachments.value.length > 0) &&
      !attachments.value.some((item) => item.uploading)
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

  function insert(text: string): void {
    draft.value = draft.value ? `${draft.value} ${text}` : text
  }

  function addAttachment(attachment: ComposerAttachment): void {
    attachments.value = [...attachments.value, attachment]
  }

  function updateAttachment(
    id: string,
    patch: Partial<ComposerAttachment>
  ): void {
    attachments.value = attachments.value.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    )
  }

  function removeAttachment(id: string): void {
    const removed = attachments.value.find((item) => item.id === id)
    if (removed?.previewUrl?.startsWith('blob:'))
      URL.revokeObjectURL(removed.previewUrl)
    attachments.value = attachments.value.filter((item) => item.id !== id)
  }

  return {
    draft,
    attachments,
    canSend,
    submit,
    insert,
    addAttachment,
    updateAttachment,
    removeAttachment
  }
}
