import type { LocalizedText } from '../i18n/translations'

interface EducationFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

export const educationFaqs: readonly EducationFaq[] = [
  {
    id: 'what-discount',
    question: {
      en: 'What discount do I get?',
      'zh-CN': '我能获得多少折扣？'
    },
    answer: {
      en: 'Verified students and educators get an extra 10% off any individual plan and an extra 5% off any team plan, up to 25% in total for annual team plans. The team discount stacks with annual pricing, so the more you commit, the more you save.',
      'zh-CN':
        '经过验证的学生和教育工作者可在任意个人方案上额外享受 10% 折扣，在任意团队方案上额外享受 5% 折扣；年付团队方案最高可累计达 25% 的折扣。团队折扣可与年付价格叠加，因此承诺时间越长，节省越多。'
    }
  },
  {
    id: 'how-verification-works',
    question: {
      en: 'How does verification work?',
      'zh-CN': '验证是如何进行的？'
    },
    answer: {
      en: "It takes about a minute, and it's all self-serve:\n\n1. Pick a plan above.\n2. Sign in, or create your Comfy account.\n3. On the payment page, if you're using a recognized school email, your discount is already applied.\n4. If your email isn't recognized, you'll see a quick note to reach support@comfy.org so we can sort it out.",
      'zh-CN':
        '大约只需一分钟，并且全程自助：\n\n1. 在上方选择一个方案。\n2. 登录或创建您的 Comfy 账户。\n3. 在付款页面，如果您使用的是可识别的学校邮箱，折扣会自动应用。\n4. 如果系统无法识别您的邮箱，您会看到一条提示，请联系 support@comfy.org，我们会帮您处理。'
    }
  },
  {
    id: 'who-is-eligible',
    question: {
      en: "Who's eligible?",
      'zh-CN': '谁有资格？'
    },
    answer: {
      en: "Enrolled higher-ed students and educators, verified by your school email when you sign up. Teaching a younger class? K-12 and under-18 use needs a quick arrangement with us first, so reach out to us at education@comfy.org and we'll help.",
      'zh-CN':
        '在读的高等教育学生和教育工作者，注册时通过学校邮箱验证。教的是更低年级？K-12 及 18 岁以下的使用需要先与我们做一个简单的安排，请通过 education@comfy.org 联系我们，我们会提供帮助。'
    }
  },
  {
    id: 'independent-instructor',
    question: {
      en: "I teach independently or run workshops, and I don't have a school email. Can I still get education pricing?",
      'zh-CN': '我独立授课或举办工作坊，没有学校邮箱。我还能获得教育定价吗？'
    },
    answer: {
      en: "The automatic discount keys off recognized school domains, so independent instructors, bootcamps, and for-profit workshops won't clear the email check on their own. Email education@comfy.org with a bit about what you teach and who it's for, and we'll find the right setup for you.",
      'zh-CN':
        '自动折扣依据可识别的学校域名进行判定，因此独立讲师、训练营和营利性工作坊无法仅凭邮箱验证通过。请发送邮件至 education@comfy.org，简单介绍一下您教授的内容和面向的对象，我们会为您找到合适的方案。'
    }
  },
  {
    id: 'cloud-or-local',
    question: {
      en: 'Is this for Comfy Cloud or local ComfyUI?',
      'zh-CN': '这是针对 Comfy Cloud 还是本地 ComfyUI？'
    },
    answer: {
      en: 'The discount is for Comfy Cloud, which gives you managed GPUs and a monthly pool of credits. Local ComfyUI is free and open source for everyone, so you can keep building locally whenever you like.',
      'zh-CN':
        '折扣适用于 Comfy Cloud，它为您提供托管 GPU 和每月的额度池。本地 ComfyUI 对所有人免费且开源，因此您随时可以继续在本地进行创作。'
    }
  },
  {
    id: 'students-own-account',
    question: {
      en: 'Do students each need their own account?',
      'zh-CN': '学生需要各自拥有账户吗？'
    },
    answer: {
      en: "You're never charged per seat. On an individual plan, each person has their own subscription and their own credits. On a team plan, you get one workspace with a shared pool of credits and can invite as many students as you want. Bring a class in for a workshop, then remove them when it's over. You only ever pay for the credits, not per student.",
      'zh-CN':
        '我们从不按席位收费。在个人方案中，每个人都有各自的订阅和各自的额度。在团队方案中，您将获得一个工作区，共享一个额度池，并可邀请任意数量的学生。把一个班级带进来参加工作坊，结束后再将他们移除。您始终只为额度付费，而不是按学生数付费。'
    }
  },
  {
    id: 'removing-a-student',
    question: {
      en: 'What happens to a student when I remove them from the team?',
      'zh-CN': '当我把学生从团队中移除后会怎样？'
    },
    answer: {
      en: 'They keep their account. When someone is removed from a team workspace, they return to their own personal workspace on the free plan, with the work they created still theirs. They can upgrade to a paid plan whenever they like. So you can bring a class in for a term and clear them out at the end without anyone losing access or their work.',
      'zh-CN':
        '他们会保留自己的账户。当某人从团队工作区中被移除后，会回到自己免费方案下的个人工作区，他们创建的作品仍归本人所有。他们可以随时升级到付费方案。因此您可以在一个学期内带一个班级进来，并在学期结束时将他们清出，而不会有人失去访问权限或作品。'
    }
  },
  {
    id: 'stack-with-affiliate',
    question: {
      en: 'Does the education discount stack with the affiliate program?',
      'zh-CN': '教育折扣可以与联盟计划叠加吗？'
    },
    answer: {
      en: "Not at the same time. Education pricing is already a program rate, so it doesn't combine with affiliate or referral credits. It does stack with annual commitment pricing on team plans, which is where the true savings come from.",
      'zh-CN':
        '不能同时使用。教育定价本身已是一种计划优惠价，因此不能与联盟或推荐额度合并使用。但它可以与团队方案的年付承诺价格叠加，这才是真正节省的来源。'
    }
  },
  {
    id: 'how-do-i-pay',
    question: {
      en: 'How do I pay?',
      'zh-CN': '我如何付款？'
    },
    answer: {
      en: "Card or ACH at checkout, billed monthly or annually. It's self-serve, so you can start right away. If your school needs to pay by invoice or purchase order, get in touch at education@comfy.org and we can help.",
      'zh-CN':
        '结账时可使用银行卡或 ACH 付款，按月或按年计费。全程自助，您可以立即开始。如果您的学校需要通过发票或采购订单付款，请联系 education@comfy.org，我们会提供帮助。'
    }
  },
  {
    id: 'access-start',
    question: {
      en: 'When does my access start?',
      'zh-CN': '我的访问权限何时开始？'
    },
    answer: {
      en: "Right away. Your discount applies the moment you subscribe, so there's no approval queue and nothing to wait for.",
      'zh-CN':
        '立即开始。折扣会在您订阅的那一刻生效，没有审核排队，也无需等待。'
    }
  },
  {
    id: 'semester-end-or-graduate',
    question: {
      en: 'What happens when the semester ends or I graduate?',
      'zh-CN': '学期结束或我毕业后会怎样？'
    },
    answer: {
      en: 'Your account and everything in it stay yours. Education pricing applies as long as your school email keeps qualifying. If that changes, you move to standard pricing, and your workflows, credits, and history all come with you.',
      'zh-CN':
        '您的账户及其中的一切始终归您所有。只要您的学校邮箱持续符合条件，教育定价就会一直适用。如果条件发生变化，您将转为标准定价，而您的工作流、额度和历史记录都会随之保留。'
    }
  },
  {
    id: 'creative-campus',
    question: {
      en: 'Can my class, program, or school partner with Comfy beyond the discount?',
      'zh-CN': '我的班级、项目或学校可以在折扣之外与 Comfy 建立合作吗？'
    },
    answer: {
      en: "Yes, that's what Creative Campus is for. It's our partnership program for educators and institutions who want to go deeper: a dedicated educator Slack channel, teaching resources and workflow libraries, co-marketing and student showcases, a named contact, and early access to new features. Email education@comfy.org and tell us what you're building.",
      'zh-CN':
        '可以，这正是 Creative Campus 的意义所在。它是我们面向希望深入合作的教育工作者和机构的合作计划：专属的教育者 Slack 频道、教学资源和工作流库、联合营销与学生展示、专属联系人，以及新功能的抢先体验。请发送邮件至 education@comfy.org，告诉我们您正在打造什么。'
    }
  },
  {
    id: 'share-with-leadership',
    question: {
      en: 'I need something to share with my leadership or procurement team.',
      'zh-CN': '我需要可以分享给领导或采购团队的资料。'
    },
    answer: {
      en: "We can send a one-page summary with pricing, terms, security details, and set up invoice or PO billing if a card won't work. Email education@comfy.org and we'll get you what you need.",
      'zh-CN':
        '我们可以提供一页式摘要，包含定价、条款和安全详情；如果无法使用银行卡，我们也可以设置发票或采购订单付款。请发送邮件至 education@comfy.org，我们会为您准备好所需的资料。'
    }
  },
  {
    id: 'full-terms',
    question: {
      en: 'Where can I read the full terms?',
      'zh-CN': '我在哪里可以阅读完整条款？'
    },
    answer: {
      en: '<a href="https://www.notion.so/comfy-org/Comfy-for-Education-Terms-3766d73d365081b78d7ac3fb6dd7f61f?source=copy_link" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Comfy for Education Terms</a>. You\'re on a standard Comfy Cloud plan at an education rate, so the <a href="https://comfy.org/terms-of-service" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Comfy Terms of Service</a> and <a href="https://comfy.org/privacy-policy" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Privacy Policy</a> apply too.',
      'zh-CN':
        '<a href="https://www.notion.so/comfy-org/Comfy-for-Education-Terms-3766d73d365081b78d7ac3fb6dd7f61f?source=copy_link" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Comfy 教育版条款</a>。您使用的是按教育优惠价提供的标准 Comfy Cloud 计划，因此 <a href="https://comfy.org/terms-of-service" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Comfy 服务条款</a>和<a href="https://comfy.org/privacy-policy" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">隐私政策</a>也同样适用。'
    }
  }
] as const
