import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming'
import {
  defaultConfig,
  type TagBadgeParameters
} from 'storybook-addon-tag-badges/manager-helpers'

const comfyTheme = create({
  base: 'dark',
  brandTitle: 'Comfy Website',
  brandUrl: 'https://www.comfy.org',
  brandImage: '/icons/logo.svg',
  brandTarget: '_self',
  colorPrimary: '#e8ff4f',
  colorSecondary: '#f1ff8a',
  appBg: '#211927',
  appContentBg: '#2d2433',
  appPreviewBg: '#211927',
  appBorderColor: '#554b59',
  barBg: '#2d2433',
  barSelectedColor: '#e8ff4f',
  inputBg: '#211927',
  inputBorder: '#706575',
  inputTextColor: '#f0efed',
  textColor: '#f0efed',
  textInverseColor: '#211927'
})

addons.setConfig({
  theme: comfyTheme,
  sidebar: {
    showRoots: true
  },
  tagBadges: [
    {
      tags: 'needs-tests',
      badge: {
        text: 'Needs tests',
        style: {
          backgroundColor: '#f4b860',
          color: '#211927'
        },
        tooltip: 'Renders in Storybook but is excluded from browser tests.'
      },
      display: {
        sidebar: [{ type: 'component', skipInherited: true }],
        toolbar: true,
        mdx: true
      }
    },
    {
      tags: 'stable',
      badge: {
        text: 'Stable',
        style: {
          backgroundColor: '#e8ff4f',
          color: '#211927'
        },
        tooltip: 'Approved for reuse in new website compositions.'
      },
      display: {
        sidebar: [{ type: 'component', skipInherited: false }],
        toolbar: true,
        mdx: true
      }
    },
    ...defaultConfig
  ] satisfies TagBadgeParameters
})
