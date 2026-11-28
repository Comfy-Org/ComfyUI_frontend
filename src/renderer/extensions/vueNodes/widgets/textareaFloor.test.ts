import { beforeEach, describe, expect, it } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'

import { withTextareaFloor } from './textareaFloor'

describe('withTextareaFloor', () => {
  beforeEach(() => {
    useSettingStore().settingValues['Comfy.TextareaWidget.FontSize'] = 12
  })

  it.for([
    {
      name: 'raises a growable minimum below two lines',
      sizing: { kind: 'growable', minHeight: 20, minWidth: 0 },
      expected: { kind: 'growable', minHeight: 68, minWidth: 0 }
    },
    {
      name: 'keeps a growable minimum above two lines',
      sizing: { kind: 'growable', minHeight: 90, minWidth: 0 },
      expected: { kind: 'growable', minHeight: 90, minWidth: 0 }
    },
    {
      name: 'leaves fixed sizing alone',
      sizing: { kind: 'fixed', height: 30 },
      expected: { kind: 'fixed', height: 30 }
    }
  ] as const)('$name', ({ sizing, expected }) => {
    expect(withTextareaFloor(sizing)).toEqual(expected)
  })
})
