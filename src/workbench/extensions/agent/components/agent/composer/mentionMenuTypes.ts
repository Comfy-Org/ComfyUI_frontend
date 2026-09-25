import type { useAgentMentionPicker } from '../../../composables/agent/useAgentMentionPicker'

export type MentionMatch = ReturnType<
  typeof useAgentMentionPicker
>['mentionMatches']['value'][number]
