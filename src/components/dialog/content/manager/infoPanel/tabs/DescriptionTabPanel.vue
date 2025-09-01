<template>
  <div class="mt-4 overflow-hidden">
    <InfoTextSection
      v-if="nodePack?.description"
      :sections="descriptionSections"
    />
    <p v-else class="text-muted italic text-sm">
      {{ $t('manager.noDescription') }}
    </p>
    <div v-if="nodePack?.latest_version?.dependencies?.length">
      <p class="mb-1">
        {{ $t('manager.dependencies') }}
      </p>
      <div
        v-for="(dep, index) in nodePack.latest_version.dependencies"
        :key="index"
        class="text-muted break-words"
      >
        {{ dep }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import InfoTextSection, {
  type TextSection
} from '@/components/dialog/content/manager/infoPanel/InfoTextSection.vue'
import { components } from '@/types/comfyRegistryTypes'
import { isValidUrl } from '@/utils/formatUtil'

const { t } = useI18n()

const { nodePack } = defineProps<{
  nodePack: components['schemas']['Node']
}>()

const isLicenseFile = (filename: string): boolean => {
  // Match LICENSE, LICENSE.md, LICENSE.txt (case insensitive)
  const licensePattern = /^license(\.md|\.txt)?$/i
  return licensePattern.test(filename)
}

const extractBaseRepoUrl = (repoUrl: string): string => {
  const githubRepoPattern = /^(https?:\/\/github\.com\/[^/]+\/[^/]+)/i
  const match = repoUrl.match(githubRepoPattern)
  return match ? match[1] : repoUrl
}

const createLicenseUrl = (filename: string, repoUrl: string): string => {
  if (!repoUrl || !filename) return ''

  const licenseFile = isLicenseFile(filename) ? filename : 'LICENSE'
  const baseRepoUrl = extractBaseRepoUrl(repoUrl)
  return `${baseRepoUrl}/blob/main/${licenseFile}`
}

const parseLicenseObject = (
  licenseObj: any
): { text: string; isUrl: boolean } => {
  const licenseFile = licenseObj.file || licenseObj.text

  if (
    typeof licenseFile === 'string' &&
    isLicenseFile(licenseFile) &&
    nodePack.repository
  ) {
    const url = createLicenseUrl(licenseFile, nodePack.repository)
    return {
      text: url,
      isUrl: !!url && isValidUrl(url)
    }
  } else if (licenseObj.text) {
    return {
      text: licenseObj.text,
      isUrl: false
    }
  } else if (typeof licenseFile === 'string') {
    // Return the license file name if repository is missing
    return {
      text: licenseFile,
      isUrl: false
    }
  }
  return {
    text: JSON.stringify(licenseObj),
    isUrl: false
  }
}

const formatLicense = (
  license: string
): { text: string; isUrl: boolean } | null => {
  // Treat "{}" JSON string as undefined
  if (license === '{}') return null

  try {
    const licenseObj = JSON.parse(license)
    // Handle empty object case
    if (Object.keys(licenseObj).length === 0) {
      return null
    }
    return parseLicenseObject(licenseObj)
  } catch (e) {
    if (isLicenseFile(license) && nodePack.repository) {
      const url = createLicenseUrl(license, nodePack.repository)
      return {
        text: url,
        isUrl: !!url && isValidUrl(url)
      }
    }
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
      text: nodePack.description || t('manager.noDescription')
    }
  ]

  if (nodePack.repository) {
    sections.push({
      title: t('manager.repository'),
      text: nodePack.repository,
      isUrl: isValidUrl(nodePack.repository)
    })
  }

  if (nodePack.license) {
    const licenseInfo = formatLicense(nodePack.license)
    if (licenseInfo && licenseInfo.text) {
      sections.push({
        title: t('manager.license'),
        text: licenseInfo.text,
        isUrl: licenseInfo.isUrl
      })
    }
  }

  return sections
})
</script>
