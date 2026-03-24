type Locale = 'en' | 'zh-CN'

const translations = {
  // HeroSection
  'hero.headline': {
    en: 'Professional Control of Visual AI',
    'zh-CN': '视觉 AI 的专业控制'
  },
  'hero.subheadline': {
    en: 'Comfy is the AI creation engine for visual professionals who demand control over every model, every parameter, and every output.',
    'zh-CN':
      'Comfy 是面向视觉专业人士的 AI 创作引擎，让您掌控每个模型、每个参数和每个输出。'
  },
  'hero.cta.getStarted': { en: 'GET STARTED', 'zh-CN': '立即开始' },
  'hero.cta.learnMore': { en: 'LEARN MORE', 'zh-CN': '了解更多' },

  // SocialProofBar
  'social.heading': {
    en: 'Trusted by Industry Leaders',
    'zh-CN': '受到行业领导者的信赖'
  },
  'social.customNodes': { en: 'Custom Nodes', 'zh-CN': '自定义节点' },
  'social.githubStars': { en: 'GitHub Stars', 'zh-CN': 'GitHub 星标' },
  'social.communityMembers': {
    en: 'Community Members',
    'zh-CN': '社区成员'
  },

  // ProductShowcase
  'showcase.heading': { en: 'See Comfy in Action', 'zh-CN': '观看 Comfy 实战' },
  'showcase.subheading': {
    en: 'Watch how professionals build AI workflows with unprecedented control',
    'zh-CN': '观看专业人士如何以前所未有的控制力构建 AI 工作流'
  },
  'showcase.placeholder': {
    en: 'Workflow Demo Coming Soon',
    'zh-CN': '工作流演示即将推出'
  },
  'showcase.nodeEditor': { en: 'Node-Based Editor', 'zh-CN': '节点编辑器' },
  'showcase.realTimePreview': {
    en: 'Real-Time Preview',
    'zh-CN': '实时预览'
  },
  'showcase.versionControl': {
    en: 'Version Control',
    'zh-CN': '版本控制'
  },

  // ValuePillars
  'pillars.heading': {
    en: 'The Building Blocks of AI Production',
    'zh-CN': 'AI 制作的基本要素'
  },
  'pillars.subheading': {
    en: 'Five powerful capabilities that give you complete control',
    'zh-CN': '五大强大功能，让您完全掌控'
  },
  'pillars.buildTitle': { en: 'Build', 'zh-CN': '构建' },
  'pillars.buildDesc': {
    en: 'Design complex AI workflows visually with our node-based editor',
    'zh-CN': '使用节点编辑器直观地设计复杂的 AI 工作流'
  },
  'pillars.customizeTitle': { en: 'Customize', 'zh-CN': '自定义' },
  'pillars.customizeDesc': {
    en: 'Fine-tune every parameter across any model architecture',
    'zh-CN': '在任何模型架构中微调每个参数'
  },
  'pillars.refineTitle': { en: 'Refine', 'zh-CN': '优化' },
  'pillars.refineDesc': {
    en: 'Iterate on outputs with precision controls and real-time preview',
    'zh-CN': '通过精确控制和实时预览迭代输出'
  },
  'pillars.automateTitle': { en: 'Automate', 'zh-CN': '自动化' },
  'pillars.automateDesc': {
    en: 'Scale your workflows with batch processing and API integration',
    'zh-CN': '通过批处理和 API 集成扩展工作流'
  },
  'pillars.runTitle': { en: 'Run', 'zh-CN': '运行' },
  'pillars.runDesc': {
    en: 'Deploy locally or in the cloud with identical results',
    'zh-CN': '在本地或云端部署，获得相同的结果'
  },

  // UseCaseSection
  'useCase.heading': {
    en: 'Built for Every Creative Industry',
    'zh-CN': '为每个创意行业而生'
  },
  'useCase.vfx': { en: 'VFX & Animation', 'zh-CN': '视觉特效与动画' },
  'useCase.agencies': { en: 'Creative Agencies', 'zh-CN': '创意机构' },
  'useCase.gaming': { en: 'Gaming', 'zh-CN': '游戏' },
  'useCase.ecommerce': {
    en: 'eCommerce & Fashion',
    'zh-CN': '电商与时尚'
  },
  'useCase.community': {
    en: 'Community & Hobbyists',
    'zh-CN': '社区与爱好者'
  },
  'useCase.body': {
    en: 'Powered by 60,000+ nodes, thousands of workflows, and a community that builds faster than any one company could.',
    'zh-CN':
      '由 60,000+ 节点、数千个工作流和一个比任何公司都更快构建的社区驱动。'
  },
  'useCase.cta': { en: 'EXPLORE WORKFLOWS', 'zh-CN': '探索工作流' },

  // CaseStudySpotlight
  'caseStudy.heading': { en: 'Customer Stories', 'zh-CN': '客户故事' },
  'caseStudy.subheading': {
    en: 'See how leading studios use Comfy in production',
    'zh-CN': '了解领先工作室如何在生产中使用 Comfy'
  },
  'caseStudy.readMore': { en: 'READ CASE STUDY', 'zh-CN': '阅读案例' },

  // TestimonialsSection
  'testimonials.heading': {
    en: 'What Professionals Say',
    'zh-CN': '专业人士的评价'
  },
  'testimonials.all': { en: 'All', 'zh-CN': '全部' },
  'testimonials.vfx': { en: 'VFX', 'zh-CN': '特效' },
  'testimonials.gaming': { en: 'Gaming', 'zh-CN': '游戏' },
  'testimonials.advertising': { en: 'Advertising', 'zh-CN': '广告' },
  'testimonials.photography': { en: 'Photography', 'zh-CN': '摄影' },

  // GetStartedSection
  'getStarted.heading': {
    en: 'Get Started in Minutes',
    'zh-CN': '几分钟即可开始'
  },
  'getStarted.subheading': {
    en: 'From download to your first AI-generated output in three simple steps',
    'zh-CN': '从下载到首次 AI 生成输出，只需三个简单步骤'
  },
  'getStarted.step1.title': {
    en: 'Download & Sign Up',
    'zh-CN': '下载与注册'
  },
  'getStarted.step1.desc': {
    en: 'Get Comfy Desktop for free or create a Cloud account',
    'zh-CN': '免费获取 Comfy Desktop 或创建云端账号'
  },
  'getStarted.step2.title': {
    en: 'Load a Workflow',
    'zh-CN': '加载工作流'
  },
  'getStarted.step2.desc': {
    en: 'Choose from thousands of community workflows or build your own',
    'zh-CN': '从数千个社区工作流中选择，或自行构建'
  },
  'getStarted.step3.title': { en: 'Generate', 'zh-CN': '生成' },
  'getStarted.step3.desc': {
    en: 'Hit run and watch your AI workflow come to life',
    'zh-CN': '点击运行，观看 AI 工作流生动呈现'
  },
  'getStarted.cta': { en: 'DOWNLOAD COMFY', 'zh-CN': '下载 COMFY' },

  // CTASection
  'cta.heading': {
    en: 'Choose Your Way to Comfy',
    'zh-CN': '选择您的 Comfy 方式'
  },
  'cta.desktop.title': { en: 'Comfy Desktop', 'zh-CN': 'Comfy Desktop' },
  'cta.desktop.desc': {
    en: 'Full power on your local machine. Free and open source.',
    'zh-CN': '在本地机器上释放全部性能。免费开源。'
  },
  'cta.desktop.cta': { en: 'DOWNLOAD', 'zh-CN': '下载' },
  'cta.cloud.title': { en: 'Comfy Cloud', 'zh-CN': 'Comfy Cloud' },
  'cta.cloud.desc': {
    en: 'Run workflows in the cloud. No GPU required.',
    'zh-CN': '在云端运行工作流，无需 GPU。'
  },
  'cta.cloud.cta': { en: 'TRY CLOUD', 'zh-CN': '试用云端' },
  'cta.api.title': { en: 'Comfy API', 'zh-CN': 'Comfy API' },
  'cta.api.desc': {
    en: 'Integrate AI generation into your applications.',
    'zh-CN': '将 AI 生成功能集成到您的应用程序中。'
  },
  'cta.api.cta': { en: 'VIEW DOCS', 'zh-CN': '查看文档' },

  // ManifestoSection
  'manifesto.heading': { en: 'Method, Not Magic', 'zh-CN': '方法，而非魔法' },
  'manifesto.body': {
    en: 'We believe in giving creators real control over AI. Not black boxes. Not magic buttons. But transparent, reproducible, node-by-node control over every step of the creative process.',
    'zh-CN':
      '我们相信应赋予创作者对 AI 的真正控制权。没有黑箱，没有魔法按钮，而是对创作过程每一步的透明、可复现、逐节点控制。'
  },

  // AcademySection
  'academy.badge': { en: 'COMFY ACADEMY', 'zh-CN': 'COMFY 学院' },
  'academy.heading': {
    en: 'Master AI Workflows',
    'zh-CN': '掌握 AI 工作流'
  },
  'academy.body': {
    en: 'Learn to build professional AI workflows with guided tutorials, video courses, and hands-on projects.',
    'zh-CN': '通过指导教程、视频课程和实践项目，学习构建专业的 AI 工作流。'
  },
  'academy.tutorials': { en: 'Guided Tutorials', 'zh-CN': '指导教程' },
  'academy.videos': { en: 'Video Courses', 'zh-CN': '视频课程' },
  'academy.projects': { en: 'Hands-on Projects', 'zh-CN': '实践项目' },
  'academy.cta': { en: 'EXPLORE ACADEMY', 'zh-CN': '探索学院' },

  // SiteNav
  'nav.enterprise': { en: 'ENTERPRISE', 'zh-CN': '企业版' },
  'nav.gallery': { en: 'GALLERY', 'zh-CN': '画廊' },
  'nav.about': { en: 'ABOUT', 'zh-CN': '关于' },
  'nav.careers': { en: 'CAREERS', 'zh-CN': '招聘' },
  'nav.cloud': { en: 'COMFY CLOUD', 'zh-CN': 'COMFY 云端' },
  'nav.hub': { en: 'COMFY HUB', 'zh-CN': 'COMFY HUB' },

  // SiteFooter
  'footer.tagline': {
    en: 'Professional control of visual AI.',
    'zh-CN': '视觉 AI 的专业控制。'
  },
  'footer.product': { en: 'Product', 'zh-CN': '产品' },
  'footer.resources': { en: 'Resources', 'zh-CN': '资源' },
  'footer.company': { en: 'Company', 'zh-CN': '公司' },
  'footer.legal': { en: 'Legal', 'zh-CN': '法律' },
  'footer.copyright': {
    en: 'Comfy Org. All rights reserved.',
    'zh-CN': 'Comfy Org. 保留所有权利。'
  },
  'footer.comfyDesktop': { en: 'Comfy Desktop', 'zh-CN': 'Comfy Desktop' },
  'footer.comfyCloud': { en: 'Comfy Cloud', 'zh-CN': 'Comfy Cloud' },
  'footer.comfyHub': { en: 'ComfyHub', 'zh-CN': 'ComfyHub' },
  'footer.pricing': { en: 'Pricing', 'zh-CN': '价格' },
  'footer.documentation': { en: 'Documentation', 'zh-CN': '文档' },
  'footer.blog': { en: 'Blog', 'zh-CN': '博客' },
  'footer.gallery': { en: 'Gallery', 'zh-CN': '画廊' },
  'footer.github': { en: 'GitHub', 'zh-CN': 'GitHub' },
  'footer.about': { en: 'About', 'zh-CN': '关于' },
  'footer.careers': { en: 'Careers', 'zh-CN': '招聘' },
  'footer.enterprise': { en: 'Enterprise', 'zh-CN': '企业版' },
  'footer.terms': { en: 'Terms of Service', 'zh-CN': '服务条款' },
  'footer.privacy': { en: 'Privacy Policy', 'zh-CN': '隐私政策' }
} as const satisfies Record<string, Record<Locale, string>>

type TranslationKey = keyof typeof translations

export function t(key: TranslationKey, locale: Locale = 'en'): string {
  return translations[key][locale] ?? translations[key].en
}

export function localePath(path: string, locale: Locale): string {
  return locale === 'en' ? path : `/${locale}${path}`
}

export type { Locale }
