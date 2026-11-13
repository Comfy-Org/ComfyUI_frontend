import { computed, shallowRef } from 'vue'
import type { ComputedRef } from 'vue'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type {
  BadgeContribution,
  ButtonContribution,
  ChromeItemHandle
} from '@/platform/nodeApi/v4/types'
import type { ActionBarButton, TopbarBadge } from '@/types/comfy'

import {
  isCallback,
  isName,
  isObject,
  isText,
  packObject
} from '@/platform/nodeApi/v4/utilities/packArguments'

interface ChromeSlot<TItem extends { readonly id: string }, THost> {
  readonly shown: ComputedRef<readonly THost[]>
  add(item: unknown): ChromeItemHandle<TItem>
}

type ReadItem<TItem> = (value: unknown, member: string) => TItem

export function createBadgeSlot(): ChromeSlot<BadgeContribution, TopbarBadge> {
  return createChromeSlot('ui.addTopBarBadge', readBadge, (badge) => ({
    text: badge.text,
    label: badge.label,
    variant: badge.variant,
    tooltip: badge.tooltip
  }))
}

export function createButtonSlot(): ChromeSlot<
  ButtonContribution,
  ActionBarButton
> {
  return createChromeSlot('ui.addActionBarButton', readButton, (button) => ({
    icon: button.icon,
    label: button.label,
    tooltip: button.tooltip,
    onClick: (event?: unknown) =>
      callListener('ui.addActionBarButton', () =>
        button.run(event instanceof MouseEvent ? event : undefined)
      )
  }))
}

function createChromeSlot<TItem extends { readonly id: string }, THost>(
  member: string,
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
          if (!isObject(changes)) {
            throw invalidArgument('update', 'the fields to change', changes)
          }
          if (!current) return false
          current = readItem({ ...current, ...changes, id: item.id }, member)
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
  const fields = packObject(member, 'a badge', value)
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
  const fields = packObject(member, 'a button', value)
  return Object.freeze({
    id: fields.required('id', isName, 'a non-empty string'),
    icon: fields.required('icon', isName, 'an icon class'),
    label: fields.optional('label', isText, 'a string'),
    tooltip: fields.optional('tooltip', isText, 'a string'),
    run: fields.required('run', isCallback, 'a function')
  })
}
