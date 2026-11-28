import { describe, it, expect } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import fr from '@/locales/fr/main.json'

import type { MenuOption } from './menuOption'
import { buildStructuredMenu } from './contextMenuConverter'

describe('core node menu sections', () => {
  it.for(['en', 'fr'])(
    'orders core sections independently of labels in %s',
    (locale) => {
      const { t } = createI18n({
        legacy: false,
        locale,
        messages: { en, fr }
      }).global
      const options: MenuOption[] = [
        { id: 'delete', label: t('contextMenu.Delete') },
        { id: 'color', label: t('contextMenu.Color') },
        { id: 'pin', label: t('contextMenu.Unpin') },
        { id: 'copy', label: t('contextMenu.Copy') },
        { id: 'openImage', label: t('contextMenu.Open Image') },
        { id: 'widget:graph:1:seed:favorite', label: 'Favorite seed' }
      ]

      expect(
        buildStructuredMenu(options, 'Extensions').map(
          (option) => option.label ?? option.type
        )
      ).toEqual([
        t('contextMenu.Open Image'),
        'divider',
        t('contextMenu.Copy'),
        'divider',
        t('contextMenu.Unpin'),
        'divider',
        t('contextMenu.Color'),
        'divider',
        'Favorite seed',
        'divider',
        t('contextMenu.Delete')
      ])
    }
  )

  it.for([
    { name: 'empty', options: [], expected: [] },
    { name: 'separators only', options: [{ type: 'divider' }], expected: [] },
    {
      name: 'Delete only',
      options: [{ id: 'delete', label: 'Delete' }],
      expected: ['Delete']
    },
    {
      name: 'unclassified core contribution',
      options: [{ label: 'Custom' }],
      expected: ['Extensions', 'Custom']
    }
  ] satisfies { name: string; options: MenuOption[]; expected: string[] }[])(
    'avoids empty sections and stray dividers for $name',
    ({ options, expected }) => {
      expect(
        buildStructuredMenu(options, 'Extensions').map(
          (option) => option.label ?? option.type
        )
      ).toEqual(expected)
    }
  )
})
