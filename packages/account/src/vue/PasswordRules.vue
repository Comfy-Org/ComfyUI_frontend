<template>
  <div :class="rootClass">
    {{ copy.requirements }}:
    <ul :class="listClass">
      <li :class="cn(!checks.length && unmetClass)">
        {{ copy.length }}
      </li>
      <li :class="cn(!checks.uppercase && unmetClass)">
        {{ copy.uppercase }}
      </li>
      <li :class="cn(!checks.lowercase && unmetClass)">
        {{ copy.lowercase }}
      </li>
      <li :class="cn(!checks.number && unmetClass)">
        {{ copy.number }}
      </li>
      <li :class="cn(!checks.special && unmetClass)">
        {{ copy.special }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * The password rule list both hosts show while a new password is typed:
 * every rule, the unmet ones marked. Unstyled: copy is host-translated and
 * the look comes through the class props; when to show the list (dirty +
 * focused) stays with the host.
 */
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { PasswordRule } from '../signInSchemas'
import { passwordRuleChecks } from '../signInSchemas'

export type PasswordRulesCopy = Readonly<
  Record<PasswordRule | 'requirements', string>
>

const { password, copy, rootClass, listClass, unmetClass } = defineProps<{
  password: string
  copy: PasswordRulesCopy
  rootClass?: string
  listClass?: string
  /** Applied to a rule the password does not yet satisfy. */
  unmetClass?: string
}>()

const checks = computed(() => passwordRuleChecks(password))
</script>
