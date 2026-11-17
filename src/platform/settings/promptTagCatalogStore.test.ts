import { describe, expect, it } from 'vitest'

import { usePromptTagCatalogStore } from './promptTagCatalogStore'

describe('prompt tag catalog', () => {
  it.for([
    {
      text: '\uFEFFblue_eyes\r\nblue_hair\r\n',
      expected: ['blue eyes', 'blue hair']
    },
    { text: 'blue_eyes,4\nblue_hair,9', expected: ['blue hair', 'blue eyes'] },
    {
      text: 'name,"count"\nblue_eyes,"4"\nblue_hair,"19"',
      expected: ['blue hair', 'blue eyes']
    },
    {
      text: '"name","category","post_count","aliases"\n"blue_eyes","0","14",""\n"blue_hair","0","9",""',
      expected: ['blue eyes', 'blue hair']
    },
    {
      text: 'name,category,post_count,aliases\nblue_eyes,0,4,"azure_eyes,cyan_eyes"\nblue_hair,0,9,""\nblue_eyes,0,12,""',
      expected: ['blue eyes', 'blue hair']
    },
    { text: '"blue, ""azure""",0,9,""', expected: ['blue, "azure"'] }
  ])('imports supported catalog data: $text', ({ text, expected }) => {
    const catalog = usePromptTagCatalogStore()

    expect(catalog.importCatalog(text)).toBe(true)
    expect(catalog.tags).toEqual(expected)
  })

  it('ranks prefixes before substrings, then frequency, with normalized queries and a bounded list', () => {
    const catalog = usePromptTagCatalogStore()
    catalog.importCatalog(
      'dark_blue_hair,100\nblue_eyes,4\nblue_hair,9\nblue_sky,20\nblue_flower,18\nblue_dress,17\nblue_shirt,16\nblue_ribbon,15\nblue_bow,14\nblue_background,13'
    )

    expect(catalog.suggest('BLUE_')).toEqual([
      'blue sky',
      'blue flower',
      'blue dress',
      'blue shirt',
      'blue ribbon',
      'blue bow',
      'blue background',
      'blue hair'
    ])
    expect(catalog.suggest('blue hair')).toEqual(['dark blue hair'])
    expect(catalog.suggest('nothing matching')).toEqual([])
  })

  it.for([
    '',
    'blue_eyes,NaN',
    'blue_eyes,-1',
    '"unterminated',
    'blue_eyes\n,0,1'
  ])('keeps the previous catalog after rejecting %j', (text) => {
    const catalog = usePromptTagCatalogStore()
    catalog.importCatalog('blue_eyes')

    expect(catalog.importCatalog(text)).toBe(false)
    expect(catalog.suggest('blue')).toEqual(['blue eyes'])
  })
})
