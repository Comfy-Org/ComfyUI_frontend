import { computed, shallowRef } from 'vue'
import type { ComputedRef } from 'vue'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import { checkedFields } from '@/platform/nodeApi/v4/checkedFields'
import type {
  BadgeContribution,
  ButtonContribution,
  ChromeItemHandle
} from '@/platform/nodeApi/v4/types'
import type { ActionBarButton, TopbarBadge } from '@/types/comfy'

import {
  isCallback,
  isName,
  isText,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'

interface ChromeSlot<TItem extends { readonly id: string }, THost> {
  readonly shown: ComputedRef<readonly THost[]>
  add(item: unknown): ChromeItemHandle<TItem>
}

type ReadItem<TItem> = (value: unknown, member: string) => TItem

const BADGE_CHANGES = {
  text: true,
  label: true,
  variant: true,
  tooltip: true
} satisfies Record<keyof Omit<BadgeContribution, 'id'>, true>

const BADGE_FIELDS = {
  id: true,
  ...BADGE_CHANGES
} satisfies Record<keyof BadgeContribution, true>

const BUTTON_CHANGES = {
  icon: true,
  label: true,
  tooltip: true,
  run: true
} satisfies Record<keyof Omit<ButtonContribution, 'id'>, true>

const BUTTON_FIELDS = {
  id: true,
  ...BUTTON_CHANGES
} satisfies Record<keyof ButtonContribution, true>

export function createBadgeSlot(): ChromeSlot<BadgeContribution, TopbarBadge> {
  return createChromeSlot(
    'ui.addTopBarBadge',
    BADGE_CHANGES,
    readBadge,
    (badge) => ({
      text: badge.text,
      label: badge.label,
      variant: badge.variant,
      tooltip: badge.tooltip
    })
  )
}

export function createButtonSlot(): ChromeSlot<
  ButtonContribution,
  ActionBarButton
> {
  return createChromeSlot(
    'ui.addActionBarButton',
    BUTTON_CHANGES,
    readButton,
    (button) => ({
      icon: button.icon,
      label: button.label,
      tooltip: button.tooltip,
      onClick: (event?: unknown) =>
        callListener('ui.addActionBarButton', () =>
          button.run(event instanceof MouseEvent ? event : undefined)
        )
    })
  )
}

function createChromeSlot<TItem extends { readonly id: string }, THost>(
  member: string,
  changeable: Readonly<Record<string, true>>,
  readItem: ReadItem<TItem>,
  toHost: (item: TItem) => THost
): ChromeSlot<TItem, THost> {
  const entries = shallowRef<readonly { item: TItem; host: THost }[]>([])

  function replace(id: string, item: TItem | undefined): void {
    entries.value = item
      ? entries.value.map((entry) =>
          entry.item.id === id ? { item, host: toHost(item) } : entry
        )
      : entries.value.filter((entry) => entry.item.id !== id)
  }

  return {
    shown: computed(() => entries.value.map((entry) => entry.host)),
    add(value) {
      const item = readItem(value, member)
      if (entries.value.some((entry) => entry.item.id === item.id)) {
        throw invalidArgument(member, 'an id nothing shown has', item.id)
      }
      entries.value = [...entries.value, { item, host: toHost(item) }]
      let current: TItem | undefined = item
      return Object.freeze({
        update(changes: unknown) {
          if (!current) return false
          const given = checkedFields(
            'update',
            'the fields to change',
            changes,
            changeable
          )
          current = readItem({ ...current, ...given, id: item.id }, 'update')
          replace(item.id, current)
          return true
        },
        remove() {
          if (!current) return
          current = undefined
          replace(item.id, undefined)
        }
      })
    }
  }
}

function readBadge(value: unknown, member: string): BadgeContribution {
  const fields = packObject(member, 'a badge', value, BADGE_FIELDS)
  return Object.freeze({
    id: fields.required('id', isName, 'a non-empty string'),
    text: fields.required('text', isText, 'a string'),
    label: fields.optional('label', isText, 'a string'),
    variant: fields.optional('variant', isVariant, 'info, warning or error'),
    tooltip: fields.optional('tooltip', isText, 'a string')
  })
}

function isVariant(value: unknown): value is BadgeContribution['variant'] {
  return value === 'info' || value === 'warning' || value === 'error'
}

function readButton(value: unknown, member: string): ButtonContribution {
  const fields = packObject(member, 'a button', value, BUTTON_FIELDS)
  return Object.freeze({
    id: fields.required('id', isName, 'a non-empty string'),
    icon: fields.required('icon', isName, 'an icon class'),
    label: fields.optional('label', isText, 'a string'),
    tooltip: fields.optional('tooltip', isText, 'a string'),
    run: fields.required('run', isCallback, 'a function')
  })
}
