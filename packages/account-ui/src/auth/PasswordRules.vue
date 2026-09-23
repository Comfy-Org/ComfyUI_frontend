<template>
  <div :class="rootClass">
    {{ copy.requirements }}:
    <ul :class="listClass">
      <li :class="checks.length ? undefined : unmetClass">
        {{ copy.length }}
      </li>
      <li :class="checks.uppercase ? undefined : unmetClass">
        {{ copy.uppercase }}
      </li>
      <li :class="checks.lowercase ? undefined : unmetClass">
        {{ copy.lowercase }}
      </li>
      <li :class="checks.number ? undefined : unmetClass">
        {{ copy.number }}
      </li>
      <li :class="checks.special ? undefined : unmetClass">
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

import type { PasswordRule } from '@comfyorg/account-core/signInSchemas'
import { passwordRuleChecks } from '@comfyorg/account-core/signInSchemas'

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
