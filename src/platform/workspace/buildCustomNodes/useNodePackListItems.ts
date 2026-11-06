import { useI18n } from 'vue-i18n'

import type { BuildCustomNode } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import type {
  NodePackVersionLabel,
  PickedNodePack
} from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import {
  buildNodeLabel,
  choiceLabel,
  isPinnedChoice
} from '@/platform/workspace/buildCustomNodes/nodePackChoice'

export interface NodePackListItem {
  key: string
  name: string
  publisher: string
  version: string
  pinned: boolean
}

/** Turns version labels, picks and Build entries into text for the picker's lists. */
export function useNodePackListItems() {
  const { t } = useI18n()

  function versionText(label: NodePackVersionLabel): string {
    switch (label.kind) {
      case 'text':
        return label.text
      case 'defaultBranch':
        return t('buildCustomNodes.defaultBranch')
      case 'uploaded':
        return t('buildCustomNodes.uploaded')
    }
  }

  function pickItem({ pack, choice }: PickedNodePack): NodePackListItem {
    return {
      key: pack.id,
      name: pack.name,
      publisher: pack.publisher,
      version: versionText(choiceLabel(choice)),
      pinned: isPinnedChoice(choice)
    }
  }

  function buildEntryItem(entry: BuildCustomNode): NodePackListItem {
    return {
      key: 'id' in entry && entry.id ? entry.id : entry.name,
      name: entry.name,
      publisher: '',
      version: versionText(buildNodeLabel(entry)),
      pinned: false
    }
  }

  return { versionText, pickItem, buildEntryItem }
}
