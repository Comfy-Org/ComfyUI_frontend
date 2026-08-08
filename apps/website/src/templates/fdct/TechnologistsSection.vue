<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import type { CardWorkflowItem } from '../../components/blocks/CardWorkflow01.vue'
import TeamGrid01 from '../../components/blocks/TeamGrid01.vue'
import { projects, technologists } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Each dialog shows its technologist's workflows from the shared past-projects
// list (already in most-popular order); profiles without any get no grid.
function workflowsOf(
  person: (typeof technologists)[number]
): CardWorkflowItem[] {
  return projects
    .filter((project) => project.author.name === person.name)
    .map((project) => ({
      id: project.id,
      title: project.title,
      href: project.href,
      media: { ...project.media, alt: project.title },
      creator: {
        name: person.name,
        avatarSrc: person.avatarSrc,
        href: person.workflowsHref
      },
      tags: [...project.tags]
    }))
}

const people = technologists.map((person) => ({
  ...person,
  workflows: workflowsOf(person)
}))
</script>

<template>
  <TeamGrid01
    :heading="t('fdct.technologists.title', locale)"
    :lead="t('fdct.technologists.lead', locale)"
    :people="people"
    :workflows-label="t('fdct.technologists.workflows', locale)"
    :try-now-label="t('fdct.technologists.tryNow', locale)"
    :close-label="t('fdct.technologists.close', locale)"
  />
</template>
