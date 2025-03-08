<template>
  <div class="mt-4 overflow-hidden">
    <InfoTextSection
      v-if="nodePack.description"
      :sections="descriptionSections"
    />
    <p v-else class="text-muted italic text-sm">
      {{ $t('manager.noDescription') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import InfoTextSection, {
  type TextSection
} from '@/components/dialog/content/manager/infoPanel/InfoTextSection.vue'
import { components } from '@/types/comfyRegistryTypes'

const { t } = useI18n()

const props = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

const isLicenseFile = (filename: string): boolean => {
  // Match LICENSE, LICENSE.md, LICENSE.txt (case insensitive)
  const licensePattern = /^license(\.md|\.txt)?$/i
  return licensePattern.test(filename)
}

const extractBaseRepoUrl = (repoUrl: string): string => {
  // Match GitHub repository URL and extract the base URL
  const githubRepoPattern = /^(https?:\/\/github\.com\/[^/]+\/[^/]+)/i
  const match = repoUrl.match(githubRepoPattern)
  return match ? match[1] : repoUrl
}

const createLicenseUrl = (filename: string, repoUrl: string): string => {
  if (!repoUrl || !filename) return ''

  // Use the filename if it's a license file, otherwise use LICENSE
  const licenseFile = isLicenseFile(filename) ? filename : 'LICENSE'

  // Get the base repository URL
  const baseRepoUrl = extractBaseRepoUrl(repoUrl)

  return `${baseRepoUrl}/blob/main/${licenseFile}`
}

const parseLicenseObject = (
  licenseObj: any
): { text: string; isUrl: boolean } => {
  // Get the license file or text
  const licenseFile = licenseObj.file || licenseObj.text

  // If it's a string and a license file, create a URL
  if (typeof licenseFile === 'string' && isLicenseFile(licenseFile)) {
    const url = createLicenseUrl(licenseFile, props.nodePack.repository)
    return {
      text: url,
      isUrl: !!url && isValidUrl(url)
    }
  }
  // Otherwise use the text directly
  else if (licenseObj.text) {
    return {
      text: licenseObj.text,
      isUrl: false
    }
  }

  // Default fallback
  return {
    text: JSON.stringify(licenseObj),
    isUrl: false
  }
}

const formatLicense = (license: string): { text: string; isUrl: boolean } => {
  try {
    const licenseObj = JSON.parse(license)
    return parseLicenseObject(licenseObj)
  } catch (e) {
    // Not JSON, handle as plain string
    // If it's a license file, create a URL
    if (isLicenseFile(license)) {
      const url = createLicenseUrl(license, props.nodePack.repository)
      return {
        text: url,
        isUrl: !!url && isValidUrl(url)
      }
    }

    // Otherwise return as is
    return {
      text: license,
      isUrl: false
    }
  }
}

const descriptionSections = computed<TextSection[]>(() => {
  const sections: TextSection[] = [
    {
      title: t('g.description'),
      text: props.nodePack.description || t('manager.noDescription')
    }
  ]

  if (props.nodePack.repository) {
    sections.push({
      title: t('manager.repository'),
      text: props.nodePack.repository,
      isUrl: isValidUrl(props.nodePack.repository)
    })
  }

  if (props.nodePack.license) {
    const { text, isUrl } = formatLicense(props.nodePack.license)
    if (text) {
      sections.push({
        title: t('manager.license'),
        text,
        isUrl
      })
    }
  }

  return sections
})
</script>
