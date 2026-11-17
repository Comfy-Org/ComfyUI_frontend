import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { GroupPatch } from '@/platform/nodeApi/v4/types'
import {
  checkedFields,
  checkedNonNegative,
  checkedPoint,
  fieldsOf
} from './checkedArguments'
import type { EditRunner } from './editRunner'
import type { GroupHandles } from './groupHandles'

/** The group edits, taking anything a pack passes and checking it. */
export interface GroupEdits {
  /** `member` names the call a refusal blames, for a handle method that calls this. */
  updateGroup(group: unknown, patch: unknown, member?: string): boolean
}

type GroupWrite = (group: LGraphGroup) => void

const FIELDS = {
  bounds: true
} satisfies Record<keyof GroupPatch, true>

export function createGroupEdits(
  groups: Pick<GroupHandles, 'locator'>,
  runner: EditRunner
): GroupEdits {
  return {
    updateGroup(group, patch, member = 'updateGroup') {
      const locate = groups.locator(group)
      if (!locate) throw invalidArgument(member, 'a group handle', group)
      const write = checkedGroupPatch(member, patch)
      const live = locate()
      if (!live) return false
      runner.apply(live.graph, () => write(live.group))
      return true
    }
  }
}

function checkedGroupPatch(member: string, patch: unknown): GroupWrite {
  const given = checkedFields(member, patch, FIELDS)
  return Object.hasOwn(given, 'bounds')
    ? checkedBounds(member, given.bounds)
    : () => {}
}

function checkedBounds(member: string, value: unknown): GroupWrite {
  const bounds = fieldsOf(member, 'bounds', value)
  const [x, y] = checkedPoint(member, 'bounds', bounds)
  const width = checkedNonNegative(member, 'bounds.width', bounds.width)
  const height = checkedNonNegative(member, 'bounds.height', bounds.height)
  return (group) => {
    group.pos = [x, y]
    group.size = [width, height]
  }
}
