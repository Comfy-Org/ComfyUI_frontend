<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import type { CardWorkflowItem } from '../../components/blocks/CardWorkflow01.vue'
import TeamGrid01 from '../../components/blocks/TeamGrid01.vue'
import type { FdctTechnologist } from '../../data/fdct'
import { projects, technologists } from '../../data/fdct'
import { t } from '../../i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()

// Each dialog shows its technologist's workflows from the shared past-projects
// list (already in most-popular order); profiles without any get no grid.
function workflowsOf(person: FdctTechnologist): CardWorkflowItem[] {
  return projects(locale)
    .filter((project) => project.author.name === person.name)
    .map((project) => ({
      id: project.id,
      title: project.title,
      href: project.href,
      media: { ...project.media, alt: project.title },
      description: project.description,
      tags: project.tags
    }))
}

const people = technologists(locale).map((person) => ({
  ...person,
  ctaLabel: t('fdct.technologists.seeWork', locale).replace(
    '{name}',
    person.nickname ?? person.name.split(' ')[0]
  ),
  workflows: workflowsOf(person)
}))
</script>

<template>
  <TeamGrid01
    :heading="t('fdct.technologists.title', locale)"
    :lead="t('fdct.technologists.lead', locale)"
    :people="people"
    :close-label="t('fdct.technologists.close', locale)"
  />
</template>
