import type { LocalizedText } from '../i18n/translations'

interface EducationStep {
  id: string
  title: LocalizedText
  description: LocalizedText
}

export const educationSteps: readonly EducationStep[] = [
  {
    id: 'choose-a-plan',
    title: {
      en: 'Choose a plan',
      'zh-CN': '选择方案'
    },
    description: {
      en: 'Select the right plan for you and sign up with your academic or institutional email',
      'zh-CN': '选择适合您的方案，并使用您的学术或院校邮箱注册'
    }
  },
  {
    id: 'get-approved',
    title: {
      en: 'Get approved',
      'zh-CN': '获得批准'
    },
    description: {
      en: 'Once you sign in to your Comfy Cloud account and your email is validated, your discount will be applied automatically',
      'zh-CN': '当您登录 Comfy Cloud 账户且邮箱通过验证后，折扣将自动应用'
    }
  },
  {
    id: 'unlock-your-creativity',
    title: {
      en: 'Unlock your creativity',
      'zh-CN': '释放你的创造力'
    },
    description: {
      en: 'Get started with thousands of pre-built templates and workflows powered by 60,000+ nodes',
      'zh-CN': '立即使用由 60,000+ 节点驱动的数千个预置模板和工作流'
    }
  }
]
