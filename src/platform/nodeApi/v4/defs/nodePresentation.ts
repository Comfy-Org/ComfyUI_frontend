import { TitleMode } from '@comfyorg/graph-model/globalEnums'

import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import {
  checkedBoolean,
  checkedChoice
} from '@/platform/nodeApi/v4/edit/checkedArguments'
import type { NodePresentation } from '@/platform/nodeApi/v4/types'

const PRESENTATION_FIELDS = {
  title: true,
  resizable: true,
  collapsible: true
} satisfies Record<keyof NodePresentation, true>

const TITLE_MODES = {
  default: TitleMode.NORMAL_TITLE,
  hidden: TitleMode.NO_TITLE
} as const satisfies Record<NonNullable<NodePresentation['title']>, TitleMode>

/** A presentation every field of which has been checked, with the host's defaults filled in. */
export interface CheckedPresentation {
  readonly titleMode: TitleMode
  readonly resizable: boolean
  readonly collapsible: boolean
}

export function checkedPresentation(
  presentation: unknown
): CheckedPresentation {
  if (presentation === undefined) {
    return {
      titleMode: TitleMode.NORMAL_TITLE,
      resizable: true,
      collapsible: true
    }
  }
  const given = checkedFields(
    'define',
    'presentation',
    presentation,
    PRESENTATION_FIELDS
  )
  return {
    titleMode:
      given.title === undefined
        ? TitleMode.NORMAL_TITLE
        : TITLE_MODES[
            checkedChoice(
              'define',
              'presentation.title',
              given.title,
              TITLE_MODES
            )
          ],
    resizable: optionalFlag('resizable', given.resizable),
    collapsible: optionalFlag('collapsible', given.collapsible)
  }
}

function optionalFlag(field: string, value: unknown): boolean {
  return (
    value === undefined ||
    checkedBoolean('define', `presentation.${field}`, value)
  )
}
