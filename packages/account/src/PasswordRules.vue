<template>
  <small class="text-sm">
    {{ copy.requirements }}:
    <ul class="mt-1 space-y-1">
      <li :class="cn(!checks.length && 'text-red-500')">
        {{ copy.length }}
      </li>
      <li :class="cn(!checks.uppercase && 'text-red-500')">
        {{ copy.uppercase }}
      </li>
      <li :class="cn(!checks.lowercase && 'text-red-500')">
        {{ copy.lowercase }}
      </li>
      <li :class="cn(!checks.number && 'text-red-500')">
        {{ copy.number }}
      </li>
      <li :class="cn(!checks.special && 'text-red-500')">
        {{ copy.special }}
      </li>
    </ul>
  </small>
</template>

<script setup lang="ts">
/**
 * The password rule list both hosts show while a new password is typed:
 * every rule, the unmet ones marked. Copy is host-translated; when to show
 * the list (dirty + focused) stays with the host.
 */
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { PasswordRule } from './signInSchemas'
import { passwordRuleChecks } from './signInSchemas'

export type PasswordRulesCopy = Readonly<
  Record<PasswordRule | 'requirements', string>
>

const { password, copy } = defineProps<{
  password: string
  copy: PasswordRulesCopy
}>()

const checks = computed(() => passwordRuleChecks(password))
</script>
