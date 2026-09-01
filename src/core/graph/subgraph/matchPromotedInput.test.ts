import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { matchPromotedInput } from './matchPromotedInput'

type MockInput = {
  name: string
  _widget?: IBaseWidget
}

function createWidget(name: string): IBaseWidget {
  return {
    name,
    type: 'text'
  } as IBaseWidget
}

describe(matchPromotedInput, () => {
  it('prefers exact _widget matches before same-name inputs', () => {
    const targetWidget = createWidget('seed')
    const aliasWidget = createWidget('seed')

    const aliasInput: MockInput = {
      name: 'seed',
      _widget: aliasWidget
    }
    const exactInput: MockInput = {
      name: 'seed',
      _widget: targetWidget
    }

    const matched = matchPromotedInput(
      fromPartial<
        Array<{
          name: string
          _widget?: IBaseWidget
        }>
      >([aliasInput, exactInput]),
      targetWidget
    )

    expect(matched).toBe(exactInput)
  })

  it('falls back to same-name matching when no exact widget match exists', () => {
    const targetWidget = createWidget('seed')
    const aliasInput: MockInput = {
      name: 'seed'
    }

    const matched = matchPromotedInput(
      fromPartial<Array<{ name: string; _widget?: IBaseWidget }>>([aliasInput]),
      targetWidget
    )

    expect(matched).toBe(aliasInput)
  })

  it('does not guess when multiple same-name inputs exist without an exact match', () => {
    const targetWidget = createWidget('seed')
    const firstAliasInput: MockInput = {
      name: 'seed'
    }
    const secondAliasInput: MockInput = {
      name: 'seed'
    }

    const matched = matchPromotedInput(
      fromPartial<
        Array<{
          name: string
          _widget?: IBaseWidget
        }>
      >([firstAliasInput, secondAliasInput]),
      targetWidget
    )

    expect(matched).toBeUndefined()
  })
})
