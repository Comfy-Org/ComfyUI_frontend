type Locale = 'en' | 'zh-CN'

const translations = {
  // Tags (global, reusable across sections)
  'tags.partnerNodes': {
    en: 'Partner Nodes',
    'zh-CN': '合作伙伴节点'
  },
  'tags.openWeights': {
    en: 'Open Weights',
    'zh-CN': '开放权重'
  },
  'tags.openSource': {
    en: 'Open Source',
    'zh-CN': '开源'
  },
  'tags.imageToVideo': {
    en: 'Image To Video',
    'zh-CN': '图像生成视频'
  },
  'tags.imageGeneration': {
    en: 'Image Generation',
    'zh-CN': '图像生成'
  },
  'tags.styleTransfer': {
    en: 'Style Transfer',
    'zh-CN': '风格迁移'
  },
  'tags.moodboards': {
    en: 'Moodboards',
    'zh-CN': '情绪板'
  },
  'tags.storyboarding': {
    en: 'Storyboarding',
    'zh-CN': '故事板'
  },
  'tags.productPhotography': {
    en: 'Product Photography',
    'zh-CN': '产品摄影'
  },
  'tags.previsualization': {
    en: 'Previsualization',
    'zh-CN': '预演'
  },
  'tags.bRoll': {
    en: 'B-Roll',
    'zh-CN': 'B-Roll 素材'
  },
  'tags.outOfHome': {
    en: 'Out-of-Home',
    'zh-CN': '户外广告'
  },
  'tags.characterDesign': {
    en: 'Character Design',
    'zh-CN': '角色设计'
  },
  'tags.keyframing': {
    en: 'Keyframing',
    'zh-CN': '关键帧'
  },
  'tags.backgrounds': {
    en: 'Backgrounds',
    'zh-CN': '背景'
  },
  'tags.threeD': {
    en: '3D',
    'zh-CN': '3D'
  },
  'tags.inBetweening': {
    en: 'In-Betweening',
    'zh-CN': '中间帧'
  },
  'tags.compositing': {
    en: 'Compositing',
    'zh-CN': '合成'
  },
  'tags.fundamentals': {
    en: 'Fundamentals',
    'zh-CN': '基础入门'
  },
  'tags.nodeGraph': {
    en: 'Node Graph',
    'zh-CN': '节点图'
  },
  'tags.lora': {
    en: 'LoRA',
    'zh-CN': 'LoRA'
  },
  'tags.controlNet': {
    en: 'ControlNet',
    'zh-CN': 'ControlNet'
  },

  // UI (global, reusable across sections)
  'ui.copy': {
    en: 'Copy',
    'zh-CN': '复制'
  },
  'ui.breadcrumb': { en: 'Breadcrumb', 'zh-CN': '面包屑导航' },
  'ui.readMore': { en: 'Read more', 'zh-CN': '展开' },
  'ui.readLess': { en: 'Read less', 'zh-CN': '收起' },
  'ui.copied': {
    en: 'Copied',
    'zh-CN': '已复制'
  },

  // CTAs (global, reusable across sections)
  'cta.tryWorkflow': {
    en: 'Try Workflow',
    'zh-CN': '试用工作流'
  },
  'cta.tryForFree': {
    en: 'Try for Free',
    'zh-CN': '免费试用'
  },
  'cta.getStarted': {
    en: 'GET STARTED',
    'zh-CN': '快速开始'
  },
  'cta.watchNow': {
    en: 'Watch Now',
    'zh-CN': '立即观看'
  },
  'cta.watchDemo': {
    en: 'Watch Demo',
    'zh-CN': '观看演示'
  },

  // Education CTA (customer story block)

  // HeroSection
  'hero.title': {
    en: 'Professional Control\nof Visual AI',
    'zh-CN': '视觉 AI 的\n最强可控性'
  },
  'hero.subtitle': {
    en: 'Comfy is the AI creation engine for visual professionals who demand control over every model, every parameter, and every output.',
    'zh-CN':
      'Comfy 是面向专业视觉人士的 AI 创作引擎。您可以精确掌控每个模型、每个参数和每个输出。'
  },
  'hero.runFirstWorkflow': {
    en: 'Run your first workflow',
    'zh-CN': '运行你的第一个工作流'
  },

  // Model release carousel (home page)
  'modelRelease.eyebrow': {
    en: 'New Model Release',
    'zh-CN': '新模型发布'
  },
  'modelRelease.seedance.title': {
    en: 'Seedance 2.5',
    'zh-CN': 'Seedance 2.5'
  },
  'modelRelease.seedance.body': {
    en: "ByteDance's cinematic video model — multi-shot sequences with native audio, text or image in. You direct on the canvas; Seedance renders the cut.",
    'zh-CN':
      '字节跳动的电影级视频模型：多镜头序列，原生音频，支持文本或图像输入。你在画布上执导，Seedance 负责渲染成片。'
  },
  'modelRelease.seedance.explore': {
    en: 'Explore Seedance 2.5',
    'zh-CN': '探索 Seedance 2.5'
  },
  'modelRelease.seedance.videoAriaLabel': {
    en: 'Seedance 2.5 preview',
    'zh-CN': 'Seedance 2.5 预览'
  },
  'modelRelease.ltx.title': {
    en: 'LTX 2.5',
    'zh-CN': 'LTX 2.5'
  },
  'modelRelease.ltx.body': {
    en: 'The fastest video generation model, now with sharper prompt adherence and audio. Cinematic detail on faces and fine textures with Diffusion Fidelity Rendering.',
    'zh-CN':
      '最快的视频生成模型，如今提示词遵循度与音频表现全面升级。凭借 Diffusion Fidelity Rendering，人物面部与细腻纹理都能呈现电影级细节。'
  },
  'modelRelease.ltx.explore': {
    en: 'Explore LTX 2.5',
    'zh-CN': '探索 LTX 2.5'
  },
  'modelRelease.ltx.videoAriaLabel': {
    en: 'LTX 2.5 preview',
    'zh-CN': 'LTX 2.5 预览'
  },
  'modelRelease.wanAnimate2.title': {
    en: 'Wan Animate 2',
    'zh-CN': 'Wan Animate 2'
  },
  'modelRelease.wanAnimate2.body': {
    en: 'Upload a reference image of your character and a video of the motion you want. Wan Animate 2 transfers that motion onto your character, end to end.',
    'zh-CN':
      '上传一张角色参考图，再加上一段你想要的动作视频，Wan Animate 2 就会把该动作完整迁移到你的角色上。'
  },
  'modelRelease.wanAnimate2.explore': {
    en: 'Explore Wan Animate 2',
    'zh-CN': '探索 Wan Animate 2'
  },
  'modelRelease.wanAnimate2.videoAriaLabel': {
    en: 'Wan Animate 2 preview',
    'zh-CN': 'Wan Animate 2 预览'
  },
  'modelRelease.minimax.title': {
    en: 'MiniMax H3',
    'zh-CN': 'MiniMax H3'
  },
  'modelRelease.minimax.body': {
    en: 'Full multi-modal I/O, native stereo clip. Up to 2K, 5 to 15s per generation. H3 actually conditions on input audio where others overwrite or drop it.',
    'zh-CN':
      '完整的多模态输入输出，原生立体声剪辑。最高 2K，每次生成 5 至 15 秒。H3 真正基于输入音频进行条件生成，而其他模型则会覆盖或丢弃它。'
  },
  'modelRelease.minimax.explore': {
    en: 'Explore MiniMax H3',
    'zh-CN': '探索 MiniMax H3'
  },
  'modelRelease.minimax.videoAriaLabel': {
    en: 'MiniMax H3 preview',
    'zh-CN': 'MiniMax H3 预览'
  },

  // ProductShowcaseSection
  'showcase.subtitle1': {
    en: 'Connect models, processing steps, and outputs on a canvas where every decision is visible and every step is inspectable.',
    'zh-CN':
      '在画布上连接模型、处理步骤和输出，每个决策都可见，每个步骤都可检查。'
  },
  'showcase.subtitle2': {
    en: 'Start from a community template or build from scratch.',
    'zh-CN': '从工作流模板开始，或从零构建。'
  },
  'showcase.feature1.title': {
    en: 'Full Control with Nodes',
    'zh-CN': '节点带来的可控性'
  },
  'showcase.feature1.description': {
    en: 'Build powerful AI pipelines by connecting nodes on an infinite canvas. Every model, parameter, and processing step is visible and adjustable.',
    'zh-CN':
      '在无限画布上连接节点，构建强大的 AI 管线。每个模型、参数和处理步骤都可见且可调整。'
  },
  'showcase.feature2.title': {
    en: 'App mode, a simplified view of your workflows',
    'zh-CN': 'App 模式，工作流的简化视图'
  },
  'showcase.feature2.description': {
    en: 'If you are new to ComfyUI, get started with App Mode, a simplified view of your workflows. You can flip back to the node graph view anytime to go deeper.',
    'zh-CN':
      '如果您是 ComfyUI 新手，可以从 App 模式开始——这是工作流的简化视图。您随时可以切换回节点图视图以深入了解。'
  },
  'showcase.feature3.title': {
    en: 'Community Workflows on Comfy Workflows',
    'zh-CN': 'Comfy Workflows 上的社区工作流'
  },
  'showcase.feature3.description': {
    en: 'Browse and remix thousands of community-shared workflows. Start from a proven template and customize it to your needs.',
    'zh-CN':
      '浏览和混搭数千个社区共享的工作流。从经过验证的模板开始，按需自定义。'
  },
  'showcase.badgeHow': { en: 'HOW', 'zh-CN': '了解' },
  'showcase.badgeWorks': { en: 'WORKS', 'zh-CN': '运行方式' },

  // UseCaseSection
  'useCase.label': {
    en: 'Industries that create with ComfyUI',
    'zh-CN': '使用 ComfyUI 创作的行业'
  },
  'useCase.navLabel': {
    en: 'Industry categories',
    'zh-CN': '行业分类'
  },
  'useCase.vfx': {
    en: 'VFX &\nAnimation',
    'zh-CN': '视觉特效 &\n动画'
  },
  'useCase.advertising': {
    en: 'Advertising &\nCreative Studios',
    'zh-CN': '广告 &\n创意工作室'
  },
  'useCase.gaming': {
    en: 'Gaming',
    'zh-CN': '电子游戏'
  },
  'useCase.ecommerce': {
    en: 'eCommerce &\nFashion',
    'zh-CN': '电商 &\n时尚'
  },
  'useCase.more': {
    en: '& More',
    'zh-CN': '& 更多'
  },
  'useCase.body': {
    en: 'Powered by 60,000+ nodes, thousands of workflows,\nand a community that builds faster than any one company could.',
    'zh-CN': '60,000+ 节点，数千条工作流，\n一个比任何公司速度都更快的社区。'
  },
  'useCase.cta': {
    en: 'EXPLORE WORKFLOWS',
    'zh-CN': '探索工作流'
  },

  // GetStartedSection
  'getStarted.heading': {
    en: 'Get started in minutes',
    'zh-CN': '几分钟即可上手'
  },
  'getStarted.subheading': {
    en: 'Go as deep as you want to.',
    'zh-CN': '想多深入就多深入。'
  },
  'getStarted.step1.title': {
    en: 'Download or Sign up',
    'zh-CN': '下载或注册'
  },
  'getStarted.step1.downloadLocal': {
    en: 'Download Desktop',
    'zh-CN': '下载桌面版'
  },
  'getStarted.step1.launchCloud': {
    en: 'Try Cloud for free',
    'zh-CN': '免费试用云端'
  },
  'getStarted.step1.or': {
    en: ' or ',
    'zh-CN': '或'
  },
  'getStarted.step2.title': {
    en: 'Load a workflow',
    'zh-CN': '加载工作流'
  },
  'getStarted.step2.descriptionPrefix': {
    en: 'Start from ',
    'zh-CN': '从'
  },
  'getStarted.step2.descriptionLink': {
    en: 'a community template',
    'zh-CN': '社区模板'
  },
  'getStarted.step2.descriptionSuffix': {
    en: ' or build your own.',
    'zh-CN': '开始，或自行构建。'
  },
  'getStarted.step3.title': {
    en: 'Generate & Iterate',
    'zh-CN': '生成与迭代'
  },
  'getStarted.step3.description': {
    en: "Run, adjust, scale when you're ready.",
    'zh-CN': '运行、调整，准备好了就扩展。'
  },

  // ProductCardsSection
  'products.labelProducts': {
    en: 'Products',
    'zh-CN': '产品'
  },
  'products.heading': {
    en: 'The AI creation\nengine for complete control',
    'zh-CN': '完全掌控的\nAI 创作引擎'
  },
  'products.subheading': {
    en: 'Over every model, every node, every step, every output.',
    'zh-CN': '掌控每个模型、每个节点、每个步骤、每个输出。'
  },
  'products.local.title': {
    en: 'Comfy\nDesktop',
    'zh-CN': 'Comfy\n桌面版'
  },
  'products.local.description': {
    en: 'Run ComfyUI on your own hardware.',
    'zh-CN': '在您自己的硬件上运行 ComfyUI。'
  },
  'products.local.cta': {
    en: 'SEE DESKTOP FEATURES',
    'zh-CN': '查看桌面版属性'
  },
  'products.cloud.title': {
    en: 'Comfy\nCloud',
    'zh-CN': 'Comfy\nCloud'
  },
  'products.cloud.description': {
    en: 'The full power of ComfyUI from anywhere.',
    'zh-CN': '随时随地使用 ComfyUI 的全部能力。'
  },
  'products.cloud.cta': {
    en: 'SEE CLOUD FEATURES',
    'zh-CN': '查看云端属性'
  },
  'products.api.title': {
    en: 'Comfy\nAPI',
    'zh-CN': 'Comfy\nAPI'
  },
  'products.api.description': {
    en: 'Turn workflows into production endpoints.',
    'zh-CN': '将工作流转化为生产级 API 端点。'
  },
  'products.api.cta': {
    en: 'SEE API FEATURES',
    'zh-CN': '查看 API 属性'
  },
  'products.enterprise.title': {
    en: 'Comfy\nEnterprise',
    'zh-CN': 'Comfy\n企业版'
  },
  'products.enterprise.description': {
    en: 'Enterprise-grade infrastructure for the creative engine inside your organization.',
    'zh-CN': '为组织内的创作引擎提供企业级基础设施。'
  },
  'products.enterprise.cta': {
    en: 'SEE ENTERPRISE FEATURES',
    'zh-CN': '查看企业版属性'
  },

  // CaseStudySpotlightSection
  'caseStudy.label': {
    en: 'Customer Stories',
    'zh-CN': '客户故事'
  },
  'caseStudy.heading': {
    en: 'See ComfyUI\nin the real world',
    'zh-CN': '看看 ComfyUI\n在真实世界中的应用'
  },
  'caseStudy.subheading': {
    en: 'Videos & case studies from teams building with ComfyUI',
    'zh-CN': '来自使用 ComfyUI 构建的团队的视频和案例研究'
  },
  'caseStudy.seeAll': {
    en: 'SEE ALL CASE STUDIES',
    'zh-CN': '查看全部案例'
  },

  // BuildWhatSection
  'buildWhat.subtitle': {
    en: "Comfy gives you the building blocks to create workflows nobody's imagined yet — and share them with everyone.",
    'zh-CN': 'Comfy 为您提供构建模块，创造出前所未有的工作流——并与所有人分享。'
  },

  // API – HeroSection
  'api.hero.heading': {
    en: 'Turn any workflow into\na production endpoint.',
    'zh-CN': '将任何工作流转化为\n生产级端点。'
  },
  'api.hero.subtitle': {
    en: 'Design your workflows. Deploy them as API calls. Automate generation, integrate with your systems, and scale to thousands of outputs on Comfy Cloud.',
    'zh-CN':
      '设计你的工作流。将它们部署为 API 调用。自动化生成、与你的系统集成，并在 Comfy Cloud 上扩展到数千个输出。'
  },
  'api.hero.getApiKeys': {
    en: 'GET API KEYS',
    'zh-CN': '获取 API 密钥'
  },
  'api.hero.viewDocs': {
    en: 'VIEW DOCS',
    'zh-CN': '查看文档'
  },
  'api.hero.trySdk': {
    en: 'TRY COMFY SDK',
    'zh-CN': '试用 Comfy SDK'
  },

  // Enterprise – TeamSection
  'enterprise.team.heading': {
    en: 'Team workspaces\nand shared assets.',
    'zh-CN': '团队工作区\n与共享资产。'
  },
  'enterprise.team.subtitle': {
    en: 'Organize workflows, models, and outputs in shared workspaces. Control who builds, who runs, and who deploys.',
    'zh-CN':
      '在共享工作区中组织工作流、模型和输出。控制谁构建、谁运行、谁部署。'
  },
  'enterprise.team.feature1.title': {
    en: 'Role-based access',
    'zh-CN': '基于角色的访问控制'
  },
  'enterprise.team.feature1.description': {
    en: 'Control who builds, who runs, and who deploys.',
    'zh-CN': '控制谁构建、谁运行、谁部署。'
  },
  'enterprise.team.feature2.title': {
    en: 'Single Sign-On',
    'zh-CN': '单点登录'
  },
  'enterprise.team.feature2.description': {
    en: 'Enable secure, centralized user authentication across your organization with SSO and SCIM provisioning.',
    'zh-CN': '为您的组织启用集中式安全用户认证，支持 SSO 和 SCIM 配置。'
  },
  'enterprise.team.feature2.cta': {
    en: 'SEE CLOUD FEATURES',
    'zh-CN': '查看云功能'
  },
  'enterprise.team.feature3.title': {
    en: 'App Mode',
    'zh-CN': 'App 模式'
  },
  'enterprise.team.feature3.description': {
    en: 'Non-technical team members run workflows without touching the node graph.',
    'zh-CN': '非技术团队成员无需接触节点图即可运行工作流。'
  },

  // Enterprise – ReasonSection
  'enterprise.reason.heading': {
    en: 'Enterprise-grade infrastructure for the creative engine inside your organization.',
    'zh-CN': '为组织内的创作引擎提供企业级基础设施。'
  },
  'enterprise.reason.subtitle': {
    en: 'Comfy Cloud API gives you a managed infrastructure so you can focus on the workflow, not the hardware.',
    'zh-CN':
      'Comfy Cloud API 为你提供托管基础设施，让你专注于工作流，而非硬件。'
  },
  'enterprise.reason.1.title': {
    en: 'Dedicated GPU compute',
    'zh-CN': '专属 GPU 算力'
  },
  'enterprise.reason.1.description': {
    en: 'Reserved server-grade, powerful compute for your organization.',
    'zh-CN': '为你的组织预留的服务器级强大算力。'
  },
  'enterprise.reason.2.title': {
    en: 'Priority queuing',
    'zh-CN': '优先队列'
  },
  'enterprise.reason.2.description': {
    en: 'Your production jobs run first.',
    'zh-CN': '你的生产任务优先运行。'
  },
  'enterprise.reason.3.title': {
    en: 'Flexible Deployment',
    'zh-CN': '灵活部署'
  },
  'enterprise.reason.3.description': {
    en: 'Same workflows on Comfy Cloud. Scale compute up or down based on your production schedule.',
    'zh-CN': '在 Comfy Cloud 上运行相同的工作流。根据生产计划弹性扩缩算力。'
  },
  'enterprise.reason.4.title': {
    en: 'Custom SLAs',
    'zh-CN': '自定义 SLA'
  },
  'enterprise.reason.4.description': {
    en: 'Uptime and response commitments built around your schedule.',
    'zh-CN': '根据你的时间安排定制正常运行时间和响应承诺。'
  },
  'enterprise.reason.5.title': {
    en: 'Commercial license guaranteed',
    'zh-CN': '商业许可保障'
  },
  'enterprise.reason.5.description': {
    en: 'Every model available through Comfy Cloud is cleared for commercial use. No license ambiguity for your legal team.',
    'zh-CN':
      '通过 Comfy Cloud 提供的每个模型均已获得商业使用许可。法务团队无需担心许可歧义。'
  },

  // Enterprise – HeroSection
  'enterprise.hero.heading': {
    en: 'Your team already runs ComfyUI. Scale it with confidence.',
    'zh-CN': '你的团队已经在使用 ComfyUI。放心地扩展它。'
  },
  'enterprise.hero.subtitle': {
    en: 'Comfy Enterprise adds managed infrastructure, team controls, and dedicated support to the workflows your organization already builds.',
    'zh-CN':
      'Comfy 企业版为你的组织已有的工作流添加托管基础设施、团队控制和专属支持。'
  },
  'enterprise.hero.contactSales': {
    en: 'CONTACT SALES',
    'zh-CN': '联系销售'
  },

  // Enterprise – DataOwnershipSection
  'enterprise.ownership.line1': {
    en: 'Your data.',
    'zh-CN': '你的数据。'
  },
  'enterprise.ownership.line2': {
    en: 'Your network.',
    'zh-CN': '你的网络。'
  },
  'enterprise.ownership.line3': {
    en: 'Your terms.',
    'zh-CN': '你的条款。'
  },
  'enterprise.ownership.subtitle': {
    en: 'Your workflows, models, and generated outputs stay within your organization\u2019s environment. Role-based access controls and data isolation built for organizations with the strictest requirements.',
    'zh-CN':
      '你的工作流、模型和生成输出始终保留在你的组织环境中。基于角色的访问控制和数据隔离，为最严格要求的组织而构建。'
  },

  // Enterprise – BYOKeySection
  'enterprise.byoKey.heading': {
    en: 'Bring your own API key',
    'zh-CN': '自带 API 密钥'
  },
  'enterprise.byoKey.subtitle': {
    en: 'Use your own contracts with third-party model providers. Comfy orchestrates the pipeline. You choose which models to run and whose API keys to use.',
    'zh-CN':
      '使用你与第三方模型提供商的合约。Comfy 编排管线。你决定运行哪些模型、使用谁的 API 密钥。'
  },
  'enterprise.byoKey.card1.title': {
    en: 'API key management',
    'zh-CN': 'API 密钥管理'
  },
  'enterprise.byoKey.card1.description': {
    en: 'Bring your own API keys from any model provider. Use your existing contracts and pricing.',
    'zh-CN': '从任何模型提供商导入你自己的 API 密钥。使用你现有的合约和定价。'
  },
  'enterprise.byoKey.card2.title': {
    en: 'Real-time progress',
    'zh-CN': '实时进度'
  },
  'enterprise.byoKey.card2.description': {
    en: 'Step-by-step execution updates via WebSocket.',
    'zh-CN': '通过 WebSocket 逐步更新执行状态。'
  },

  // Enterprise – OrchestrationSection
  'enterprise.orchestration.heading': {
    en: 'The orchestration layer isn\u2019t worth rebuilding.',
    'zh-CN': '编排层不值得重建。'
  },
  'enterprise.orchestration.highlight': {
    en: 'Every team that evaluates building this internally reaches the same conclusion.',
    'zh-CN': '每个评估过内部自建的团队都得出了同样的结论。'
  },
  'enterprise.orchestration.description': {
    en: 'Internal estimates are 12\u201318 months with a dedicated engineering team. No matter how good or how fast, building this internally won\u2019t have 5,000+ extensions, 60,000+ nodes, or same-day model support.',
    'zh-CN':
      '内部评估需要一个专属工程团队耗时 12\u201318 个月。无论多优秀多快速，自建方案都不会拥有 5,000+ 扩展、60,000+ 节点或当日模型支持。'
  },
  'enterprise.orchestration.quote': {
    en: 'Platforms like OpenArt and Fal already run Comfy underneath \u2014 because they reached the same conclusion.',
    'zh-CN':
      'OpenArt 和 Fal 等平台底层已经运行 Comfy——因为他们得出了同样的结论。'
  },
  'enterprise.orchestration.footer': {
    en: 'Comfy Enterprise plans come with support from the team that builds the engine: direct access to our engineering team and a whiteglove onboarding.',
    'zh-CN':
      'Comfy 企业版计划附带引擎开发团队的支持：直接访问我们的工程团队和白手套式入职服务。'
  },

  // Enterprise – FAQ
  'enterprise.faq.heading': {
    en: 'FAQs',
    'zh-CN': '常见问题'
  },

  // API – StepsSection
  'api.steps.heading': {
    en: 'Three steps to production',
    'zh-CN': '三步进入生产'
  },
  'api.steps.step1.title': {
    en: 'Design the workflow',
    'zh-CN': '设计工作流'
  },
  'api.steps.step1.description': {
    en: 'Build and test in the ComfyUI interface \u2014 locally or on Comfy Cloud. When it works, export the API format.',
    'zh-CN':
      '在 ComfyUI 界面中构建和测试——本地或 Comfy Cloud 上。测试通过后，导出 API 格式。'
  },
  'api.steps.step2.title': {
    en: 'Submit via API',
    'zh-CN': '通过 API 提交'
  },
  'api.steps.step2.description': {
    en: 'Send the workflow JSON or a single request to the API endpoint. Modify inputs programmatically \u2014 prompts, seeds, images, any parameter on any node.',
    'zh-CN':
      '将工作流 JSON 或单个请求发送到 API 端点。以编程方式修改输入——提示词、种子、图像、任何节点上的任何参数。'
  },
  'api.steps.step3.title': {
    en: 'Monitor and Retrieve',
    'zh-CN': '监控与获取'
  },
  'api.steps.step3.description': {
    en: 'Track progress in real time over WebSocket. Download the finished output when the job completes.',
    'zh-CN': '通过 WebSocket 实时跟踪进度。作业完成后下载最终输出。'
  },

  // API – AutomationSection
  'api.automation.heading': {
    en: 'The automation layer for\nprofessional-grade visual AI',
    'zh-CN': '专业级视觉 AI 的\n自动化层'
  },
  'api.automation.subtitle': {
    en: 'To transform ComfyUI from a powerful tool to reliable infrastructure.',
    'zh-CN': '将 ComfyUI 从强大的工具转化为可靠的基础设施。'
  },
  'api.automation.feature1.title': {
    en: "Automate what can't be manual",
    'zh-CN': '自动化无法手动完成的工作'
  },
  'api.automation.feature1.description': {
    en: 'Trigger generation when a user uploads a photo. Process an entire product catalog overnight. Swap a character\u2019s expression across 500 frames.',
    'zh-CN':
      '当用户上传照片时触发生成。一夜之间处理整个产品目录。在 500 帧中替换角色表情。'
  },
  'api.automation.feature1.description2': {
    en: 'The API is for running workflows inside other systems \u2014 triggered by code, not by a person at a keyboard.',
    'zh-CN':
      'API 用于在其他系统内运行工作流——由代码触发，而非由键盘前的人触发。'
  },
  'api.automation.feature2.title': {
    en: 'Inject dynamic values at runtime',
    'zh-CN': '在运行时注入动态值'
  },
  'api.automation.feature2.description': {
    en: 'Pass a different face, a different product, a different brand palette into the same pipeline \u2014 consistent, controlled output every time.',
    'zh-CN':
      '将不同的面孔、不同的产品、不同的品牌色板传入同一管线——每次都获得一致、可控的输出。'
  },
  'api.automation.feature2.description2': {
    en: 'The workflow stays fixed. The inputs change.',
    'zh-CN': '工作流保持不变。输入可以改变。'
  },
  'api.automation.feature3.title': {
    en: 'Integrate ComfyUI into the rest of your stack',
    'zh-CN': '将 ComfyUI 集成到你的技术栈中'
  },
  'api.automation.feature3.description': {
    en: 'Generation is usually one step in a larger system. Fetch input from S3, call the ComfyUI API, post-process the result, write it to a database, and notify a team.',
    'zh-CN':
      '生成通常只是更大系统中的一个步骤。从 S3 获取输入、调用 ComfyUI API、后处理结果、写入数据库、通知团队。'
  },

  // API – ReasonSection
  'api.reason.heading': {
    en: 'Deploy on\n',
    'zh-CN': '部署在\n'
  },
  'api.reason.headingHighlight': {
    en: 'Comfy Cloud —\n',
    'zh-CN': 'Comfy Cloud——\n'
  },
  'api.reason.headingSuffix': {
    en: 'no servers to\nmanage.',
    'zh-CN': '无需管理\n服务器。'
  },
  'api.reason.subtitle': {
    en: 'Comfy Cloud API gives you a managed infrastructure so you can focus on the workflow, not the hardware.',
    'zh-CN':
      'Comfy Cloud API 为你提供托管基础设施，让你专注于工作流，而非硬件。'
  },
  'api.reason.1.title': {
    en: 'Powerful GPUs on demand',
    'zh-CN': '按需使用强大 GPU'
  },
  'api.reason.1.description': {
    en: 'Heavy video generation, complex multi-step pipelines, large batch jobs.',
    'zh-CN': '重度视频生成、复杂多步管线、大批量任务。'
  },
  'api.reason.2.title': {
    en: 'One API key. Immediate access.',
    'zh-CN': '一个 API 密钥。即时访问。'
  },
  'api.reason.2.description': {
    en: 'No environment setup, no model downloads, no GPU procurement.',
    'zh-CN': '无需环境配置、无需下载模型、无需采购 GPU。'
  },
  'api.reason.3.title': {
    en: 'Open models & partner models through one endpoint',
    'zh-CN': '通过一个端点访问开源模型和合作伙伴模型'
  },
  'api.reason.3.description': {
    en: 'Open-source models alongside partner models like Kling, Luma, Nano Banana, Grok, and Runway \u2014 all with one credit balance.',
    'zh-CN':
      '开源模型与 Kling、Luma、Nano Banana、Grok、Runway 等合作伙伴模型并存——全部使用同一额度。'
  },
  'api.reason.4.title': {
    en: 'Real-time progress',
    'zh-CN': '实时进度'
  },
  'api.reason.4.description': {
    en: 'Step-by-step execution updates and live previews during generation via WebSocket.',
    'zh-CN': '通过 WebSocket 获取逐步执行更新和生成过程中的实时预览。'
  },

  // Download – FAQSection
  'download.faq.heading': {
    en: 'FAQs',
    'zh-CN': '常见问题'
  },
  'download.faq.1.q': {
    en: 'Do I need a GPU to run ComfyUI locally?',
    'zh-CN': '本地运行 ComfyUI 需要 GPU 吗？'
  },
  'download.faq.1.a': {
    en: 'A dedicated GPU is strongly recommended — more VRAM means bigger models and batches. No GPU? Run the same workflow on Comfy Cloud.',
    'zh-CN':
      '强烈建议使用独立 GPU——更大的显存意味着更大的模型和批量。没有 GPU？在 Comfy Cloud 上运行相同的工作流。'
  },
  'download.faq.2.q': {
    en: 'How much disk space do I need?',
    'zh-CN': '需要多少磁盘空间？'
  },
  'download.faq.2.a': {
    en: 'ComfyUI is lightweight, models are the heavy part. Plan for a dedicated drive as your library grows.',
    'zh-CN':
      'ComfyUI 本身很轻量，模型才是大头。随着库的增长，建议准备专用硬盘。'
  },
  'download.faq.3.q': {
    en: "Is it really free? What's the catch?",
    'zh-CN': '真的免费吗？有什么附加条件？'
  },
  'download.faq.3.a': {
    en: 'Yes. Free and open source under GPL-3.0. No feature gates, no trials, no catch.',
    'zh-CN':
      '是的。基于 GPL-3.0 免费开源。没有功能限制、没有试用期、没有附加条件。'
  },
  'download.faq.4.q': {
    en: 'Why would I pay for Comfy Cloud if Desktop is free?',
    'zh-CN': '既然桌面版免费，为什么还要付费使用 Comfy Cloud？'
  },
  'download.faq.4.a': {
    en: 'Your machine or ours. Cloud gives you powerful GPUs on demand, pre-loaded models, end-to-end security and infrastructure out of the box and partner models cleared for commercial use.',
    'zh-CN':
      '你的机器或我们的。Cloud 按需提供强大 GPU、预加载模型、端到端安全性和开箱即用的基础设施，以及经过商业许可的合作伙伴模型。'
  },
  'download.faq.5.q': {
    en: "What's the difference between Desktop, Portable, and CLI install?",
    'zh-CN': 'Desktop、Portable 和 CLI 安装有什么区别？'
  },
  'download.faq.5.a': {
    en: 'Desktop: one-click installer with auto-updates. Portable: self-contained build you can run from any folder. CLI: clone from GitHub for full developer control, for developers who want to customize the environment or contribute upstream.',
    'zh-CN':
      'Desktop：一键安装，自动更新。Portable：独立构建，可从任意文件夹运行。CLI：从 GitHub 克隆，完全开发者控制，适合想自定义环境或参与上游贡献的开发者。'
  },
  'download.faq.6.q': {
    en: 'Can I use my Desktop workflows in Comfy Cloud?',
    'zh-CN': '我可以在 Comfy Cloud 中使用桌面工作流吗？'
  },
  'download.faq.6.a': {
    en: 'Yes — same file, same results. No conversion, no rework.',
    'zh-CN': '可以——同样的文件，同样的结果。无需转换，无需返工。'
  },
  'download.faq.7.q': {
    en: 'How do I install custom nodes and extensions?',
    'zh-CN': '如何安装自定义节点和扩展？'
  },
  'download.faq.7.a': {
    en: 'ComfyUI Manager lets you browse, install, update, and manage 5,000+ extensions from inside the app.',
    'zh-CN': 'ComfyUI Manager 让你在应用内浏览、安装、更新和管理 5,000+ 扩展。'
  },
  'download.faq.8.q': {
    en: 'My workflow is running slowly. Should I switch to Cloud?',
    'zh-CN': '我的工作流运行缓慢。应该切换到 Cloud 吗？'
  },
  'download.faq.8.a': {
    en: 'No need to switch. Push heavy jobs to Comfy Cloud when you need more compute, keep building locally the rest of the time.',
    'zh-CN':
      '无需切换。需要更多算力时将繁重任务推送到 Comfy Cloud，其余时间继续在本地构建。'
  },

  // Download – EcoSystemSection
  'download.ecosystem.heading': {
    en: 'An ecosystem that moves faster than any company could.',
    'zh-CN': '一个比任何公司都迭代更快的生态系统。'
  },
  'download.ecosystem.description': {
    en: 'Over 5,000 community-built extensions — totaling 60,000+ nodes — plug into ComfyUI and extend what it can do. When a new open model launches, ComfyUI implements it, and the community customizes and builds it into their workflows immediately. When a research paper drops a new technique, an extension appears within days.',
    'zh-CN':
      '超过 5,000 个社区构建的扩展——共计 60,000+ 节点——接入 ComfyUI 并扩展其能力。当新的开源模型发布时，ComfyUI 会实现它，社区会立即将其定制并构建到工作流中。当研究论文发布新技术时，几天内就会出现相应扩展。'
  },

  // Download – ReasonSection
  'download.reason.heading': {
    en: 'Why\nprofessionals\nchoose ',
    'zh-CN': '专业人士为何\n选择'
  },
  'download.reason.headingHighlight': {
    en: 'Desktop',
    'zh-CN': '桌面版'
  },
  'download.reason.1.title': {
    en: 'Unlimited\nCustomization',
    'zh-CN': '无限\n自定义'
  },
  'download.reason.1.description': {
    en: 'Install any of 5,000+ community extensions, totaling 60,000+ nodes. Build your own custom nodes. Integrate with Photoshop, Nuke, Blender, Houdini, and any tool in your existing pipeline.',
    'zh-CN':
      '安装 5,000+ 社区扩展中的任何一个，共计 60,000+ 节点。构建自定义节点。与 Photoshop、Nuke、Blender、Houdini 及现有管线中的任何工具集成。'
  },
  'download.reason.2.title': {
    en: 'Any model.\nNo exceptions.',
    'zh-CN': '任何模型。\n无一例外。'
  },
  'download.reason.2.description': {
    en: 'Run every open-source model — Wan 2.1, Flux, LTX and more. Finetune, customize, control the full inference process. Or use partner models like Nano Banana and Grok.',
    'zh-CN':
      '运行每个开源模型——Wan 2.1、Flux、LTX 等。微调、自定义、控制完整推理过程。或使用 Nano Banana 和 Grok 等合作伙伴模型。'
  },
  'download.reason.3.title': {
    en: 'Your machine.\nYour data.\nYour terms.',
    'zh-CN': '你的机器。\n你的数据。\n你的规则。'
  },
  'download.reason.3.description': {
    en: 'Run entirely offline. No internet connection required after setup. Your workflows, your models, your data.',
    'zh-CN':
      '完全离线运行。安装后无需网络连接。你的工作流、你的模型、你的数据。'
  },
  'download.reason.4.title': {
    en: 'Free. Open Source.\nNo ceiling.',
    'zh-CN': '免费。开源。\n没有上限。'
  },
  'download.reason.4.description': {
    en: 'No feature gates, no trial periods, no "pro" tier for core functionality. No vendor can lock you in or force you off the platform. Build your own nodes and modify ComfyUI as your own.',
    'zh-CN':
      '没有功能限制、没有试用期、核心功能没有"专业"层级。没有供应商可以锁定你或强迫你离开平台。构建自己的节点，随心修改 ComfyUI。'
  },

  // Download – HeroSection
  'download.hero.heading': {
    en: 'Run on your hardware.\nFree forever.',
    'zh-CN': '在你的硬件上运行。\n永久免费。'
  },
  'download.hero.subtitle': {
    en: 'The full ComfyUI engine — open source, fast, extensible, and yours to run however you want.',
    'zh-CN': '完整的 ComfyUI 引擎——开源、快速、可扩展，随你运行。'
  },
  'download.hero.downloadLocal': {
    en: 'DOWNLOAD DESKTOP',
    'zh-CN': '下载桌面版'
  },
  'download.hero.installGithub': {
    en: 'INSTALL FROM GITHUB',
    'zh-CN': '从 GITHUB 安装'
  },

  // Download – MobileDownloadEmailForm
  'download.emailForm.heading': {
    en: 'Get download link',
    'zh-CN': '获取下载链接'
  },
  'download.emailForm.emailLabel': {
    en: 'Email address',
    'zh-CN': '邮箱地址'
  },
  'download.emailForm.placeholder': {
    en: 'you@email.com',
    'zh-CN': 'you@email.com'
  },
  'download.emailForm.submit': {
    en: 'Send download link',
    'zh-CN': '发送下载链接'
  },
  'download.emailForm.success': {
    en: 'The link is sent to {email}!',
    'zh-CN': '下载链接已发送至 {email}！'
  },
  'download.emailForm.invalidEmail': {
    en: 'Please enter a valid email address.',
    'zh-CN': '请输入有效的邮箱地址。'
  },
  'download.emailForm.error': {
    en: 'Something went wrong. Please try again.',
    'zh-CN': '出错了，请重试。'
  },

  // Download – CloudBannerSection
  'download.cloud.prefix': {
    en: 'Need more power?',
    'zh-CN': '需要更强算力？'
  },
  'download.cloud.cta': {
    en: 'TRY COMFY CLOUD',
    'zh-CN': '试试 COMFY CLOUD'
  },
  'download.cloud.suffix': {
    en: 'Powerful GPUs, same workflow, same results, from anywhere.',
    'zh-CN': '强大 GPU，同样的工作流，同样的结果，随时随地。'
  },
  // Cloud – HeroSection
  'cloud.hero.heading': {
    en: 'The full power of\nComfyUI — from\nanywhere.',
    'zh-CN': 'ComfyUI 的全部能力\n随时随地。'
  },
  'cloud.hero.subtitle': {
    en: 'The easiest way to start with ComfyUI. Pre-loaded models. Pre-installed custom nodes. Concurrent jobs. The full power of ComfyUI on Blackwell RTX 6000 Pros. Open a tab and start creating.',
    'zh-CN':
      '最简单的 ComfyUI 入门方式。预加载模型。预安装自定义节点。并发任务。在 Blackwell RTX 6000 Pro 上体验 ComfyUI 的全部能力。打开标签页，开始创作。'
  },
  'cloud.hero.cta': {
    en: 'TRY COMFY CLOUD FOR FREE',
    'zh-CN': '免费试用 COMFY CLOUD'
  },

  'cloudNodes.hero.label': {
    en: 'CLOUD NODES',
    'zh-CN': '云端节点目录'
  },
  'cloudNodes.hero.heading': {
    en: 'Run your favorite ComfyUI custom nodes on the cloud',
    'zh-CN': '在云端运行你喜爱的 ComfyUI 自定义节点'
  },
  'cloudNodes.hero.body': {
    en: 'Spin up workflows with hundreds of community-built nodes — detailers, ControlNet preprocessors, animation tools, and quality-of-life utilities — preinstalled on Comfy Cloud and ready to run on managed GPUs.',
    'zh-CN':
      '在 Comfy Cloud 托管 GPU 上即开即用，预装数百个社区节点——细节修复、ControlNet 预处理、动画工具与日常便利组件，应有尽有。'
  },
  'cloudNodes.section.heading': {
    en: 'Find a custom-node pack',
    'zh-CN': '查找自定义节点包'
  },
  'cloudNodes.search.placeholder': {
    en: 'Search packs or nodes',
    'zh-CN': '搜索节点包或节点名称'
  },
  'cloudNodes.sort.downloads': {
    en: 'Most installed',
    'zh-CN': '按安装量'
  },
  'cloudNodes.sort.mostNodes': {
    en: 'Most nodes',
    'zh-CN': '按节点数量'
  },
  'cloudNodes.sort.az': {
    en: 'A → Z',
    'zh-CN': '按名称 A → Z'
  },
  'cloudNodes.sort.recentlyUpdated': {
    en: 'Recently updated',
    'zh-CN': '最近更新'
  },
  'cloudNodes.search.label': {
    en: 'Search custom-node packs',
    'zh-CN': '搜索自定义节点包'
  },
  'cloudNodes.sort.label': {
    en: 'Sort packs',
    'zh-CN': '排序节点包'
  },
  'cloudNodes.list.ariaLabel': {
    en: 'Custom-node packs supported on Comfy Cloud',
    'zh-CN': 'Comfy Cloud 支持的自定义节点包'
  },
  'cloudNodes.meta.title': {
    en: 'Custom-node packs on Comfy Cloud - supported by default',
    'zh-CN': 'Comfy Cloud 自定义节点包合集——开箱即用'
  },
  'cloudNodes.meta.description': {
    en: 'Browse hundreds of ComfyUI custom-node packs preinstalled on Comfy Cloud. Detailers, ControlNet preprocessors, animation tools, samplers, and more — search by pack or by node name.',
    'zh-CN':
      '浏览 Comfy Cloud 预装的数百个 ComfyUI 自定义节点包：细节修复、ControlNet 预处理、动画工具、采样器等——按节点包或节点名搜索。'
  },
  'cloudNodes.detail.metaTitle': {
    en: '{pack} on Comfy Cloud',
    'zh-CN': '{pack}（Comfy Cloud）'
  },
  'cloudNodes.detail.metaDescription': {
    en: '{pack} is preinstalled on Comfy Cloud — {nodeCount} nodes ready to run on managed GPUs. {description}',
    'zh-CN':
      '{pack} 已预装于 Comfy Cloud——{nodeCount} 个节点可在托管 GPU 上即时运行。{description}'
  },
  'cloudNodes.empty.heading': {
    en: 'No matching packs',
    'zh-CN': '未找到匹配的节点包'
  },
  'cloudNodes.empty.body': {
    en: 'Try a different search term or clear your filters.',
    'zh-CN': '试试其他关键词，或清空筛选条件。'
  },
  'cloudNodes.card.nodeCountOne': {
    en: '{count} node',
    'zh-CN': '{count} 个节点'
  },
  'cloudNodes.card.nodeCountOther': {
    en: '{count} nodes',
    'zh-CN': '{count} 个节点'
  },
  'cloudNodes.card.viewRepo': {
    en: 'View repository',
    'zh-CN': '查看仓库'
  },
  'cloudNodes.card.unavailableDescription': {
    en: 'Description unavailable.',
    'zh-CN': '暂无描述信息。'
  },
  'cloudNodes.card.nodesHeading': {
    en: 'Included nodes',
    'zh-CN': '包含节点'
  },
  'cloudNodes.detail.back': {
    en: 'Back to all packs',
    'zh-CN': '返回所有节点包'
  },
  'cloudNodes.detail.publisher': {
    en: 'Publisher',
    'zh-CN': '发布者'
  },
  'cloudNodes.detail.downloads': {
    en: 'Downloads',
    'zh-CN': '下载量'
  },
  'cloudNodes.detail.stars': {
    en: 'GitHub stars',
    'zh-CN': 'GitHub 星标'
  },
  'cloudNodes.detail.latestVersion': {
    en: 'Latest version',
    'zh-CN': '最新版本'
  },
  'cloudNodes.detail.license': {
    en: 'License',
    'zh-CN': '许可证'
  },
  'cloudNodes.detail.lastUpdated': {
    en: 'Last updated',
    'zh-CN': '最后更新'
  },
  'cloudNodes.detail.deprecated': {
    en: 'Deprecated',
    'zh-CN': '已弃用'
  },
  'cloudNodes.detail.experimental': {
    en: 'Experimental',
    'zh-CN': '实验性'
  },
  'cloudNodes.detail.nodesHeading': {
    en: 'Nodes in this pack',
    'zh-CN': '此节点包中的节点'
  },

  // Cloud – ReasonSection
  'cloud.reason.heading': {
    en: 'Why\nprofessionals\nchoose ',
    'zh-CN': '专业人士为何\n选择'
  },
  'cloud.reason.headingHighlight': {
    en: 'Cloud',
    'zh-CN': 'Cloud'
  },
  'cloud.reason.1.title': {
    en: 'Powerful GPUs with <span class="whitespace-nowrap">end-to-end</span> security <span class="whitespace-nowrap">built-in</span>',
    'zh-CN': '强大 GPU\n端到端安全内置'
  },
  'cloud.reason.1.description': {
    en: 'Comfy Cloud works on any device. Pay only for running workflows, not idle time. With Comfy Cloud, you get security and infrastructure built-in with access to the most popular custom nodes.',
    'zh-CN':
      'Comfy Cloud 可在任何设备上使用。只需为运行工作流付费，无需为闲置时间付费。使用 Comfy Cloud，您可获得内置的安全性和基础设施，并访问最流行的自定义节点。'
  },
  'cloud.reason.2.title': {
    en: 'All models. Commercial\nlicense guaranteed.',
    'zh-CN': '所有模型。\n商业许可保证。'
  },
  'cloud.reason.2.description': {
    en: 'Run open-source models like Wan 2.2, Flux, LTX and Qwen alongside partner models like Nano Banana, Seedance, Seedream, Grok, Kling, Hunyuan 3D, GPT Image 2 and more. Every model on Comfy Cloud is cleared for commercial use. No license ambiguity. All through one credit balance.',
    'zh-CN':
      '运行 Wan 2.2、Flux、LTX 和 Qwen 等开源模型，以及 Nano Banana、Seedance、Seedream、Grok、Kling、Hunyuan 3D、GPT Image 2 等合作伙伴模型。Comfy Cloud 上的每个模型都已获得商业使用许可。无许可证歧义。通过统一的积分余额使用。'
  },
  'cloud.reason.2.badge.onlyOn': {
    en: 'ONLY ON',
    'zh-CN': '仅在'
  },
  'cloud.reason.2.badge.cloud': {
    en: 'CLOUD',
    'zh-CN': '云端'
  },
  'cloud.reason.3.title': {
    en: 'More control than any\nother visual AI tool',
    'zh-CN': '比任何其他\n视觉 AI 工具更强的控制力'
  },
  'cloud.reason.3.description': {
    en: 'Every node exposed. Every setting adjustable. ComfyUI gives you the full inference pipeline. Choose your sampler, your scheduler, your model chain. The cloud simplifies the setup and supercharges the hardware underneath it.',
    'zh-CN':
      '每个节点都可见。每个设置都可调。ComfyUI 为您提供完整的推理管线。选择您的采样器、调度器、模型链。云端简化了设置并增强了底层硬件。'
  },
  'cloud.reason.4.title': {
    en: 'Community workflows,\nunlimited customization\nthrough <span class="whitespace-nowrap">pre-installed</span>\ncustom nodes',
    'zh-CN': '社区工作流，\n通过预安装自定义节点\n实现无限自定义'
  },
  'cloud.reason.4.description': {
    en: 'Browse, run, and remix workflows built by thousands of creators. Start from proven templates instead of blank canvases. Upload custom LoRAs or finetuned foundational models from CivitAI and Hugging Face. The nodes powering ~90% of local ComfyUI workflows are now in the cloud.',
    'zh-CN':
      '浏览、运行和混搭由数千名创作者构建的工作流。从经过验证的模板开始，而非空白画布。上传自定义 LoRA 或来自 CivitAI 和 Hugging Face 的微调基础模型。驱动约 90% 本地 ComfyUI 工作流的节点现已上云。'
  },

  // Cloud – AIModelsSection
  'cloud.aiModels.label': {
    en: 'AI MODELS',
    'zh-CN': 'AI 模型'
  },
  'cloud.aiModels.heading': {
    en: 'Run the world’s\nleading AI models',
    'zh-CN': '运行全球领先的\nAI 模型'
  },
  'cloud.aiModels.subtitle': {
    en: 'New models are added as they launch.',
    'zh-CN': '新模型发布后会第一时间上线。'
  },
  'cloud.aiModels.card.grokImagine': {
    en: 'Grok Video',
    'zh-CN': 'Grok Video'
  },
  'cloud.aiModels.card.nanoBananaPro': {
    en: 'Nano Banana Pro',
    'zh-CN': 'Nano Banana Pro'
  },
  'cloud.aiModels.card.seedance20': {
    en: 'Seedance 2.0',
    'zh-CN': 'Seedance 2.0'
  },
  'cloud.aiModels.card.qwenImageEdit': {
    en: 'Qwen\nImage Edit',
    'zh-CN': 'Qwen\n图像编辑'
  },
  'cloud.aiModels.card.wan22TextToVideo': {
    en: 'Wan 2.2',
    'zh-CN': 'Wan 2.2'
  },
  'cloud.aiModels.card.gptImage2': {
    en: 'GPT Image 2',
    'zh-CN': 'GPT Image 2'
  },
  'cloud.aiModels.ctaDesktop': {
    en: 'EXPLORE WORKFLOWS WITH THE LATEST MODELS',
    'zh-CN': '探索最新模型工作流'
  },
  'cloud.aiModels.ctaMobile': {
    en: 'EXPLORE WORKFLOWS',
    'zh-CN': '探索工作流'
  },

  // Cloud – AudienceSection
  'cloud.audience.heading': {
    en: 'Built for {creators} who need quality, control, and simplicity.',
    'zh-CN': '为追求质量、控制与简约的{creators}而生。'
  },
  'cloud.audience.headingHighlight': {
    en: 'creators',
    'zh-CN': '创作者'
  },
  'cloud.audience.creators.label': {
    en: 'CREATORS',
    'zh-CN': '创作者'
  },
  'cloud.audience.creators.title': {
    en: 'From idea to output\nin minutes.',
    'zh-CN': '从创意到成品，\n只需几分钟。'
  },
  'cloud.audience.creators.description': {
    en: 'For those who want to generate images, video, and 3D with more control than prompt-based tools offer — without spending a weekend configuring your machine.',
    'zh-CN':
      '适合那些想要生成图像、视频和 3D 内容，且需要比基于提示词的工具更精细控制的人——无需花一整个周末配置机器。'
  },
  'cloud.audience.teams.label': {
    en: 'TEAMS & STUDIOS',
    'zh-CN': '团队与工作室'
  },
  'cloud.audience.teams.title': {
    en: 'Onboard your\nteam today.',
    'zh-CN': '立即开始\n团队协作。'
  },
  'cloud.audience.teams.description': {
    en: 'No IT setup, no GPU procurement, no environment headaches. Everyone works from the same up-to-date platform. Share workflows via App Mode links — your team runs them instantly, no training required.',
    'zh-CN':
      '无需 IT 部署、GPU 采购，也没有环境配置的烦恼。所有人在同一个最新平台上工作。通过 App Mode 链接分享工作流——团队立即运行，无需培训。'
  },

  // Cloud – PricingSection
  'cloud.pricing.title': {
    en: 'Simple, credit-based pricing',
    'zh-CN': '简单的按积分计费'
  },
  'cloud.pricing.description': {
    en: 'One balance for Cloud GPU time and Partner Node API models. Build and edit workflows for free — credits are consumed only when the GPU runs.',
    'zh-CN':
      '一个余额即可使用云端 GPU 算力和合作伙伴节点 API 模型。免费构建和编辑工作流——仅在 GPU 运行时消耗积分。'
  },
  'cloud.pricing.tagline': {
    en: "Start free. Upgrade when you're ready.",
    'zh-CN': '免费开始，随时升级。'
  },
  'cloud.pricing.cta': {
    en: 'SEE PRICING PLANS',
    'zh-CN': '查看定价方案'
  },

  // Cloud – FAQSection
  'cloud.faq.heading': {
    en: 'FAQs',
    'zh-CN': '常见问题'
  },
  'cloud.faq.footer': {
    en: 'For pricing, plans, credits, and billing details, see the <a href="/cloud/pricing#faq" class="text-primary-comfy-yellow underline">Pricing FAQs</a>.',
    'zh-CN':
      '有关定价、计划、积分和账单的详细信息，请查看<a href="/zh-CN/cloud/pricing#faq" class="text-primary-comfy-yellow underline">定价常见问题</a>。'
  },
  'cloud.faq.1.q': {
    en: 'What is Comfy Cloud / ComfyUI Cloud?',
    'zh-CN': '什么是 Comfy Cloud / ComfyUI Cloud？'
  },
  'cloud.faq.1.a': {
    en: 'Comfy Cloud is a version of ComfyUI that we officially host — no setup, no GPU required. Run your workflows instantly on high-performance cloud GPUs.',
    'zh-CN':
      'Comfy Cloud 是我们官方托管的 ComfyUI 版本——无需设置，无需 GPU。在高性能云端 GPU 上即时运行您的工作流。'
  },
  'cloud.faq.2.q': {
    en: 'How is Cloud different from running ComfyUI locally?',
    'zh-CN': 'Cloud 与本地运行 ComfyUI 有什么区别？'
  },
  'cloud.faq.2.a': {
    en: 'Cloud runs on powerful remote GPUs and is accessible from any device. Comfy Desktop runs entirely on your computer, giving you full control and offline use.',
    'zh-CN':
      'Cloud 在强大的远程 GPU 上运行，可从任何设备访问。Comfy 桌面版完全在您的电脑上运行，提供完全控制和离线使用。'
  },
  'cloud.faq.3.q': {
    en: 'Which version should I choose, Comfy Cloud or Comfy Desktop?',
    'zh-CN': '我应该选择 Comfy Cloud 还是 Comfy 桌面版？'
  },
  'cloud.faq.3.a': {
    en: "Comfy Cloud has zero setup, is easy to share with your team, and is faster than most GPUs you can run on a desktop workstation. You can immediately run the best models and workflows from the community on Comfy Cloud.\nComfy Desktop is infinitely customizable, works offline, and you don't need to worry about queue times. However, depending on what you want to create, you might need to have a good GPU and some amount of technical knowledge to install community-created custom nodes.",
    'zh-CN':
      'Comfy Cloud 无需任何设置，方便与团队共享，比大多数桌面工作站 GPU 更快。您可以立即在 Comfy Cloud 上运行社区中最好的模型和工作流。\nComfy 桌面版可以无限定制，支持离线工作，无需担心排队时间。但根据您的创作需求，可能需要一块好的 GPU 以及一定的技术知识来安装社区创建的自定义节点。'
  },
  'cloud.faq.4.q': {
    en: 'Do I need a GPU or a strong computer to use Comfy Cloud?',
    'zh-CN': '使用 Comfy Cloud 需要 GPU 或高性能电脑吗？'
  },
  'cloud.faq.4.a': {
    en: 'No, you can start creating instantly from your browser, no matter what computer you use.',
    'zh-CN': '不需要，无论使用什么电脑，您都可以从浏览器即时开始创作。'
  },
  'cloud.faq.5.q': {
    en: 'What machine or GPU does Comfy Cloud run on?',
    'zh-CN': 'Comfy Cloud 使用什么机器或 GPU？'
  },
  'cloud.faq.5.a': {
    en: 'Comfy Cloud runs on Blackwell RTX 6000 Pros — 96GB VRAM, with a library of 900+ pre-installed models and support for many of the most-used custom nodes from the ComfyUI community. We expand node support regularly based on demand and compatibility.',
    'zh-CN':
      'Comfy Cloud 运行在 Blackwell RTX 6000 Pro 上——96GB 显存，拥有 900+ 预装模型库，并支持 ComfyUI 社区中许多最常用的自定义节点。我们会根据需求和兼容性定期扩展节点支持。'
  },
  'cloud.faq.6.q': {
    en: 'Can I use my existing workflows with Comfy Cloud?',
    'zh-CN': '我可以在 Comfy Cloud 上使用现有的工作流吗？'
  },
  'cloud.faq.6.a': {
    en: 'Yes, your workflows work across Desktop and Cloud. Just note that only the most popular custom nodes are supported for now, but more will be added soon.',
    'zh-CN':
      '可以，您的工作流在桌面版和云端都能使用。请注意，目前仅支持最热门的自定义节点，但很快会添加更多。'
  },
  'cloud.faq.7.q': {
    en: 'Are all ComfyUI extensions and custom nodes supported?',
    'zh-CN': '所有 ComfyUI 扩展和自定义节点都支持吗？'
  },
  'cloud.faq.7.a': {
    en: 'You can always check Cloud to see the list of extensions and models that we support, for free.\nMost popular ones are available, and new ones are added over time.',
    'zh-CN':
      '您可以随时在 Cloud 上免费查看我们支持的扩展和模型列表。\n大多数热门扩展已可用，新的扩展会持续添加。'
  },
  'cloud.faq.8.q': {
    en: 'Can I use my own models or checkpoints?',
    'zh-CN': '我可以使用自己的模型或检查点吗？'
  },
  'cloud.faq.8.a': {
    en: 'You can always check Cloud to see the list of extensions and models that we support, for free.\nCurrently, we support a wide variety of preinstalled models.\nFor those on the Creator, Pro, or Team plans, you can bring in your own fine-tuned LoRAs from CivitAI or HuggingFace to perfect your own style.\nDirect file upload for larger models is on our roadmap.',
    'zh-CN':
      '您可以随时在 Cloud 上免费查看我们支持的扩展和模型列表。\n目前我们支持大量预装模型。\n对于 Creator、Pro 或 Team 计划用户，您可以导入自己从 CivitAI 或 HuggingFace 微调的 LoRA 来打造专属风格。\n大型模型的直接文件上传功能已在我们的路线图中。'
  },
  'cloud.faq.9.q': {
    en: 'Can I run long or multiple workflows?',
    'zh-CN': '我可以运行长时间或多个工作流吗？'
  },
  'cloud.faq.9.a': {
    en: 'Each workflow has a max runtime of 30 minutes on Standard and Creator, raised to 1 hour on Pro. Jobs over the limit are cancelled automatically to keep the system fair and stable. You can queue up to 100 workflows at once, and run 1 / 3 / 5 concurrently via API on Standard / Creator / Pro. Need higher API rate limits? Contact enterprise@comfy.org.',
    'zh-CN':
      'Standard 和 Creator 上，单个工作流的最长运行时长为 30 分钟；Pro 上提升至 1 小时。超出限制的任务会被自动取消，以保持系统的公平与稳定。您可以同时排队最多 100 个工作流，并在 Standard / Creator / Pro 上通过 API 分别并发运行 1 / 3 / 5 个工作流。需要更高的 API 速率限制？请联系 enterprise@comfy.org。'
  },
  'cloud.faq.10.q': {
    en: 'How is my user data stored and secured in Comfy Cloud?',
    'zh-CN': '我的用户数据在 Comfy Cloud 中如何存储和保护？'
  },
  'cloud.faq.10.a': {
    en: 'By default, all your inputs, outputs, and workflows are private to your account.\nFor enhanced security features or enterprise-level options, please contact our team via support@comfy.org for more details.',
    'zh-CN':
      '默认情况下，您的所有输入、输出和工作流都是您账户的私有数据。\n如需增强安全功能或企业级选项，请通过 support@comfy.org 联系我们的团队了解更多详情。'
  },
  'cloud.faq.11.q': {
    en: 'Will ComfyUI always be free to run locally?',
    'zh-CN': 'ComfyUI 本地运行会一直免费吗？'
  },
  'cloud.faq.11.a': {
    en: "Yes, absolutely. ComfyUI will always be free and open source. You can deploy it however you want, such as downloading it from GitHub, using Docker, custom setups, etc.\n\nComfy Cloud is an optional hosted service for those who prefer convenience, accessibility, or don't have powerful GPUs.",
    'zh-CN':
      '是的，绝对如此。ComfyUI 将始终免费且开源。您可以按任何方式部署它，例如从 GitHub 下载、使用 Docker、自定义设置等。\n\nComfy Cloud 是一项可选的托管服务，适合偏好便捷性、可访问性或没有强大 GPU 的用户。'
  },
  'cloud.faq.12.q': {
    en: 'How much does Comfy Cloud cost?',
    'zh-CN': 'Comfy Cloud 的费用是多少？'
  },
  'cloud.faq.12.a': {
    en: 'Plans start at $20/mo with a credit-based model. For full pricing details — credits, plans, Team plan, billing, and refunds — see the <a href="/cloud/pricing#faq" class="text-primary-comfy-yellow underline">Pricing FAQs</a>.',
    'zh-CN':
      '计划起价为每月 $20，采用基于积分的模式。如需完整的定价详情——积分、计划、团队计划、账单和退款——请查看 <a href="/zh-CN/cloud/pricing#faq" class="text-primary-comfy-yellow underline">定价常见问题</a>。'
  },

  'buildWhat.row1': { en: 'BUILD WHAT', 'zh-CN': '构建' },
  'buildWhat.row2a': { en: "DOESN'T EXIST", 'zh-CN': '尚不存在的' },
  'buildWhat.row2b': { en: 'YET', 'zh-CN': '事物' },

  // PricingSection
  'pricing.title': { en: 'Choose a plan', 'zh-CN': '价格' },
  'pricing.subtitle': {
    en: 'Access cloud-powered ComfyUI workflows with straightforward, usage-based pricing.',
    'zh-CN': '通过简单透明、按使用量计费的方式，访问云端 ComfyUI 工作流。'
  },
  'pricing.badge.popular': { en: 'MOST POPULAR', 'zh-CN': '最受欢迎' },
  'pricing.period.monthly': { en: 'Monthly', 'zh-CN': '按月' },
  'pricing.period.yearly': {
    en: 'Yearly (Up to 20% off)',
    'zh-CN': '按年（最高 20% 优惠）'
  },
  'pricing.period.billedMonthly': { en: 'Billed monthly', 'zh-CN': '按月计费' },
  'pricing.period.billedYearly': {
    en: '{total} billed yearly',
    'zh-CN': '按年计费 {total}'
  },
  'pricing.savePercent': {
    en: 'Save {pct}% ({amount})',
    'zh-CN': '节省 {pct}%（{amount}）'
  },
  'pricing.team.videosEstimate': {
    en: 'Generates ~{count} 5s videos*',
    'zh-CN': '约可生成 {count} 个 5 秒视频*'
  },
  'pricing.plan.period': { en: '/month', 'zh-CN': '/月' },
  'pricing.creditsLabel': { en: 'monthly credits', 'zh-CN': '每月积分' },
  'pricing.banner.title': {
    en: "Start free. Upgrade when you're ready.",
    'zh-CN': '免费开始，准备好了再升级。'
  },
  'pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'pricing.banner.cta': { en: 'TRY FREE', 'zh-CN': '免费试用' },

  'pricing.feature.educationalSavings': {
    en: 'Educational savings – 10% off',
    'zh-CN': '教育优惠 – 立减 10%'
  },
  'pricing.feature.educationalSavingsYearly': {
    en: 'Educational savings – 25% off',
    'zh-CN': '教育优惠 – 立减 25%'
  },
  'pricing.feature.shortRuntime': {
    en: '30 minute max workflow runtime',
    'zh-CN': '单个工作流最长运行 30 分钟'
  },
  'pricing.feature.addCredits': {
    en: 'Add more credits anytime',
    'zh-CN': '可随时增加积分'
  },
  'pricing.feature.importModels': {
    en: 'Import your own models',
    'zh-CN': '导入你自己的模型'
  },
  'pricing.feature.longRuntime': {
    en: 'Longer workflow runtime (up to 1 hr)',
    'zh-CN': '更长工作流运行时长（最长 1 小时）'
  },
  'pricing.feature.inviteMembers': {
    en: 'Invite members',
    'zh-CN': '邀请成员'
  },
  'pricing.feature.concurrentWorkflows': {
    en: 'Members can run workflows concurrently',
    'zh-CN': '成员可并行运行工作流'
  },
  'pricing.feature.sharedCreditPool': {
    en: 'Shared credit pool for all members',
    'zh-CN': '所有成员共享积分池'
  },
  'pricing.feature.roleBasedPermissions': {
    en: 'Role-based permissions',
    'zh-CN': '基于角色的权限'
  },

  'pricing.plan.free.label': { en: 'FREE', 'zh-CN': '免费版' },
  'pricing.plan.free.price': { en: '$0', 'zh-CN': '$0' },
  'pricing.plan.free.credits': { en: '400', 'zh-CN': '400' },
  'pricing.plan.free.estimate': {
    en: 'Generates ~35 5s videos*',
    'zh-CN': '约可生成 35 个 5 秒视频*'
  },
  'pricing.plan.free.cta': { en: 'START FREE', 'zh-CN': '免费开始' },
  'pricing.plan.free.feature1': {
    en: '10-minute max runtime per workflow',
    'zh-CN': '单个工作流最长运行 10 分钟'
  },
  'pricing.plan.free.feature2': {
    en: 'Runs on RTX 6000 Pro GPUs (96GB VRAM)',
    'zh-CN': '运行于 RTX 6000 Pro GPU（96GB 显存）'
  },

  'pricing.plan.standard.label': { en: 'STANDARD', 'zh-CN': '标准版' },
  'pricing.plan.standard.price': { en: '$20', 'zh-CN': '$20' },
  'pricing.plan.standard.yearlyPrice': { en: '$16', 'zh-CN': '$16' },
  'pricing.plan.standard.yearlyTotal': { en: '$192', 'zh-CN': '$192' },
  'pricing.plan.standard.eduPrice': { en: '$18', 'zh-CN': '$18' },
  'pricing.plan.standard.eduYearlyPrice': { en: '$15', 'zh-CN': '$15' },
  'pricing.plan.standard.eduYearlyTotal': { en: '$180', 'zh-CN': '$180' },
  'pricing.plan.standard.credits': { en: '4,200', 'zh-CN': '4,200' },
  'pricing.plan.standard.estimate': {
    en: 'Generates ~380 5s videos*',
    'zh-CN': '约可生成 380 个 5 秒视频*'
  },
  'pricing.plan.standard.cta': {
    en: 'SUBSCRIBE TO STANDARD',
    'zh-CN': '订阅标准版'
  },

  'pricing.plan.creator.label': { en: 'CREATOR', 'zh-CN': '创作者版' },
  'pricing.plan.creator.price': { en: '$35', 'zh-CN': '$35' },
  'pricing.plan.creator.yearlyPrice': { en: '$28', 'zh-CN': '$28' },
  'pricing.plan.creator.yearlyTotal': { en: '$336', 'zh-CN': '$336' },
  'pricing.plan.creator.eduPrice': { en: '$31.50', 'zh-CN': '$31.50' },
  'pricing.plan.creator.eduYearlyPrice': { en: '$26.25', 'zh-CN': '$26.25' },
  'pricing.plan.creator.eduYearlyTotal': { en: '$315', 'zh-CN': '$315' },
  'pricing.plan.creator.credits': { en: '7,400', 'zh-CN': '7,400' },
  'pricing.plan.creator.estimate': {
    en: 'Generates ~670 5s videos*',
    'zh-CN': '约可生成 670 个 5 秒视频*'
  },
  'pricing.plan.creator.cta': {
    en: 'SUBSCRIBE TO CREATOR',
    'zh-CN': '订阅创作者版'
  },

  'pricing.plan.pro.label': { en: 'PRO', 'zh-CN': '专业版' },
  'pricing.plan.pro.price': { en: '$100', 'zh-CN': '$100' },
  'pricing.plan.pro.yearlyPrice': { en: '$80', 'zh-CN': '$80' },
  'pricing.plan.pro.yearlyTotal': { en: '$960', 'zh-CN': '$960' },
  'pricing.plan.pro.eduPrice': { en: '$90', 'zh-CN': '$90' },
  'pricing.plan.pro.eduYearlyPrice': { en: '$75', 'zh-CN': '$75' },
  'pricing.plan.pro.eduYearlyTotal': { en: '$900', 'zh-CN': '$900' },
  'pricing.plan.pro.credits': { en: '21,100', 'zh-CN': '21,100' },
  'pricing.plan.pro.estimate': {
    en: 'Generates ~1,915 5s videos*',
    'zh-CN': '约可生成 1,915 个 5 秒视频*'
  },
  'pricing.plan.pro.cta': { en: 'SUBSCRIBE TO PRO', 'zh-CN': '订阅专业版' },

  'pricing.plan.team.label': { en: 'TEAM', 'zh-CN': '团队版' },
  'pricing.plan.team.cta': {
    en: 'SUBSCRIBE TO TEAM',
    'zh-CN': '订阅团队版'
  },
  'pricing.plan.team.everythingInProPlus': {
    en: 'Everything in Pro, plus:',
    'zh-CN': '包含专业版的全部功能，另加：'
  },
  'pricing.team.sliderLabel': {
    en: 'Team monthly credit commitment',
    'zh-CN': '团队每月积分承诺'
  },
  'pricing.team.description': {
    en: 'Built for teams collaborating on workflows together.',
    'zh-CN': '为协作开发工作流的团队打造。'
  },
  'pricing.plan.team.comingSoon': {
    en: 'Coming soon...',
    'zh-CN': '即将推出…'
  },
  'pricing.plan.team.sharedWorkflowsAndAssets': {
    en: 'Shared workflows & assets',
    'zh-CN': '共享工作流与资产'
  },
  'pricing.plan.team.projects': {
    en: 'Projects',
    'zh-CN': '项目'
  },
  'pricing.plan.feature.status.coming': {
    en: 'Coming soon',
    'zh-CN': '即将推出'
  },
  'pricing.plan.feature.status.included': {
    en: 'Included',
    'zh-CN': '已包含'
  },
  'pricing.plan.feature.status.excluded': {
    en: 'Not included',
    'zh-CN': '未包含'
  },

  'pricing.enterprise.label': { en: 'ENTERPRISE', 'zh-CN': '企业版' },
  'pricing.enterprise.description': {
    en: 'Need more members? Looking for more flexibility or custom features?',
    'zh-CN': '需要更多成员？想要更多灵活性或定制功能？'
  },
  'pricing.enterprise.cta': { en: 'Contact Us', 'zh-CN': '联系我们' },
  'pricing.enterprise.feature1': {
    en: 'Annual commitments with bulk pricing and custom compute packages',
    'zh-CN': '支持年度承诺、批量定价与定制算力套餐'
  },
  'pricing.enterprise.feature2': {
    en: 'Onboarding and priority support via Slack',
    'zh-CN': '通过 Slack 提供上手辅导与优先支持'
  },
  'pricing.enterprise.feature3': {
    en: 'Advanced execution (concurrent processing, longer-running jobs, etc)',
    'zh-CN': '高级执行能力（并发处理、长时任务等）'
  },
  'pricing.enterprise.feature4': {
    en: 'Enterprise security and access controls (permissions, audit logs, SSO, etc)',
    'zh-CN': '企业级安全与访问控制（权限、审计日志、SSO 等）'
  },
  'pricing.enterprise.andMore': { en: 'And more...', 'zh-CN': '以及更多…' },
  'pricing.footnote': {
    en: '*Based on 5s videos created with the Wan 2.2 Image-to-Video template using default settings (81 frames, 18fps, 640x640, 4-step sampler)',
    'zh-CN':
      '*基于默认设置（81 帧、18fps、640x640、4-step sampler）使用 Wan 2.2 图生视频模板生成 5 秒视频估算'
  },

  'pricing.included.heading': {
    en: "What's included\nin the Comfy plan",
    'zh-CN': 'Comfy 计划\n包含哪些内容'
  },
  'pricing.included.comingSoon': {
    en: '(coming soon)',
    'zh-CN': '（即将推出）'
  },
  'pricing.included.feature1.title': {
    en: 'Machine Setup',
    'zh-CN': '机器配置'
  },
  'pricing.included.feature1.description': {
    en: 'Comfy Cloud runs on Blackwell RTX 6000 Pro – 96GB VRAM',
    'zh-CN': 'Comfy Cloud 运行在 Blackwell RTX 6000 Pro 上，配备 96GB 显存'
  },
  'pricing.included.feature2.title': {
    en: 'Time limit per job',
    'zh-CN': '单个任务时限'
  },
  'pricing.included.feature2.description': {
    en: 'Each workflow run has a maximum duration of 30 minutes. On the Pro plan, the time limit is increased to 1 hour. Jobs exceeding that limit are automatically cancelled to ensure fair usage and system stability.',
    'zh-CN':
      '每个工作流运行的最长时长为 30 分钟。Pro 计划的时限可延长至 1 小时。超时任务将自动取消，以确保公平使用和系统稳定。'
  },
  'pricing.included.feature3.title': {
    en: 'Usage',
    'zh-CN': '用量计费'
  },
  'pricing.included.feature3.description': {
    en: "You're only charged for <strong>active GPU</strong> time while a workflow is running. Idle time (e.g. time spent building workflows) does not consume GPU hours.",
    'zh-CN':
      '仅在工作流运行期间按<strong>实际 GPU</strong> 使用时长计费。空闲时间（如构建工作流）不消耗 GPU 时长。'
  },
  'pricing.included.feature4.title': {
    en: 'Credit balance',
    'zh-CN': '积分余额'
  },
  'pricing.included.feature4.description': {
    en: 'All plans will include a monthly pool of credits that are spent on active workflow runtime and <a href="https://docs.comfy.org/tutorials/partner-nodes/overview" class="text-primary-comfy-yellow underline">Partner Nodes</a> like Nano Banana Pro.',
    'zh-CN':
      '所有计划均包含每月积分池，可用于工作流运行和<a href="https://docs.comfy.org/tutorials/partner-nodes/overview" class="text-primary-comfy-yellow underline">合作伙伴节点</a>（如 Nano Banana Pro）。'
  },
  'pricing.included.feature5.title': {
    en: 'Add more credits anytime',
    'zh-CN': '随时加购积分'
  },
  'pricing.included.feature5.description': {
    en: 'Purchase additional credits at any time. Unused top-ups roll over to the next month automatically for up to 1 year.',
    'zh-CN':
      '可随时购买额外积分。未使用的充值积分将自动顺延至下个月，最长可保留 1 年。'
  },
  'pricing.included.feature6.title': {
    en: 'Pre-installed models',
    'zh-CN': '预装模型'
  },
  'pricing.included.feature6.description': {
    en: 'Access a library of 900+ pre-installed models.',
    'zh-CN': '可访问 900+ 预装模型库。'
  },
  'pricing.included.feature7.title': {
    en: 'Custom nodes support',
    'zh-CN': '自定义节点支持'
  },
  'pricing.included.feature7.description': {
    en: "Comfy Cloud currently supports a variety of the most-used custom nodes from the ComfyUI community. We're expanding support regularly based on demand and compatibility.",
    'zh-CN':
      'Comfy Cloud 目前支持 ComfyUI 社区中最常用的多种自定义节点。我们会根据需求和兼容性持续扩展支持范围。'
  },
  'pricing.included.feature8.title': {
    en: 'Partner Nodes',
    'zh-CN': '合作伙伴节点'
  },
  'pricing.included.feature8.description': {
    en: 'Run <strong>proprietary models</strong> through Comfy\'s <a href="https://docs.comfy.org/tutorials/partner-nodes/overview" class="text-primary-comfy-yellow underline">Partner Nodes</a>, such as Nano Banana. The amount of credits each node uses depends on the model and parameters you set in the node, but these credits are the same ones that your monthly subscription comes with. These credits can also be used across <strong>Comfy Cloud and local ComfyUI</strong>. Read more about Partner nodes <a href="https://docs.comfy.org/tutorials/partner-nodes/overview" class="text-primary-comfy-yellow underline">here</a>.',
    'zh-CN':
      '通过 Comfy 的<a href="https://docs.comfy.org/tutorials/partner-nodes/overview" class="text-primary-comfy-yellow underline">合作伙伴节点</a>运行<strong>专有模型</strong>，如 Nano Banana。每个节点消耗的积分取决于所用模型和参数设置，且与月度订阅积分通用。积分可在 <strong>Comfy Cloud 和本地 ComfyUI</strong> 间通用。了解更多关于合作伙伴节点的信息请点击<a href="https://docs.comfy.org/tutorials/partner-nodes/overview" class="text-primary-comfy-yellow underline">此处</a>。'
  },
  'pricing.included.feature9.title': {
    en: 'Job queue',
    'zh-CN': '任务队列'
  },
  'pricing.included.feature9.description': {
    en: 'Queue up to 100 workflows at once.',
    'zh-CN': '可同时排队最多 100 个工作流。'
  },
  'pricing.included.feature10.title': {
    en: 'Custom LoRA importing',
    'zh-CN': '自定义 LoRA 导入'
  },
  'pricing.included.feature10.description': {
    en: 'For those on the Creator, Pro, or Team plans, you can bring in your own models & LoRAs from CivitAI or Huggingface to perfect your own style.',
    'zh-CN':
      'Creator、Pro 或 Team 计划用户可从 CivitAI 或 Huggingface 导入自己的模型和 LoRA，打造专属风格。'
  },
  'pricing.included.feature11.title': {
    en: 'Parallel job execution',
    'zh-CN': '并行任务执行'
  },
  'pricing.included.feature11.description': {
    en: 'Run multiple workflows in parallel to speed up your pipeline.',
    'zh-CN': '并行运行多个工作流，加速你的流程。'
  },

  'pricing.faq.heading': {
    en: 'FAQs',
    'zh-CN': '常见问题'
  },

  // VideoPlayer
  'player.play': { en: 'Play', 'zh-CN': '播放' },
  'player.pause': { en: 'Pause', 'zh-CN': '暂停' },
  'player.seek': { en: 'Seek', 'zh-CN': '播放进度' },
  'player.fullscreen': { en: 'Fullscreen', 'zh-CN': '全屏' },
  'player.mute': { en: 'Mute', 'zh-CN': '静音' },
  'player.unmute': { en: 'Unmute', 'zh-CN': '取消静音' },
  'player.subtitlesOn': { en: 'Subtitles on', 'zh-CN': '开启字幕' },
  'player.subtitlesOff': { en: 'Subtitles off', 'zh-CN': '关闭字幕' },

  // LearningDirectorySection
  'learning.title': { en: 'Learning', 'zh-CN': '学习' },
  'learning.tagline': {
    en: 'Hands-on ComfyUI tutorials and workflows, by discipline.',
    'zh-CN': '按创作领域分类的 ComfyUI 实战教程与工作流。'
  },
  'learning.categoryNav': { en: 'Category filter', 'zh-CN': '分类筛选' },
  'learning.featuredBadge': { en: 'Featured', 'zh-CN': '精选' },
  'learning.categories.all': { en: 'All', 'zh-CN': '全部' },
  'learning.categories.all.blurb': {
    en: 'Every tutorial and workflow',
    'zh-CN': '所有教程与工作流'
  },
  'learning.categories.basics': { en: 'Basics', 'zh-CN': '基础' },
  'learning.categories.basics.blurb': {
    en: 'Fundamentals and getting started',
    'zh-CN': '基础入门与上手指南'
  },
  'learning.categories.vfx': { en: 'VFX', 'zh-CN': 'VFX' },
  'learning.categories.vfx.blurb': {
    en: 'Compositing, cleanup and shot work',
    'zh-CN': '合成、清理与镜头处理'
  },
  'learning.categories.animations': { en: 'Animations', 'zh-CN': '动画' },
  'learning.categories.animations.blurb': {
    en: 'Motion, retiming and character',
    'zh-CN': '运动、变速与角色'
  },
  'learning.categories.ads': { en: 'Ads', 'zh-CN': '广告' },
  'learning.categories.ads.blurb': {
    en: 'Product shots and campaign assets',
    'zh-CN': '产品展示与广告素材'
  },
  // Per-vertical h1 + description/meta copy, swapped when a category filter is
  // active (see learningHeading / learningDescription).
  'learning.categories.basics.heading': {
    en: 'ComfyUI Basics',
    'zh-CN': 'ComfyUI 基础教程'
  },
  'learning.categories.basics.description': {
    en: 'Beginner ComfyUI tutorials — learn the node graph, LoRAs, style transfer, and ControlNets from the ground up.',
    'zh-CN':
      '面向初学者的 ComfyUI 教程——从零开始掌握节点图、LoRA、风格迁移与 ControlNet。'
  },
  'learning.categories.vfx.heading': {
    en: 'VFX Tutorials',
    'zh-CN': 'VFX 教程'
  },
  'learning.categories.vfx.description': {
    en: 'Hands-on ComfyUI VFX tutorials — cleanplates, sky replacement, de-aging, mattes, and shot work you can open and run yourself.',
    'zh-CN':
      '实战 ComfyUI VFX 教程——净板、天空替换、减龄、遮罩与镜头处理，均可亲自打开并运行。'
  },
  'learning.categories.animations.heading': {
    en: 'Animation Tutorials',
    'zh-CN': '动画教程'
  },
  'learning.categories.animations.description': {
    en: 'Hands-on ComfyUI animation tutorials — character sheets, keyframes, in-betweening, backgrounds, and compositing you can run yourself.',
    'zh-CN':
      '实战 ComfyUI 动画教程——角色设定表、关键帧、中间帧、背景与合成，均可亲自运行。'
  },
  'learning.categories.ads.heading': {
    en: 'Ad Creative Tutorials',
    'zh-CN': '广告创意教程'
  },
  'learning.categories.ads.description': {
    en: 'Hands-on ComfyUI ad creative tutorials — moodboards, storyboards, product photography, B-roll, and campaign assets you can run yourself.',
    'zh-CN':
      '实战 ComfyUI 广告创意教程——情绪板、故事板、产品摄影、B-Roll 与广告素材，均可亲自运行。'
  },
  // LearningWatchPage
  'learning.watch.nowWatching': { en: 'Now watching', 'zh-CN': '正在观看' },
  'learning.watch.watchMore': { en: 'Watch more', 'zh-CN': '观看更多' },
  'learning.watch.recommended': { en: 'Recommended', 'zh-CN': '推荐' },

  // LearningCallToActionSection
  'learning.cta.heading': {
    en: 'Everything Comfy ships. All in one place.',
    'zh-CN': 'Comfy 的全部内容，一处尽享。'
  },
  'learning.cta.runComfy': {
    en: 'Run Comfy for free',
    'zh-CN': '免费运行 Comfy'
  },

  // GalleryHeroSection
  'gallery.label': { en: 'GALLERY', 'zh-CN': '画廊' },
  'gallery.heroTitle.before': {
    en: 'Built, Tweaked, and Dreamed in',
    'zh-CN': '在 ComfyUI 中构建、调整与创想'
  },
  'gallery.heroSubtitle': {
    en: 'A small glimpse of what\u2019s being created with ComfyUI by the community.',
    'zh-CN': '社区使用 ComfyUI 创作成果的一小部分展示。'
  },
  // GalleryCard
  'gallery.card.by': { en: 'By', 'zh-CN': '作者' },
  'gallery.card.and': { en: 'and', 'zh-CN': '和' },
  'gallery.card.teamUsing': { en: 'team using', 'zh-CN': '团队使用' },
  'gallery.card.using': { en: 'using', 'zh-CN': '使用' },
  'gallery.detail.close': { en: 'Close', 'zh-CN': '关闭' },
  'gallery.detail.visitHub': {
    en: 'VISIT COMMUNITY HUB',
    'zh-CN': '访问社区中心'
  },
  // ContactSection
  'gallery.contact.label': { en: 'CONTACT', 'zh-CN': '联系' },
  'gallery.contact.heading': {
    en: 'Built something cool with ComfyUI?<br> <a href="https://docs.google.com/forms/d/1B6_RPQfhTyKvqHk9OO2bUn8z1Qgh6QIZsF3GNMiCXDw/preview" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Submit</a> your work to be featured on our website and socials and get seen by the global ComfyUI community.',
    'zh-CN':
      '用 ComfyUI 创作了很酷的作品？<br><a href="https://docs.google.com/forms/d/1B6_RPQfhTyKvqHk9OO2bUn8z1Qgh6QIZsF3GNMiCXDw/preview" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">提交</a>你的作品，展示在我们的网站和社交媒体上，让全球 ComfyUI 社区看到。'
  },

  // AboutHeroSection
  'about.hero.label': { en: 'ABOUT', 'zh-CN': '关于' },
  'about.hero.heading': {
    en: 'Build the tools that reward creative skill',
    'zh-CN': '打造奖励创造力的工具'
  },
  'about.hero.body': {
    en: 'The team behind Comfy is small, intense, and building what we intend to be our life\u2019s work.',
    'zh-CN':
      'Comfy \u80cc\u540e\u7684\u56e2\u961f\u89c4\u6a21\u867d\u5c0f\uff0c\u4f46\u5145\u6ee1\u70ed\u60c5\uff0c\u81f4\u529b\u4e8e\u6253\u9020\u6211\u4eec\u6bd5\u751f\u7684\u4e8b\u4e1a\u3002'
  },
  'about.hero.cta': {
    en: 'SEE OPEN ROLES',
    'zh-CN': '\u67e5\u770b\u5f00\u653e\u804c\u4f4d'
  },

  // AboutStorySection
  'about.story.label': { en: 'OUR STORY', 'zh-CN': '我们的故事' },
  'about.story.headingBefore': {
    en: 'An open-source project that became the ',
    'zh-CN': '一个开源项目成为了视觉 AI 的'
  },
  'about.story.headingHighlight': {
    en: 'professional standard',
    'zh-CN': '行业标准'
  },
  'about.story.headingAfter': {
    en: ' for visual AI.',
    'zh-CN': '。'
  },
  'about.story.body': {
    en: 'In January, 2023, no tool on the market could chain two AI models together into a repeatable workflow. One developer in Quebec City built his own in two weeks and open-sourced it.',
    'zh-CN':
      '2023 年 1 月，市场上没有任何工具能将两个 AI 模型串联成可重复的工作流。一位魁北克市的开发者用两周时间自己构建了一个，并将其开源。'
  },
  'about.story.investorsLabel': {
    en: 'OUR INVESTORS',
    'zh-CN': '我们的投资者'
  },
  'about.story.investorsBody': {
    en: 'If it can be open, it should be open. That\u2019s how we build an ecosystem that moves faster than any company could think for, and it\u2019s how we think about code, content, and skins. We make money by building things worth paying for, not by controlling what we believe should be free.',
    'zh-CN':
      '如果能开放，就应该开放。这是我们建立一个比任何公司都更快发展的生态系统的方式，也是我们对代码、内容和皮肤的思考方式。我们通过构建值得付费的产品来赚钱，而不是通过控制我们认为应该免费的东西。'
  },

  // AboutQuoteSection
  'about.quote.text': {
    en: '\u2018Comfy has innovated a new and powerful ecosystem for creativity without compromising creative control. It has been amazing to watch technical artists and curious creative minds leverage Comfy to explore the full surface area of their ideas.\u2019',
    'zh-CN':
      '\u201CComfy 在不牺牲创作控制力的前提下，开创了一个全新而强大的创意生态系统。看到技术艺术家和充满好奇心的创意人士利用 Comfy 探索他们想法的全部可能性，真是令人惊叹。\u201D'
  },
  'about.quote.attribution': {
    en: 'Scott Belsky, Founder of Behance',
    'zh-CN': 'Scott Belsky，Behance 创始人'
  },

  // AboutValuesSection
  'about.values.label': { en: 'OUR VALUES', 'zh-CN': '我们的价值观' },
  'about.values.headingBefore': {
    en: 'We believe ',
    'zh-CN': '我们相信'
  },
  'about.values.headingHighlight': {
    en: 'everyone deserves to design exactly what they dream',
    'zh-CN': '每个人都值得设计出自己梦想中的作品'
  },
  'about.values.headingAfter': {
    en: ', own their process, and never compromise because of their software.',
    'zh-CN': '，掌握自己的流程，永远不因软件而妥协。'
  },
  'about.values.card1.title': { en: 'SHIP IT', 'zh-CN': 'SHIP IT' },
  'about.values.card1.body': {
    en: 'Work hard for what makes it into the world. Ideas don\u2019t substitute for output.',
    'zh-CN': '为能交付到世界的成果而努力。想法不能替代产出。'
  },
  'about.values.card2.title': { en: 'SHARE IT', 'zh-CN': 'SHARE IT' },
  'about.values.card2.body': {
    en: 'Every decision and its reasoning gets shared with the team.',
    'zh-CN': '每个决策及其理由都会与团队共享。'
  },
  'about.values.card3.title': {
    en: 'OPEN SOURCE IT',
    'zh-CN': 'OPEN SOURCE IT'
  },
  'about.values.card3.body': {
    en: 'If it can be open, it should be open. That\u2019s how we build an ecosystem that moves faster than any company could imagine.',
    'zh-CN':
      '如果能开放，就应该开放。这是我们构建一个比任何公司都更快发展的生态系统的方式。'
  },
  'about.values.card4.title': {
    en: 'RESPECT THE CRAFT',
    'zh-CN': 'RESPECT THE CRAFT'
  },
  'about.values.card4.body': {
    en: 'We build for people who prefer precision over shortcuts. The learning curve is high but the payoff is worth it.',
    'zh-CN': '我们为追求精确而非捷径的人而构建。学习曲线虽然陡峭，但回报值得。'
  },

  // AboutCareersSection
  'about.careers.whyLabel': { en: 'IF YOU...', 'zh-CN': '如果你...' },
  'about.careers.whyTitle': {
    en: 'Why join Comfy?',
    'zh-CN': '为什么加入 Comfy？'
  },
  'about.careers.whyTitleBefore': {
    en: 'Why join',
    'zh-CN': '为什么加入'
  },
  'about.careers.whyTitleAfter': {
    en: '?',
    'zh-CN': '？'
  },
  'about.careers.reason1': {
    en: 'Want to build tools that empower others to create.',
    'zh-CN': '想要构建赋能他人创作的工具。'
  },
  'about.careers.reason2': {
    en: 'Want your output to matter more than your title.',
    'zh-CN': '想要你的产出比头衔更重要。'
  },
  'about.careers.reason3': {
    en: 'Want high agency in a flat organization.',
    'zh-CN': '想要在扁平组织中拥有高度自主权。'
  },
  'about.careers.reason4': {
    en: 'Would rather ship and learn than plan and wait.',
    'zh-CN': '宁愿交付与学习，也不愿计划与等待。'
  },
  'about.careers.label': { en: 'CAREERS', 'zh-CN': '招聘' },
  'about.careers.heading': {
    en: 'Join the team',
    'zh-CN': '加入团队'
  },
  'about.careers.cta': { en: 'SEE OPEN ROLES', 'zh-CN': '查看开放职位' },
  'about.careers.noRole': {
    en: 'Don\u2019t see your dream role here?',
    'zh-CN': '没找到你理想的职位？'
  },

  // CareersHeroSection
  'careers.hero.label': { en: 'CAREERS', 'zh-CN': '招聘' },
  'careers.hero.heading': {
    en: 'Building an operating\nsystem for Gen AI',
    'zh-CN': '构建生成式 AI 的\n\u201C操作系统\u201D'
  },
  'careers.hero.body1': {
    en: "We're building the world's leading visual AI platform \u2014 open, modular, and designed for those who want control, quality and scale in their creative process.",
    'zh-CN':
      '我们正在构建全球领先的视觉 AI 平台——开放、模块化，专为追求创作过程中的控制力、品质和规模化的人而设计。'
  },
  'careers.hero.body2': {
    en: 'From solo creators to enterprise teams, millions of people rely on ComfyUI to push the boundaries of what creative AI can do.',
    'zh-CN':
      '从独立创作者到企业团队，数百万人依赖 ComfyUI 来突破创意 AI 的边界。'
  },
  'careers.hero.body3': {
    en: "We're a team of builders. We raise the bar for each other, move fast, and care deeply about the open-source community that's grown alongside us.",
    'zh-CN':
      '我们是一支建设者团队。我们互相提高标准、快速迭代，并深切关心与我们一同成长的开源社区。'
  },
  'careers.hero.body4': {
    en: 'If you want to shape the future of creativity, come build with us.',
    'zh-CN': '如果你想塑造创意的未来，来和我们一起构建。'
  },

  // CareersWhyJoinSection
  'careers.whyJoin.reason1': {
    en: 'Want to build tools that empower others to create.',
    'zh-CN': '想打造赋能他人创作的工具。'
  },
  'careers.whyJoin.reason2': {
    en: "Like working on foundational tech that's already powering real-world videos, images, music, and apps.",
    'zh-CN': '喜欢从事已经在驱动真实世界视频、图像、音乐和应用的基础技术。'
  },
  'careers.whyJoin.reason3': {
    en: 'Care about open, free alternatives to closed AI platforms.',
    'zh-CN': '关心开放、免费的替代方案，而非封闭的 AI 平台。'
  },
  'careers.whyJoin.reason4': {
    en: 'Believe artists, hackers, and solo builders should have real control over their tools.',
    'zh-CN': '相信艺术家、黑客和独立创作者应该真正掌控自己的工具。'
  },
  'careers.whyJoin.reason5': {
    en: 'Want to work in a small, sharp, no-BS team that moves fast and ships often.',
    'zh-CN': '想在一个精干、务实、快速迭代的小团队中工作。'
  },

  // CareersRolesSection
  'careers.roles.heading': { en: 'Roles', 'zh-CN': '职位' },
  'careers.roles.empty': {
    en: 'No open roles right now. Check back soon.',
    'zh-CN': '目前暂无开放职位，请稍后再来查看。'
  },

  // CareersFAQSection
  'careers.faq.heading': { en: 'Q&A', 'zh-CN': 'Q&A' },
  'careers.faq.1.q': {
    en: 'What is the team culture?',
    'zh-CN': '团队文化是什么样的？'
  },
  'careers.faq.1.a': {
    en: "We're a small, intense team that values ownership, speed, and craft. Everyone ships real work, helps each other raise the bar, and cares deeply about the open-source community we serve. We move fast, communicate directly, and trust each other to do great work.",
    'zh-CN':
      '我们是一个精干、高效的团队，重视主人翁精神、速度和工匠精神。每个人都交付真实的成果，互相提高标准，并深切关心我们服务的开源社区。我们快速行动、直接沟通，彼此信任。'
  },
  'careers.faq.2.q': {
    en: 'What kind of background do I need to have to apply?',
    'zh-CN': '我需要什么样的背景才能申请？'
  },
  'careers.faq.2.a': {
    en: 'We care about what you can do, not where you went to school. Show us your work — side projects, open-source contributions, or anything that demonstrates your skills and taste. We value builders who ship.',
    'zh-CN':
      '我们关心的是你能做什么，而不是你的学历背景。向我们展示你的作品——副项目、开源贡献，或任何能展示你技能和品味的东西。我们重视能交付成果的建设者。'
  },
  'careers.faq.3.q': {
    en: 'How do I apply?',
    'zh-CN': '如何申请？'
  },
  'careers.faq.3.a': {
    en: 'Click on any open role above to apply through our job board. Include your resume and any relevant links to your work (GitHub, portfolio, etc.).',
    'zh-CN':
      '点击上方任何开放职位，通过我们的招聘页面申请。请附上你的简历以及任何相关的作品链接（GitHub、作品集等）。'
  },
  'careers.faq.4.q': {
    en: 'What does the hiring process look like?',
    'zh-CN': '招聘流程是什么样的？'
  },
  'careers.faq.4.a': {
    en: 'Typically: application review → intro call → technical assessment or work sample → team interviews → offer. We try to move quickly and respect your time throughout the process.',
    'zh-CN':
      '通常是：简历筛选 → 初步电话沟通 → 技术评估或作品展示 → 团队面试 → 发放 offer。我们会尽快推进流程，尊重你的时间。'
  },
  'careers.faq.5.q': {
    en: 'In-person vs remote?',
    'zh-CN': '线下还是远程？'
  },
  'careers.faq.5.a': {
    en: 'Most roles are based in San Francisco, but we have team members in other locations too. Each role listing specifies the location. We do regular team offsites to stay connected.',
    'zh-CN':
      '大多数职位在旧金山，但我们也有其他地区的团队成员。每个职位会标注具体地点。我们定期举办团队活动以保持紧密联系。'
  },
  'careers.faq.6.q': {
    en: 'How can I increase my chances of getting the job?',
    'zh-CN': '如何提高获得工作的机会？'
  },
  'careers.faq.6.a': {
    en: "Use ComfyUI. Build something with it. Contribute to the open-source project. The best candidates are the ones who already understand the product and community because they're part of it.",
    'zh-CN':
      '使用 ComfyUI。用它构建一些东西。为开源项目做贡献。最好的候选人是那些已经了解产品和社区的人，因为他们本身就是社区的一部分。'
  },
  'careers.faq.7.q': {
    en: 'What if I need visa sponsorship to work in the US?',
    'zh-CN': '如果我需要签证担保在美国工作怎么办？'
  },
  'careers.faq.7.a': {
    en: "We can sponsor visas for exceptional candidates. Let us know your situation in your application and we'll work through the details together.",
    'zh-CN':
      '对于优秀的候选人，我们可以提供签证担保。请在申请中说明你的情况，我们会一起解决细节问题。'
  },
  'careers.faq.8.q': {
    en: 'Can I get feedback for my resume and interview?',
    'zh-CN': '我能获得简历和面试的反馈吗？'
  },
  'careers.faq.8.a': {
    en: 'We do our best to provide meaningful feedback to candidates who go through our interview process. Due to volume, we may not be able to provide detailed feedback at the application stage.',
    'zh-CN':
      '我们尽力为经历面试流程的候选人提供有意义的反馈。由于申请量较大，在简历筛选阶段可能无法提供详细反馈。'
  },

  // MCP – Meta
  'mcp.meta.title': {
    en: 'Comfy MCP - Drive ComfyUI from any AI agent',
    'zh-CN': 'Comfy MCP - 让任何 AI 智能体驱动 ComfyUI'
  },
  'mcp.meta.description': {
    en: 'Comfy MCP exposes the full ComfyUI engine over the Model Context Protocol. Generate images, video, audio, and 3D from Claude Code, Claude Desktop, and any MCP-compatible client. On Comfy Cloud GPUs, or on your own machine.',
    'zh-CN':
      'Comfy MCP 通过模型上下文协议暴露完整的 ComfyUI 引擎，可在 Claude Code、Claude Desktop 及任何兼容 MCP 的客户端中生成图像、视频、音频和 3D 内容。在 Comfy Cloud 的 GPU 上运行，或就在你自己的机器上。'
  },

  // MCP – HeroSection
  'mcp.hero.heading': {
    en: 'Drive ComfyUI from\nany AI agent,\nlocal or cloud.',
    'zh-CN': '让任何 AI 智能体\n驱动 ComfyUI，\n本地或云端。'
  },
  'mcp.hero.subtitle': {
    en: 'Turn your agent into a creative technologist. Generate images, video, audio and 3D, search models, nodes and templates, and run real workflows. Built for batch generation, reproducibility and teamwork.',
    'zh-CN':
      '让你的智能体成为创意技术专家。生成图像、视频、音频和 3D，搜索模型、节点与模板，并运行真实工作流。为批量生成、可复现性与团队协作而打造。'
  },
  'mcp.hero.demoPromptKeyframeBoard': {
    en: 'board the launch film — 8 key frames from the brief',
    'zh-CN': '为发布影片做分镜——从简报生成 8 张关键帧'
  },
  'mcp.hero.demoPromptCharacterConcepts': {
    en: 'explore 4 hero directions — pick one to take forward',
    'zh-CN': '探索 4 个主角方向——挑一个继续推进'
  },
  'mcp.hero.demoPromptStyleTransfer': {
    en: 'stylize all 12 previz frames — photoreal, one pass',
    'zh-CN': '把 12 张预演帧统一风格化——写实，一次完成'
  },
  'mcp.hero.demoPromptFrameToVideo': {
    en: 'animate each shot — first + last frame, 9:16, batch',
    'zh-CN': '逐镜生成动画——首帧加尾帧，9:16，批量'
  },
  'mcp.hero.demoPromptProductPlacement': {
    en: 'drop the can into all 8 hero shots, matched light',
    'zh-CN': '把罐子放进 8 张主视觉里，光影匹配'
  },
  'mcp.hero.demoPromptCharacterDesign': {
    en: 'design the hero — 4 turnarounds, game-ready',
    'zh-CN': '设计主角——4 视图转面，可直接用于游戏'
  },
  'mcp.hero.demoPrompt3dAsset': {
    en: 'build a 3D hero prop for the scene I have open',
    'zh-CN': '为我打开的场景做一个 3D 主道具'
  },
  'mcp.hero.demoPromptCampaignKeyArt': {
    en: "match this frame's palette, make the campaign key art",
    'zh-CN': '匹配这一帧的配色，生成营销主视觉'
  },
  'mcp.hero.demoPromptSetExtension': {
    en: 'extend the set — matte painting from this plate',
    'zh-CN': '扩展场景——用这张底板做接景绘制'
  },
  'mcp.hero.viewDocs': {
    en: 'VIEW DOCS',
    'zh-CN': '查看文档'
  },
  'mcp.hero.installMcp': {
    en: 'INSTALL MCP',
    'zh-CN': '安装 MCP'
  },
  'mcp.hero.demoGenerate': {
    en: 'GENERATE',
    'zh-CN': '生成'
  },
  'mcp.hero.demoToolKeyframeBoard': {
    en: 'keyframe board',
    'zh-CN': '关键帧分镜'
  },
  'mcp.hero.demoToolCharacterConcepts': {
    en: 'character concepts',
    'zh-CN': '角色概念'
  },
  'mcp.hero.demoToolStyleTransfer': {
    en: 'style transfer',
    'zh-CN': '风格迁移'
  },
  'mcp.hero.demoToolFrameToVideo': {
    en: 'frame to video',
    'zh-CN': '帧生视频'
  },
  'mcp.hero.demoToolProductPlacement': {
    en: 'product placement',
    'zh-CN': '产品植入'
  },
  'mcp.hero.demoToolCharacterDesign': {
    en: 'character design',
    'zh-CN': '角色设计'
  },
  'mcp.hero.demoTool3dAsset': {
    en: '3d asset',
    'zh-CN': '3D 资产'
  },
  'mcp.hero.demoToolCampaignKeyArt': {
    en: 'campaign key art',
    'zh-CN': '营销主视觉'
  },
  'mcp.hero.demoToolSetExtension': {
    en: 'set extension',
    'zh-CN': '场景扩展'
  },
  'mcp.hero.demoStatusIdle': {
    en: "your agent has Comfy's tools",
    'zh-CN': '你的智能体已接入 Comfy 工具'
  },
  'mcp.hero.demoStatusBridging': {
    en: 'bridging {app} → {tool}…',
    'zh-CN': '正在桥接 {app} → {tool}…'
  },
  'mcp.hero.demoStatusRunning': {
    en: 'running {tool}…',
    'zh-CN': '正在运行 {tool}…'
  },

  // MCP – SetupSection
  'mcp.setup.label': {
    en: 'GET STARTED',
    'zh-CN': '快速开始'
  },
  'mcp.setup.heading': {
    en: 'Set up Comfy MCP',
    'zh-CN': '配置 Comfy MCP'
  },
  'mcp.setup.subtitle': {
    en: 'Pick where it runs: Comfy Cloud GPUs, or your own machine.\nAdd the server yourself or ask your agent to install it, and the full ComfyUI toolset lands in your chat.',
    'zh-CN':
      '选择运行位置：Comfy Cloud 的 GPU，或你自己的机器。\n自行添加服务器，或让智能体代劳，ComfyUI 全套工具即可进入你的对话。'
  },
  'mcp.setup.connections.tabsLabel': {
    en: 'Pick your connection',
    'zh-CN': '选择你的连接方式'
  },
  'mcp.setup.connections.cloud.name': {
    en: 'Comfy Cloud',
    'zh-CN': 'Comfy Cloud'
  },
  'mcp.setup.connections.cloud.tagline': {
    en: 'Nothing to install. Runs on Comfy Cloud GPUs.',
    'zh-CN': '无需安装。在 Comfy Cloud 的 GPU 上运行。'
  },
  'mcp.setup.connections.local.name': {
    en: 'Local ComfyUI',
    'zh-CN': '本地 ComfyUI'
  },
  'mcp.setup.connections.local.tagline': {
    en: 'Open source. Runs free on your own machine.',
    'zh-CN': '开源。在你自己的机器上免费运行。'
  },
  'mcp.setup.requirementPrefix': {
    en: 'To use Comfy Cloud via MCP, you need a ',
    'zh-CN': '如需通过 MCP 使用 Comfy Cloud，你需要'
  },
  'mcp.setup.requirementLinkLabel': {
    en: 'subscription of any tier',
    'zh-CN': '任意套餐的订阅'
  },
  'mcp.setup.requirementSuffix': {
    en: '.',
    'zh-CN': '。'
  },
  'mcp.setup.requirementFootnote': {
    en: " A credit top-up alone isn't enough to run generations.",
    'zh-CN': '仅充值积分不足以运行生成任务。'
  },
  'mcp.setup.manual.title': {
    en: 'Install manually',
    'zh-CN': '手动安装'
  },
  'mcp.setup.manual.description': {
    en: 'Add this URL as a custom connector or remote MCP server in your client, then sign in when prompted.',
    'zh-CN':
      '将此 URL 添加为客户端的自定义连接器或远程 MCP 服务器，然后按提示登录。'
  },
  'mcp.setup.manual.tabsLabel': {
    en: 'Pick your client',
    'zh-CN': '选择你的客户端'
  },
  'mcp.setup.agent.title': {
    en: 'Ask your agent to install Comfy MCP',
    'zh-CN': '让你的智能体安装 Comfy MCP'
  },
  'mcp.setup.agent.recommended': {
    en: 'Recommended',
    'zh-CN': '推荐'
  },
  'mcp.setup.agent.command': {
    en: 'Help me install Comfy MCP.\nFollow the setup guide at {url}',
    'zh-CN': '帮我安装 Comfy MCP。\n请按照 {url} 上的设置指南操作。'
  },
  'mcp.setup.agent.description': {
    en: 'Prefer to let your agent do it? Paste this into Claude, Cursor, Codex, or any MCP-compatible agent. It reads the docs and adds the connector for you.',
    'zh-CN':
      '想让智能体代劳？将它粘贴到 Claude、Cursor、Codex 或任意兼容 MCP 的智能体中。它会读取文档并为你添加连接器。'
  },
  'mcp.setup.clients.claudeCode.step': {
    en: 'Run this in your terminal, then use /mcp to pick comfy-cloud and authenticate.',
    'zh-CN': '在终端运行以下命令，然后通过 /mcp 选择 comfy-cloud 并完成认证。'
  },
  'mcp.setup.walkthroughAlt': {
    en: '{client} setup walkthrough',
    'zh-CN': '{client} 设置演示'
  },
  'mcp.setup.clients.claudeDesktop.manualTitle': {
    en: 'Add Custom Connector',
    'zh-CN': '添加自定义连接器'
  },
  'mcp.setup.clients.claudeDesktop.step': {
    en: 'Click Customize in the sidebar, open Connectors, choose Add custom connector, paste the URL above, and sign in.',
    'zh-CN':
      '点击侧边栏的 Customize，进入 Connectors，选择添加自定义连接器，粘贴上方 URL 并登录。'
  },
  'mcp.setup.clients.cursor.step': {
    en: 'Add the URL above to ~/.cursor/mcp.json with an X-API-Key header. Create your key at ',
    'zh-CN':
      '将上方 URL 添加到 ~/.cursor/mcp.json，并附带 X-API-Key 请求头。在此创建密钥：'
  },
  'mcp.setup.clients.cursor.linkLabel': {
    en: 'platform.comfy.org',
    'zh-CN': 'platform.comfy.org'
  },
  'mcp.setup.clients.codex.step': {
    en: 'Run this in your terminal, then codex mcp login comfy-cloud to sign in.',
    'zh-CN': '在终端运行以下命令，然后执行 codex mcp login comfy-cloud 登录。'
  },
  'mcp.setup.clients.openclaw.step': {
    en: 'Run these in your terminal, then openclaw mcp login comfy to sign in.',
    'zh-CN': '在终端运行以下命令，然后执行 openclaw mcp login comfy 登录。'
  },
  'mcp.setup.clients.other.name': {
    en: 'Others',
    'zh-CN': '其他'
  },
  'mcp.setup.clients.other.step': {
    en: 'Add the URL above as a remote MCP server. No OAuth in your client? Use an X-API-Key header instead. Full walkthroughs live in the ',
    'zh-CN':
      '将上方 URL 添加为远程 MCP 服务器。客户端不支持 OAuth？改用 X-API-Key 请求头。完整教程见'
  },
  'mcp.setup.clients.other.linkLabel': {
    en: 'setup docs',
    'zh-CN': '设置文档'
  },
  'mcp.setup.skillsNote': {
    en: 'Using Claude Code? The Comfy skills plugin adds ready-made slash commands. ',
    'zh-CN': '在用 Claude Code？Comfy 技能插件提供现成的斜杠命令。'
  },
  'mcp.setup.skillsLink': {
    en: 'View on GitHub',
    'zh-CN': '在 GitHub 上查看'
  },
  'mcp.setup.local.requirementPrefix': {
    en: 'The local ComfyUI connection runs free on your own hardware, and the MCP is ',
    'zh-CN': '本地 ComfyUI 连接在你自己的硬件上免费运行，MCP '
  },
  'mcp.setup.local.requirementLinkLabel': {
    en: 'open source on GitHub',
    'zh-CN': '在 GitHub 上开源'
  },
  'mcp.setup.local.requirementSuffix': {
    en: '.',
    'zh-CN': '。'
  },
  'mcp.setup.local.manual.title': {
    en: 'Install the server',
    'zh-CN': '安装服务器'
  },
  'mcp.setup.local.manual.description': {
    en: 'Install comfy-mcp from PyPI with the command above, then register it in your client. Your client launches the server, and the server drives the ComfyUI on your machine.',
    'zh-CN':
      '使用上方命令从 PyPI 安装 comfy-mcp，然后在客户端中注册。客户端会启动服务器，服务器驱动你机器上的 ComfyUI。'
  },
  'mcp.setup.local.agent.command': {
    en: 'Help me set up the local Comfy MCP connection.\nFollow the setup guide at {url}',
    'zh-CN': '帮我配置本地 Comfy MCP 连接。\n请按照 {url} 上的设置指南操作。'
  },
  'mcp.setup.local.clients.claudeCode.step': {
    en: 'Run this in your terminal, then restart Claude Code so the tools appear.',
    'zh-CN': '在终端运行以下命令，然后重启 Claude Code 以加载工具。'
  },
  'mcp.setup.local.clients.claudeDesktop.step': {
    en: 'Open Settings, choose Developer, then Edit Config, add this to claude_desktop_config.json, and restart Claude Desktop.',
    'zh-CN':
      '打开 Settings，选择 Developer，点击 Edit Config，将以下内容添加到 claude_desktop_config.json，然后重启 Claude Desktop。'
  },
  'mcp.setup.local.clients.cursor.step': {
    en: 'Add this to ~/.cursor/mcp.json, or to .cursor/mcp.json inside a project.',
    'zh-CN':
      '将以下内容添加到 ~/.cursor/mcp.json，或项目内的 .cursor/mcp.json。'
  },
  'mcp.setup.local.clients.other.step': {
    en: 'Any client that can launch a stdio MCP server works: point it at the comfy-mcp command. Full walkthroughs live in the ',
    'zh-CN':
      '任何能启动 stdio MCP 服务器的客户端都可以：将其指向 comfy-mcp 命令即可。完整教程见'
  },

  // MCP – WhyBuildSection
  'mcp.why.heading': {
    en: 'Why build on\n',
    'zh-CN': '为什么选择\n'
  },
  'mcp.why.headingHighlight': {
    en: 'Comfy MCP?',
    'zh-CN': 'Comfy MCP？'
  },
  'mcp.why.subtitle': {
    en: 'The first MCP built for production pipelines: trusted infrastructure that lets engineers and professionals ship faster.',
    'zh-CN':
      '首个为生产管线打造的 MCP：值得信赖的基础设施，让工程师和专业人士交付更快。'
  },
  'mcp.why.1.title': {
    en: 'Open protocol,\nany client.',
    'zh-CN': '开放协议，\n任意客户端。'
  },
  'mcp.why.1.description': {
    en: 'MCP is an open standard, so any MCP-compatible client can connect: Claude Code, Claude Desktop, Codex, Cursor, and more. Sign in with OAuth or an API key on cloud; local runs need no account at all.',
    'zh-CN':
      'MCP 是开放标准，任何兼容 MCP 的客户端都能接入：Claude Code、Claude Desktop、Codex、Cursor 等。云端通过 OAuth 或 API 密钥登录；本地运行完全不需要账户。'
  },
  'mcp.why.2.title': {
    en: 'The full engine,\nnot a sandbox.',
    'zh-CN': '完整引擎，\n非沙箱环境。'
  },
  'mcp.why.2.description': {
    en: 'Same tool your team uses. Fully connected multi-step, multi-GPU workflows, with best-practice templates that update as the ecosystem moves. Everything available now and in the future.',
    'zh-CN':
      '与你团队使用的相同工具。完整连接的多步骤、多 GPU 工作流，以及随生态更新的最佳实践模板。当前及未来的所有功能均可使用。'
  },
  'mcp.why.3.title': {
    en: 'Reproducible\nby design.',
    'zh-CN': '为可复现性\n而设计。'
  },
  'mcp.why.3.description': {
    en: 'Every generation is a workflow: rerun it, share it by URL, hand it to a teammate. Made for long-term projects, not one-off generations. Outputs land in your Comfy library to store, reuse, and remix.',
    'zh-CN':
      '每次生成都是一个工作流：可以重跑、通过 URL 分享、交给队友。为长期项目而生，而非一次性生成。输出保存到你的 Comfy 库，随时存储、复用和二次创作。'
  },
  'mcp.why.4.title': {
    en: 'Your GPUs,\nor ours.',
    'zh-CN': '你的 GPU，\n或我们的。'
  },
  'mcp.why.4.description': {
    en: 'Run without a GPU on Comfy Cloud, or go local and let the agent do the hard part: it reads your machine (models, custom nodes, VRAM), untangles complex open-source workflows, and builds ones your hardware can actually run.',
    'zh-CN':
      '无需 GPU，在 Comfy Cloud 上运行；或选择本地，把难题交给智能体：它了解你的机器（模型、自定义节点、显存），理清复杂的开源工作流，构建你的硬件真正跑得动的工作流。'
  },

  // MCP – ToolsSection
  'mcp.tools.heading': {
    en: 'Everything ComfyUI can do,\nnow available as tools.',
    'zh-CN': 'ComfyUI 能做的一切，\n现在都可作为工具调用。'
  },
  'mcp.tools.film.alt': {
    en: 'Comfy MCP launch film: an agent driving ComfyUI workflows end to end',
    'zh-CN': 'Comfy MCP 发布影片：智能体端到端驱动 ComfyUI 工作流'
  },
  'mcp.tools.1.title': {
    en: 'Generate anything',
    'zh-CN': '生成任意内容'
  },
  'mcp.tools.1.description': {
    en: 'Generate images, video, audio, 3D, upscale, or remove backgrounds. Add or remove elements in images, create or modify any visual, audio, or 3D asset at any scale.',
    'zh-CN':
      '生成图像、视频、音频、3D 内容，放大分辨率或移除背景。添加或删除图像元素，以任意规模创建或修改任何视觉、音频或 3D 资产。'
  },
  'mcp.tools.1.alt': {
    en: 'Comfy MCP generating images, video, audio, and 3D assets from a single prompt',
    'zh-CN': 'Comfy MCP 通过单个提示生成图像、视频、音频和 3D 资产'
  },
  'mcp.tools.2.title': {
    en: 'Search the ecosystem',
    'zh-CN': '搜索生态系统'
  },
  'mcp.tools.2.description': {
    en: 'Query thousands of models, browse rankings, and choose workflow templates straight from your response.',
    'zh-CN': '查询数千个模型，浏览排名，直接在对话中选择工作流模板。'
  },
  'mcp.tools.2.alt': {
    en: 'Comfy MCP searching the ecosystem of models, rankings, and workflow templates',
    'zh-CN': 'Comfy MCP 搜索模型、排名和工作流模板的生态系统'
  },
  'mcp.tools.3.title': {
    en: 'Run real workflows',
    'zh-CN': '运行真实工作流'
  },
  'mcp.tools.3.description': {
    en: 'Submit graphs, track jobs, and pull outputs back. It reads the workflows you already have, so you start where you are: save, share, and reuse them, or open any run on the ComfyUI canvas — the full engine, driven by tool calls.',
    'zh-CN':
      '提交计算图、跟踪任务并取回输出。它能读取你已有的工作流，让你从现有基础直接开始：保存、分享、复用，或在 ComfyUI 画布上打开任意运行——完整的引擎，由工具调用驱动。'
  },
  'mcp.tools.3.alt': {
    en: 'Comfy MCP running a ComfyUI workflow as a callable tool from a chat',
    'zh-CN': 'Comfy MCP 在对话中将 ComfyUI 工作流作为可调用工具运行'
  },
  'mcp.tools.4.title': {
    en: 'Direct any model',
    'zh-CN': '直接调用任意模型'
  },
  'mcp.tools.4.description': {
    en: 'MiniMax H3, Seedance, Flux, GPT-Image, Nano Banana, Kling, Z-Image, ElevenLabs, HY3D, and more. Closed partner APIs and open-source models, reached through one set of tools.',
    'zh-CN':
      'MiniMax H3、Seedance、Flux、GPT-Image、Nano Banana、Kling、Z-Image、ElevenLabs、HY3D 等。封闭的合作伙伴 API 与开源模型，通过同一套工具即可调用。'
  },
  'mcp.tools.4.alt': {
    en: 'Comfy MCP directing closed partner APIs and open-source models through one set of tools',
    'zh-CN': 'Comfy MCP 通过同一套工具调用封闭合作伙伴 API 和开源模型'
  },
  'mcp.tools.5.title': {
    en: 'Generate in batches',
    'zh-CN': '批量生成'
  },
  'mcp.tools.5.description': {
    en: 'Stack a batch on the Queue, track it, and pull back every output. Dozens of runs from a single call.',
    'zh-CN':
      '将一批任务加入队列，跟踪进度，并取回每一个输出。一次调用即可完成数十次运行。'
  },
  'mcp.tools.5.alt': {
    en: 'Comfy MCP stacking a batch on the Queue and pulling back every output',
    'zh-CN': 'Comfy MCP 将一批任务加入队列并取回每个输出'
  },
  'mcp.tools.6.title': {
    en: 'Ship it as an app',
    'zh-CN': '作为应用发布'
  },
  'mcp.tools.6.description': {
    en: 'Turn any workflow into an app with a shareable URL. Collaborators run it in the browser — only the inputs you expose, nothing to install.',
    'zh-CN':
      '将任意工作流变成带可分享链接的应用。协作者在浏览器中运行——只暴露你开放的输入，无需安装任何东西。'
  },
  'mcp.tools.6.alt': {
    en: 'Comfy MCP turning a workflow into a shareable browser app',
    'zh-CN': 'Comfy MCP 将工作流变成可在浏览器中分享的应用'
  },

  // MCP – UseCasesSection
  'mcp.useCases.heading': {
    en: 'Production use cases.',
    'zh-CN': '生产级用例。'
  },
  'mcp.useCases.subtitle': {
    en: 'One prompt, a real campaign: batch pack shots for every SKU, character sheets from a saved workflow, outputs filed straight back into your project folders.',
    'zh-CN':
      '一条提示，一整个真实项目：为每个 SKU 批量生成产品图，用已保存的工作流生成角色设定表，输出直接归档到你的项目文件夹。'
  },
  'mcp.useCases.alt': {
    en: 'Comfy MCP running production jobs: batch pack-shot variations per SKU and a character sheet from a saved workflow',
    'zh-CN':
      'Comfy MCP 运行生产任务：为每个 SKU 批量生成产品图变体，并用已保存的工作流生成角色设定表'
  },

  // MCP – HowItWorksSection
  'mcp.howItWorks.heading': {
    en: 'How it works',
    'zh-CN': '工作原理'
  },
  'mcp.howItWorks.step1.number': { en: '01', 'zh-CN': '01' },
  'mcp.howItWorks.step1.title': {
    en: 'CONNECT',
    'zh-CN': '连接'
  },
  'mcp.howItWorks.step1.description': {
    en: 'Connect the cloud server with one URL and an OAuth sign-in, or pip install the open-source local server. Most clients happily run both.',
    'zh-CN':
      '通过一个 URL 和 OAuth 登录连接云端服务器，或用 pip 安装开源本地服务器。大多数客户端可以同时运行两者。'
  },
  'mcp.howItWorks.step2.number': { en: '02', 'zh-CN': '02' },
  'mcp.howItWorks.step2.title': {
    en: 'DISCOVER',
    'zh-CN': '发现'
  },
  'mcp.howItWorks.step2.description': {
    en: "Your agent gets Comfy's tools: search, generate, submit, and retrieve — everything it needs to create.",
    'zh-CN':
      '你的智能体获得 Comfy 的工具：搜索、生成、提交和获取——一切所需，应有尽有。'
  },
  'mcp.howItWorks.step3.number': { en: '03', 'zh-CN': '03' },
  'mcp.howItWorks.step3.title': {
    en: 'CREATE',
    'zh-CN': '创作'
  },
  'mcp.howItWorks.step3.description': {
    en: 'Request what you want, the agent queues and runs the workflow, and returns the finished result.',
    'zh-CN': '描述你的需求，智能体排队执行工作流，并返回最终结果。'
  },

  // MCP – FAQSection
  'mcp.faq.heading': {
    en: 'Q&As',
    'zh-CN': '常见问答'
  },
  'mcp.faq.1.q': {
    en: 'Which agents are supported?',
    'zh-CN': '支持哪些智能体？'
  },
  'mcp.faq.1.a': {
    en: 'Any MCP-compatible client. For the cloud connection, add https://cloud.comfy.org/mcp as a custom connector or remote MCP server, then sign in when prompted. For the local connection, your client launches the open-source comfy-mcp server: Claude Code, Claude Desktop, Cursor, and any client that supports stdio servers. Send the docs https://docs.comfy.org/agent-tools/mcp.md to your agent and it will figure out the installation for you.',
    'zh-CN':
      '任何兼容 MCP 的客户端。云端连接：将 https://cloud.comfy.org/mcp 添加为自定义连接器或远程 MCP 服务器，然后在提示时登录。本地连接：由客户端启动开源的 comfy-mcp 服务器，支持 Claude Code、Claude Desktop、Cursor 以及任何支持 stdio 服务器的客户端。将文档 https://docs.comfy.org/agent-tools/mcp.md 发送给你的智能体，它会为你完成安装。'
  },
  'mcp.faq.2.q': {
    en: "What's the server URL?",
    'zh-CN': '服务器 URL 是什么？'
  },
  'mcp.faq.2.a': {
    en: 'For the cloud connection: https://cloud.comfy.org/mcp — add it as a custom connector or remote MCP server in any client, then sign in when prompted. The local connection has no URL: your client launches the comfy-mcp command directly and talks to it over stdio.',
    'zh-CN':
      '云端连接：https://cloud.comfy.org/mcp——在任意客户端中将它添加为自定义连接器或远程 MCP 服务器，然后在提示时登录。本地连接没有 URL：客户端直接启动 comfy-mcp 命令，通过 stdio 与它通信。'
  },
  'mcp.faq.3.q': {
    en: "What's the difference between the cloud and local connections?",
    'zh-CN': '云端连接和本地连接有什么区别？'
  },
  'mcp.faq.3.a': {
    en: "The cloud connection is hosted: one URL, nothing to install, and workflows run on Comfy Cloud GPUs with our model catalog. The local connection is open source: your client launches the comfy-mcp server on your machine, and it drives your own ComfyUI — your models, your custom nodes, your GPU.\nWhich one to choose: new users should start with cloud — it is the simplest setup, and the more compatible choice for claude.ai, ChatGPT, and Claude Desktop. Pick local if you already run ComfyUI on your machine or work mostly in a coding agent like Claude Code, Cursor, or Codex. One caveat for Mac users: today's big open-weight models will not run at a workable speed on the Apple GPU, so run those on cloud.",
    'zh-CN':
      '云端连接是托管服务：一个 URL，无需安装，工作流在 Comfy Cloud 的 GPU 上运行，并可使用我们的模型目录。本地连接是开源的：客户端在你的机器上启动 comfy-mcp 服务器，驱动你自己的 ComfyUI——你的模型、你的自定义节点、你的 GPU。\n如何选择：新用户建议从云端开始——配置最简单，对 claude.ai、ChatGPT 和 Claude Desktop 的兼容性也更好。如果你已经在本机运行 ComfyUI，或主要在 Claude Code、Cursor、Codex 等编程智能体中工作，选本地。Mac 用户注意：如今的大型开源权重模型在 Apple GPU 上跑不出实用的速度，请在云端运行。'
  },
  'mcp.faq.4.q': {
    en: 'Can I use both connections at once?',
    'zh-CN': '可以同时使用两种连接吗？'
  },
  'mcp.faq.4.a': {
    en: 'Yes. Most clients happily run two MCP servers side by side, and they authenticate independently: the cloud connection signs in to your Comfy account, while the local one needs no sign-in at all until you run partner models. Prototype free on your own GPU, then send the heavy batch to cloud GPUs from the same chat.',
    'zh-CN':
      '可以。大多数客户端可以同时运行两个 MCP 服务器，且各自独立认证：云端连接登录你的 Comfy 账户，本地连接在运行合作伙伴模型之前完全不需要登录。你可以先在自己的 GPU 上免费打样，再在同一个对话里把大批量任务发到云端 GPU。'
  },
  'mcp.faq.5.q': {
    en: 'Do I need an API key?',
    'zh-CN': '我需要 API 密钥吗？'
  },
  'mcp.faq.5.a': {
    en: 'In short, no. On the local connection, driving your own ComfyUI needs no key and no account. You only sign in when you run partner models: through comfy-cli with a browser sign-in, or with a Comfy API key. On the cloud connection, Claude Code, Claude Desktop, Codex, and OpenClaw sign in with OAuth; Cursor and Hermes need a Comfy API key for now. Just copy https://docs.comfy.org/agent-tools/mcp.md and your agent will figure out the installation for you.',
    'zh-CN':
      '简而言之，不需要。本地连接方面，驱动你自己的 ComfyUI 不需要密钥，也不需要账户。只有在运行合作伙伴模型时才需要登录：通过 comfy-cli 在浏览器中登录，或使用 Comfy API 密钥。云端连接方面，Claude Code、Claude Desktop、Codex 和 OpenClaw 通过 OAuth 登录；Cursor 和 Hermes 目前需要 Comfy API 密钥。只需复制 https://docs.comfy.org/agent-tools/mcp.md，你的智能体就会为你完成安装。'
  },
  'mcp.faq.6.q': {
    en: 'Does it cost anything?',
    'zh-CN': '需要付费吗？'
  },
  'mcp.faq.6.a': {
    en: "On the local connection, runs on your own hardware are free, and the server is open source. Partner models are the exception: they run on partner infrastructure and spend Comfy credits from your account, so you sign in before using them. On the cloud connection, connecting and searching are free, and running a generation uses Comfy Cloud credits — you need a [subscription of any tier](https://comfy.org/cloud/pricing); a credit top-up alone isn't enough. Either way, your agent confirms with you before it spends.",
    'zh-CN':
      '本地连接方面，在你自己硬件上的生成是免费的，服务器也是开源的。合作伙伴模型是例外：它们在合作伙伴的基础设施上运行，消耗你 Comfy 账户中的积分，因此使用前需要登录。云端连接方面，连接和搜索免费，运行生成会使用 Comfy Cloud 积分——你需要[任意套餐的订阅](https://comfy.org/cloud/pricing)，仅充值积分是不够的。无论哪种方式，智能体在消费前都会先与你确认。'
  },
  'mcp.faq.7.q': {
    en: 'Is Comfy MCP open source?',
    'zh-CN': 'Comfy MCP 开源吗？'
  },
  'mcp.faq.7.a': {
    en: 'The local connection is: comfy-mcp lives at https://github.com/Comfy-Org/comfy-mcp and installs from PyPI with pip install comfy-mcp. The cloud connection is a hosted service in front of Comfy Cloud.',
    'zh-CN':
      '本地连接是开源的：comfy-mcp 的代码在 https://github.com/Comfy-Org/comfy-mcp，可通过 pip install comfy-mcp 从 PyPI 安装。云端连接是构建在 Comfy Cloud 之上的托管服务。'
  },
  'mcp.faq.8.q': {
    en: 'What can my agent do once connected?',
    'zh-CN': '连接后我的智能体能做什么？'
  },
  'mcp.faq.8.a': {
    en: "• Generate images, video, audio, and 3D — including all open-source workflows and partner models like Seedance, GPT-Image, Nano Banana, and Kling\n• Build, edit, and run workflows; save and re-run workflows\n• Run and read in large batches\n• Search models, nodes, and template workflows\n• Read and execute shared workflow URLs\n• Upload and download assets for you\n\nEverything is in natural language, with no nodes or node graphs if you don't want them. On the cloud connection there is nothing to download and no GPU needed; the local connection drives the ComfyUI already installed on your machine.",
    'zh-CN':
      '• 生成图像、视频、音频和 3D——包括所有开源工作流以及 Seedance、GPT-Image、Nano Banana 和 Kling 等合作伙伴模型\n• 构建、编辑和运行工作流；保存并重新运行工作流\n• 大批量运行和读取\n• 搜索模型、节点和模板工作流\n• 读取并执行分享的工作流链接\n• 为你上传和下载资产\n\n一切都用自然语言完成，如果你愿意，无需节点、无需节点图。云端连接无需下载、无需 GPU；本地连接则驱动你机器上已安装的 ComfyUI。'
  },
  'mcp.faq.9.q': {
    en: 'Where do my outputs go?',
    'zh-CN': '我的输出会保存到哪里？'
  },
  'mcp.faq.9.a': {
    en: 'On the cloud connection, into your Comfy Cloud asset library, so you can reuse, remix, and share them — and open any run on the canvas to keep editing. You can also ask your agent to download the assets locally for you. On the local connection, outputs land in your ComfyUI output folder, and your agent can copy them anywhere you name.',
    'zh-CN':
      '云端连接：保存到你的 Comfy Cloud 资产库，你可以复用、二次创作和分享——还能在画布上打开任意运行继续编辑。你也可以让智能体把资产下载到本地。本地连接：输出保存在你的 ComfyUI 输出文件夹中，智能体可以把它们复制到你指定的任何位置。'
  },

  // SiteNav
  'nav.products': { en: 'Products', 'zh-CN': '产品' },
  'nav.pricing': { en: 'Pricing', 'zh-CN': '价格' },
  'nav.community': { en: 'Community', 'zh-CN': '社区' },
  'nav.resources': { en: 'Resources', 'zh-CN': '资源' },
  'nav.company': { en: 'Company', 'zh-CN': '公司' },
  'nav.comfyLocal': { en: 'Comfy Desktop', 'zh-CN': 'Comfy 桌面版' },
  'nav.comfyCloud': { en: 'Comfy Cloud', 'zh-CN': 'Comfy Cloud' },
  'nav.comfyApi': { en: 'Comfy API', 'zh-CN': 'Comfy API' },
  'nav.comfyEnterprise': {
    en: 'Comfy Enterprise',
    'zh-CN': 'Comfy 企业版'
  },
  'nav.comfyHub': { en: 'Comfy Workflows', 'zh-CN': 'Comfy Workflows' },
  'nav.fdct': {
    en: 'Forward Deployed Creatives',
    'zh-CN': '前沿驻场创意人才'
  },
  'nav.gallery': { en: 'Gallery', 'zh-CN': '画廊' },
  'nav.learning': { en: 'Learning', 'zh-CN': '学习' },
  'nav.blogs': { en: 'Blog', 'zh-CN': '博客' },
  'nav.github': { en: 'GitHub', 'zh-CN': 'GitHub' },
  'nav.discord': { en: 'Discord', 'zh-CN': 'Discord' },
  'nav.docs': { en: 'Docs', 'zh-CN': '文档' },
  'nav.youtube': { en: 'YouTube', 'zh-CN': 'YouTube' },
  'nav.aboutUs': { en: 'About Us', 'zh-CN': '关于我们' },
  'nav.careers': { en: 'Careers', 'zh-CN': '招聘' },
  'nav.brand': { en: 'Brand', 'zh-CN': '品牌' },
  'nav.customerStories': { en: 'Customer Stories', 'zh-CN': '客户故事' },
  'nav.launches': { en: 'Launches', 'zh-CN': '发布' },
  'nav.events': { en: 'Events', 'zh-CN': '活动' },
  'nav.downloadLocal': { en: 'DOWNLOAD DESKTOP', 'zh-CN': '下载桌面版' },
  'nav.launchCloud': { en: 'TRY CLOUD FOR FREE', 'zh-CN': '免费试用云端' },
  'nav.ctaDesktopCore': { en: 'DESKTOP', 'zh-CN': '桌面版' },
  'nav.ctaCloudCore': { en: 'TRY FREE', 'zh-CN': '免费试用' },
  'nav.home': { en: 'Comfy home', 'zh-CN': 'Comfy 首页' },
  'breadcrumb.home': { en: 'Home', 'zh-CN': '首页' },
  'breadcrumb.about': { en: 'About Us', 'zh-CN': '关于我们' },
  'breadcrumb.contact': { en: 'Contact', 'zh-CN': '联系我们' },
  'breadcrumb.download': { en: 'Download', 'zh-CN': '下载' },
  'breadcrumb.careers': { en: 'Careers', 'zh-CN': '招聘' },
  'breadcrumb.pricing': { en: 'Pricing', 'zh-CN': '定价' },
  'breadcrumb.fdct': {
    en: 'Forward Deployed Creative Technologists',
    'zh-CN': '前沿驻场创意技术专家'
  },
  'breadcrumb.supportedNodes': { en: 'Supported Nodes', 'zh-CN': '支持的节点' },
  'breadcrumb.events': { en: 'Events', 'zh-CN': '活动' },
  'nav.menu': { en: 'Menu', 'zh-CN': '菜单' },
  'nav.toggleMenu': { en: 'Toggle menu', 'zh-CN': '切换菜单' },
  'nav.close': { en: 'Close', 'zh-CN': '关闭' },
  'nav.mobileMenuDescription': {
    en: 'Site navigation and quick links',
    'zh-CN': '网站导航和快速链接'
  },
  'nav.back': { en: 'BACK', 'zh-CN': '返回' },
  'nav.badgeNew': { en: 'NEW', 'zh-CN': '新' },
  // Column headers used in HeaderMainDesktop dropdowns
  'nav.mcpServer': { en: 'Comfy MCP', 'zh-CN': 'Comfy MCP' },
  'nav.supportedModels': { en: 'Supported Models', 'zh-CN': '支持的模型' },
  'nav.colFeatures': { en: 'Features', 'zh-CN': '功能' },
  'nav.colPrograms': { en: 'Programs', 'zh-CN': '项目' },
  'nav.colConnect': { en: 'Connect', 'zh-CN': '联系' },
  'nav.colMore': { en: 'More', 'zh-CN': '更多' },
  // Dropdown items not yet covered above
  'nav.reddit': { en: 'Reddit', 'zh-CN': 'Reddit' },
  'nav.x': { en: 'X', 'zh-CN': 'X' },
  'nav.instagram': { en: 'Instagram', 'zh-CN': 'Instagram' },
  'nav.linkedin': { en: 'LinkedIn', 'zh-CN': 'LinkedIn' },
  'nav.affiliates': { en: 'Affiliates', 'zh-CN': '联盟计划' },
  'nav.contact': { en: 'Contact', 'zh-CN': '联系我们' },
  // Featured dropdown cards — keys are keyed by parent nav item, not card content,
  // so the copy can be swapped without renaming the key.
  'nav.featuredProductsTitle': {
    en: 'NEW RELEASE: LTX 2.5',
    'zh-CN': '全新发布：LTX 2.5'
  },
  'nav.featuredProductsAlt': {
    en: 'LTX 2.5 feature image',
    'zh-CN': 'LTX 2.5 精选图片'
  },
  'nav.featuredProductsCta': {
    en: 'EXPLORE NOW',
    'zh-CN': '立即探索'
  },
  'nav.featuredProductsCtaAria': {
    en: 'Explore the LTX 2.5 release',
    'zh-CN': '探索 LTX 2.5 版本'
  },
  'nav.featuredCommunityTitle': {
    en: 'Sky Replacement',
    'zh-CN': '天空替换'
  },
  'nav.featuredCommunityAlt': {
    en: 'Sky Replacement workflow demo image',
    'zh-CN': '天空替换工作流演示图片'
  },
  'nav.featuredCommunityCtaAria': {
    en: 'Watch the Sky Replacement demo',
    'zh-CN': '观看天空替换演示'
  },
  'nav.featuredCompanyTitle': {
    en: 'Customer story: Black Math',
    'zh-CN': '客户故事：Black Math'
  },
  'nav.featuredCompanyAlt': {
    en: 'Black Math customer story image',
    'zh-CN': 'Black Math 客户故事图片'
  },
  'nav.featuredCompanyCtaAria': {
    en: 'Watch the Black Math customer story',
    'zh-CN': '观看 Black Math 客户故事'
  },

  // SiteFooter
  'footer.tagline': {
    en: 'The most powerful workflow engine for visual AI.',
    'zh-CN': '最强大的视觉 AI 工作流引擎。'
  },
  'footer.products': { en: 'Products', 'zh-CN': '产品' },
  'footer.resources': { en: 'Resources', 'zh-CN': '资源' },
  'footer.company': { en: 'Company', 'zh-CN': '公司' },
  'footer.contact': { en: 'Contact', 'zh-CN': '联系我们' },
  'footer.minimaxH3': { en: 'MiniMax H3', 'zh-CN': 'MiniMax H3' },
  'footer.minimaxMusic3': {
    en: 'MiniMax Music 3',
    'zh-CN': 'MiniMax Music 3'
  },
  'footer.seedance': { en: 'Seedance 2.5', 'zh-CN': 'Seedance 2.5' },
  'footer.about': { en: 'About', 'zh-CN': '关于' },
  'footer.termsOfService': { en: 'Terms of Service', 'zh-CN': '服务条款' },
  'footer.privacyPolicy': { en: 'Privacy Policy', 'zh-CN': '隐私政策' },
  'footer.trustSafety': { en: 'Trust & Safety', 'zh-CN': '信任与安全' },
  'footer.support': { en: 'Support', 'zh-CN': '支持' },
  'footer.sales': { en: 'Sales', 'zh-CN': '销售' },
  'footer.press': { en: 'Press', 'zh-CN': '媒体' },
  'footer.cloudStatus': { en: 'Cloud Status', 'zh-CN': '云端状态' },
  'footer.blog': { en: 'Blog', 'zh-CN': '博客' },
  'footer.affiliateProgram': {
    en: 'Affiliate Program',
    'zh-CN': 'Affiliate Program'
  },
  'footer.location': {
    en: 'San Francisco, USA',
    'zh-CN': '美国旧金山'
  },

  // ── Privacy Policy ────────────────────────────────────────────────
  'privacy.intro.label': { en: 'INTRO', 'zh-CN': '简介' },
  'privacy.intro.block.0': {
    en: 'Your privacy is important to us. It is Comfy Organization Inc\'s policy to respect your privacy and comply with any applicable law and regulation regarding any personal information we may collect about you, including across our website, <a href="https://www.comfy.org" class="text-white underline">https://www.comfy.org</a>, and other sites we own and operate.',
    'zh-CN':
      '您的隐私对我们非常重要。Comfy Organization Inc 的政策是尊重您的隐私，并遵守有关我们可能收集的您的个人信息的任何适用法律和法规，包括在我们的网站 <a href="https://www.comfy.org" class="text-white underline">https://www.comfy.org</a> 以及我们拥有和运营的其他网站上。'
  },
  'privacy.intro.block.1': {
    en: 'Personal information is any information about you which can be used to identify you. This includes information about you as a person (such as name, address, and date of birth), your devices, payment details, and even information about how you use a website or online service.',
    'zh-CN':
      '个人信息是指可以用于识别您身份的任何信息。这包括关于您个人的信息（如姓名、地址和出生日期）、您的设备、付款信息，甚至包括您如何使用网站或在线服务的信息。'
  },
  'privacy.intro.block.2': {
    en: 'In the event our site contains links to third-party sites and services, please be aware that those sites and services have their own privacy policies. After following a link to any third-party content, you should read their posted privacy policy information about how they collect and use personal information. This Privacy Policy does not apply to any of your activities after you leave our site.',
    'zh-CN':
      '如果我们的网站包含指向第三方网站和服务的链接，请注意这些网站和服务有自己的隐私政策。在访问任何第三方内容的链接后，您应阅读其发布的关于如何收集和使用个人信息的隐私政策信息。本隐私政策不适用于您离开我们网站后的任何活动。'
  },
  'privacy.intro.block.3': {
    en: 'This policy is effective as of April 18, 2025. For information specific to Comfy Desktop (the local install application), including named processors, lawful basis under GDPR/UK GDPR, retention periods, and your rights, see our <a href="/privacy/desktop" class="text-white underline">Desktop Privacy Policy</a>.',
    'zh-CN':
      '本政策自 2025 年 4 月 18 日起生效。有关 Comfy Desktop（本地安装应用程序）的具体信息，包括指定的数据处理方、GDPR/UK GDPR 下的合法依据、保留期限以及您的权利，请参阅我们的<a href="/zh-CN/privacy/desktop" class="text-white underline">Desktop 隐私政策</a>。'
  },
  'privacy.information-we-collect.label': {
    en: 'INFORMATION',
    'zh-CN': '信息收集'
  },
  'privacy.information-we-collect.title': {
    en: 'Information We Collect',
    'zh-CN': '我们收集的信息'
  },
  'privacy.information-we-collect.block.0': {
    en: 'Information we collect falls into one of two categories: "voluntarily provided" information and "automatically collected" information.',
    'zh-CN': '我们收集的信息分为两类："自愿提供"的信息和"自动收集"的信息。'
  },
  'privacy.information-we-collect.block.1': {
    en: '"Voluntarily provided" information refers to any information you knowingly and actively provide us when using or participating in any of our services and promotions.',
    'zh-CN':
      '"自愿提供"的信息是指您在使用或参与我们的任何服务和促销活动时，有意识地主动提供给我们的任何信息。'
  },
  'privacy.information-we-collect.block.2': {
    en: '"Automatically collected" information refers to any information automatically sent by your devices in the course of accessing our products and services.',
    'zh-CN':
      '"自动收集"的信息是指您的设备在访问我们的产品和服务过程中自动发送的任何信息。'
  },
  'privacy.personal-information.label': {
    en: 'PERSONAL INFO',
    'zh-CN': '个人信息'
  },
  'privacy.personal-information.title': {
    en: 'Personal Information',
    'zh-CN': '个人信息'
  },
  'privacy.personal-information.block.0': {
    en: 'We may ask for personal information — for example when you register an account — which may include one or more of the following:',
    'zh-CN':
      '我们可能会要求您提供个人信息——例如当您注册账户时——可能包括以下一项或多项：'
  },
  'privacy.personal-information.block.1': {
    en: 'Name\nEmail',
    'zh-CN': '姓名\n电子邮件'
  },
  'privacy.legitimate-reasons.label': { en: 'PROCESSING', 'zh-CN': '处理理由' },
  'privacy.legitimate-reasons.title': {
    en: 'Legitimate Reasons for Processing Your Personal Information',
    'zh-CN': '处理您个人信息的合法理由'
  },
  'privacy.legitimate-reasons.block.0': {
    en: 'We only collect and use your personal information when we have a legitimate reason for doing so. In which instance, we only collect personal information that is reasonably necessary to provide our services to you.',
    'zh-CN':
      '我们仅在有合法理由时才收集和使用您的个人信息。在这种情况下，我们仅收集为向您提供服务而合理必要的个人信息。'
  },
  'privacy.collection-and-use.label': {
    en: 'COLLECTION',
    'zh-CN': '收集与使用'
  },
  'privacy.collection-and-use.title': {
    en: 'Collection and Use of Information',
    'zh-CN': '信息的收集和使用'
  },
  'privacy.collection-and-use.block.0': {
    en: 'We may collect personal information from you when you do any of the following on our website:',
    'zh-CN': '当您在我们的网站上进行以下操作时，我们可能会向您收集个人信息：'
  },
  'privacy.collection-and-use.block.1': {
    en: 'Register for an account\nPurchase a subscription\nUse a mobile device or web browser to access our content\nContact us via email, social media, or on any similar technologies\nWhen you mention us on social media',
    'zh-CN':
      '注册账户\n购买订阅\n使用移动设备或网络浏览器访问我们的内容\n通过电子邮件、社交媒体或任何类似技术联系我们\n在社交媒体上提及我们'
  },
  'privacy.collection-and-use.block.2': {
    en: 'We may collect, hold, use, and disclose information for the following purposes, and personal information will not be further processed in a manner that is incompatible with these purposes:',
    'zh-CN':
      '我们可能出于以下目的收集、持有、使用和披露信息，且个人信息不会以与这些目的不相容的方式进一步处理：'
  },
  'privacy.collection-and-use.block.3': {
    en: "to provide you with our platform's core features and services\nto contact and communicate with you\nto enable you to access and use our website, associated applications, and associated social media platforms",
    'zh-CN':
      '为您提供我们平台的核心功能和服务\n与您联系和沟通\n使您能够访问和使用我们的网站、相关应用程序和相关社交媒体平台'
  },
  'privacy.collection-and-use.block.4': {
    en: 'We may combine voluntarily provided and automatically collected personal information with general information or research data we receive from other trusted sources. For example, if you provide us with your location, we may combine this with general information about currency and language to provide you with an enhanced experience of our site and service.',
    'zh-CN':
      '我们可能会将自愿提供和自动收集的个人信息与我们从其他可信来源获得的一般信息或研究数据相结合。例如，如果您向我们提供您的位置信息，我们可能会将其与有关货币和语言的一般信息结合，为您提供更好的网站和服务体验。'
  },
  'privacy.security.label': { en: 'SECURITY', 'zh-CN': '安全' },
  'privacy.security.title': {
    en: 'Security of Your Personal Information',
    'zh-CN': '您个人信息的安全'
  },
  'privacy.security.block.0': {
    en: 'When we collect and process personal information, and while we retain this information, we will protect it within commercially acceptable means to prevent loss and theft, as well as unauthorized access, disclosure, copying, use or modification.',
    'zh-CN':
      '当我们收集和处理个人信息时，在保留这些信息期间，我们将在商业上可接受的范围内保护这些信息，以防止丢失和盗窃，以及未经授权的访问、披露、复制、使用或修改。'
  },
  'privacy.security.block.1': {
    en: 'Although we will do our best to protect the personal information you provide to us, we advise that no method of electronic transmission or storage is 100% secure and no one can guarantee absolute data security.',
    'zh-CN':
      '尽管我们会尽最大努力保护您提供给我们的个人信息，但我们建议您注意，没有任何电子传输或存储方法是 100% 安全的，没有人能保证绝对的数据安全。'
  },
  'privacy.security.block.2': {
    en: 'You are responsible for selecting any password and its overall security strength, ensuring the security of your own information within the bounds of our services. For example, ensuring any passwords associated with accessing your personal information and accounts are secure and confidential.',
    'zh-CN':
      '您有责任选择任何密码及其整体安全强度，确保您自己信息在我们服务范围内的安全。例如，确保与访问您个人信息和账户相关的任何密码是安全和保密的。'
  },
  'privacy.retention.label': { en: 'RETENTION', 'zh-CN': '保留' },
  'privacy.retention.title': {
    en: 'How Long We Keep Your Personal Information',
    'zh-CN': '我们保留您个人信息的时间'
  },
  'privacy.retention.block.0': {
    en: 'We keep your personal information only for as long as we need to. This time period may depend on what we are using your information for, in accordance with this privacy policy. If your personal information is no longer required, we will delete it or make it anonymous by removing all details that identify you.',
    'zh-CN':
      '我们仅在需要的时间内保留您的个人信息。此时间段可能取决于我们根据本隐私政策使用您信息的目的。如果不再需要您的个人信息，我们将删除它或通过删除所有识别您身份的详细信息使其匿名化。'
  },
  'privacy.retention.block.1': {
    en: 'However, if necessary, we may retain your personal information for our compliance with a legal, accounting, or reporting obligation or for archiving purposes in the public interest, scientific, or historical research purposes or statistical purposes.',
    'zh-CN':
      '但是，如果有必要，我们可能会为了遵守法律、会计或报告义务，或出于公共利益、科学或历史研究目的或统计目的的存档需要而保留您的个人信息。'
  },
  'privacy.children.label': { en: 'CHILDREN', 'zh-CN': '儿童' },
  'privacy.children.title': { en: "Children's Privacy", 'zh-CN': '儿童隐私' },
  'privacy.children.block.0': {
    en: 'We do not aim any of our products or services directly at children under the age of 13 and we do not knowingly collect personal information about children under 13.',
    'zh-CN':
      '我们不会将我们的任何产品或服务直接面向 13 岁以下的儿童，也不会故意收集 13 岁以下儿童的个人信息。'
  },
  'privacy.third-parties.label': { en: 'THIRD PARTIES', 'zh-CN': '第三方' },
  'privacy.third-parties.title': {
    en: 'Disclosure of Personal Information to Third Parties',
    'zh-CN': '向第三方披露个人信息'
  },
  'privacy.third-parties.block.0': {
    en: 'We may disclose personal information to third-party service providers that assist us in operating our services. This includes payment processors such as Stripe, cloud hosting providers, and analytics services. We require these parties to handle your data in accordance with this policy and applicable law.',
    'zh-CN':
      '我们可能会向协助我们运营服务的第三方服务提供商披露个人信息。这包括 Stripe 等支付处理商、云托管提供商和分析服务。我们要求这些方按照本政策和适用法律处理您的数据。'
  },
  'privacy.your-rights.label': { en: 'YOUR RIGHTS', 'zh-CN': '您的权利' },
  'privacy.your-rights.title': {
    en: 'Your Rights and Controlling Your Personal Information',
    'zh-CN': '您的权利及控制您的个人信息'
  },
  'privacy.your-rights.block.0': {
    en: 'Depending on your location, you may have the following rights regarding your personal information:',
    'zh-CN': '根据您所在的地区，您可能拥有以下关于您个人信息的权利：'
  },
  'privacy.your-rights.block.1': {
    en: 'The right to access the personal information we hold about you.\nThe right to request correction of inaccurate personal information.\nThe right to request deletion of your personal information.\nThe right to object to or restrict processing.\nThe right to data portability.\nThe right to withdraw consent at any time.',
    'zh-CN':
      '访问我们持有的关于您的个人信息的权利。\n请求更正不准确的个人信息的权利。\n请求删除您的个人信息的权利。\n反对或限制处理的权利。\n数据可携带权。\n随时撤回同意的权利。'
  },
  'privacy.your-rights.block.2': {
    en: 'To exercise any of these rights, please contact us at <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      '如需行使任何这些权利，请通过 <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a> 与我们联系。'
  },
  'privacy.limits.label': { en: 'LIMITS', 'zh-CN': '局限' },
  'privacy.limits.title': {
    en: 'Limits of Our Policy',
    'zh-CN': '本政策的局限性'
  },
  'privacy.limits.block.0': {
    en: 'Our website may link to external sites that are not operated by us. Please be aware that we have no control over the content and practices of these sites and cannot accept responsibility for their respective privacy policies.',
    'zh-CN':
      '我们的网站可能链接到非我们运营的外部网站。请注意，我们无法控制这些网站的内容和做法，也无法对其各自的隐私政策承担责任。'
  },
  'privacy.changes.label': { en: 'CHANGES', 'zh-CN': '变更' },
  'privacy.changes.title': {
    en: 'Changes to This Policy',
    'zh-CN': '本政策的变更'
  },
  'privacy.changes.block.0': {
    en: 'We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website with a revised effective date.',
    'zh-CN':
      '我们可能会不时更新本隐私政策，以反映我们做法的变化或出于其他运营、法律或监管原因。我们将通过在网站上发布更新后的政策并注明修订后的生效日期来通知您任何重大变更。'
  },
  'privacy.us-state-privacy.label': { en: 'US STATES', 'zh-CN': '美国各州' },
  'privacy.us-state-privacy.title': {
    en: 'U.S. State Privacy Compliance',
    'zh-CN': '美国各州隐私合规'
  },
  'privacy.us-state-privacy.block.0': {
    en: 'We comply with privacy laws in the following U.S. states, where applicable:',
    'zh-CN': '我们在适用的情况下遵守以下美国各州的隐私法：'
  },
  'privacy.us-state-privacy.block.1': {
    en: 'California (CCPA / CPRA)\nColorado (CPA)\nDelaware (DPDPA)\nFlorida (FDBR)\nVirginia (VCDPA)\nUtah (UCPA)',
    'zh-CN':
      '加利福尼亚州（CCPA / CPRA）\n科罗拉多州（CPA）\n特拉华州（DPDPA）\n佛罗里达州（FDBR）\n弗吉尼亚州（VCDPA）\n犹他州（UCPA）'
  },
  'privacy.us-state-privacy.block.2': {
    en: 'Residents of these states may have additional rights, including the right to know what personal information is collected, the right to delete personal information, and the right to opt out of the sale of personal information. To exercise these rights, contact us at <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      '这些州的居民可能拥有额外的权利，包括了解收集了哪些个人信息的权利、删除个人信息的权利以及选择退出出售个人信息的权利。如需行使这些权利，请通过 <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a> 与我们联系。'
  },
  'privacy.do-not-track.label': { en: 'DNT', 'zh-CN': 'DNT' },
  'privacy.do-not-track.title': {
    en: 'Do Not Track',
    'zh-CN': '请勿追踪（Do Not Track）'
  },
  'privacy.do-not-track.block.0': {
    en: 'Some browsers include a "Do Not Track" (DNT) feature that signals to websites that you do not wish to be tracked. There is currently no uniform standard for how companies should respond to DNT signals. At this time, we do not respond to DNT signals.',
    'zh-CN':
      '某些浏览器包含"请勿追踪"（DNT）功能，向网站发出您不希望被追踪的信号。目前尚无关于公司应如何回应 DNT 信号的统一标准。目前，我们不会回应 DNT 信号。'
  },
  'privacy.ccpa.label': { en: 'CCPA', 'zh-CN': 'CCPA' },
  'privacy.ccpa.title': { en: 'CCPA / CPPA', 'zh-CN': 'CCPA / CPPA' },
  'privacy.ccpa.block.0': {
    en: 'Under the California Consumer Privacy Act (CCPA) and the California Privacy Protection Agency (CPPA) regulations, California residents have the right to know what personal information we collect, request deletion of their data, and opt out of the sale of their personal information. We do not sell personal information. To make a request, contact us at <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      '根据加利福尼亚消费者隐私法（CCPA）和加利福尼亚隐私保护局（CPPA）的规定，加利福尼亚州居民有权了解我们收集的个人信息、请求删除其数据以及选择退出出售其个人信息。我们不会出售个人信息。如需提出请求，请通过 <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a> 与我们联系。'
  },
  'privacy.gdpr.label': { en: 'GDPR', 'zh-CN': 'GDPR' },
  'privacy.gdpr.title': {
    en: 'GDPR — European Economic Area',
    'zh-CN': 'GDPR — 欧洲经济区'
  },
  'privacy.gdpr.block.0': {
    en: 'If you are located in the European Economic Area (EEA), the General Data Protection Regulation (GDPR) grants you certain rights regarding your personal data, including the right to access, rectify, erase, restrict processing, data portability, and to object to processing. Our legal bases for processing include consent, contract performance, and legitimate interests. To exercise your GDPR rights, contact us at <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      '如果您位于欧洲经济区（EEA），《通用数据保护条例》（GDPR）赋予您有关个人数据的某些权利，包括访问权、更正权、删除权、限制处理权、数据可携带权以及反对处理权。我们处理的法律依据包括同意、合同履行和合法利益。如需行使您的 GDPR 权利，请通过 <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a> 与我们联系。'
  },
  'privacy.uk-gdpr.label': { en: 'UK GDPR', 'zh-CN': 'UK GDPR' },
  'privacy.uk-gdpr.title': { en: 'UK GDPR', 'zh-CN': '英国 GDPR' },
  'privacy.uk-gdpr.block.0': {
    en: 'If you are located in the United Kingdom, the UK General Data Protection Regulation (UK GDPR) provides you with similar rights to those under the EU GDPR, including the right to access, rectify, erase, and port your data. To exercise your rights under the UK GDPR, please contact us at <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      '如果您位于英国，英国《通用数据保护条例》（UK GDPR）为您提供与欧盟 GDPR 类似的权利，包括访问、更正、删除和传输数据的权利。如需行使您在英国 GDPR 下的权利，请通过 <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a> 与我们联系。'
  },
  'privacy.australian-privacy.label': { en: 'AUSTRALIA', 'zh-CN': '澳大利亚' },
  'privacy.australian-privacy.title': {
    en: 'Australian Privacy',
    'zh-CN': '澳大利亚隐私'
  },
  'privacy.australian-privacy.block.0': {
    en: 'If you are located in Australia, the Australian Privacy Principles (APPs) under the Privacy Act 1988 apply to our handling of your personal information. You have the right to request access to and correction of your personal information. If you believe we have breached the APPs, you may lodge a complaint with us or with the Office of the Australian Information Commissioner (OAIC).',
    'zh-CN':
      '如果您位于澳大利亚，《1988年隐私法》下的澳大利亚隐私原则（APPs）适用于我们对您个人信息的处理。您有权请求访问和更正您的个人信息。如果您认为我们违反了 APPs，您可以向我们或澳大利亚信息专员办公室（OAIC）提出投诉。'
  },
  'privacy.contact.label': { en: 'CONTACT', 'zh-CN': '联系' },
  'privacy.contact.title': { en: 'Contact Us', 'zh-CN': '联系我们' },
  'privacy.contact.block.0': {
    en: 'If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:',
    'zh-CN':
      '如果您对本隐私政策或我们的数据处理方式有任何疑问或顾虑，请通过以下方式联系我们：'
  },
  'privacy.contact.block.1': {
    en: '<a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>',
    'zh-CN':
      '<a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>'
  },

  // ── Desktop Privacy Policy ────────────────────────────────────────
  'desktop_privacy.intro.label': { en: 'OVERVIEW', 'zh-CN': 'OVERVIEW' },
  'desktop_privacy.intro.block.0': {
    en: 'Effective 3 June 2026. Applies to the Comfy Desktop application.',
    'zh-CN': 'Effective 3 June 2026. Applies to the Comfy Desktop application.'
  },
  'desktop_privacy.intro.block.1': {
    en: 'This Privacy Policy describes the personal data we process when you use Comfy Desktop, the purposes and lawful bases for that processing, the recipients of the data, and the rights available to you. The same policy is shown in the application on first run and is available at any time from Settings → About → Privacy Policy.',
    'zh-CN':
      'This Privacy Policy describes the personal data we process when you use Comfy Desktop, the purposes and lawful bases for that processing, the recipients of the data, and the rights available to you. The same policy is shown in the application on first run and is available at any time from Settings → About → Privacy Policy.'
  },

  'desktop_privacy.controller.label': {
    en: 'CONTROLLER',
    'zh-CN': 'CONTROLLER'
  },
  'desktop_privacy.controller.title': {
    en: 'Controller',
    'zh-CN': 'Controller'
  },
  'desktop_privacy.controller.block.0': {
    en: 'Comfy Organization Inc ("Comfy Org", "we", "us") is the data controller for personal data processed in connection with your use of Comfy Desktop. We are established in San Francisco, USA. For privacy enquiries: <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      'Comfy Organization Inc ("Comfy Org", "we", "us") is the data controller for personal data processed in connection with your use of Comfy Desktop. We are established in San Francisco, USA. For privacy enquiries: <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.'
  },

  'desktop_privacy.data.label': {
    en: 'DATA WE PROCESS',
    'zh-CN': 'DATA WE PROCESS'
  },
  'desktop_privacy.data.title': {
    en: 'Personal data we process',
    'zh-CN': 'Personal data we process'
  },
  'desktop_privacy.data.block.0': {
    en: 'If you have enabled telemetry, either on the first-run consent screen or at Settings → Telemetry, we process the following categories of data:',
    'zh-CN':
      'If you have enabled telemetry, either on the first-run consent screen or at Settings → Telemetry, we process the following categories of data:'
  },
  'desktop_privacy.data.block.1': {
    en: 'Device identifier. A pseudonymous identifier generated locally on first run. Before you sign in to Comfy Cloud it is not linked to your name, email address, or hardware. When you sign in, it is associated with your Comfy account.\nTechnical metadata. Application version, operating system, and processor architecture.\nProduct usage events. Feature interactions, navigation between views, installation and update milestones, and approximate timing.\nCustom node identifiers. Public package names of custom nodes you install through Manager (for example, "comfyui-impact-pack"). The local installation path is not transmitted.\nCrash and error diagnostics. Stack traces, error messages, and short stdout/stderr fragments captured at the moment of failure.',
    'zh-CN':
      'Device identifier. A pseudonymous identifier generated locally on first run. Before you sign in to Comfy Cloud it is not linked to your name, email address, or hardware. When you sign in, it is associated with your Comfy account.\nTechnical metadata. Application version, operating system, and processor architecture.\nProduct usage events. Feature interactions, navigation between views, installation and update milestones, and approximate timing.\nCustom node identifiers. Public package names of custom nodes you install through Manager (for example, "comfyui-impact-pack"). The local installation path is not transmitted.\nCrash and error diagnostics. Stack traces, error messages, and short stdout/stderr fragments captured at the moment of failure.'
  },
  'desktop_privacy.data.block.2': {
    en: 'Before crash or error diagnostic data is transmitted, we apply automated redaction to home-directory paths and to well-known credential patterns (Bearer tokens, OpenAI <code>sk-*</code> and Hugging Face <code>hf_*</code> keys, basic-auth URLs, and <code>KEY=</code> / <code>SECRET=</code> environment assignments).',
    'zh-CN':
      'Before crash or error diagnostic data is transmitted, we apply automated redaction to home-directory paths and to well-known credential patterns (Bearer tokens, OpenAI <code>sk-*</code> and Hugging Face <code>hf_*</code> keys, basic-auth URLs, and <code>KEY=</code> / <code>SECRET=</code> environment assignments).'
  },
  'desktop_privacy.data.block.3': {
    en: 'We do not process:',
    'zh-CN': 'We do not process:'
  },
  'desktop_privacy.data.block.4': {
    en: 'Workflow content (the graph, the nodes you connect, their parameters)\nPrompts you write\nGenerated images, video, or audio\nModel weights, or the local filenames under which you save them\nNetwork activity outside the application',
    'zh-CN':
      'Workflow content (the graph, the nodes you connect, their parameters)\nPrompts you write\nGenerated images, video, or audio\nModel weights, or the local filenames under which you save them\nNetwork activity outside the application'
  },
  'desktop_privacy.data.block.5': {
    en: 'Your workflow files, your models, the outputs you generate, the list of installations you create, and your local settings remain on your device. They are not transmitted to Comfy Org, and they are not accessible to us.',
    'zh-CN':
      'Your workflow files, your models, the outputs you generate, the list of installations you create, and your local settings remain on your device. They are not transmitted to Comfy Org, and they are not accessible to us.'
  },

  'desktop_privacy.purposes.label': { en: 'PURPOSES', 'zh-CN': 'PURPOSES' },
  'desktop_privacy.purposes.title': {
    en: 'Purposes and lawful bases',
    'zh-CN': 'Purposes and lawful bases'
  },
  'desktop_privacy.purposes.block.0': {
    en: 'We process personal data on the following lawful bases under GDPR and UK GDPR:',
    'zh-CN':
      'We process personal data on the following lawful bases under GDPR and UK GDPR:'
  },
  'desktop_privacy.purposes.block.1': {
    en: 'Product usage analytics: consent under Article 6(1)(a).\nCrash and error diagnostics: consent under Article 6(1)(a).\nDelivery of software updates and integrity verification: legitimate interests under Article 6(1)(f).\nAuthentication when you sign in to Comfy Cloud: performance of a contract under Article 6(1)(b).',
    'zh-CN':
      'Product usage analytics: consent under Article 6(1)(a).\nCrash and error diagnostics: consent under Article 6(1)(a).\nDelivery of software updates and integrity verification: legitimate interests under Article 6(1)(f).\nAuthentication when you sign in to Comfy Cloud: performance of a contract under Article 6(1)(b).'
  },
  'desktop_privacy.purposes.block.2': {
    en: 'Consent for analytics and crash diagnostics is opt-in, and you may withdraw it at any time at Settings → Telemetry. Withdrawal does not affect the lawfulness of processing carried out before withdrawal. To object to processing on the basis of legitimate interests, contact <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      'Consent for analytics and crash diagnostics is opt-in, and you may withdraw it at any time at Settings → Telemetry. Withdrawal does not affect the lawfulness of processing carried out before withdrawal. To object to processing on the basis of legitimate interests, contact <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.'
  },
  'desktop_privacy.purposes.block.3': {
    en: 'We do not carry out automated decision-making, including profiling, that produces legal or similarly significant effects. We do not sell personal data, and we do not share personal data for cross-context behavioural advertising.',
    'zh-CN':
      'We do not carry out automated decision-making, including profiling, that produces legal or similarly significant effects. We do not sell personal data, and we do not share personal data for cross-context behavioural advertising.'
  },

  'desktop_privacy.processors.label': {
    en: 'RECIPIENTS',
    'zh-CN': 'RECIPIENTS'
  },
  'desktop_privacy.processors.title': {
    en: 'Recipients',
    'zh-CN': 'Recipients'
  },
  'desktop_privacy.processors.block.0': {
    en: 'We engage the following processors under Data Processing Agreements:',
    'zh-CN':
      'We engage the following processors under Data Processing Agreements:'
  },
  'desktop_privacy.processors.block.1': {
    en: 'PostHog (product usage analytics)\nDatadog (crash and error diagnostics)\nToDesktop (application distribution and software updates)\nComfy Org analytics warehouse (long-term aggregate analytics, operated by Comfy Org)',
    'zh-CN':
      'PostHog (product usage analytics)\nDatadog (crash and error diagnostics)\nToDesktop (application distribution and software updates)\nComfy Org analytics warehouse (long-term aggregate analytics, operated by Comfy Org)'
  },

  'desktop_privacy.transfers.label': { en: 'TRANSFERS', 'zh-CN': 'TRANSFERS' },
  'desktop_privacy.transfers.title': {
    en: 'International transfers',
    'zh-CN': 'International transfers'
  },
  'desktop_privacy.transfers.block.0': {
    en: 'Comfy Organization Inc is established in the United States. Personal data of users in the EU, UK, EEA, or other jurisdictions outside the United States may be transferred to the United States and to other locations where our processors operate. Where required, we rely on the European Commission Standard Contractual Clauses (and the UK International Data Transfer Addendum where applicable) as the transfer mechanism under Chapter V GDPR.',
    'zh-CN':
      'Comfy Organization Inc is established in the United States. Personal data of users in the EU, UK, EEA, or other jurisdictions outside the United States may be transferred to the United States and to other locations where our processors operate. Where required, we rely on the European Commission Standard Contractual Clauses (and the UK International Data Transfer Addendum where applicable) as the transfer mechanism under Chapter V GDPR.'
  },

  'desktop_privacy.retention.label': { en: 'RETENTION', 'zh-CN': 'RETENTION' },
  'desktop_privacy.retention.title': { en: 'Retention', 'zh-CN': 'Retention' },
  'desktop_privacy.retention.block.0': {
    en: 'Product usage analytics: up to 24 months from the event, then aggregated or deleted.\nCrash and error diagnostics: 15 days at full fidelity, then sampled or aggregated.\nAggregate analytics: up to 36 months in aggregated form.\nUpdate-server logs: 90 days.\nLocal device identifier: stored on your device only, and removed when you uninstall the application.',
    'zh-CN':
      'Product usage analytics: up to 24 months from the event, then aggregated or deleted.\nCrash and error diagnostics: 15 days at full fidelity, then sampled or aggregated.\nAggregate analytics: up to 36 months in aggregated form.\nUpdate-server logs: 90 days.\nLocal device identifier: stored on your device only, and removed when you uninstall the application.'
  },

  'desktop_privacy.rights.label': { en: 'YOUR RIGHTS', 'zh-CN': 'YOUR RIGHTS' },
  'desktop_privacy.rights.title': { en: 'Your rights', 'zh-CN': 'Your rights' },
  'desktop_privacy.rights.block.0': {
    en: 'If you are in the EU, UK, or EEA, you have the following rights under GDPR and UK GDPR: access, rectification, erasure, restriction of processing, objection, portability, and withdrawal of consent.',
    'zh-CN':
      'If you are in the EU, UK, or EEA, you have the following rights under GDPR and UK GDPR: access, rectification, erasure, restriction of processing, objection, portability, and withdrawal of consent.'
  },
  'desktop_privacy.rights.block.1': {
    en: 'If you are a California resident, you have rights under CCPA and CPRA: to know what we collect, to delete, to correct, and to limit use of sensitive personal information. We do not sell personal information, and we do not share it for cross-context behavioural advertising.',
    'zh-CN':
      'If you are a California resident, you have rights under CCPA and CPRA: to know what we collect, to delete, to correct, and to limit use of sensitive personal information. We do not sell personal information, and we do not share it for cross-context behavioural advertising.'
  },
  'desktop_privacy.rights.block.2': {
    en: "You also have the right to lodge a complaint with your supervisory authority, such as the UK Information Commissioner's Office, your EU member-state data protection authority, or the California Privacy Protection Agency.",
    'zh-CN':
      "You also have the right to lodge a complaint with your supervisory authority, such as the UK Information Commissioner's Office, your EU member-state data protection authority, or the California Privacy Protection Agency."
  },
  'desktop_privacy.rights.block.3': {
    en: 'To exercise any of these rights, contact <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>. If you have signed in to Comfy Cloud, your account verifies your identity. If you have not signed in, please tell us your approximate install date, platform, and application version, and we will attempt to match these against our records. We aim to respond within 30 days.',
    'zh-CN':
      'To exercise any of these rights, contact <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>. If you have signed in to Comfy Cloud, your account verifies your identity. If you have not signed in, please tell us your approximate install date, platform, and application version, and we will attempt to match these against our records. We aim to respond within 30 days.'
  },

  'desktop_privacy.children.label': { en: 'CHILDREN', 'zh-CN': 'CHILDREN' },
  'desktop_privacy.children.title': { en: 'Children', 'zh-CN': 'Children' },
  'desktop_privacy.children.block.0': {
    en: 'Comfy Desktop is not intended for, and we do not knowingly collect personal data from, individuals under 13 years of age.',
    'zh-CN':
      'Comfy Desktop is not intended for, and we do not knowingly collect personal data from, individuals under 13 years of age.'
  },

  'desktop_privacy.changes.label': { en: 'CHANGES', 'zh-CN': 'CHANGES' },
  'desktop_privacy.changes.title': { en: 'Changes', 'zh-CN': 'Changes' },
  'desktop_privacy.changes.block.0': {
    en: 'We will revise this Privacy Policy when our processing changes materially. The Effective date at the top of this policy reflects the date of the most recent revision.',
    'zh-CN':
      'We will revise this Privacy Policy when our processing changes materially. The Effective date at the top of this policy reflects the date of the most recent revision.'
  },

  'desktop_privacy.contact.label': { en: 'CONTACT', 'zh-CN': 'CONTACT' },
  'desktop_privacy.contact.title': { en: 'Contact', 'zh-CN': 'Contact' },
  'desktop_privacy.contact.block.0': {
    en: 'For any privacy enquiry, contact <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.',
    'zh-CN':
      'For any privacy enquiry, contact <a href="mailto:support@comfy.org" class="text-white underline">support@comfy.org</a>.'
  },

  // ── Terms of Service ──────────────────────────────────────────────
  'tos.effectiveDateLabel': {
    en: 'Effective Date',
    'zh-CN': 'Effective Date'
  },
  'tos.effectiveDate': {
    en: 'May 13, 2026',
    'zh-CN': 'May 13, 2026'
  },

  'tos.intro.label': { en: 'INTRO', 'zh-CN': 'INTRO' },
  'tos.intro.block.0': {
    en: 'These Comfy Terms of Service (the “Agreement”) are made available by Comfy Organization, Inc., a Delaware corporation (“Comfy”) and set forth your rights and obligations when accessing the Comfy Products (as defined below).',
    'zh-CN':
      'These Comfy Terms of Service (the “Agreement”) are made available by Comfy Organization, Inc., a Delaware corporation (“Comfy”) and set forth your rights and obligations when accessing the Comfy Products (as defined below).'
  },
  'tos.intro.block.1': {
    en: 'The Agreement is entered into by and between Comfy and the entity or person accessing the Comfy Products (“Customer” or “you”). If you are accessing or using the Comfy Products on behalf of your company, you represent that you are authorized to enter into the Agreement on behalf of your company.',
    'zh-CN':
      'The Agreement is entered into by and between Comfy and the entity or person accessing the Comfy Products (“Customer” or “you”). If you are accessing or using the Comfy Products on behalf of your company, you represent that you are authorized to enter into the Agreement on behalf of your company.'
  },
  'tos.intro.block.2': {
    en: 'PLEASE REVIEW THESE TERMS OF SERVICE CAREFULLY. ONCE ACCEPTED, THE TERMS AND CONDITIONS OF THE AGREEMENT WILL BECOME A BINDING LEGAL COMMITMENT BETWEEN YOU AND COMFY. IF YOU DO NOT AGREE TO BE BOUND BY THESE TERMS OF SERVICE, YOU SHOULD NOT ACCEPT THESE TERMS OF SERVICE AND MAY NOT USE THE PLATFORM.',
    'zh-CN':
      'PLEASE REVIEW THESE TERMS OF SERVICE CAREFULLY. ONCE ACCEPTED, THE TERMS AND CONDITIONS OF THE AGREEMENT WILL BECOME A BINDING LEGAL COMMITMENT BETWEEN YOU AND COMFY. IF YOU DO NOT AGREE TO BE BOUND BY THESE TERMS OF SERVICE, YOU SHOULD NOT ACCEPT THESE TERMS OF SERVICE AND MAY NOT USE THE PLATFORM.'
  },

  'tos.definitions.label': { en: 'DEFINITIONS', 'zh-CN': 'DEFINITIONS' },
  'tos.definitions.title': { en: '1. Definitions', 'zh-CN': '1. Definitions' },
  'tos.definitions.block.0': {
    en: '“Affiliates” means any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where “control” means the ownership of more than fifty percent (50%) of the voting securities or other voting interests of such entity.',
    'zh-CN':
      '“Affiliates” means any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where “control” means the ownership of more than fifty percent (50%) of the voting securities or other voting interests of such entity.'
  },
  'tos.definitions.block.1': {
    en: '“Applicable Laws” means all federal and state laws, treaties, rules, regulations, regulatory and supervisory guidance, directives, policies, orders or determinations of a regulatory authority applicable to the activities and obligations contemplated under this Agreement.',
    'zh-CN':
      '“Applicable Laws” means all federal and state laws, treaties, rules, regulations, regulatory and supervisory guidance, directives, policies, orders or determinations of a regulatory authority applicable to the activities and obligations contemplated under this Agreement.'
  },
  'tos.definitions.block.2': {
    en: '“Comfy API” means the application programming interface and related developer tools made available by Comfy that allow you to access and execute visual AI workflows programmatically as production endpoints from within your own applications or systems.',
    'zh-CN':
      '“Comfy API” means the application programming interface and related developer tools made available by Comfy that allow you to access and execute visual AI workflows programmatically as production endpoints from within your own applications or systems.'
  },
  'tos.definitions.block.3': {
    en: '“Comfy Branding” means the names, logos, and associated trademarks owned or in progress of being owned by Comfy.',
    'zh-CN':
      '“Comfy Branding” means the names, logos, and associated trademarks owned or in progress of being owned by Comfy.'
  },
  'tos.definitions.block.4': {
    en: '“Comfy Cloud” means the cloud-based hosting environment made available by Comfy that allows you to access and run visual AI workflows remotely through Comfy’s infrastructure, without requiring local installation or hardware.',
    'zh-CN':
      '“Comfy Cloud” means the cloud-based hosting environment made available by Comfy that allows you to access and run visual AI workflows remotely through Comfy’s infrastructure, without requiring local installation or hardware.'
  },
  'tos.definitions.block.5': {
    en: '“Comfy Enterprise” means the enterprise-grade product tier made available by Comfy that provides organizations with dedicated infrastructure, enhanced security, administrative controls, and related support services for deploying and managing visual AI workflows at scale.',
    'zh-CN':
      '“Comfy Enterprise” means the enterprise-grade product tier made available by Comfy that provides organizations with dedicated infrastructure, enhanced security, administrative controls, and related support services for deploying and managing visual AI workflows at scale.'
  },
  'tos.definitions.block.6': {
    en: '“Comfy OSS” means the open-source software, source code, libraries, tools, and related components made available by Comfy under one or more open source licenses, including the software repositories published by Comfy at <a href="https://github.com/Comfy-Org" class="text-white underline">https://github.com/Comfy-Org</a>, as updated, modified, or supplemented from time to time. For the avoidance of doubt, Comfy OSS does not include any proprietary software, infrastructure, or functionality made available by Comfy under these Terms of Service or in connection with any commercial product or offering.',
    'zh-CN':
      '“Comfy OSS” means the open-source software, source code, libraries, tools, and related components made available by Comfy under one or more open source licenses, including the software repositories published by Comfy at <a href="https://github.com/Comfy-Org" class="text-white underline">https://github.com/Comfy-Org</a>, as updated, modified, or supplemented from time to time. For the avoidance of doubt, Comfy OSS does not include any proprietary software, infrastructure, or functionality made available by Comfy under these Terms of Service or in connection with any commercial product or offering.'
  },
  'tos.definitions.block.7': {
    en: '“Comfy Products” means Comfy Cloud, Comfy API, Comfy Enterprise and other products, software, features, tools, and functionality made available by Comfy to you under these Terms of Service, excluding any Comfy OSS.',
    'zh-CN':
      '“Comfy Products” means Comfy Cloud, Comfy API, Comfy Enterprise and other products, software, features, tools, and functionality made available by Comfy to you under these Terms of Service, excluding any Comfy OSS.'
  },
  'tos.definitions.block.8': {
    en: '“Customer Data” means electronic data and information submitted or generated by Customer in connection with its use of the Comfy Products, including all Inputs and Outputs.',
    'zh-CN':
      '“Customer Data” means electronic data and information submitted or generated by Customer in connection with its use of the Comfy Products, including all Inputs and Outputs.'
  },
  'tos.definitions.block.9': {
    en: '“Open Source License” means the open source license(s) under which Comfy makes Comfy OSS available, as identified in the applicable source code repository.',
    'zh-CN':
      '“Open Source License” means the open source license(s) under which Comfy makes Comfy OSS available, as identified in the applicable source code repository.'
  },
  'tos.definitions.block.10': {
    en: '“Operational Metadata” means usage and diagnostic information generated by the Comfy Products and collected by Comfy to support, maintain, and optimize the performance and security of the Comfy Products, including information regarding software versions, system configuration, uptime, error logs, health metrics, and feature usage. Operational Metadata does not include Customer Data or Confidential Information.',
    'zh-CN':
      '“Operational Metadata” means usage and diagnostic information generated by the Comfy Products and collected by Comfy to support, maintain, and optimize the performance and security of the Comfy Products, including information regarding software versions, system configuration, uptime, error logs, health metrics, and feature usage. Operational Metadata does not include Customer Data or Confidential Information.'
  },
  'tos.definitions.block.11': {
    en: '“Order Form” means the online sign-up flow, order form or other ordering document entered into or otherwise agreed by Customer that references this Agreement.',
    'zh-CN':
      '“Order Form” means the online sign-up flow, order form or other ordering document entered into or otherwise agreed by Customer that references this Agreement.'
  },
  'tos.definitions.block.12': {
    en: '“User” means Customer’s or Customer’s Affiliates’ employees and contractors who are authorized by Customer to access and use the Comfy Products on Customer’s or Customer’s Affiliates’ behalf according to the terms of this Agreement.',
    'zh-CN':
      '“User” means Customer’s or Customer’s Affiliates’ employees and contractors who are authorized by Customer to access and use the Comfy Products on Customer’s or Customer’s Affiliates’ behalf according to the terms of this Agreement.'
  },

  'tos.comfy-products.label': {
    en: 'COMFY PRODUCTS',
    'zh-CN': 'COMFY PRODUCTS'
  },
  'tos.comfy-products.title': {
    en: '2. Comfy Products',
    'zh-CN': '2. Comfy Products'
  },
  'tos.comfy-products.block.0.heading': {
    en: 'Right to Access and Use Comfy Products.',
    'zh-CN': 'Right to Access and Use Comfy Products.'
  },
  'tos.comfy-products.block.1': {
    en: 'Subject to your compliance with all of the terms and conditions of this Agreement, Comfy grants you and your Users a non-exclusive, non-sublicensable, non-transferable right during the term of this Agreement to access and use the Comfy Products as set forth in the applicable Order Form for your internal business purposes.',
    'zh-CN':
      'Subject to your compliance with all of the terms and conditions of this Agreement, Comfy grants you and your Users a non-exclusive, non-sublicensable, non-transferable right during the term of this Agreement to access and use the Comfy Products as set forth in the applicable Order Form for your internal business purposes.'
  },
  'tos.comfy-products.block.2.heading': {
    en: 'Customer Data.',
    'zh-CN': 'Customer Data.'
  },
  'tos.comfy-products.block.3': {
    en: 'As between Comfy and Customer, Customer retains all right, title, and interest in and to any data, images, videos, prompts, models, workflows, nodes, parameters, or other materials submitted or uploaded by Customer to the Comfy Products (“Input”), as well as any images, videos, designs, or other visual content generated through Customer’s use of the Comfy Products as a result of processing Customer’s Input (“Output”). Customer acknowledges that due to the nature of artificial intelligence, Comfy may generate the same or similar Output for other customers, and Customer shall have no right, title, or interest in or to Output generated for any other customer.',
    'zh-CN':
      'As between Comfy and Customer, Customer retains all right, title, and interest in and to any data, images, videos, prompts, models, workflows, nodes, parameters, or other materials submitted or uploaded by Customer to the Comfy Products (“Input”), as well as any images, videos, designs, or other visual content generated through Customer’s use of the Comfy Products as a result of processing Customer’s Input (“Output”). Customer acknowledges that due to the nature of artificial intelligence, Comfy may generate the same or similar Output for other customers, and Customer shall have no right, title, or interest in or to Output generated for any other customer.'
  },
  'tos.comfy-products.block.4.heading': {
    en: 'No AI Training.',
    'zh-CN': 'No AI Training.'
  },
  'tos.comfy-products.block.5': {
    en: 'Comfy will not use Input or Output to train generative AI or diffusion models. Comfy may, however, collect and use limited metadata derived from Customer’s use of the Comfy Products, such as prompt classifications, workflow structures, and node configurations, to improve the performance, functionality, and user experience of the Comfy Products.',
    'zh-CN':
      'Comfy will not use Input or Output to train generative AI or diffusion models. Comfy may, however, collect and use limited metadata derived from Customer’s use of the Comfy Products, such as prompt classifications, workflow structures, and node configurations, to improve the performance, functionality, and user experience of the Comfy Products.'
  },
  'tos.comfy-products.block.6.heading': {
    en: 'Comfy OSS.',
    'zh-CN': 'Comfy OSS.'
  },
  'tos.comfy-products.block.7': {
    en: 'You may use Comfy OSS under the terms of the applicable Open Source License(s) governing each respective component, as identified in the corresponding source code repository, rather than under these Terms. Nothing in these Terms shall be construed to limit, supersede, or modify any rights or obligations arising under an applicable Open Source License. If you choose to use the Comfy Products in conjunction with Comfy OSS, these Terms apply solely to your use of the Comfy Products and not to the Comfy OSS itself.',
    'zh-CN':
      'You may use Comfy OSS under the terms of the applicable Open Source License(s) governing each respective component, as identified in the corresponding source code repository, rather than under these Terms. Nothing in these Terms shall be construed to limit, supersede, or modify any rights or obligations arising under an applicable Open Source License. If you choose to use the Comfy Products in conjunction with Comfy OSS, these Terms apply solely to your use of the Comfy Products and not to the Comfy OSS itself.'
  },
  'tos.comfy-products.block.8.heading': {
    en: 'Partner Nodes.',
    'zh-CN': 'Partner Nodes.'
  },
  'tos.comfy-products.block.9': {
    en: 'Certain features of the Comfy Products allow you to access third-party AI model providers (“Partner Nodes”) through Comfy. When you use a Partner Node, Comfy proxies your request to the applicable third-party provider, transmitting the information necessary to fulfill your request, including prompts, images, models, and parameters. Comfy does not transmit your identity or account information to third-party providers in connection with Partner Node requests. Your use of Partner Nodes is subject to the terms and policies of the applicable third-party provider, and Comfy is not responsible for the data practices of such providers. Usage of Partner Nodes is metered and billed through Comfy.',
    'zh-CN':
      'Certain features of the Comfy Products allow you to access third-party AI model providers (“Partner Nodes”) through Comfy. When you use a Partner Node, Comfy proxies your request to the applicable third-party provider, transmitting the information necessary to fulfill your request, including prompts, images, models, and parameters. Comfy does not transmit your identity or account information to third-party providers in connection with Partner Node requests. Your use of Partner Nodes is subject to the terms and policies of the applicable third-party provider, and Comfy is not responsible for the data practices of such providers. Usage of Partner Nodes is metered and billed through Comfy.'
  },
  'tos.comfy-products.block.10.heading': {
    en: 'Modification of Comfy Products.',
    'zh-CN': 'Modification of Comfy Products.'
  },
  'tos.comfy-products.block.11': {
    en: 'Comfy may, at any time and in its sole discretion, modify, update, enhance, restrict, suspend, or discontinue the Comfy Products, in whole or in part, including by changing or removing features, functionality, endpoints, specifications, documentation, access methods, usage limits, or availability. Comfy has no obligation to maintain or support any particular version of the Comfy Products or to ensure backward compatibility. Any such modifications may be made with or without notice and may result in interruptions to or degradation of the Comfy Products. Comfy shall have no liability arising out of or related to any modification, suspension, or discontinuation of the Comfy Products, and Customer acknowledges that its use of the Comfy Products is at its own risk and that it should not rely on the continued availability of any aspect of the Comfy Products.',
    'zh-CN':
      'Comfy may, at any time and in its sole discretion, modify, update, enhance, restrict, suspend, or discontinue the Comfy Products, in whole or in part, including by changing or removing features, functionality, endpoints, specifications, documentation, access methods, usage limits, or availability. Comfy has no obligation to maintain or support any particular version of the Comfy Products or to ensure backward compatibility. Any such modifications may be made with or without notice and may result in interruptions to or degradation of the Comfy Products. Comfy shall have no liability arising out of or related to any modification, suspension, or discontinuation of the Comfy Products, and Customer acknowledges that its use of the Comfy Products is at its own risk and that it should not rely on the continued availability of any aspect of the Comfy Products.'
  },
  'tos.comfy-products.block.12.heading': {
    en: 'Data Retention and Deletion.',
    'zh-CN': 'Data Retention and Deletion.'
  },
  'tos.comfy-products.block.13': {
    en: 'Comfy retains Customer Data for as long as your account remains active or as otherwise necessary to provide the Comfy Products, comply with applicable legal obligations, resolve disputes, and enforce this Agreement. Specific retention periods for different categories of Customer Data are set forth in Comfy’s retention documentation, available at <a href="https://docs.comfy.org/support/data-retention" class="text-white underline">docs.comfy.org/support/data-retention</a>, as updated from time to time. You may request deletion of your account and associated Customer Data by contacting Comfy at <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a>. Upon receipt of a verified deletion request, Comfy will use commercially reasonable efforts to delete or de-identify your personal information from its primary systems within a reasonable time. You acknowledge that: (i) deletion may not propagate immediately to all backup systems, third-party analytics providers, or observability systems, which retain data subject to their own retention policies; (ii) certain Customer Data may be retained as required by applicable law or for legitimate business purposes such as billing records; and (iii) aggregated or de-identified data derived from your use of the Comfy Products may be retained indefinitely.',
    'zh-CN':
      'Comfy retains Customer Data for as long as your account remains active or as otherwise necessary to provide the Comfy Products, comply with applicable legal obligations, resolve disputes, and enforce this Agreement. Specific retention periods for different categories of Customer Data are set forth in Comfy’s retention documentation, available at <a href="https://docs.comfy.org/support/data-retention" class="text-white underline">docs.comfy.org/support/data-retention</a>, as updated from time to time. You may request deletion of your account and associated Customer Data by contacting Comfy at <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a>. Upon receipt of a verified deletion request, Comfy will use commercially reasonable efforts to delete or de-identify your personal information from its primary systems within a reasonable time. You acknowledge that: (i) deletion may not propagate immediately to all backup systems, third-party analytics providers, or observability systems, which retain data subject to their own retention policies; (ii) certain Customer Data may be retained as required by applicable law or for legitimate business purposes such as billing records; and (iii) aggregated or de-identified data derived from your use of the Comfy Products may be retained indefinitely.'
  },

  'tos.customer-responsibilities.label': {
    en: 'RESPONSIBILITIES',
    'zh-CN': 'RESPONSIBILITIES'
  },
  'tos.customer-responsibilities.title': {
    en: '3. Customer Responsibilities',
    'zh-CN': '3. Customer Responsibilities'
  },
  'tos.customer-responsibilities.block.0.heading': {
    en: 'Registration.',
    'zh-CN': 'Registration.'
  },
  'tos.customer-responsibilities.block.1': {
    en: 'In order to access and use the Comfy Products, you may be required to register an account by providing us with your email and other information requested in our registration form. You agree to provide us with complete and accurate registration information. You may not attempt to impersonate another person in registration. If you are registering on behalf of an organization, you warrant that you are authorized to agree to this Agreement on their behalf. You agree to be responsible for the security of your account. You accept that you are solely responsible for all activities that take place through your account, and that failure to limit access to your devices or systems may permit unauthorized use by third parties.',
    'zh-CN':
      'In order to access and use the Comfy Products, you may be required to register an account by providing us with your email and other information requested in our registration form. You agree to provide us with complete and accurate registration information. You may not attempt to impersonate another person in registration. If you are registering on behalf of an organization, you warrant that you are authorized to agree to this Agreement on their behalf. You agree to be responsible for the security of your account. You accept that you are solely responsible for all activities that take place through your account, and that failure to limit access to your devices or systems may permit unauthorized use by third parties.'
  },
  'tos.customer-responsibilities.block.2.heading': {
    en: 'General Technology Restrictions.',
    'zh-CN': 'General Technology Restrictions.'
  },
  'tos.customer-responsibilities.block.3': {
    en: 'You agree that you will not, directly or indirectly: (i) sublicense the Comfy Products for use by a third party; (ii) reverse engineer or attempt to extract the source code or underlying methodology from the Comfy Products or any related software, except to the extent that this restriction is expressly prohibited by Applicable Laws; (iii) use or facilitate the use of the Comfy Products for any activities that are prohibited by Applicable Laws or otherwise; (iv) bypass or circumvent measures employed to prevent or limit access to the Comfy Products; (v) use the Comfy Products to create a product or service competitive with Comfy’s products or services; (vi) create derivative works of or otherwise create, attempt to create or derive, or knowingly assist any third party to create or derive, the source code underlying the Comfy Products; or (vii) otherwise use or interact with the Comfy Products for any purpose not expressly permitted under this Agreement.',
    'zh-CN':
      'You agree that you will not, directly or indirectly: (i) sublicense the Comfy Products for use by a third party; (ii) reverse engineer or attempt to extract the source code or underlying methodology from the Comfy Products or any related software, except to the extent that this restriction is expressly prohibited by Applicable Laws; (iii) use or facilitate the use of the Comfy Products for any activities that are prohibited by Applicable Laws or otherwise; (iv) bypass or circumvent measures employed to prevent or limit access to the Comfy Products; (v) use the Comfy Products to create a product or service competitive with Comfy’s products or services; (vi) create derivative works of or otherwise create, attempt to create or derive, or knowingly assist any third party to create or derive, the source code underlying the Comfy Products; or (vii) otherwise use or interact with the Comfy Products for any purpose not expressly permitted under this Agreement.'
  },
  'tos.customer-responsibilities.block.4.heading': {
    en: 'Acceptable Use; Prohibited Customer Data.',
    'zh-CN': 'Acceptable Use; Prohibited Customer Data.'
  },
  'tos.customer-responsibilities.block.5': {
    en: 'Customer is solely responsible for ensuring that all Input submitted to the Comfy Products complies with all Applicable Laws, and Customer agrees that it will not, and will not permit any third party to submit to Comfy or the Comfy Products or otherwise use the Comfy Products to create: (i) any data, designs, or other materials subject to U.S. export control laws and regulations; (ii) any viruses, malware, ransomware, Trojan horses, worms, spyware, or other malicious or harmful code or content that could damage, disrupt, interfere with, or compromise the Comfy Products, Comfy’s systems or infrastructure, or the data or systems of any other user or third party; (iii) any Customer Data that depicts, promotes, or facilitates illegal activity, including without limitation child sexual abuse material, non-consensual intimate imagery, or content that incites violence or hatred against any individual or group; (iv) any Customer Data that infringes or misappropriates the intellectual property rights, privacy rights, or publicity rights of any third party, including without limitation by submitting models, images, or other materials without the right to do so; (v) any content or information that is intentionally deceptive or misleading, including without limitation synthetic media designed to impersonate a real individual without their consent; or (vi) any Customer Data that could reasonably be expected to cause harm to any individual or group.',
    'zh-CN':
      'Customer is solely responsible for ensuring that all Input submitted to the Comfy Products complies with all Applicable Laws, and Customer agrees that it will not, and will not permit any third party to submit to Comfy or the Comfy Products or otherwise use the Comfy Products to create: (i) any data, designs, or other materials subject to U.S. export control laws and regulations; (ii) any viruses, malware, ransomware, Trojan horses, worms, spyware, or other malicious or harmful code or content that could damage, disrupt, interfere with, or compromise the Comfy Products, Comfy’s systems or infrastructure, or the data or systems of any other user or third party; (iii) any Customer Data that depicts, promotes, or facilitates illegal activity, including without limitation child sexual abuse material, non-consensual intimate imagery, or content that incites violence or hatred against any individual or group; (iv) any Customer Data that infringes or misappropriates the intellectual property rights, privacy rights, or publicity rights of any third party, including without limitation by submitting models, images, or other materials without the right to do so; (v) any content or information that is intentionally deceptive or misleading, including without limitation synthetic media designed to impersonate a real individual without their consent; or (vi) any Customer Data that could reasonably be expected to cause harm to any individual or group.'
  },

  'tos.payment.label': { en: 'PAYMENT', 'zh-CN': 'PAYMENT' },
  'tos.payment.title': { en: '4. Payment', 'zh-CN': '4. Payment' },
  'tos.payment.block.0.heading': {
    en: 'Plans; Fees; Free Tier.',
    'zh-CN': 'Plans; Fees; Free Tier.'
  },
  'tos.payment.block.1': {
    en: 'Your use of the Comfy Products is subject to the plan selected via the applicable ordering page, online sign-up flow, or order form (“Plan”). Comfy may offer a free or freemium tier (“Free Tier”) and one or more paid tiers; the applicable Plan may include usage caps, feature restrictions, throttling, overage charges, or upgrade requirements, each as described in the pricing page or applicable Order Form. If a Free Tier user provides a valid payment method in connection with their account (including for identity verification, future upgrade purposes, or any other reason), such user expressly authorizes Comfy to charge that payment method for any usage that exceeds the applicable Free Tier limits, including overages resulting from intentional use, usage by authorized users or third parties under the account, or technical factors. Comfy will use reasonable efforts to notify users when they approach or exceed Free Tier limits, but such notice is not a condition of Comfy’s right to charge for overages. You are responsible for all usage under your account, including usage by your Users and under your credentials and API keys. Comfy may modify, suspend, or discontinue any Plan (including the Free Tier) consistent with this Agreement and the Order Forms.',
    'zh-CN':
      'Your use of the Comfy Products is subject to the plan selected via the applicable ordering page, online sign-up flow, or order form (“Plan”). Comfy may offer a free or freemium tier (“Free Tier”) and one or more paid tiers; the applicable Plan may include usage caps, feature restrictions, throttling, overage charges, or upgrade requirements, each as described in the pricing page or applicable Order Form. If a Free Tier user provides a valid payment method in connection with their account (including for identity verification, future upgrade purposes, or any other reason), such user expressly authorizes Comfy to charge that payment method for any usage that exceeds the applicable Free Tier limits, including overages resulting from intentional use, usage by authorized users or third parties under the account, or technical factors. Comfy will use reasonable efforts to notify users when they approach or exceed Free Tier limits, but such notice is not a condition of Comfy’s right to charge for overages. You are responsible for all usage under your account, including usage by your Users and under your credentials and API keys. Comfy may modify, suspend, or discontinue any Plan (including the Free Tier) consistent with this Agreement and the Order Forms.'
  },
  'tos.payment.block.2.heading': {
    en: 'Self-Serve Credit Card Billing.',
    'zh-CN': 'Self-Serve Credit Card Billing.'
  },
  'tos.payment.block.3': {
    en: 'For self-serve Plans, Customer will provide a valid payment method (e.g., credit card) and authorizes Comfy (and its payment processor) to charge all fees and taxes when due. Unless the Order Forms state otherwise, subscription components (if any) will be billed in advance on a recurring basis and usage-based components (including any overages) will be billed in arrears for the applicable billing period (and may be charged as usage accrues). This billing authorization applies regardless of whether the Customer is on a paid Plan or a Free Tier at the time the overage is incurred. Paid self-serve Plans automatically renew for successive billing periods until cancelled through the console or as otherwise described in the Order Forms; if a charge fails, Comfy may retry the charge and Customer must promptly update its payment method. The same retry rights apply to any failed overage charges incurred by Free Tier users.',
    'zh-CN':
      'For self-serve Plans, Customer will provide a valid payment method (e.g., credit card) and authorizes Comfy (and its payment processor) to charge all fees and taxes when due. Unless the Order Forms state otherwise, subscription components (if any) will be billed in advance on a recurring basis and usage-based components (including any overages) will be billed in arrears for the applicable billing period (and may be charged as usage accrues). This billing authorization applies regardless of whether the Customer is on a paid Plan or a Free Tier at the time the overage is incurred. Paid self-serve Plans automatically renew for successive billing periods until cancelled through the console or as otherwise described in the Order Forms; if a charge fails, Comfy may retry the charge and Customer must promptly update its payment method. The same retry rights apply to any failed overage charges incurred by Free Tier users.'
  },
  'tos.payment.block.4.heading': {
    en: 'Invoiced Billing.',
    'zh-CN': 'Invoiced Billing.'
  },
  'tos.payment.block.5': {
    en: 'If Comfy approves invoiced billing for Customer, Comfy will invoice Customer in accordance with the applicable Order Form, and Customer will pay all undisputed amounts within thirty (30) days of the invoice date. Any purchase Order Forms are for administrative convenience only and will not modify this Agreement. Customer will notify Comfy in writing of any good-faith dispute regarding an invoice within thirty (30) days of the invoice date and will timely pay all undisputed amounts while the parties work to resolve the dispute.',
    'zh-CN':
      'If Comfy approves invoiced billing for Customer, Comfy will invoice Customer in accordance with the applicable Order Form, and Customer will pay all undisputed amounts within thirty (30) days of the invoice date. Any purchase Order Forms are for administrative convenience only and will not modify this Agreement. Customer will notify Comfy in writing of any good-faith dispute regarding an invoice within thirty (30) days of the invoice date and will timely pay all undisputed amounts while the parties work to resolve the dispute.'
  },
  'tos.payment.block.6.heading': {
    en: 'Prepaid Credits.',
    'zh-CN': 'Prepaid Credits.'
  },
  'tos.payment.block.7': {
    en: 'Customer may prepay for usage credits (“Credits”) which may be applied toward usage of the Comfy Products at the rates set forth on Comfy’s pricing page. Except for documented billing errors or similar service issues attributed to Comfy, all purchases of Credits are final and non-refundable, and Comfy will not issue refunds or credits for any unused, partially used, or remaining Credits under any circumstances, including upon termination or expiration of Customer’s account. Comfy reserves the right to modify the pricing or Credit redemption rates applicable to future Credit purchases upon reasonable notice, but any Credits purchased prior to such modification will be honored at the rates in effect at the time of purchase.',
    'zh-CN':
      'Customer may prepay for usage credits (“Credits”) which may be applied toward usage of the Comfy Products at the rates set forth on Comfy’s pricing page. Except for documented billing errors or similar service issues attributed to Comfy, all purchases of Credits are final and non-refundable, and Comfy will not issue refunds or credits for any unused, partially used, or remaining Credits under any circumstances, including upon termination or expiration of Customer’s account. Comfy reserves the right to modify the pricing or Credit redemption rates applicable to future Credit purchases upon reasonable notice, but any Credits purchased prior to such modification will be honored at the rates in effect at the time of purchase.'
  },
  'tos.payment.block.8.heading': {
    en: 'Taxes; Price Changes; No Refunds.',
    'zh-CN': 'Taxes; Price Changes; No Refunds.'
  },
  'tos.payment.block.9': {
    en: 'Fees are exclusive of all taxes, duties, levies, and similar governmental assessments (including sales, use, VAT/GST, and withholding taxes), and Customer is responsible for all such amounts other than taxes based on Comfy’s net income; if withholding is required by law, Customer will gross up payments so Comfy receives the invoiced amount, unless prohibited by law. Comfy may change fees or introduce new fees upon prior notice (including by posting to the pricing page or in-product notice), effective as of the next billing period or as otherwise stated in the notice. Except as required by law or expressly stated in the Order Forms, all fees are non-cancellable and non-refundable.',
    'zh-CN':
      'Fees are exclusive of all taxes, duties, levies, and similar governmental assessments (including sales, use, VAT/GST, and withholding taxes), and Customer is responsible for all such amounts other than taxes based on Comfy’s net income; if withholding is required by law, Customer will gross up payments so Comfy receives the invoiced amount, unless prohibited by law. Comfy may change fees or introduce new fees upon prior notice (including by posting to the pricing page or in-product notice), effective as of the next billing period or as otherwise stated in the notice. Except as required by law or expressly stated in the Order Forms, all fees are non-cancellable and non-refundable.'
  },
  'tos.payment.block.10.heading': {
    en: 'Late Payments; Suspension.',
    'zh-CN': 'Late Payments; Suspension.'
  },
  'tos.payment.block.11': {
    en: 'Overdue undisputed amounts may accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law, plus reasonable collection costs. Comfy may suspend or limit access to the Comfy Products (including throttling, disabling API keys, or downgrading to the Free Tier) for non-payment of undisputed amounts after providing commercially reasonable notice and an opportunity to cure, unless Comfy reasonably determines immediate suspension is necessary to protect the Comfy Products or comply with Applicable Laws.',
    'zh-CN':
      'Overdue undisputed amounts may accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law, plus reasonable collection costs. Comfy may suspend or limit access to the Comfy Products (including throttling, disabling API keys, or downgrading to the Free Tier) for non-payment of undisputed amounts after providing commercially reasonable notice and an opportunity to cure, unless Comfy reasonably determines immediate suspension is necessary to protect the Comfy Products or comply with Applicable Laws.'
  },

  'tos.term-termination.label': {
    en: 'TERM; TERMINATION',
    'zh-CN': 'TERM; TERMINATION'
  },
  'tos.term-termination.title': {
    en: '5. Term; Termination',
    'zh-CN': '5. Term; Termination'
  },
  'tos.term-termination.block.0.heading': {
    en: 'Termination of Agreement.',
    'zh-CN': 'Termination of Agreement.'
  },
  'tos.term-termination.block.1': {
    en: 'You may stop using the Comfy Products at any time with or without notice. This Agreement will remain in effect until terminated in accordance with this Section. Either party may terminate this Agreement for convenience upon written notice to the other; provided, however, that to the extent the parties have entered into one or more executed Order Forms with a stated term, such Order Form will remain in effect for its stated term unless earlier terminated in accordance with its terms or this Agreement, and termination of this Agreement will not, by itself, terminate any then-effective Order Form.',
    'zh-CN':
      'You may stop using the Comfy Products at any time with or without notice. This Agreement will remain in effect until terminated in accordance with this Section. Either party may terminate this Agreement for convenience upon written notice to the other; provided, however, that to the extent the parties have entered into one or more executed Order Forms with a stated term, such Order Form will remain in effect for its stated term unless earlier terminated in accordance with its terms or this Agreement, and termination of this Agreement will not, by itself, terminate any then-effective Order Form.'
  },
  'tos.term-termination.block.2.heading': {
    en: 'Effect of Termination.',
    'zh-CN': 'Effect of Termination.'
  },
  'tos.term-termination.block.3': {
    en: 'Upon any termination or expiration of an Order Form (or this Agreement, if no Order Form is then in effect), Customer will promptly cease all use of the Comfy Products under the terminated arrangement and, if applicable, any continued use must be pursuant to a then-effective Order Form or other written authorization from Comfy. Comfy may suspend or terminate Customer’s access to the Comfy Products, or discontinue the Comfy Products or any portion or feature thereof, at any time; provided that Comfy will not terminate an unexpired Order Form for convenience unless the applicable Order Form expressly permits it, and any suspension or termination may be implemented immediately if Comfy reasonably determines that Customer’s use poses a security risk, violates this Agreement, or materially degrades the Comfy Products. Except as expressly set forth in an Order Form, Comfy will have no liability or other obligation to Customer arising out of or relating to any termination, suspension, or discontinuance under this Section.',
    'zh-CN':
      'Upon any termination or expiration of an Order Form (or this Agreement, if no Order Form is then in effect), Customer will promptly cease all use of the Comfy Products under the terminated arrangement and, if applicable, any continued use must be pursuant to a then-effective Order Form or other written authorization from Comfy. Comfy may suspend or terminate Customer’s access to the Comfy Products, or discontinue the Comfy Products or any portion or feature thereof, at any time; provided that Comfy will not terminate an unexpired Order Form for convenience unless the applicable Order Form expressly permits it, and any suspension or termination may be implemented immediately if Comfy reasonably determines that Customer’s use poses a security risk, violates this Agreement, or materially degrades the Comfy Products. Except as expressly set forth in an Order Form, Comfy will have no liability or other obligation to Customer arising out of or relating to any termination, suspension, or discontinuance under this Section.'
  },
  'tos.term-termination.block.4.heading': {
    en: 'Survival.',
    'zh-CN': 'Survival.'
  },
  'tos.term-termination.block.5': {
    en: 'Termination or expiration will not affect any rights or obligations, including the payment of amounts due, which have accrued under this Agreement up to the date of termination or expiration. Upon termination or expiration of this Agreement, the provisions that are intended by their nature to survive termination will survive and continue in full force and effect in accordance with their terms, including confidentiality obligations, proprietary rights, indemnification, limitations of liability, and disclaimers.',
    'zh-CN':
      'Termination or expiration will not affect any rights or obligations, including the payment of amounts due, which have accrued under this Agreement up to the date of termination or expiration. Upon termination or expiration of this Agreement, the provisions that are intended by their nature to survive termination will survive and continue in full force and effect in accordance with their terms, including confidentiality obligations, proprietary rights, indemnification, limitations of liability, and disclaimers.'
  },

  'tos.confidentiality.label': {
    en: 'CONFIDENTIALITY',
    'zh-CN': 'CONFIDENTIALITY'
  },
  'tos.confidentiality.title': {
    en: '6. Confidentiality',
    'zh-CN': '6. Confidentiality'
  },
  'tos.confidentiality.block.0.heading': {
    en: 'Definition of Confidential Information.',
    'zh-CN': 'Definition of Confidential Information.'
  },
  'tos.confidentiality.block.1': {
    en: '“Confidential Information” means all non-public information disclosed by a party (“Disclosing Party”) to the other party (“Receiving Party”), whether oral or written, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. Confidential Information of Customer includes Customer Data; Confidential Information of Comfy includes the Comfy Products; and each party’s Confidential Information includes the terms of this Agreement and any Order Forms (including pricing), as well as business, financial, marketing, technical, and product information. Confidential Information excludes information that the Receiving Party can demonstrate: (i) is or becomes publicly available without breach; (ii) was known prior to disclosure without breach; (iii) is received from a third party without breach; or (iv) was independently developed without use of or reference to the Disclosing Party’s Confidential Information.',
    'zh-CN':
      '“Confidential Information” means all non-public information disclosed by a party (“Disclosing Party”) to the other party (“Receiving Party”), whether oral or written, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. Confidential Information of Customer includes Customer Data; Confidential Information of Comfy includes the Comfy Products; and each party’s Confidential Information includes the terms of this Agreement and any Order Forms (including pricing), as well as business, financial, marketing, technical, and product information. Confidential Information excludes information that the Receiving Party can demonstrate: (i) is or becomes publicly available without breach; (ii) was known prior to disclosure without breach; (iii) is received from a third party without breach; or (iv) was independently developed without use of or reference to the Disclosing Party’s Confidential Information.'
  },
  'tos.confidentiality.block.2.heading': {
    en: 'Protection of Confidential Information.',
    'zh-CN': 'Protection of Confidential Information.'
  },
  'tos.confidentiality.block.3': {
    en: 'The Receiving Party will: (a) protect Confidential Information using at least reasonable care; (b) use it solely to perform under this Agreement; and (c) limit access to its and its Affiliates’ employees and contractors with a need to know and confidentiality obligations at least as protective as those herein. Neither party may disclose the terms of this Agreement or any Order Form except to its Affiliates, legal counsel, or accountants, and remains responsible for their compliance. Upon written request, the Receiving Party will promptly return or destroy Confidential Information, except for information retained in routine backups or as required by law or internal retention policies.',
    'zh-CN':
      'The Receiving Party will: (a) protect Confidential Information using at least reasonable care; (b) use it solely to perform under this Agreement; and (c) limit access to its and its Affiliates’ employees and contractors with a need to know and confidentiality obligations at least as protective as those herein. Neither party may disclose the terms of this Agreement or any Order Form except to its Affiliates, legal counsel, or accountants, and remains responsible for their compliance. Upon written request, the Receiving Party will promptly return or destroy Confidential Information, except for information retained in routine backups or as required by law or internal retention policies.'
  },
  'tos.confidentiality.block.4.heading': {
    en: 'Compelled Disclosure.',
    'zh-CN': 'Compelled Disclosure.'
  },
  'tos.confidentiality.block.5': {
    en: 'The Receiving Party may disclose Confidential Information if legally required, provided it gives prior notice (where permitted) and reasonable assistance, at the Disclosing Party’s expense, to seek protective treatment. Any disclosure will be limited to what is legally required, and the Receiving Party will request confidential treatment. These obligations survive while Confidential Information remains in the Receiving Party’s possession.',
    'zh-CN':
      'The Receiving Party may disclose Confidential Information if legally required, provided it gives prior notice (where permitted) and reasonable assistance, at the Disclosing Party’s expense, to seek protective treatment. Any disclosure will be limited to what is legally required, and the Receiving Party will request confidential treatment. These obligations survive while Confidential Information remains in the Receiving Party’s possession.'
  },
  'tos.confidentiality.block.6.heading': {
    en: 'Data Security.',
    'zh-CN': 'Data Security.'
  },
  'tos.confidentiality.block.7': {
    en: 'Comfy will implement and maintain commercially reasonable administrative, technical, and physical safeguards designed to protect Customer Data against unauthorized access, disclosure, alteration, or destruction. These measures will be no less protective than those Comfy uses to protect its own confidential information of a similar nature. In the event Comfy becomes aware of a confirmed security breach that results in unauthorized access to or disclosure of Customer Data, Comfy will notify Customer without undue delay and will provide reasonable cooperation to assist Customer in investigating and mitigating the effects of such breach. Customer acknowledges that no security measures are perfect or impenetrable, and Comfy does not guarantee that Customer Data will be free from unauthorized access or disclosure.',
    'zh-CN':
      'Comfy will implement and maintain commercially reasonable administrative, technical, and physical safeguards designed to protect Customer Data against unauthorized access, disclosure, alteration, or destruction. These measures will be no less protective than those Comfy uses to protect its own confidential information of a similar nature. In the event Comfy becomes aware of a confirmed security breach that results in unauthorized access to or disclosure of Customer Data, Comfy will notify Customer without undue delay and will provide reasonable cooperation to assist Customer in investigating and mitigating the effects of such breach. Customer acknowledges that no security measures are perfect or impenetrable, and Comfy does not guarantee that Customer Data will be free from unauthorized access or disclosure.'
  },

  'tos.proprietary-rights.label': {
    en: 'PROPRIETARY RIGHTS',
    'zh-CN': 'PROPRIETARY RIGHTS'
  },
  'tos.proprietary-rights.title': {
    en: '7. Proprietary Rights',
    'zh-CN': '7. Proprietary Rights'
  },
  'tos.proprietary-rights.block.0.heading': {
    en: 'Reservation of Rights.',
    'zh-CN': 'Reservation of Rights.'
  },
  'tos.proprietary-rights.block.1': {
    en: 'Comfy and its licensors retain all right, title, and interest, including all intellectual property and proprietary rights, in and to the Comfy Products, Comfy Branding, and all software, code, algorithms, protocols, interfaces, tools, documentation, data structures, and other technology underlying or embodied in, or used to provide, the Comfy Products (collectively, “Comfy Materials”). Except for the limited rights expressly granted to Customer under this Agreement, no rights or licenses are granted, whether by implication, estoppel, or otherwise. Comfy expressly reserves all rights in and to the Comfy Materials not expressly granted hereunder.',
    'zh-CN':
      'Comfy and its licensors retain all right, title, and interest, including all intellectual property and proprietary rights, in and to the Comfy Products, Comfy Branding, and all software, code, algorithms, protocols, interfaces, tools, documentation, data structures, and other technology underlying or embodied in, or used to provide, the Comfy Products (collectively, “Comfy Materials”). Except for the limited rights expressly granted to Customer under this Agreement, no rights or licenses are granted, whether by implication, estoppel, or otherwise. Comfy expressly reserves all rights in and to the Comfy Materials not expressly granted hereunder.'
  },
  'tos.proprietary-rights.block.2.heading': {
    en: 'Feedback.',
    'zh-CN': 'Feedback.'
  },
  'tos.proprietary-rights.block.3': {
    en: 'You may from time to time provide feedback (including suggestions, comments for enhancements, functionality or usability, etc.) (“Feedback”) to Comfy regarding your experience using, and needs and integration requirements for, the Comfy Products. Comfy shall have full discretion to determine whether or not to proceed with the development of any requested enhancements, new features or functionality, and you hereby grant Comfy the full, unencumbered, royalty-free right to incorporate and otherwise fully exploit Feedback in connection with Comfy’s products and services.',
    'zh-CN':
      'You may from time to time provide feedback (including suggestions, comments for enhancements, functionality or usability, etc.) (“Feedback”) to Comfy regarding your experience using, and needs and integration requirements for, the Comfy Products. Comfy shall have full discretion to determine whether or not to proceed with the development of any requested enhancements, new features or functionality, and you hereby grant Comfy the full, unencumbered, royalty-free right to incorporate and otherwise fully exploit Feedback in connection with Comfy’s products and services.'
  },
  'tos.proprietary-rights.block.4.heading': {
    en: 'Operational Metadata.',
    'zh-CN': 'Operational Metadata.'
  },
  'tos.proprietary-rights.block.5': {
    en: 'Customer agrees that Comfy may collect and use Operational Metadata to operate, maintain, improve, and support the Comfy Products, including for diagnostics, analytics, system performance, and reporting purposes. Comfy will only disclose Operational Metadata externally if such data is (a) aggregated or anonymized with data across other customers, and (b) does not disclose the identity of Customer or any Customer Confidential Information.',
    'zh-CN':
      'Customer agrees that Comfy may collect and use Operational Metadata to operate, maintain, improve, and support the Comfy Products, including for diagnostics, analytics, system performance, and reporting purposes. Comfy will only disclose Operational Metadata externally if such data is (a) aggregated or anonymized with data across other customers, and (b) does not disclose the identity of Customer or any Customer Confidential Information.'
  },

  'tos.disclaimer.label': { en: 'DISCLAIMER', 'zh-CN': 'DISCLAIMER' },
  'tos.disclaimer.title': { en: '8. Disclaimer', 'zh-CN': '8. Disclaimer' },
  'tos.disclaimer.block.0': {
    en: 'THE Comfy Products AND OUTPUT ARE PROVIDED “AS IS” WITHOUT ANY WARRANTY OF ANY KIND. Comfy DISCLAIMS ANY AND ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS RELATING TO THE Comfy Products (INCLUDING ANY OUTPUT), WHETHER EXPRESS, IMPLIED, INCLUDING, BUT NOT LIMITED TO, ANY REPRESENTATION, WARRANTY, OR CONDITION OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE OR NON-INFRINGEMENT. YOU AGREE AND ACKNOWLEDGE THAT YOUR USE OF ANY OUTPUT PROVIDED BY THE Comfy Products IS AT YOUR OWN RISK.',
    'zh-CN':
      'THE Comfy Products AND OUTPUT ARE PROVIDED “AS IS” WITHOUT ANY WARRANTY OF ANY KIND. Comfy DISCLAIMS ANY AND ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS RELATING TO THE Comfy Products (INCLUDING ANY OUTPUT), WHETHER EXPRESS, IMPLIED, INCLUDING, BUT NOT LIMITED TO, ANY REPRESENTATION, WARRANTY, OR CONDITION OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE OR NON-INFRINGEMENT. YOU AGREE AND ACKNOWLEDGE THAT YOUR USE OF ANY OUTPUT PROVIDED BY THE Comfy Products IS AT YOUR OWN RISK.'
  },
  'tos.disclaimer.block.1': {
    en: 'Customer is solely responsible for (a) verifying the Output is appropriate for Customer’s use case, and (b) any decisions, actions, or omissions taken in reliance on the OUTPUT. in no event will Comfy be liable for any damages or losses arising from or related to Customer’s use of or reliance on the OUTPUT, including any decisions made or actions taken based on the OUTPUT.',
    'zh-CN':
      'Customer is solely responsible for (a) verifying the Output is appropriate for Customer’s use case, and (b) any decisions, actions, or omissions taken in reliance on the OUTPUT. in no event will Comfy be liable for any damages or losses arising from or related to Customer’s use of or reliance on the OUTPUT, including any decisions made or actions taken based on the OUTPUT.'
  },

  'tos.liability.label': { en: 'LIABILITY', 'zh-CN': 'LIABILITY' },
  'tos.liability.title': {
    en: '9. Limitation of Liability',
    'zh-CN': '9. Limitation of Liability'
  },
  'tos.liability.block.0': {
    en: 'WHEN PERMITTED BY LAW, COMFY, AND COMFY’S SUPPLIERS AND DISTRIBUTORS, WILL NOT BE RESPONSIBLE FOR LOST PROFITS, REVENUES, OR DATA; FINANCIAL LOSSES; OR INDIRECT, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES. TO THE EXTENT PERMITTED BY LAW, THE TOTAL LIABILITY OF Comfy, AND ITS SUPPLIERS AND DISTRIBUTORS, FOR ANY CLAIM UNDER THIS AGREEMENT, INCLUDING FOR ANY IMPLIED WARRANTIES, IS LIMITED TO THE GREATER OF (A) ONE THOUSAND DOLLARS ($1,000); AND (B) THE AMOUNTS PAID OR PAYABLE BY CUSTOMER IN THE SIX (6) MONTHS PRECEDING THE DATE OF THE CLAIM. IN ALL CASES, Comfy, AND ITS SUPPLIERS AND DISTRIBUTORS, WILL NOT BE LIABLE FOR ANY EXPENSE, LOSS, OR DAMAGE THAT IS NOT REASONABLY FORESEEABLE.',
    'zh-CN':
      'WHEN PERMITTED BY LAW, COMFY, AND COMFY’S SUPPLIERS AND DISTRIBUTORS, WILL NOT BE RESPONSIBLE FOR LOST PROFITS, REVENUES, OR DATA; FINANCIAL LOSSES; OR INDIRECT, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES. TO THE EXTENT PERMITTED BY LAW, THE TOTAL LIABILITY OF Comfy, AND ITS SUPPLIERS AND DISTRIBUTORS, FOR ANY CLAIM UNDER THIS AGREEMENT, INCLUDING FOR ANY IMPLIED WARRANTIES, IS LIMITED TO THE GREATER OF (A) ONE THOUSAND DOLLARS ($1,000); AND (B) THE AMOUNTS PAID OR PAYABLE BY CUSTOMER IN THE SIX (6) MONTHS PRECEDING THE DATE OF THE CLAIM. IN ALL CASES, Comfy, AND ITS SUPPLIERS AND DISTRIBUTORS, WILL NOT BE LIABLE FOR ANY EXPENSE, LOSS, OR DAMAGE THAT IS NOT REASONABLY FORESEEABLE.'
  },

  'tos.indemnification.label': {
    en: 'INDEMNIFICATION',
    'zh-CN': 'INDEMNIFICATION'
  },
  'tos.indemnification.title': {
    en: '10. Indemnification',
    'zh-CN': '10. Indemnification'
  },
  'tos.indemnification.block.0': {
    en: 'You agree to defend, indemnify, and hold harmless Comfy Organization, Inc. and its officers, directors, employees, contractors, and agents from and against any and all third-party claims, demands, actions, suits, or proceedings, and any resulting losses, damages, liabilities, costs, and expenses (including reasonable attorneys’ fees) to the extent resulting from your Customer Data or your breach of this Agreement. You must not settle any claim without Comfy’s prior written consent if the settlement would require Comfy to (a) admit fault, (b) pay any damages or other amounts, or (c) take or refrain from taking any action. Comfy may participate in a claim through counsel of its own choosing at its own expense, and you and Comfy will reasonably cooperate on the defense of any such claim.',
    'zh-CN':
      'You agree to defend, indemnify, and hold harmless Comfy Organization, Inc. and its officers, directors, employees, contractors, and agents from and against any and all third-party claims, demands, actions, suits, or proceedings, and any resulting losses, damages, liabilities, costs, and expenses (including reasonable attorneys’ fees) to the extent resulting from your Customer Data or your breach of this Agreement. You must not settle any claim without Comfy’s prior written consent if the settlement would require Comfy to (a) admit fault, (b) pay any damages or other amounts, or (c) take or refrain from taking any action. Comfy may participate in a claim through counsel of its own choosing at its own expense, and you and Comfy will reasonably cooperate on the defense of any such claim.'
  },

  'tos.dispute-resolution.label': {
    en: 'DISPUTE RESOLUTION',
    'zh-CN': 'DISPUTE RESOLUTION'
  },
  'tos.dispute-resolution.title': {
    en: '11. Governing Law and Dispute Resolution',
    'zh-CN': '11. Governing Law and Dispute Resolution'
  },
  'tos.dispute-resolution.block.0.heading': {
    en: 'Governing Law.',
    'zh-CN': 'Governing Law.'
  },
  'tos.dispute-resolution.block.1': {
    en: 'This Agreement and any dispute, claim, or controversy arising out of or relating to this Agreement, the Comfy Products, or the parties’ relationship (each, a “Dispute”), shall be governed by and construed in accordance with the laws of the State of California, without regard to conflict of laws principles that would result in the application of the laws of any other jurisdiction.',
    'zh-CN':
      'This Agreement and any dispute, claim, or controversy arising out of or relating to this Agreement, the Comfy Products, or the parties’ relationship (each, a “Dispute”), shall be governed by and construed in accordance with the laws of the State of California, without regard to conflict of laws principles that would result in the application of the laws of any other jurisdiction.'
  },
  'tos.dispute-resolution.block.2.heading': {
    en: 'Binding Arbitration; JAMS.',
    'zh-CN': 'Binding Arbitration; JAMS.'
  },
  'tos.dispute-resolution.block.3': {
    en: 'Except as expressly set forth in Section 11(c) (Exceptions; Injunctive Relief), any Dispute shall be finally resolved by binding arbitration administered by JAMS in accordance with the JAMS Comprehensive Arbitration Rules and Procedures (or, if applicable, the JAMS Streamlined Arbitration Rules and Procedures), as in effect at the time the arbitration is commenced. The arbitration shall be seated in San Francisco, California, and conducted in English before one (1) arbitrator. Judgment on the award rendered by the arbitrator may be entered in any court of competent jurisdiction.',
    'zh-CN':
      'Except as expressly set forth in Section 11(c) (Exceptions; Injunctive Relief), any Dispute shall be finally resolved by binding arbitration administered by JAMS in accordance with the JAMS Comprehensive Arbitration Rules and Procedures (or, if applicable, the JAMS Streamlined Arbitration Rules and Procedures), as in effect at the time the arbitration is commenced. The arbitration shall be seated in San Francisco, California, and conducted in English before one (1) arbitrator. Judgment on the award rendered by the arbitrator may be entered in any court of competent jurisdiction.'
  },
  'tos.dispute-resolution.block.4.heading': {
    en: 'Exceptions; Injunctive Relief.',
    'zh-CN': 'Exceptions; Injunctive Relief.'
  },
  'tos.dispute-resolution.block.5': {
    en: 'Notwithstanding anything to the contrary, either party may seek temporary, preliminary, or permanent injunctive relief (or other equitable relief) in any court of competent jurisdiction located in San Francisco, CA to prevent or enjoin actual or threatened misuse, infringement, or misappropriation of its intellectual property rights, confidential information, or proprietary rights, without the necessity of posting bond or proving actual damages to the extent permitted by Applicable Law. In addition, either party may bring an individual claim in small claims court in San Francisco, CA, if the claim qualifies.',
    'zh-CN':
      'Notwithstanding anything to the contrary, either party may seek temporary, preliminary, or permanent injunctive relief (or other equitable relief) in any court of competent jurisdiction located in San Francisco, CA to prevent or enjoin actual or threatened misuse, infringement, or misappropriation of its intellectual property rights, confidential information, or proprietary rights, without the necessity of posting bond or proving actual damages to the extent permitted by Applicable Law. In addition, either party may bring an individual claim in small claims court in San Francisco, CA, if the claim qualifies.'
  },
  'tos.dispute-resolution.block.6.heading': {
    en: 'Class Action Waiver.',
    'zh-CN': 'Class Action Waiver.'
  },
  'tos.dispute-resolution.block.7': {
    en: 'To the fullest extent permitted by Applicable Law, the parties agree that any Dispute will be brought and resolved on an individual basis only, and not as a plaintiff or class member in any purported class, collective, consolidated, coordinated, or representative action or proceeding. The arbitrator may not consolidate claims or preside over any form of representative or class proceeding.',
    'zh-CN':
      'To the fullest extent permitted by Applicable Law, the parties agree that any Dispute will be brought and resolved on an individual basis only, and not as a plaintiff or class member in any purported class, collective, consolidated, coordinated, or representative action or proceeding. The arbitrator may not consolidate claims or preside over any form of representative or class proceeding.'
  },
  'tos.dispute-resolution.block.8.heading': {
    en: 'Waiver of Jury Trial.',
    'zh-CN': 'Waiver of Jury Trial.'
  },
  'tos.dispute-resolution.block.9': {
    en: 'To the fullest extent permitted by Applicable Law, each party hereby knowingly and irrevocably waives any right to a trial by jury in any action, proceeding, or counterclaim arising out of or relating to this Agreement or the Comfy Products.',
    'zh-CN':
      'To the fullest extent permitted by Applicable Law, each party hereby knowingly and irrevocably waives any right to a trial by jury in any action, proceeding, or counterclaim arising out of or relating to this Agreement or the Comfy Products.'
  },
  'tos.dispute-resolution.block.10.heading': {
    en: 'Exclusive Forum for Court Proceedings.',
    'zh-CN': 'Exclusive Forum for Court Proceedings.'
  },
  'tos.dispute-resolution.block.11': {
    en: 'To the extent any Dispute is not subject to arbitration under this Agreement, the parties agree to the exclusive jurisdiction and venue of the state and federal courts located in San Francisco, CA and each party irrevocably submits to such jurisdiction and venue and waives any objection based on inconvenient forum.',
    'zh-CN':
      'To the extent any Dispute is not subject to arbitration under this Agreement, the parties agree to the exclusive jurisdiction and venue of the state and federal courts located in San Francisco, CA and each party irrevocably submits to such jurisdiction and venue and waives any objection based on inconvenient forum.'
  },
  'tos.dispute-resolution.block.12.heading': {
    en: 'Confidentiality.',
    'zh-CN': 'Confidentiality.'
  },
  'tos.dispute-resolution.block.13': {
    en: 'The arbitration, including the existence of the arbitration, all materials submitted, and all testimony and awards, shall be confidential and may not be disclosed except as necessary to conduct the arbitration, to enforce an award, or as required by Applicable Law.',
    'zh-CN':
      'The arbitration, including the existence of the arbitration, all materials submitted, and all testimony and awards, shall be confidential and may not be disclosed except as necessary to conduct the arbitration, to enforce an award, or as required by Applicable Law.'
  },
  'tos.dispute-resolution.block.14.heading': {
    en: 'Time Limit.',
    'zh-CN': 'Time Limit.'
  },
  'tos.dispute-resolution.block.15': {
    en: 'To the fullest extent permitted by Applicable Law, any Dispute must be brought by you within one (1) year after the claim or cause of action first arose, or it is permanently barred.',
    'zh-CN':
      'To the fullest extent permitted by Applicable Law, any Dispute must be brought by you within one (1) year after the claim or cause of action first arose, or it is permanently barred.'
  },

  'tos.miscellaneous.label': { en: 'MISCELLANEOUS', 'zh-CN': 'MISCELLANEOUS' },
  'tos.miscellaneous.title': {
    en: '12. Miscellaneous',
    'zh-CN': '12. Miscellaneous'
  },
  'tos.miscellaneous.block.0.heading': {
    en: 'Export Compliance.',
    'zh-CN': 'Export Compliance.'
  },
  'tos.miscellaneous.block.1': {
    en: 'You will comply with the export laws and regulations of the United States, the European Union and other applicable jurisdictions in providing and using the Comfy Products.',
    'zh-CN':
      'You will comply with the export laws and regulations of the United States, the European Union and other applicable jurisdictions in providing and using the Comfy Products.'
  },
  'tos.miscellaneous.block.2.heading': {
    en: 'Publicity.',
    'zh-CN': 'Publicity.'
  },
  'tos.miscellaneous.block.3': {
    en: 'You agree that Comfy may refer to your name, logo, and trademarks in Comfy’s marketing materials and website; however, Comfy will not use your name or trademarks in any other publicity (e.g., press releases, customer references and case studies) without your prior written consent (which may be by email) not to be unreasonably withheld, conditioned, or delayed.',
    'zh-CN':
      'You agree that Comfy may refer to your name, logo, and trademarks in Comfy’s marketing materials and website; however, Comfy will not use your name or trademarks in any other publicity (e.g., press releases, customer references and case studies) without your prior written consent (which may be by email) not to be unreasonably withheld, conditioned, or delayed.'
  },
  'tos.miscellaneous.block.4.heading': {
    en: 'Third-Party Infrastructure.',
    'zh-CN': 'Third-Party Infrastructure.'
  },
  'tos.miscellaneous.block.5': {
    en: 'Customer acknowledges that the Comfy Products relies on third-party infrastructure, hardware, and services, including cloud computing providers and GPU infrastructure providers (collectively, “Third-Party Infrastructure”), and that the availability, performance, and security of the Comfy Products may be affected by the operation, maintenance, or failure of such Third-Party Infrastructure. Comfy will use commercially reasonable efforts to maintain Comfy Products availability but makes no representation or warranty regarding the performance or availability of any Third-Party Infrastructure, and Comfy shall have no liability to Customer for any interruption, degradation, loss of data, or other harm arising out of or related to any failure, outage, or limitation of Third-Party Infrastructure, whether or not within Comfy’s control.',
    'zh-CN':
      'Customer acknowledges that the Comfy Products relies on third-party infrastructure, hardware, and services, including cloud computing providers and GPU infrastructure providers (collectively, “Third-Party Infrastructure”), and that the availability, performance, and security of the Comfy Products may be affected by the operation, maintenance, or failure of such Third-Party Infrastructure. Comfy will use commercially reasonable efforts to maintain Comfy Products availability but makes no representation or warranty regarding the performance or availability of any Third-Party Infrastructure, and Comfy shall have no liability to Customer for any interruption, degradation, loss of data, or other harm arising out of or related to any failure, outage, or limitation of Third-Party Infrastructure, whether or not within Comfy’s control.'
  },
  'tos.miscellaneous.block.6.heading': {
    en: 'Assignment; Delegation.',
    'zh-CN': 'Assignment; Delegation.'
  },
  'tos.miscellaneous.block.7': {
    en: 'Neither party hereto may assign or otherwise transfer this Agreement, in whole or in part, without the other party’s prior written consent, except that Comfy may assign this Agreement without consent to a successor to all or substantially all of its assets or business related to this Agreement. Any attempted assignment, delegation, or transfer by either party in violation hereof will be null and void. Subject to the foregoing, this Agreement will be binding on the parties and their successors and assigns.',
    'zh-CN':
      'Neither party hereto may assign or otherwise transfer this Agreement, in whole or in part, without the other party’s prior written consent, except that Comfy may assign this Agreement without consent to a successor to all or substantially all of its assets or business related to this Agreement. Any attempted assignment, delegation, or transfer by either party in violation hereof will be null and void. Subject to the foregoing, this Agreement will be binding on the parties and their successors and assigns.'
  },
  'tos.miscellaneous.block.8.heading': {
    en: 'Amendment; Waiver.',
    'zh-CN': 'Amendment; Waiver.'
  },
  'tos.miscellaneous.block.9': {
    en: 'Comfy reserves the right in its sole discretion and at any time and for any reason to modify this Agreement. Any modifications to this Agreement shall become effective upon the date of posting. Your continued use of, or access to, the Comfy Products after an update goes into effect will constitute acceptance of the update. If you do not agree with an update, you may stop using the Comfy Products or terminate this Agreement. No waiver by either party of any breach or default hereunder shall be deemed to be a waiver of any preceding or subsequent breach or default. Any such waiver will apply only to the specific provision and under the specific circumstances for which it was given, and will not apply with respect to any repeated or continued violation of the same provision or any other provision. Failure or delay by either party to enforce any provision of this Agreement will not be deemed a waiver of future enforcement of that or any other provision.',
    'zh-CN':
      'Comfy reserves the right in its sole discretion and at any time and for any reason to modify this Agreement. Any modifications to this Agreement shall become effective upon the date of posting. Your continued use of, or access to, the Comfy Products after an update goes into effect will constitute acceptance of the update. If you do not agree with an update, you may stop using the Comfy Products or terminate this Agreement. No waiver by either party of any breach or default hereunder shall be deemed to be a waiver of any preceding or subsequent breach or default. Any such waiver will apply only to the specific provision and under the specific circumstances for which it was given, and will not apply with respect to any repeated or continued violation of the same provision or any other provision. Failure or delay by either party to enforce any provision of this Agreement will not be deemed a waiver of future enforcement of that or any other provision.'
  },
  'tos.miscellaneous.block.10.heading': {
    en: 'Relationship.',
    'zh-CN': 'Relationship.'
  },
  'tos.miscellaneous.block.11': {
    en: 'Nothing contained herein will in any way constitute any association, partnership, agency, employment or joint venture between the parties hereto, or be construed to evidence the intention of the parties to establish any such relationship. Neither party will have the authority to obligate or bind the other in any manner, and nothing herein contained will give rise to, or is intended to give rise to any rights of any kind in favor of any third parties.',
    'zh-CN':
      'Nothing contained herein will in any way constitute any association, partnership, agency, employment or joint venture between the parties hereto, or be construed to evidence the intention of the parties to establish any such relationship. Neither party will have the authority to obligate or bind the other in any manner, and nothing herein contained will give rise to, or is intended to give rise to any rights of any kind in favor of any third parties.'
  },
  'tos.miscellaneous.block.12.heading': {
    en: 'Unenforceability.',
    'zh-CN': 'Unenforceability.'
  },
  'tos.miscellaneous.block.13': {
    en: 'If a court of competent jurisdiction determines that any provision of this Agreement is invalid, illegal, or otherwise unenforceable, such provision will be enforced as nearly as possible in accordance with the stated intention of the parties, while the remainder of this Agreement will remain in full force and effect and bind the parties according to its terms.',
    'zh-CN':
      'If a court of competent jurisdiction determines that any provision of this Agreement is invalid, illegal, or otherwise unenforceable, such provision will be enforced as nearly as possible in accordance with the stated intention of the parties, while the remainder of this Agreement will remain in full force and effect and bind the parties according to its terms.'
  },
  'tos.miscellaneous.block.14.heading': {
    en: 'Notices.',
    'zh-CN': 'Notices.'
  },
  'tos.miscellaneous.block.15': {
    en: 'Any notice required or permitted to be given hereunder will be given in writing by personal delivery, certified mail, return receipt requested, or by overnight delivery. Notices to you may be sent to the email address provided by you when you created your account with Comfy. Notices to Comfy must be sent to the following: 201 Spear Street, Ste 17, San Francisco, CA 94105.',
    'zh-CN':
      'Any notice required or permitted to be given hereunder will be given in writing by personal delivery, certified mail, return receipt requested, or by overnight delivery. Notices to you may be sent to the email address provided by you when you created your account with Comfy. Notices to Comfy must be sent to the following: 201 Spear Street, Ste 17, San Francisco, CA 94105.'
  },
  'tos.miscellaneous.block.16.heading': {
    en: 'Entire Agreement.',
    'zh-CN': 'Entire Agreement.'
  },
  'tos.miscellaneous.block.17': {
    en: 'This Agreement comprises the entire agreement between you and Comfy with respect to its subject matter, and supersedes all prior and contemporaneous proposals, statements, sales materials or presentations and agreements (oral and written). No oral or written information or advice given by Comfy, its agents or employees will create a warranty or in any way increase the scope of the warranties in this Agreement.',
    'zh-CN':
      'This Agreement comprises the entire agreement between you and Comfy with respect to its subject matter, and supersedes all prior and contemporaneous proposals, statements, sales materials or presentations and agreements (oral and written). No oral or written information or advice given by Comfy, its agents or employees will create a warranty or in any way increase the scope of the warranties in this Agreement.'
  },

  'tos.contact.label': { en: 'CONTACT', 'zh-CN': 'CONTACT' },
  'tos.contact.title': { en: '13. Contact Us', 'zh-CN': '13. Contact Us' },
  'tos.contact.block.0': {
    en: 'If you have any questions regarding this Agreement or the Comfy Products, please contact us at: <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a>.',
    'zh-CN':
      'If you have any questions regarding this Agreement or the Comfy Products, please contact us at: <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a>.'
  },

  // ── Affiliate Program Terms ───────────────────────────────────────
  // Legal-reviewed copy — ENGLISH ONLY. There is no /zh-CN/affiliates/terms
  // route, and the `'zh-CN'` values below intentionally duplicate `en`
  // verbatim only to satisfy the translations dictionary's required
  // Record<Locale, string> shape. Do NOT translate these into Chinese:
  // shipping an unreviewed translation as the active terms exposes us to
  // liability from the translation diverging from the legal-approved
  // English source. If a translated terms page is ever needed, add a
  // separate `/affiliates/terms/<locale>` route only after legal signs
  // off on that specific translation as the authoritative version.
  'affiliate-terms.effective-date': {
    en: 'May 16, 2026',
    'zh-CN': 'May 16, 2026'
  },
  'affiliate-terms.1-program-overview.label': {
    en: 'PROGRAM',
    'zh-CN': 'PROGRAM'
  },
  'affiliate-terms.1-program-overview.title': {
    en: '1. Program Overview',
    'zh-CN': '1. Program Overview'
  },
  'affiliate-terms.1-program-overview.block.0': {
    en: 'The <a href="https://comfy.org" class="text-white underline">Comfy.org</a> Affiliate Program ("<strong>Program</strong>") allows approved participants ("<strong>Affiliates</strong>") to earn commissions by referring new paying customers to Comfy Cloud. By participating in this program, you agree to these terms.',
    'zh-CN':
      'The <a href="https://comfy.org" class="text-white underline">Comfy.org</a> Affiliate Program ("<strong>Program</strong>") allows approved participants ("<strong>Affiliates</strong>") to earn commissions by referring new paying customers to Comfy Cloud. By participating in this program, you agree to these terms.'
  },
  'affiliate-terms.2-eligible-products.label': {
    en: 'PRODUCTS',
    'zh-CN': 'PRODUCTS'
  },
  'affiliate-terms.2-eligible-products.title': {
    en: '2. Eligible Products',
    'zh-CN': '2. Eligible Products'
  },
  'affiliate-terms.2-eligible-products.block.0': {
    en: 'Commissions are earned on Comfy Cloud paid subscription plans only. The following are excluded from commission eligibility: free tier signups (unless they later convert to paid), one-time credit purchases, enterprise contracts negotiated directly with Comfy sales, and API-only usage billed outside of standard subscription plans.',
    'zh-CN':
      'Commissions are earned on Comfy Cloud paid subscription plans only. The following are excluded from commission eligibility: free tier signups (unless they later convert to paid), one-time credit purchases, enterprise contracts negotiated directly with Comfy sales, and API-only usage billed outside of standard subscription plans.'
  },
  'affiliate-terms.3-commission-structure.label': {
    en: 'COMMISSION',
    'zh-CN': 'COMMISSION'
  },
  'affiliate-terms.3-commission-structure.title': {
    en: '3. Commission Structure',
    'zh-CN': '3. Commission Structure'
  },
  'affiliate-terms.3-commission-structure.block.0': {
    en: 'Commission rate: 30% recurring on the net subscription amount received by Comfy.org\nCommission duration: 3 months from the referred customer\u2019s first paid subscription\nCookie/attribution window: 60 days from the referral click\nMinimum payout threshold: $100\nPayout schedule: Monthly, within the first 10 business days of each month after the receipt of applicable payment by Comfy from its referred customer\nPayout method: Via the affiliate tracking platform (Stripe Express or PayPal)\nCommission cessation: To the extent a referred customer\u2019s subscription is canceled, in whole or in part, the affiliate shall correspondingly cease to receive commission payments, even within the 3-month commission window. Refunded or charged-back transactions are not eligible for commission, and any commission previously paid for such transactions will be deducted from future payouts (see Section 4).',
    'zh-CN':
      'Commission rate: 30% recurring on the net subscription amount received by Comfy.org\nCommission duration: 3 months from the referred customer\u2019s first paid subscription\nCookie/attribution window: 60 days from the referral click\nMinimum payout threshold: $100\nPayout schedule: Monthly, within the first 10 business days of each month after the receipt of applicable payment by Comfy from its referred customer\nPayout method: Via the affiliate tracking platform (Stripe Express or PayPal)\nCommission cessation: To the extent a referred customer\u2019s subscription is canceled, in whole or in part, the affiliate shall correspondingly cease to receive commission payments, even within the 3-month commission window. Refunded or charged-back transactions are not eligible for commission, and any commission previously paid for such transactions will be deducted from future payouts (see Section 4).'
  },
  'affiliate-terms.4-attribution-rules.label': {
    en: 'ATTRIBUTION',
    'zh-CN': 'ATTRIBUTION'
  },
  'affiliate-terms.4-attribution-rules.title': {
    en: '4. Attribution Rules',
    'zh-CN': '4. Attribution Rules'
  },
  'affiliate-terms.4-attribution-rules.block.0': {
    en: 'Commissions are attributed on a last-click basis within the 60-day cookie window\nIf a referred customer cancels and re-subscribes within 60 days, the original affiliate retains attribution\nIf a referred customer upgrades their plan, commission is calculated on the upgraded amount\nIf a referred customer downgrades their plan, commission adjusts to the new plan amount\nRefunded transactions are not eligible for commission\nAny commission paid on refunded transactions will be deducted from future payouts to you',
    'zh-CN':
      'Commissions are attributed on a last-click basis within the 60-day cookie window\nIf a referred customer cancels and re-subscribes within 60 days, the original affiliate retains attribution\nIf a referred customer upgrades their plan, commission is calculated on the upgraded amount\nIf a referred customer downgrades their plan, commission adjusts to the new plan amount\nRefunded transactions are not eligible for commission\nAny commission paid on refunded transactions will be deducted from future payouts to you'
  },
  'affiliate-terms.5-prohibited-activities.label': {
    en: 'PROHIBITED',
    'zh-CN': 'PROHIBITED'
  },
  'affiliate-terms.5-prohibited-activities.title': {
    en: '5. Prohibited Activities',
    'zh-CN': '5. Prohibited Activities'
  },
  'affiliate-terms.5-prohibited-activities.block.0': {
    en: 'Affiliates must NOT:',
    'zh-CN': 'Affiliates must NOT:'
  },
  'affiliate-terms.5-prohibited-activities.block.1': {
    en: '<strong>Self-refer</strong>: Use your own affiliate link to purchase or receive discounts on your own account\n<strong>Bid on branded keywords</strong>: Run paid search campaigns (Google Ads, Bing Ads, etc.) targeting "ComfyUI," "Comfy.org," "Comfy Cloud," or any misspellings or variations thereof\n<strong>Misrepresent</strong>: Impersonate Comfy.org, claim to be an employee, or create assets that could be confused with official Comfy.org materials\n<strong>Spam</strong>: Send unsolicited bulk emails, messages, or engage in any form of spam promotion\n<strong>Cookie stuff</strong>: Use hidden iframes, pop-unders, or any technical means to set cookies without genuine user intent\n<strong>Incentivize clicks</strong>: Offer monetary rewards, points, or other incentives solely for clicking your affiliate link (content recommendations are fine)\n<strong>Use misleading claims</strong>: Make false or exaggerated claims about Comfy.org products, pricing, or features\n<strong>Promote on prohibited content</strong>: Place affiliate links on sites containing illegal content, hate speech, or adult content\n<strong>Contrary to laws</strong>: Place affiliate links in any market that is prohibited as a region under the laws of the United States of America.',
    'zh-CN':
      '<strong>Self-refer</strong>: Use your own affiliate link to purchase or receive discounts on your own account\n<strong>Bid on branded keywords</strong>: Run paid search campaigns (Google Ads, Bing Ads, etc.) targeting "ComfyUI," "Comfy.org," "Comfy Cloud," or any misspellings or variations thereof\n<strong>Misrepresent</strong>: Impersonate Comfy.org, claim to be an employee, or create assets that could be confused with official Comfy.org materials\n<strong>Spam</strong>: Send unsolicited bulk emails, messages, or engage in any form of spam promotion\n<strong>Cookie stuff</strong>: Use hidden iframes, pop-unders, or any technical means to set cookies without genuine user intent\n<strong>Incentivize clicks</strong>: Offer monetary rewards, points, or other incentives solely for clicking your affiliate link (content recommendations are fine)\n<strong>Use misleading claims</strong>: Make false or exaggerated claims about Comfy.org products, pricing, or features\n<strong>Promote on prohibited content</strong>: Place affiliate links on sites containing illegal content, hate speech, or adult content\n<strong>Contrary to laws</strong>: Place affiliate links in any market that is prohibited as a region under the laws of the United States of America.'
  },
  'affiliate-terms.6-content-guidelines.label': {
    en: 'CONTENT & IP',
    'zh-CN': 'CONTENT & IP'
  },
  'affiliate-terms.6-content-guidelines.title': {
    en: '6. Content Guidelines and Intellectual Property Rights',
    'zh-CN': '6. Content Guidelines and Intellectual Property Rights'
  },
  'affiliate-terms.6-content-guidelines.block.0': {
    en: 'Affiliates must clearly disclose the affiliate relationship in accordance with FTC guidelines (US) and equivalent regulations in their jurisdiction\nRecommended disclosure: "This page contains affiliate links. I may earn a commission if you sign up through my link."\nAffiliates may use Comfy.org logos and brand assets only as provided in the official affiliate asset kit, and may not modify them\nComfy.org retains all rights, including in any of its intellectual property apart from the limited use rights granted herein',
    'zh-CN':
      'Affiliates must clearly disclose the affiliate relationship in accordance with FTC guidelines (US) and equivalent regulations in their jurisdiction\nRecommended disclosure: "This page contains affiliate links. I may earn a commission if you sign up through my link."\nAffiliates may use Comfy.org logos and brand assets only as provided in the official affiliate asset kit, and may not modify them\nComfy.org retains all rights, including in any of its intellectual property apart from the limited use rights granted herein'
  },
  'affiliate-terms.7-termination.label': {
    en: 'TERMINATION',
    'zh-CN': 'TERMINATION'
  },
  'affiliate-terms.7-termination.title': {
    en: '7. Termination',
    'zh-CN': '7. Termination'
  },
  'affiliate-terms.7-termination.block.0': {
    en: 'Either party may terminate the affiliate relationship at any time with 14 days\u2019 prior written notice\nComfy.org reserves the right to immediately terminate and withhold commissions if an affiliate violates any of the prohibited activities listed above\nUpon termination, any unpaid commissions above the minimum threshold will be paid in the next regular payout cycle\nCommissions on referred customers will cease at the time of termination, even if within the 3-month commission window',
    'zh-CN':
      'Either party may terminate the affiliate relationship at any time with 14 days\u2019 prior written notice\nComfy.org reserves the right to immediately terminate and withhold commissions if an affiliate violates any of the prohibited activities listed above\nUpon termination, any unpaid commissions above the minimum threshold will be paid in the next regular payout cycle\nCommissions on referred customers will cease at the time of termination, even if within the 3-month commission window'
  },
  'affiliate-terms.8-program-modifications.label': {
    en: 'MODIFICATIONS',
    'zh-CN': 'MODIFICATIONS'
  },
  'affiliate-terms.8-program-modifications.title': {
    en: '8. Program Modifications',
    'zh-CN': '8. Program Modifications'
  },
  'affiliate-terms.8-program-modifications.block.0': {
    en: 'Comfy.org reserves the right to modify these terms, commission rates, or program structure with 30 days notice to active affiliates\nContinued participation after notice constitutes acceptance of modified terms',
    'zh-CN':
      'Comfy.org reserves the right to modify these terms, commission rates, or program structure with 30 days notice to active affiliates\nContinued participation after notice constitutes acceptance of modified terms'
  },
  'affiliate-terms.9-indemnification.label': {
    en: 'LIABILITY',
    'zh-CN': 'LIABILITY'
  },
  'affiliate-terms.9-indemnification.title': {
    en: '9. Indemnification and Limitation of Liability',
    'zh-CN': '9. Indemnification and Limitation of Liability'
  },
  'affiliate-terms.9-indemnification.block.0': {
    en: 'You will indemnify Comfy.org from any third party claim arising out of your breach of these terms.\nComfy.org\u2019s liability to any affiliate shall not (i) exceed the total commissions paid to that affiliate in the preceding 12 months, and (ii) include any indirect, consequential, punitive or any other type of special damages.\nComfy.org is not responsible for tracking failures caused by user browser settings, ad blockers, or VPNs, though we employ server-side tracking to minimize these issues',
    'zh-CN':
      'You will indemnify Comfy.org from any third party claim arising out of your breach of these terms.\nComfy.org\u2019s liability to any affiliate shall not (i) exceed the total commissions paid to that affiliate in the preceding 12 months, and (ii) include any indirect, consequential, punitive or any other type of special damages.\nComfy.org is not responsible for tracking failures caused by user browser settings, ad blockers, or VPNs, though we employ server-side tracking to minimize these issues'
  },
  'affiliate-terms.10-governing-law.label': {
    en: 'GOVERNING LAW',
    'zh-CN': 'GOVERNING LAW'
  },
  'affiliate-terms.10-governing-law.title': {
    en: '10. Governing Law',
    'zh-CN': '10. Governing Law'
  },
  'affiliate-terms.10-governing-law.block.0': {
    en: 'These terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles. All disputes arising under this Agreement shall be resolved exclusively in the state or federal courts in the State of Delaware.',
    'zh-CN':
      'These terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of law principles. All disputes arising under this Agreement shall be resolved exclusively in the state or federal courts in the State of Delaware.'
  },
  'affiliate-terms.11-miscellaneous.label': {
    en: 'MISCELLANEOUS',
    'zh-CN': 'MISCELLANEOUS'
  },
  'affiliate-terms.11-miscellaneous.title': {
    en: '11. Miscellaneous',
    'zh-CN': '11. Miscellaneous'
  },
  'affiliate-terms.11-miscellaneous.block.0': {
    en: '<strong>(a) Entire Agreement.</strong> These terms constitutes the sole and entire agreement (including the attached schedules and exhibits) of the Parties with respect to the subject matter of these terms, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, with respect to the subject matter. <strong>(b) Relationship of Parties.</strong> Each party is an independent contractor with regard to these terms. Nothing contained in These terms shall be construed as creating any agency, partnership, joint venture, or other form of joint enterprise, employment, or fiduciary relationship between the Parties. Neither party, by virtue of these terms, will have any right, power, or authority to act or create an obligation, express or implied, on behalf of the other party. <strong>(c) Assignment.</strong> Neither party shall assign any of its rights or delegate any of its obligations hereunder without the prior written consent of the other party, which consent shall not be unreasonably withheld, conditioned or delayed. <strong>(d) Severability.</strong> If any term or provision of these terms is invalid, illegal, or unenforceable in any jurisdiction, such invalidity, illegality, or unenforceability shall not affect any other term or provision of these terms or invalidate or render unenforceable such term or provision in any other jurisdiction. Upon a determination that any term or provision is invalid, illegal or unenforceable, the Parties hereto shall negotiate in good faith to modify these terms to effect the original intent of the Parties as closely as possible in order that the transactions contemplated hereby be consummated as originally contemplated to the greatest extent possible. <strong>(e) Waiver.</strong> No waiver by either party of any of the provisions hereof shall be effective unless explicitly set forth in writing and signed by the party so waiving. <strong>(f) Notice.</strong> Each party shall deliver all notices, requests, consents, claims, demands, waivers, and other communications under these terms in writing to the email utilized for the primary contact for the other party. <strong>(g) Cumulative Remedies.</strong> All rights and remedies provided in these terms are cumulative and not exclusive, and the exercise by a party of any right or remedy does not preclude the exercise of any other rights or remedies that may now or subsequently be available at Law, in equity, by statute, in any other agreement between the Parties or otherwise. <strong>(h) No Third-Party Beneficiaries.</strong> These terms benefits solely the Parties to these terms and their respective permitted successors and assigns and nothing in these terms, express or implied, confers on any other person or entity any legal or equitable right, benefit, or remedy of any nature whatsoever under or by reason of these terms.',
    'zh-CN':
      '<strong>(a) Entire Agreement.</strong> These terms constitutes the sole and entire agreement (including the attached schedules and exhibits) of the Parties with respect to the subject matter of these terms, and supersedes all prior and contemporaneous understandings, agreements, representations, and warranties, both written and oral, with respect to the subject matter. <strong>(b) Relationship of Parties.</strong> Each party is an independent contractor with regard to these terms. Nothing contained in These terms shall be construed as creating any agency, partnership, joint venture, or other form of joint enterprise, employment, or fiduciary relationship between the Parties. Neither party, by virtue of these terms, will have any right, power, or authority to act or create an obligation, express or implied, on behalf of the other party. <strong>(c) Assignment.</strong> Neither party shall assign any of its rights or delegate any of its obligations hereunder without the prior written consent of the other party, which consent shall not be unreasonably withheld, conditioned or delayed. <strong>(d) Severability.</strong> If any term or provision of these terms is invalid, illegal, or unenforceable in any jurisdiction, such invalidity, illegality, or unenforceability shall not affect any other term or provision of these terms or invalidate or render unenforceable such term or provision in any other jurisdiction. Upon a determination that any term or provision is invalid, illegal or unenforceable, the Parties hereto shall negotiate in good faith to modify these terms to effect the original intent of the Parties as closely as possible in order that the transactions contemplated hereby be consummated as originally contemplated to the greatest extent possible. <strong>(e) Waiver.</strong> No waiver by either party of any of the provisions hereof shall be effective unless explicitly set forth in writing and signed by the party so waiving. <strong>(f) Notice.</strong> Each party shall deliver all notices, requests, consents, claims, demands, waivers, and other communications under these terms in writing to the email utilized for the primary contact for the other party. <strong>(g) Cumulative Remedies.</strong> All rights and remedies provided in these terms are cumulative and not exclusive, and the exercise by a party of any right or remedy does not preclude the exercise of any other rights or remedies that may now or subsequently be available at Law, in equity, by statute, in any other agreement between the Parties or otherwise. <strong>(h) No Third-Party Beneficiaries.</strong> These terms benefits solely the Parties to these terms and their respective permitted successors and assigns and nothing in these terms, express or implied, confers on any other person or entity any legal or equitable right, benefit, or remedy of any nature whatsoever under or by reason of these terms.'
  },

  'affiliate-terms.page.title': {
    en: 'Affiliate Terms - Comfy',
    'zh-CN': 'Affiliate Terms - Comfy'
  },
  'affiliate-terms.page.description': {
    en: 'Comfy.org Affiliate Program Terms and Conditions.',
    'zh-CN': 'Comfy.org Affiliate Program Terms and Conditions.'
  },
  'affiliate-terms.page.heading': {
    en: 'Affiliate Terms',
    'zh-CN': 'Affiliate Terms'
  },
  'affiliate-terms.page.tocLabel': {
    en: 'On this page',
    'zh-CN': '本页内容'
  },
  'affiliate-terms.page.effectiveDateLabel': {
    en: 'Effective Date',
    'zh-CN': '生效日期'
  },

  // ── Enterprise MSA ─────────────────────────────────────────────────
  // English-only, by design. This is a legal-reviewed customer-facing
  // template. Serving a translated variant would expose Comfy to
  // liability from the translation diverging from the approved English
  // source. See the matching header comment in
  // src/pages/enterprise-msa.astro and the LOCALE_INVARIANT_ROUTE_KEYS
  // entry in src/config/routes.ts.
  'enterprise-msa.effective-date': {
    en: 'May 22, 2026',
    'zh-CN': 'May 22, 2026'
  },
  'enterprise-msa.1-definitions.label': {
    en: 'DEFINITIONS',
    'zh-CN': 'DEFINITIONS'
  },
  'enterprise-msa.1-definitions.title': {
    en: '1. Definitions',
    'zh-CN': '1. Definitions'
  },
  'enterprise-msa.1-definitions.block.0': {
    en: '<strong>“Affiliates”</strong> means any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where “control” means the ownership of more than fifty percent (50%) of the voting securities or other voting interests of such entity.',
    'zh-CN':
      '<strong>“Affiliates”</strong> means any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where “control” means the ownership of more than fifty percent (50%) of the voting securities or other voting interests of such entity.'
  },
  'enterprise-msa.1-definitions.block.1': {
    en: '<strong>“Applicable Laws”</strong> means all federal and state laws, treaties, rules, regulations, regulatory and supervisory guidance, directives, policies, orders or determinations of a regulatory authority applicable to the activities and obligations contemplated under this Agreement.',
    'zh-CN':
      '<strong>“Applicable Laws”</strong> means all federal and state laws, treaties, rules, regulations, regulatory and supervisory guidance, directives, policies, orders or determinations of a regulatory authority applicable to the activities and obligations contemplated under this Agreement.'
  },
  'enterprise-msa.1-definitions.block.2': {
    en: '<strong>“Comfy API”</strong> means the application programming interface and related developer tools made available by Comfy that allows Customer to access and execute visual AI workflows programmatically as production endpoints from within Customer’s own applications or systems.',
    'zh-CN':
      '<strong>“Comfy API”</strong> means the application programming interface and related developer tools made available by Comfy that allows Customer to access and execute visual AI workflows programmatically as production endpoints from within Customer’s own applications or systems.'
  },
  'enterprise-msa.1-definitions.block.3': {
    en: '<strong>“Comfy Branding”</strong> means the names, logos, and associated trademarks owned or in progress of being owned by Comfy.',
    'zh-CN':
      '<strong>“Comfy Branding”</strong> means the names, logos, and associated trademarks owned or in progress of being owned by Comfy.'
  },
  'enterprise-msa.1-definitions.block.4': {
    en: '<strong>“Comfy Cloud”</strong> means the cloud-based hosting environment made available by Comfy that allows Customer to access and run visual AI workflows remotely through Comfy’s infrastructure, without requiring local installation or hardware.',
    'zh-CN':
      '<strong>“Comfy Cloud”</strong> means the cloud-based hosting environment made available by Comfy that allows Customer to access and run visual AI workflows remotely through Comfy’s infrastructure, without requiring local installation or hardware.'
  },
  'enterprise-msa.1-definitions.block.5': {
    en: '<strong>“Comfy Enterprise”</strong> means the enterprise-grade product tier made available by Comfy that provides organizations with dedicated infrastructure, enhanced security, administrative controls, and related support services for deploying and managing visual AI workflows at scale.',
    'zh-CN':
      '<strong>“Comfy Enterprise”</strong> means the enterprise-grade product tier made available by Comfy that provides organizations with dedicated infrastructure, enhanced security, administrative controls, and related support services for deploying and managing visual AI workflows at scale.'
  },
  'enterprise-msa.1-definitions.block.6': {
    en: '<strong>“Comfy OSS”</strong> means the open-source software, source code, libraries, tools, and related components made available by Comfy under one or more open source licenses, including the software repositories published by Comfy at <a href="https://github.com/Comfy-Org" class="text-white underline">https://github.com/Comfy-Org</a>, as updated, modified, or supplemented from time to time. For the avoidance of doubt, Comfy OSS does not include any proprietary software, infrastructure, or functionality made available by Comfy under this Agreement or in connection with any commercial product or offering.',
    'zh-CN':
      '<strong>“Comfy OSS”</strong> means the open-source software, source code, libraries, tools, and related components made available by Comfy under one or more open source licenses, including the software repositories published by Comfy at <a href="https://github.com/Comfy-Org" class="text-white underline">https://github.com/Comfy-Org</a>, as updated, modified, or supplemented from time to time. For the avoidance of doubt, Comfy OSS does not include any proprietary software, infrastructure, or functionality made available by Comfy under this Agreement or in connection with any commercial product or offering.'
  },
  'enterprise-msa.1-definitions.block.7': {
    en: '<strong>“Comfy Products”</strong> means Comfy Cloud, Comfy API, Comfy Enterprise and other products, software, features, tools, and functionality made available by Comfy to Customer under this Agreement, excluding any Comfy OSS.',
    'zh-CN':
      '<strong>“Comfy Products”</strong> means Comfy Cloud, Comfy API, Comfy Enterprise and other products, software, features, tools, and functionality made available by Comfy to Customer under this Agreement, excluding any Comfy OSS.'
  },
  'enterprise-msa.1-definitions.block.8': {
    en: '<strong>“Customer Data”</strong> means electronic data and information submitted or generated by Customer in connection with its use of the Comfy Products, including all Inputs and Outputs.',
    'zh-CN':
      '<strong>“Customer Data”</strong> means electronic data and information submitted or generated by Customer in connection with its use of the Comfy Products, including all Inputs and Outputs.'
  },
  'enterprise-msa.1-definitions.block.9': {
    en: '<strong>“Open Source License”</strong> means the open source license(s) under which Comfy makes Comfy OSS available, as identified in the applicable source code repository.',
    'zh-CN':
      '<strong>“Open Source License”</strong> means the open source license(s) under which Comfy makes Comfy OSS available, as identified in the applicable source code repository.'
  },
  'enterprise-msa.1-definitions.block.10': {
    en: '<strong>“Operational Metadata”</strong> means usage and diagnostic information generated by the Comfy Products and collected by Comfy to support, maintain, and optimize the performance and security of the Comfy Products, including information regarding software versions, system configuration, uptime, error logs, health metrics, and feature usage. Operational Metadata does not include Customer Data or Confidential Information.',
    'zh-CN':
      '<strong>“Operational Metadata”</strong> means usage and diagnostic information generated by the Comfy Products and collected by Comfy to support, maintain, and optimize the performance and security of the Comfy Products, including information regarding software versions, system configuration, uptime, error logs, health metrics, and feature usage. Operational Metadata does not include Customer Data or Confidential Information.'
  },
  'enterprise-msa.1-definitions.block.11': {
    en: '<strong>“Order Form”</strong> means the online sign-up flow, order form or other ordering document entered into or otherwise agreed by Customer that references this Agreement. The initial Order Form is attached as Exhibit A.',
    'zh-CN':
      '<strong>“Order Form”</strong> means the online sign-up flow, order form or other ordering document entered into or otherwise agreed by Customer that references this Agreement. The initial Order Form is attached as Exhibit A.'
  },
  'enterprise-msa.1-definitions.block.12': {
    en: '<strong>“User”</strong> means Customer’s or Customer’s Affiliates’ employees and contractors who are authorized by Customer to access and use the Comfy Products on Customer’s or Customer’s Affiliates’ behalf according to the terms of this Agreement.',
    'zh-CN':
      '<strong>“User”</strong> means Customer’s or Customer’s Affiliates’ employees and contractors who are authorized by Customer to access and use the Comfy Products on Customer’s or Customer’s Affiliates’ behalf according to the terms of this Agreement.'
  },
  'enterprise-msa.2-comfy-products.label': {
    en: 'PRODUCTS',
    'zh-CN': 'PRODUCTS'
  },
  'enterprise-msa.2-comfy-products.title': {
    en: '2. Comfy Products',
    'zh-CN': '2. Comfy Products'
  },
  'enterprise-msa.2-comfy-products.block.0': {
    en: '<strong>Right to Access and Use Comfy Products.</strong> Subject to Customer’s compliance with all of the terms and conditions of this Agreement, Comfy grants Customer and Customer’s Users a non-exclusive, non-sublicensable, non-transferable right during the term of this Agreement to access and use the Comfy Products as set forth in the applicable Order Form for Customer’s internal business purposes.',
    'zh-CN':
      '<strong>Right to Access and Use Comfy Products.</strong> Subject to Customer’s compliance with all of the terms and conditions of this Agreement, Comfy grants Customer and Customer’s Users a non-exclusive, non-sublicensable, non-transferable right during the term of this Agreement to access and use the Comfy Products as set forth in the applicable Order Form for Customer’s internal business purposes.'
  },
  'enterprise-msa.2-comfy-products.block.1': {
    en: '<strong>Customer Data.</strong> As between Comfy and Customer, Customer retains all right, title, and interest in and to any data, images, videos, prompts, models, workflows, nodes, parameters, or other materials submitted or uploaded by Customer to the Comfy Products (“Input”), as well as any images, videos, designs, or other visual content generated through Customer’s use of the Comfy Products as a result of processing Customer’s Input (“Output”). Customer acknowledges that due to the nature of artificial intelligence, Comfy may generate the same or similar Output for other customers, and Customer shall have no right, title, or interest in or to Output generated for any other customer.',
    'zh-CN':
      '<strong>Customer Data.</strong> As between Comfy and Customer, Customer retains all right, title, and interest in and to any data, images, videos, prompts, models, workflows, nodes, parameters, or other materials submitted or uploaded by Customer to the Comfy Products (“Input”), as well as any images, videos, designs, or other visual content generated through Customer’s use of the Comfy Products as a result of processing Customer’s Input (“Output”). Customer acknowledges that due to the nature of artificial intelligence, Comfy may generate the same or similar Output for other customers, and Customer shall have no right, title, or interest in or to Output generated for any other customer.'
  },
  'enterprise-msa.2-comfy-products.block.2': {
    en: '<strong>No AI Training.</strong> Comfy will not use Input or Output to train generative AI or diffusion models. Comfy may, however, collect and use limited metadata derived from Customer’s use of the Comfy Products, such as prompt classifications, workflow structures, and node configurations, to improve the performance, functionality, and user experience of the Comfy Products.',
    'zh-CN':
      '<strong>No AI Training.</strong> Comfy will not use Input or Output to train generative AI or diffusion models. Comfy may, however, collect and use limited metadata derived from Customer’s use of the Comfy Products, such as prompt classifications, workflow structures, and node configurations, to improve the performance, functionality, and user experience of the Comfy Products.'
  },
  'enterprise-msa.2-comfy-products.block.3': {
    en: '<strong>Comfy OSS.</strong> Customer may use Comfy OSS under the terms of the applicable Open Source License(s) governing each respective component, as identified in the corresponding source code repository, rather than under this Agreement. Nothing in this Agreement shall be construed to limit, supersede, or modify any rights or obligations arising under an applicable Open Source License. If Customer chooses to use the Comfy Products in conjunction with Comfy OSS, this Agreement applies solely to Customer’s use of the Comfy Products and not to the Comfy OSS itself.',
    'zh-CN':
      '<strong>Comfy OSS.</strong> Customer may use Comfy OSS under the terms of the applicable Open Source License(s) governing each respective component, as identified in the corresponding source code repository, rather than under this Agreement. Nothing in this Agreement shall be construed to limit, supersede, or modify any rights or obligations arising under an applicable Open Source License. If Customer chooses to use the Comfy Products in conjunction with Comfy OSS, this Agreement applies solely to Customer’s use of the Comfy Products and not to the Comfy OSS itself.'
  },
  'enterprise-msa.2-comfy-products.block.4': {
    en: '<strong>Partner Nodes.</strong> Certain features of the Comfy Products allow Customer to access third-party AI model providers (“Partner Nodes”) through Comfy. When Customer uses a Partner Node, Comfy proxies Customer’s request to the applicable third-party provider, transmitting the information necessary to fulfill Customer’s request, including prompts, images, models, and parameters. Comfy does not transmit Customer’s identity or account information to third-party providers in connection with Partner Node requests. Customer’s use of Partner Nodes is subject to the terms and policies of the applicable third-party provider, and Comfy is not responsible for the data practices of such providers. Usage of Partner Nodes is metered and billed through Comfy.',
    'zh-CN':
      '<strong>Partner Nodes.</strong> Certain features of the Comfy Products allow Customer to access third-party AI model providers (“Partner Nodes”) through Comfy. When Customer uses a Partner Node, Comfy proxies Customer’s request to the applicable third-party provider, transmitting the information necessary to fulfill Customer’s request, including prompts, images, models, and parameters. Comfy does not transmit Customer’s identity or account information to third-party providers in connection with Partner Node requests. Customer’s use of Partner Nodes is subject to the terms and policies of the applicable third-party provider, and Comfy is not responsible for the data practices of such providers. Usage of Partner Nodes is metered and billed through Comfy.'
  },
  'enterprise-msa.2-comfy-products.block.5': {
    en: '<strong>Modification of Comfy Products.</strong> Comfy may, at any time and in its sole discretion, modify, update, enhance, restrict, suspend, or discontinue the Comfy Products, in whole or in part, including by changing or removing features, functionality, endpoints, specifications, documentation, access methods, usage limits, or availability. Comfy has no obligation to maintain or support any particular version of the Comfy Products or to ensure backward compatibility. Any such modifications may be made with or without notice and may result in interruptions to or degradation of the Comfy Products. Comfy shall have no liability arising out of or related to any modification, suspension, or discontinuation of the Comfy Products, and Customer acknowledges that its use of the Comfy Products is at its own risk and that it should not rely on the continued availability of any aspect of the Comfy Products.',
    'zh-CN':
      '<strong>Modification of Comfy Products.</strong> Comfy may, at any time and in its sole discretion, modify, update, enhance, restrict, suspend, or discontinue the Comfy Products, in whole or in part, including by changing or removing features, functionality, endpoints, specifications, documentation, access methods, usage limits, or availability. Comfy has no obligation to maintain or support any particular version of the Comfy Products or to ensure backward compatibility. Any such modifications may be made with or without notice and may result in interruptions to or degradation of the Comfy Products. Comfy shall have no liability arising out of or related to any modification, suspension, or discontinuation of the Comfy Products, and Customer acknowledges that its use of the Comfy Products is at its own risk and that it should not rely on the continued availability of any aspect of the Comfy Products.'
  },
  'enterprise-msa.2-comfy-products.block.6': {
    en: '<strong>Data Retention and Deletion.</strong> Comfy retains Customer Data for as long as Customer’s account remains active or as otherwise necessary to provide the Comfy Products, comply with applicable legal obligations, resolve disputes, and enforce this Agreement. Specific retention periods for different categories of Customer Data are set forth in Comfy’s retention documentation, available at <a href="https://docs.comfy.org/support/data-retention" class="text-white underline">docs.comfy.org/support/data-retention</a>, as updated from time to time. Customer may request deletion of Customer’s account and associated Customer Data by contacting Comfy at <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a>. Upon receipt of a verified deletion request, Comfy will use commercially reasonable efforts to delete or de-identify Customer’s personal information from its primary systems within a reasonable time. Customer acknowledges that: (i) deletion may not propagate immediately to all backup systems, third-party analytics providers, or observability systems, which retain data subject to their own retention policies; (ii) certain Customer Data may be retained as required by applicable law or for legitimate business purposes such as billing records; and (iii) aggregated or de-identified data derived from Customer’s use of the Comfy Products may be retained indefinitely.',
    'zh-CN':
      '<strong>Data Retention and Deletion.</strong> Comfy retains Customer Data for as long as Customer’s account remains active or as otherwise necessary to provide the Comfy Products, comply with applicable legal obligations, resolve disputes, and enforce this Agreement. Specific retention periods for different categories of Customer Data are set forth in Comfy’s retention documentation, available at <a href="https://docs.comfy.org/support/data-retention" class="text-white underline">docs.comfy.org/support/data-retention</a>, as updated from time to time. Customer may request deletion of Customer’s account and associated Customer Data by contacting Comfy at <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a>. Upon receipt of a verified deletion request, Comfy will use commercially reasonable efforts to delete or de-identify Customer’s personal information from its primary systems within a reasonable time. Customer acknowledges that: (i) deletion may not propagate immediately to all backup systems, third-party analytics providers, or observability systems, which retain data subject to their own retention policies; (ii) certain Customer Data may be retained as required by applicable law or for legitimate business purposes such as billing records; and (iii) aggregated or de-identified data derived from Customer’s use of the Comfy Products may be retained indefinitely.'
  },
  'enterprise-msa.3-customer-responsibilities.label': {
    en: 'CUSTOMER',
    'zh-CN': 'CUSTOMER'
  },
  'enterprise-msa.3-customer-responsibilities.title': {
    en: '3. Customer Responsibilities',
    'zh-CN': '3. Customer Responsibilities'
  },
  'enterprise-msa.3-customer-responsibilities.block.0': {
    en: '<strong>Registration.</strong> To access and use the Comfy Products, Customer may be required to register one or more accounts by providing Comfy with the information specified in the applicable registration form, including Customer’s email address. Customer shall ensure that all registration information provided to Comfy is complete and accurate, and shall promptly update such information as necessary to keep it current. Customer shall be liable for all activities conducted through its account, including any unauthorized access or use resulting from Customer’s failure to implement reasonable access controls or to limit access to its systems and devices.',
    'zh-CN':
      '<strong>Registration.</strong> To access and use the Comfy Products, Customer may be required to register one or more accounts by providing Comfy with the information specified in the applicable registration form, including Customer’s email address. Customer shall ensure that all registration information provided to Comfy is complete and accurate, and shall promptly update such information as necessary to keep it current. Customer shall be liable for all activities conducted through its account, including any unauthorized access or use resulting from Customer’s failure to implement reasonable access controls or to limit access to its systems and devices.'
  },
  'enterprise-msa.3-customer-responsibilities.block.1': {
    en: '<strong>General Technology Restrictions.</strong> Customer agrees that it will not, directly or indirectly: (i) sublicense the Comfy Products for use by a third party; (ii) reverse engineer or attempt to extract the source code or underlying methodology from the Comfy Products or any related software, except to the extent that this restriction is expressly prohibited by Applicable Laws; (iii) use or facilitate the use of the Comfy Products for any activities that are prohibited by Applicable Laws or otherwise; (iv) bypass or circumvent measures employed to prevent or limit access to the Comfy Products; (v) use the Comfy Products to create a product or service competitive with Comfy’s products or services; (vi) create derivative works of or otherwise create, attempt to create or derive, or knowingly assist any third party to create or derive, the source code underlying the Comfy Products; or (vii) otherwise use or interact with the Comfy Products for any purpose not expressly permitted under this Agreement.',
    'zh-CN':
      '<strong>General Technology Restrictions.</strong> Customer agrees that it will not, directly or indirectly: (i) sublicense the Comfy Products for use by a third party; (ii) reverse engineer or attempt to extract the source code or underlying methodology from the Comfy Products or any related software, except to the extent that this restriction is expressly prohibited by Applicable Laws; (iii) use or facilitate the use of the Comfy Products for any activities that are prohibited by Applicable Laws or otherwise; (iv) bypass or circumvent measures employed to prevent or limit access to the Comfy Products; (v) use the Comfy Products to create a product or service competitive with Comfy’s products or services; (vi) create derivative works of or otherwise create, attempt to create or derive, or knowingly assist any third party to create or derive, the source code underlying the Comfy Products; or (vii) otherwise use or interact with the Comfy Products for any purpose not expressly permitted under this Agreement.'
  },
  'enterprise-msa.3-customer-responsibilities.block.2': {
    en: '<strong>Acceptable Use; Prohibited Customer Data.</strong> Customer is solely responsible for ensuring that all Input submitted to the Comfy Products complies with all Applicable Laws, and Customer agrees that it will not, and will not permit any third party to submit to Comfy or the Comfy Products or otherwise use the Comfy Products to create: (i) any data, designs, or other materials subject to U.S. export control laws and regulations; (ii) any viruses, malware, ransomware, Trojan horses, worms, spyware, or other malicious or harmful code or content that could damage, disrupt, interfere with, or compromise the Comfy Products, Comfy’s systems or infrastructure, or the data or systems of any other user or third party; (iii) any Customer Data that depicts, promotes, or facilitates illegal activity, including without limitation child sexual abuse material, non-consensual intimate imagery, or content that incites violence or hatred against any individual or group; (iv) any Customer Data that infringes or misappropriates the intellectual property rights, privacy rights, or publicity rights of any third party, including without limitation by submitting models, images, or other materials without the right to do so; (v) any content or information that is intentionally deceptive or misleading, including without limitation synthetic media designed to impersonate a real individual without their consent; or (vi) any Customer Data that could reasonably be expected to cause harm to any individual or group.',
    'zh-CN':
      '<strong>Acceptable Use; Prohibited Customer Data.</strong> Customer is solely responsible for ensuring that all Input submitted to the Comfy Products complies with all Applicable Laws, and Customer agrees that it will not, and will not permit any third party to submit to Comfy or the Comfy Products or otherwise use the Comfy Products to create: (i) any data, designs, or other materials subject to U.S. export control laws and regulations; (ii) any viruses, malware, ransomware, Trojan horses, worms, spyware, or other malicious or harmful code or content that could damage, disrupt, interfere with, or compromise the Comfy Products, Comfy’s systems or infrastructure, or the data or systems of any other user or third party; (iii) any Customer Data that depicts, promotes, or facilitates illegal activity, including without limitation child sexual abuse material, non-consensual intimate imagery, or content that incites violence or hatred against any individual or group; (iv) any Customer Data that infringes or misappropriates the intellectual property rights, privacy rights, or publicity rights of any third party, including without limitation by submitting models, images, or other materials without the right to do so; (v) any content or information that is intentionally deceptive or misleading, including without limitation synthetic media designed to impersonate a real individual without their consent; or (vi) any Customer Data that could reasonably be expected to cause harm to any individual or group.'
  },
  'enterprise-msa.4-payment.label': {
    en: 'PAYMENT',
    'zh-CN': 'PAYMENT'
  },
  'enterprise-msa.4-payment.title': {
    en: '4. Payment',
    'zh-CN': '4. Payment'
  },
  'enterprise-msa.4-payment.block.0': {
    en: '<strong>Fees.</strong> Customer will pay Comfy the fees set forth in the applicable Order Form. Customer shall pay those amounts due and not disputed in good faith within seven (7) days of the date of receipt of the applicable invoice, unless a specific date for payment is set forth in such Order Form, in which case payment will be due on the date specified. Except as otherwise specified herein or in any applicable Order Form, (a) fees are quoted and payable in United States dollars and (b) payment obligations are non-cancelable and non-pro-ratable for partial months, and fees paid are non-refundable. Comfy reserves the right to change its fees upon each renewal term. Customer is responsible for all usage under Customer’s account, including usage by Customer’s Users and under Customer’s credentials and API keys.',
    'zh-CN':
      '<strong>Fees.</strong> Customer will pay Comfy the fees set forth in the applicable Order Form. Customer shall pay those amounts due and not disputed in good faith within seven (7) days of the date of receipt of the applicable invoice, unless a specific date for payment is set forth in such Order Form, in which case payment will be due on the date specified. Except as otherwise specified herein or in any applicable Order Form, (a) fees are quoted and payable in United States dollars and (b) payment obligations are non-cancelable and non-pro-ratable for partial months, and fees paid are non-refundable. Comfy reserves the right to change its fees upon each renewal term. Customer is responsible for all usage under Customer’s account, including usage by Customer’s Users and under Customer’s credentials and API keys.'
  },
  'enterprise-msa.4-payment.block.1': {
    en: '<strong>Prepaid Credits.</strong> Customer may prepay for usage credits (“Credits”) which may be applied toward usage of the Comfy Products at the rates set forth on Comfy’s pricing page. Except for documented billing errors or similar service issues attributed to Comfy, all purchases of Credits are final and non-refundable, and Comfy will not issue refunds or credits for any unused, partially used, or remaining Credits under any circumstances, including upon termination or expiration of Customer’s account. Comfy reserves the right to modify the pricing or Credit redemption rates applicable to future Credit purchases upon reasonable notice, but any Credits purchased prior to such modification will be honored at the rates in effect at the time of purchase.',
    'zh-CN':
      '<strong>Prepaid Credits.</strong> Customer may prepay for usage credits (“Credits”) which may be applied toward usage of the Comfy Products at the rates set forth on Comfy’s pricing page. Except for documented billing errors or similar service issues attributed to Comfy, all purchases of Credits are final and non-refundable, and Comfy will not issue refunds or credits for any unused, partially used, or remaining Credits under any circumstances, including upon termination or expiration of Customer’s account. Comfy reserves the right to modify the pricing or Credit redemption rates applicable to future Credit purchases upon reasonable notice, but any Credits purchased prior to such modification will be honored at the rates in effect at the time of purchase.'
  },
  'enterprise-msa.4-payment.block.2': {
    en: '<strong>Taxes.</strong> Fees are exclusive of all taxes, duties, levies, and similar governmental assessments (including sales, use, VAT/GST, and withholding taxes), and Customer is responsible for all such amounts other than taxes based on Comfy’s net income; if withholding is required by law, Customer will gross up payments so Comfy receives the invoiced amount, unless prohibited by law.',
    'zh-CN':
      '<strong>Taxes.</strong> Fees are exclusive of all taxes, duties, levies, and similar governmental assessments (including sales, use, VAT/GST, and withholding taxes), and Customer is responsible for all such amounts other than taxes based on Comfy’s net income; if withholding is required by law, Customer will gross up payments so Comfy receives the invoiced amount, unless prohibited by law.'
  },
  'enterprise-msa.4-payment.block.3': {
    en: '<strong>Late Payments; Suspension.</strong> Overdue undisputed amounts may accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law, plus reasonable collection costs. Comfy may suspend or limit access to the Comfy Products (including throttling, disabling API keys, or downgrading to the Free Tier) for non-payment of undisputed amounts after providing commercially reasonable notice and an opportunity to cure, unless Comfy reasonably determines immediate suspension is necessary to protect the Comfy Products or comply with Applicable Laws.',
    'zh-CN':
      '<strong>Late Payments; Suspension.</strong> Overdue undisputed amounts may accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law, plus reasonable collection costs. Comfy may suspend or limit access to the Comfy Products (including throttling, disabling API keys, or downgrading to the Free Tier) for non-payment of undisputed amounts after providing commercially reasonable notice and an opportunity to cure, unless Comfy reasonably determines immediate suspension is necessary to protect the Comfy Products or comply with Applicable Laws.'
  },
  'enterprise-msa.5-term-termination.label': {
    en: 'TERM',
    'zh-CN': 'TERM'
  },
  'enterprise-msa.5-term-termination.title': {
    en: '5. Term; Termination',
    'zh-CN': '5. Term; Termination'
  },
  'enterprise-msa.5-term-termination.block.0': {
    en: '<strong>Term.</strong> The term of this Agreement will commence on the Effective Date and continue until terminated as set forth below (“Term”). The initial term of each Order Form will begin on the Subscription Start Date of such Order Form and will continue for the subscription term set forth therein. Except as set forth in such Order Form, the Order Form will renew for successive renewal terms equal to the length of the Initial Subscription Term.',
    'zh-CN':
      '<strong>Term.</strong> The term of this Agreement will commence on the Effective Date and continue until terminated as set forth below (“Term”). The initial term of each Order Form will begin on the Subscription Start Date of such Order Form and will continue for the subscription term set forth therein. Except as set forth in such Order Form, the Order Form will renew for successive renewal terms equal to the length of the Initial Subscription Term.'
  },
  'enterprise-msa.5-term-termination.block.1': {
    en: '<strong>Termination of Agreement.</strong> Each party may terminate this Agreement upon written notice to the other party if there are no Order Forms then in effect. Each party may also terminate this Agreement or the applicable Order Form upon written notice in the event (a) the other party commits any material breach of this Agreement or the applicable Order Form and fails to remedy such breach within thirty (30) days after written notice of such breach or (b) subject to applicable law, upon the other party’s liquidation, commencement of dissolution proceedings or assignment of substantially all its assets for the benefit of creditors, or if the other party becomes the subject of bankruptcy or similar proceeding that is not dismissed within sixty (60) days.',
    'zh-CN':
      '<strong>Termination of Agreement.</strong> Each party may terminate this Agreement upon written notice to the other party if there are no Order Forms then in effect. Each party may also terminate this Agreement or the applicable Order Form upon written notice in the event (a) the other party commits any material breach of this Agreement or the applicable Order Form and fails to remedy such breach within thirty (30) days after written notice of such breach or (b) subject to applicable law, upon the other party’s liquidation, commencement of dissolution proceedings or assignment of substantially all its assets for the benefit of creditors, or if the other party becomes the subject of bankruptcy or similar proceeding that is not dismissed within sixty (60) days.'
  },
  'enterprise-msa.5-term-termination.block.2': {
    en: '<strong>Deletion of Customer Data Upon Termination.</strong> Upon expiration or termination of this Agreement, Comfy will delete Customer Data from its primary production systems within sixty (60) days. Notwithstanding the foregoing, Customer Data may persist in routine backup systems beyond such period solely to the extent necessary under Comfy’s standard backup retention schedule, provided that such data is not actively accessed or used by Comfy and remains subject to the confidentiality obligations of this Agreement.',
    'zh-CN':
      '<strong>Deletion of Customer Data Upon Termination.</strong> Upon expiration or termination of this Agreement, Comfy will delete Customer Data from its primary production systems within sixty (60) days. Notwithstanding the foregoing, Customer Data may persist in routine backup systems beyond such period solely to the extent necessary under Comfy’s standard backup retention schedule, provided that such data is not actively accessed or used by Comfy and remains subject to the confidentiality obligations of this Agreement.'
  },
  'enterprise-msa.5-term-termination.block.3': {
    en: '<strong>Survival.</strong> Termination or expiration will not affect any rights or obligations, including the payment of amounts due, which have accrued under this Agreement up to the date of termination or expiration. Upon termination or expiration of this Agreement, the provisions that are intended by their nature to survive termination will survive and continue in full force and effect in accordance with their terms, including confidentiality obligations, proprietary rights, indemnification, limitations of liability, and disclaimers.',
    'zh-CN':
      '<strong>Survival.</strong> Termination or expiration will not affect any rights or obligations, including the payment of amounts due, which have accrued under this Agreement up to the date of termination or expiration. Upon termination or expiration of this Agreement, the provisions that are intended by their nature to survive termination will survive and continue in full force and effect in accordance with their terms, including confidentiality obligations, proprietary rights, indemnification, limitations of liability, and disclaimers.'
  },
  'enterprise-msa.6-confidentiality.label': {
    en: 'CONFIDENTIALITY',
    'zh-CN': 'CONFIDENTIALITY'
  },
  'enterprise-msa.6-confidentiality.title': {
    en: '6. Confidentiality',
    'zh-CN': '6. Confidentiality'
  },
  'enterprise-msa.6-confidentiality.block.0': {
    en: '<strong>Definition of Confidential Information.</strong> “Confidential Information” means all non-public information disclosed by a party (“Disclosing Party”) to the other party (“Receiving Party”), whether oral or written, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. Confidential Information of Customer includes Customer Data; Confidential Information of Comfy includes the Comfy Products; and each party’s Confidential Information includes the terms of this Agreement and any Order Forms (including pricing), as well as business, financial, marketing, technical, and product information. Confidential Information excludes information that the Receiving Party can demonstrate: (i) is or becomes publicly available without breach; (ii) was known prior to disclosure without breach; (iii) is received from a third party without breach; or (iv) was independently developed without use of or reference to the Disclosing Party’s Confidential Information.',
    'zh-CN':
      '<strong>Definition of Confidential Information.</strong> “Confidential Information” means all non-public information disclosed by a party (“Disclosing Party”) to the other party (“Receiving Party”), whether oral or written, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. Confidential Information of Customer includes Customer Data; Confidential Information of Comfy includes the Comfy Products; and each party’s Confidential Information includes the terms of this Agreement and any Order Forms (including pricing), as well as business, financial, marketing, technical, and product information. Confidential Information excludes information that the Receiving Party can demonstrate: (i) is or becomes publicly available without breach; (ii) was known prior to disclosure without breach; (iii) is received from a third party without breach; or (iv) was independently developed without use of or reference to the Disclosing Party’s Confidential Information.'
  },
  'enterprise-msa.6-confidentiality.block.1': {
    en: '<strong>Protection of Confidential Information.</strong> The Receiving Party will: (a) protect Confidential Information using at least reasonable care; (b) use it solely to perform under this Agreement; and (c) limit access to its and its Affiliates’ employees and contractors with a need to know and confidentiality obligations at least as protective as those herein. Neither party may disclose the terms of this Agreement or any Order Form except to its Affiliates, legal counsel, or accountants, and remains responsible for their compliance. Upon written request, the Receiving Party will promptly return or destroy Confidential Information, except for information retained in routine backups or as required by law or internal retention policies.',
    'zh-CN':
      '<strong>Protection of Confidential Information.</strong> The Receiving Party will: (a) protect Confidential Information using at least reasonable care; (b) use it solely to perform under this Agreement; and (c) limit access to its and its Affiliates’ employees and contractors with a need to know and confidentiality obligations at least as protective as those herein. Neither party may disclose the terms of this Agreement or any Order Form except to its Affiliates, legal counsel, or accountants, and remains responsible for their compliance. Upon written request, the Receiving Party will promptly return or destroy Confidential Information, except for information retained in routine backups or as required by law or internal retention policies.'
  },
  'enterprise-msa.6-confidentiality.block.2': {
    en: '<strong>Compelled Disclosure.</strong> The Receiving Party may disclose Confidential Information if legally required, provided it gives prior notice (where permitted) and reasonable assistance, at the Disclosing Party’s expense, to seek protective treatment. Any disclosure will be limited to what is legally required, and the Receiving Party will request confidential treatment. These obligations survive while Confidential Information remains in the Receiving Party’s possession.',
    'zh-CN':
      '<strong>Compelled Disclosure.</strong> The Receiving Party may disclose Confidential Information if legally required, provided it gives prior notice (where permitted) and reasonable assistance, at the Disclosing Party’s expense, to seek protective treatment. Any disclosure will be limited to what is legally required, and the Receiving Party will request confidential treatment. These obligations survive while Confidential Information remains in the Receiving Party’s possession.'
  },
  'enterprise-msa.6-confidentiality.block.3': {
    en: '<strong>Data Security.</strong> Comfy will implement and maintain commercially reasonable administrative, technical, and physical safeguards designed to protect Customer Data against unauthorized access, disclosure, alteration, or destruction. These measures will be no less protective than those Comfy uses to protect its own confidential information of a similar nature. In the event Comfy becomes aware of a confirmed security breach that results in unauthorized access to or disclosure of Customer Data, Comfy will notify Customer without undue delay and will provide reasonable cooperation to assist Customer in investigating and mitigating the effects of such breach. Customer acknowledges that no security measures are perfect or impenetrable, and Comfy does not guarantee that Customer Data will be free from unauthorized access or disclosure.',
    'zh-CN':
      '<strong>Data Security.</strong> Comfy will implement and maintain commercially reasonable administrative, technical, and physical safeguards designed to protect Customer Data against unauthorized access, disclosure, alteration, or destruction. These measures will be no less protective than those Comfy uses to protect its own confidential information of a similar nature. In the event Comfy becomes aware of a confirmed security breach that results in unauthorized access to or disclosure of Customer Data, Comfy will notify Customer without undue delay and will provide reasonable cooperation to assist Customer in investigating and mitigating the effects of such breach. Customer acknowledges that no security measures are perfect or impenetrable, and Comfy does not guarantee that Customer Data will be free from unauthorized access or disclosure.'
  },
  'enterprise-msa.7-proprietary-rights.label': {
    en: 'IP',
    'zh-CN': 'IP'
  },
  'enterprise-msa.7-proprietary-rights.title': {
    en: '7. Proprietary Rights',
    'zh-CN': '7. Proprietary Rights'
  },
  'enterprise-msa.7-proprietary-rights.block.0': {
    en: '<strong>Reservation of Rights.</strong> Comfy and its licensors retain all right, title, and interest, including all intellectual property and proprietary rights, in and to the Comfy Products, Comfy Branding, and all software, code, algorithms, protocols, interfaces, tools, documentation, data structures, and other technology underlying or embodied in, or used to provide, the Comfy Products (collectively, “Comfy Materials”). Except for the limited rights expressly granted to Customer under this Agreement, no rights or licenses are granted, whether by implication, estoppel, or otherwise. Comfy expressly reserves all rights in and to the Comfy Materials not expressly granted hereunder.',
    'zh-CN':
      '<strong>Reservation of Rights.</strong> Comfy and its licensors retain all right, title, and interest, including all intellectual property and proprietary rights, in and to the Comfy Products, Comfy Branding, and all software, code, algorithms, protocols, interfaces, tools, documentation, data structures, and other technology underlying or embodied in, or used to provide, the Comfy Products (collectively, “Comfy Materials”). Except for the limited rights expressly granted to Customer under this Agreement, no rights or licenses are granted, whether by implication, estoppel, or otherwise. Comfy expressly reserves all rights in and to the Comfy Materials not expressly granted hereunder.'
  },
  'enterprise-msa.7-proprietary-rights.block.1': {
    en: '<strong>Feedback.</strong> Customer may from time to time provide feedback (including suggestions, comments for enhancements, functionality or usability, etc.) (“Feedback”) to Comfy regarding Customer’s experience using, and needs and integration requirements for, the Comfy Products. Comfy shall have full discretion to determine whether or not to proceed with the development of any requested enhancements, new features or functionality, and Customer hereby grants Comfy the full, unencumbered, royalty-free right to incorporate and otherwise fully exploit Feedback in connection with Comfy’s products and services.',
    'zh-CN':
      '<strong>Feedback.</strong> Customer may from time to time provide feedback (including suggestions, comments for enhancements, functionality or usability, etc.) (“Feedback”) to Comfy regarding Customer’s experience using, and needs and integration requirements for, the Comfy Products. Comfy shall have full discretion to determine whether or not to proceed with the development of any requested enhancements, new features or functionality, and Customer hereby grants Comfy the full, unencumbered, royalty-free right to incorporate and otherwise fully exploit Feedback in connection with Comfy’s products and services.'
  },
  'enterprise-msa.7-proprietary-rights.block.2': {
    en: '<strong>Operational Metadata.</strong> Customer agrees that Comfy may collect and use Operational Metadata to operate, maintain, improve, and support the Comfy Products, including for diagnostics, analytics, system performance, and reporting purposes. Comfy will only disclose Operational Metadata externally if such data is (a) aggregated or anonymized with data across other customers, and (b) does not disclose the identity of Customer or any Customer Confidential Information.',
    'zh-CN':
      '<strong>Operational Metadata.</strong> Customer agrees that Comfy may collect and use Operational Metadata to operate, maintain, improve, and support the Comfy Products, including for diagnostics, analytics, system performance, and reporting purposes. Comfy will only disclose Operational Metadata externally if such data is (a) aggregated or anonymized with data across other customers, and (b) does not disclose the identity of Customer or any Customer Confidential Information.'
  },
  'enterprise-msa.8-warranties-disclaimer.label': {
    en: 'WARRANTIES',
    'zh-CN': 'WARRANTIES'
  },
  'enterprise-msa.8-warranties-disclaimer.title': {
    en: '8. Warranties; Disclaimer',
    'zh-CN': '8. Warranties; Disclaimer'
  },
  'enterprise-msa.8-warranties-disclaimer.block.0': {
    en: '<strong>Comfy.</strong> Comfy warrants that it will, consistent with prevailing industry standards, provide the Comfy Products in a professional and workmanlike manner and the Comfy Products will conform in all material respects with the Documentation. For material breach of the foregoing express warranty, Customer’s exclusive remedy shall be the re-performance of the deficient Comfy Products or, if Comfy cannot re-perform such deficient Comfy Products as warranted within thirty (30) days after receipt of written notice of the warranty breach, Customer shall be entitled to terminate the applicable Order Form and recover a pro-rata portion of the prepaid subscription fees corresponding to the terminated portion of the applicable subscription term.',
    'zh-CN':
      '<strong>Comfy.</strong> Comfy warrants that it will, consistent with prevailing industry standards, provide the Comfy Products in a professional and workmanlike manner and the Comfy Products will conform in all material respects with the Documentation. For material breach of the foregoing express warranty, Customer’s exclusive remedy shall be the re-performance of the deficient Comfy Products or, if Comfy cannot re-perform such deficient Comfy Products as warranted within thirty (30) days after receipt of written notice of the warranty breach, Customer shall be entitled to terminate the applicable Order Form and recover a pro-rata portion of the prepaid subscription fees corresponding to the terminated portion of the applicable subscription term.'
  },
  'enterprise-msa.8-warranties-disclaimer.block.1': {
    en: '<strong>Customer.</strong> Customer represents and warrants that it owns or has obtained all necessary rights, licenses, and permissions to submit Customer Data to the Comfy Products, and that Customer Data does not include any content that Customer is legally prohibited from sharing or processing through the Comfy Products.',
    'zh-CN':
      '<strong>Customer.</strong> Customer represents and warrants that it owns or has obtained all necessary rights, licenses, and permissions to submit Customer Data to the Comfy Products, and that Customer Data does not include any content that Customer is legally prohibited from sharing or processing through the Comfy Products.'
  },
  'enterprise-msa.8-warranties-disclaimer.block.2': {
    en: '<strong>Disclaimer.</strong> EXCEPT AS SET FORTH HEREIN, THE COMFY PRODUCTS AND OUTPUT ARE PROVIDED “AS IS” WITHOUT ANY WARRANTY OF ANY KIND. COMFY DISCLAIMS ANY AND ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS RELATING TO THE COMFY PRODUCTS (INCLUDING ANY OUTPUT), WHETHER EXPRESS, IMPLIED, INCLUDING, BUT NOT LIMITED TO, ANY REPRESENTATION, WARRANTY, OR CONDITION OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE OR NON-INFRINGEMENT. CUSTOMER AGREES AND ACKNOWLEDGES THAT CUSTOMER’S USE OF ANY OUTPUT PROVIDED BY THE COMFY PRODUCTS IS AT CUSTOMER’S OWN RISK. Customer is solely responsible for (a) verifying the Output is appropriate for Customer’s use case, and (b) any decisions, actions, or omissions taken in reliance on the OUTPUT. IN NO EVENT WILL COMFY BE LIABLE FOR ANY DAMAGES OR LOSSES ARISING FROM OR RELATED TO CUSTOMER’S USE OF OR RELIANCE ON THE OUTPUT, INCLUDING ANY DECISIONS MADE OR ACTIONS TAKEN BASED ON THE OUTPUT.',
    'zh-CN':
      '<strong>Disclaimer.</strong> EXCEPT AS SET FORTH HEREIN, THE COMFY PRODUCTS AND OUTPUT ARE PROVIDED “AS IS” WITHOUT ANY WARRANTY OF ANY KIND. COMFY DISCLAIMS ANY AND ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS RELATING TO THE COMFY PRODUCTS (INCLUDING ANY OUTPUT), WHETHER EXPRESS, IMPLIED, INCLUDING, BUT NOT LIMITED TO, ANY REPRESENTATION, WARRANTY, OR CONDITION OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE OR NON-INFRINGEMENT. CUSTOMER AGREES AND ACKNOWLEDGES THAT CUSTOMER’S USE OF ANY OUTPUT PROVIDED BY THE COMFY PRODUCTS IS AT CUSTOMER’S OWN RISK. Customer is solely responsible for (a) verifying the Output is appropriate for Customer’s use case, and (b) any decisions, actions, or omissions taken in reliance on the OUTPUT. IN NO EVENT WILL COMFY BE LIABLE FOR ANY DAMAGES OR LOSSES ARISING FROM OR RELATED TO CUSTOMER’S USE OF OR RELIANCE ON THE OUTPUT, INCLUDING ANY DECISIONS MADE OR ACTIONS TAKEN BASED ON THE OUTPUT.'
  },
  'enterprise-msa.9-limitation-of-liability.label': {
    en: 'LIABILITY',
    'zh-CN': 'LIABILITY'
  },
  'enterprise-msa.9-limitation-of-liability.title': {
    en: '9. Limitation of Liability',
    'zh-CN': '9. Limitation of Liability'
  },
  'enterprise-msa.9-limitation-of-liability.block.0': {
    en: 'UNDER NO LEGAL THEORY, WHETHER IN TORT, CONTRACT, OR OTHERWISE, WILL EITHER PARTY BE LIABLE TO THE OTHER UNDER THIS AGREEMENT FOR (A) ANY INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL OR PUNITIVE DAMAGES OF ANY CHARACTER, INCLUDING DAMAGES FOR LOSS OF GOODWILL, LOST PROFITS, LOST SALES OR BUSINESS, WORK STOPPAGE, COMPUTER FAILURE OR MALFUNCTION, LOST CONTENT OR DATA, EVEN IF A REPRESENTATIVE OF SUCH PARTY HAS BEEN ADVISED, KNEW OR SHOULD HAVE KNOWN OF THE POSSIBILITY OF SUCH DAMAGES, OR (B) EXCLUDING CUSTOMER’S PAYMENT OBLIGATIONS, ANY AGGREGATE DAMAGES, COSTS, OR LIABILITIES IN EXCESS OF THE AMOUNTS PAID BY CUSTOMER UNDER THE APPLICABLE ORDER FORM DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.',
    'zh-CN':
      'UNDER NO LEGAL THEORY, WHETHER IN TORT, CONTRACT, OR OTHERWISE, WILL EITHER PARTY BE LIABLE TO THE OTHER UNDER THIS AGREEMENT FOR (A) ANY INDIRECT, SPECIAL, INCIDENTAL, CONSEQUENTIAL OR PUNITIVE DAMAGES OF ANY CHARACTER, INCLUDING DAMAGES FOR LOSS OF GOODWILL, LOST PROFITS, LOST SALES OR BUSINESS, WORK STOPPAGE, COMPUTER FAILURE OR MALFUNCTION, LOST CONTENT OR DATA, EVEN IF A REPRESENTATIVE OF SUCH PARTY HAS BEEN ADVISED, KNEW OR SHOULD HAVE KNOWN OF THE POSSIBILITY OF SUCH DAMAGES, OR (B) EXCLUDING CUSTOMER’S PAYMENT OBLIGATIONS, ANY AGGREGATE DAMAGES, COSTS, OR LIABILITIES IN EXCESS OF THE AMOUNTS PAID BY CUSTOMER UNDER THE APPLICABLE ORDER FORM DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.'
  },
  'enterprise-msa.10-indemnification.label': {
    en: 'INDEMNITY',
    'zh-CN': 'INDEMNITY'
  },
  'enterprise-msa.10-indemnification.title': {
    en: '10. Indemnification',
    'zh-CN': '10. Indemnification'
  },
  'enterprise-msa.10-indemnification.block.0': {
    en: '<strong>Indemnity by Comfy.</strong> Comfy will defend Customer against any claim, demand, suit, or proceeding (“Claim”) made or brought against Customer by a third party alleging that the Comfy Products as provided by Comfy infringes or misappropriates a U.S. patent, copyright or trade secret and will indemnify Customer for any damages finally awarded against Customer (or any settlement approved by Comfy) in connection with any such Claim; provided that (a) Customer will promptly notify Comfy of such Claim, (b) Comfy will have the sole and exclusive authority to defend and/or settle any such Claim (provided that Comfy may not settle any Claim without Customer’s prior written consent, which will not be unreasonably withheld, unless it unconditionally releases Customer of all related liability) and (c) Customer reasonably cooperates with Comfy in connection therewith. If the use of the Comfy Products by Customer has become, or in Comfy’s opinion is likely to become, the subject of any claim of infringement, Comfy may at its option and expense (i) procure for Customer the right to continue using and receiving the Comfy Products as set forth hereunder; (ii) replace or modify the Comfy Products to make it non-infringing (with comparable functionality); or (iii) if the options in clauses (i) or (ii) are not reasonably practicable, terminate the applicable Order Form and provide a pro rata refund of any prepaid subscription fees corresponding to the terminated portion of the applicable subscription term. Comfy will have no liability or obligation with respect to any Claim to the extent such Claim is caused by (A) prompts, inputs, or other instructions or materials submitted by Customer or its Users; (B) Customer’s use of any outputs, generated content, or models in a manner not authorized under this Agreement; (C) modification of any generated outputs by or on behalf of Customer; (D) Customer Data, including any third-party intellectual property, likenesses, or other proprietary material incorporated therein; or (E) Customer’s failure to obtain rights, consents, or clearances required for the submission or use of any content through the Comfy Products (clauses (A) through (E), “Excluded Claims”). This Section states Comfy’s sole and exclusive liability and obligation, and Customer’s exclusive remedy, for any claim of any nature related to infringement or misappropriation of intellectual property.',
    'zh-CN':
      '<strong>Indemnity by Comfy.</strong> Comfy will defend Customer against any claim, demand, suit, or proceeding (“Claim”) made or brought against Customer by a third party alleging that the Comfy Products as provided by Comfy infringes or misappropriates a U.S. patent, copyright or trade secret and will indemnify Customer for any damages finally awarded against Customer (or any settlement approved by Comfy) in connection with any such Claim; provided that (a) Customer will promptly notify Comfy of such Claim, (b) Comfy will have the sole and exclusive authority to defend and/or settle any such Claim (provided that Comfy may not settle any Claim without Customer’s prior written consent, which will not be unreasonably withheld, unless it unconditionally releases Customer of all related liability) and (c) Customer reasonably cooperates with Comfy in connection therewith. If the use of the Comfy Products by Customer has become, or in Comfy’s opinion is likely to become, the subject of any claim of infringement, Comfy may at its option and expense (i) procure for Customer the right to continue using and receiving the Comfy Products as set forth hereunder; (ii) replace or modify the Comfy Products to make it non-infringing (with comparable functionality); or (iii) if the options in clauses (i) or (ii) are not reasonably practicable, terminate the applicable Order Form and provide a pro rata refund of any prepaid subscription fees corresponding to the terminated portion of the applicable subscription term. Comfy will have no liability or obligation with respect to any Claim to the extent such Claim is caused by (A) prompts, inputs, or other instructions or materials submitted by Customer or its Users; (B) Customer’s use of any outputs, generated content, or models in a manner not authorized under this Agreement; (C) modification of any generated outputs by or on behalf of Customer; (D) Customer Data, including any third-party intellectual property, likenesses, or other proprietary material incorporated therein; or (E) Customer’s failure to obtain rights, consents, or clearances required for the submission or use of any content through the Comfy Products (clauses (A) through (E), “Excluded Claims”). This Section states Comfy’s sole and exclusive liability and obligation, and Customer’s exclusive remedy, for any claim of any nature related to infringement or misappropriation of intellectual property.'
  },
  'enterprise-msa.10-indemnification.block.1': {
    en: '<strong>Indemnification by Customer.</strong> Customer will defend Comfy against any Claim made or brought against Comfy by a third party to the extent arising out of Customer’s breach of Section 3 or the Excluded Claims, and Customer will indemnify Comfy for any damages finally awarded against Comfy (or any settlement approved by Customer) in connection with any such Claim; provided that (a) Comfy will promptly notify Customer of such Claim, (b) Customer will have the sole and exclusive authority to defend and/or settle any such Claim (provided that Customer may not settle any Claim without Comfy’s prior written consent, which will not be unreasonably withheld, unless it unconditionally releases Comfy of all liability) and (c) Comfy reasonably cooperates with Customer in connection therewith.',
    'zh-CN':
      '<strong>Indemnification by Customer.</strong> Customer will defend Comfy against any Claim made or brought against Comfy by a third party to the extent arising out of Customer’s breach of Section 3 or the Excluded Claims, and Customer will indemnify Comfy for any damages finally awarded against Comfy (or any settlement approved by Customer) in connection with any such Claim; provided that (a) Comfy will promptly notify Customer of such Claim, (b) Customer will have the sole and exclusive authority to defend and/or settle any such Claim (provided that Customer may not settle any Claim without Comfy’s prior written consent, which will not be unreasonably withheld, unless it unconditionally releases Comfy of all liability) and (c) Comfy reasonably cooperates with Customer in connection therewith.'
  },
  'enterprise-msa.11-miscellaneous.label': {
    en: 'MISCELLANEOUS',
    'zh-CN': 'MISCELLANEOUS'
  },
  'enterprise-msa.11-miscellaneous.title': {
    en: '11. Miscellaneous',
    'zh-CN': '11. Miscellaneous'
  },
  'enterprise-msa.11-miscellaneous.block.0': {
    en: '<strong>Governing Law.</strong> This Agreement will be governed by the laws of the State of California, exclusive of its rules governing choice of law and conflict of laws. The parties agree to the exclusive jurisdiction and venue of the state and federal courts located in San Francisco, CA and each party irrevocably submits to such jurisdiction and venue and waives any objection based on inconvenient forum. This Agreement will not be governed by the United Nations Convention on Contracts for the International Sale of Goods.',
    'zh-CN':
      '<strong>Governing Law.</strong> This Agreement will be governed by the laws of the State of California, exclusive of its rules governing choice of law and conflict of laws. The parties agree to the exclusive jurisdiction and venue of the state and federal courts located in San Francisco, CA and each party irrevocably submits to such jurisdiction and venue and waives any objection based on inconvenient forum. This Agreement will not be governed by the United Nations Convention on Contracts for the International Sale of Goods.'
  },
  'enterprise-msa.11-miscellaneous.block.1': {
    en: '<strong>Export Compliance.</strong> Customer will comply with the export laws and regulations of the United States, the European Union and other applicable jurisdictions in using the Comfy Products.',
    'zh-CN':
      '<strong>Export Compliance.</strong> Customer will comply with the export laws and regulations of the United States, the European Union and other applicable jurisdictions in using the Comfy Products.'
  },
  'enterprise-msa.11-miscellaneous.block.2': {
    en: '<strong>Publicity.</strong> Customer agrees that Comfy may refer to Customer’s name, logo, and trademarks in Comfy’s marketing materials and website; however, Comfy will not use Customer’s name or trademarks in any other publicity (e.g., press releases, customer references and case studies) without Customer’s prior written consent (which may be by email) not to be unreasonably withheld, conditioned, or delayed.',
    'zh-CN':
      '<strong>Publicity.</strong> Customer agrees that Comfy may refer to Customer’s name, logo, and trademarks in Comfy’s marketing materials and website; however, Comfy will not use Customer’s name or trademarks in any other publicity (e.g., press releases, customer references and case studies) without Customer’s prior written consent (which may be by email) not to be unreasonably withheld, conditioned, or delayed.'
  },
  'enterprise-msa.11-miscellaneous.block.3': {
    en: '<strong>Third-Party Infrastructure.</strong> Customer acknowledges that the Comfy Products relies on third-party infrastructure, hardware, and services, including cloud computing providers and GPU infrastructure providers (collectively, “Third-Party Infrastructure”), and that the availability, performance, and security of the Comfy Products may be affected by the operation, maintenance, or failure of such Third-Party Infrastructure. Comfy will use commercially reasonable efforts to maintain Comfy Products availability but makes no representation or warranty regarding the performance or availability of any Third-Party Infrastructure, and Comfy shall have no liability to Customer for any interruption, degradation, loss of data, or other harm arising out of or related to any failure, outage, or limitation of Third-Party Infrastructure, whether or not within Comfy’s control.',
    'zh-CN':
      '<strong>Third-Party Infrastructure.</strong> Customer acknowledges that the Comfy Products relies on third-party infrastructure, hardware, and services, including cloud computing providers and GPU infrastructure providers (collectively, “Third-Party Infrastructure”), and that the availability, performance, and security of the Comfy Products may be affected by the operation, maintenance, or failure of such Third-Party Infrastructure. Comfy will use commercially reasonable efforts to maintain Comfy Products availability but makes no representation or warranty regarding the performance or availability of any Third-Party Infrastructure, and Comfy shall have no liability to Customer for any interruption, degradation, loss of data, or other harm arising out of or related to any failure, outage, or limitation of Third-Party Infrastructure, whether or not within Comfy’s control.'
  },
  'enterprise-msa.11-miscellaneous.block.4': {
    en: '<strong>Assignment; Delegation.</strong> Neither party hereto may assign or otherwise transfer this Agreement, in whole or in part, without the other party’s prior written consent, except that Comfy may assign this Agreement without consent to a successor to all or substantially all of its assets or business related to this Agreement. Any attempted assignment, delegation, or transfer by either party in violation hereof will be null and void. Subject to the foregoing, this Agreement will be binding on the parties and their successors and assigns.',
    'zh-CN':
      '<strong>Assignment; Delegation.</strong> Neither party hereto may assign or otherwise transfer this Agreement, in whole or in part, without the other party’s prior written consent, except that Comfy may assign this Agreement without consent to a successor to all or substantially all of its assets or business related to this Agreement. Any attempted assignment, delegation, or transfer by either party in violation hereof will be null and void. Subject to the foregoing, this Agreement will be binding on the parties and their successors and assigns.'
  },
  'enterprise-msa.11-miscellaneous.block.5': {
    en: '<strong>Amendment; Waiver.</strong> No amendment or modification to this Agreement, nor any waiver of any rights hereunder, will be effective unless assented to in writing by both parties. Any such waiver will be only to the specific provision and under the specific circumstances for which it was given and will not apply with respect to any repeated or continued violation of the same provision or any other provision. Failure or delay by either party to enforce any provision of this Agreement will not be deemed a waiver of future enforcement of that or any other provision.',
    'zh-CN':
      '<strong>Amendment; Waiver.</strong> No amendment or modification to this Agreement, nor any waiver of any rights hereunder, will be effective unless assented to in writing by both parties. Any such waiver will be only to the specific provision and under the specific circumstances for which it was given and will not apply with respect to any repeated or continued violation of the same provision or any other provision. Failure or delay by either party to enforce any provision of this Agreement will not be deemed a waiver of future enforcement of that or any other provision.'
  },
  'enterprise-msa.11-miscellaneous.block.6': {
    en: '<strong>Relationship.</strong> Nothing contained herein will in any way constitute any association, partnership, agency, employment or joint venture between the parties hereto, or be construed to evidence the intention of the parties to establish any such relationship. Neither party will have the authority to obligate or bind the other in any manner, and nothing herein contained will give rise to, or is intended to give rise to any rights of any kind in favor of any third parties.',
    'zh-CN':
      '<strong>Relationship.</strong> Nothing contained herein will in any way constitute any association, partnership, agency, employment or joint venture between the parties hereto, or be construed to evidence the intention of the parties to establish any such relationship. Neither party will have the authority to obligate or bind the other in any manner, and nothing herein contained will give rise to, or is intended to give rise to any rights of any kind in favor of any third parties.'
  },
  'enterprise-msa.11-miscellaneous.block.7': {
    en: '<strong>Unenforceability.</strong> If a court of competent jurisdiction determines that any provision of this Agreement is invalid, illegal, or otherwise unenforceable, such provision will be enforced as nearly as possible in accordance with the stated intention of the parties, while the remainder of this Agreement will remain in full force and effect and bind the parties according to its terms.',
    'zh-CN':
      '<strong>Unenforceability.</strong> If a court of competent jurisdiction determines that any provision of this Agreement is invalid, illegal, or otherwise unenforceable, such provision will be enforced as nearly as possible in accordance with the stated intention of the parties, while the remainder of this Agreement will remain in full force and effect and bind the parties according to its terms.'
  },
  'enterprise-msa.11-miscellaneous.block.8': {
    en: '<strong>Notices.</strong> Any notice required or permitted to be given hereunder will be given in writing by personal delivery, certified mail, return receipt requested, or by overnight delivery. Notices to the parties must be sent to the respective address set forth in the signature blocks below, or such other address designated pursuant to this Section.',
    'zh-CN':
      '<strong>Notices.</strong> Any notice required or permitted to be given hereunder will be given in writing by personal delivery, certified mail, return receipt requested, or by overnight delivery. Notices to the parties must be sent to the respective address set forth in the signature blocks below, or such other address designated pursuant to this Section.'
  },
  'enterprise-msa.11-miscellaneous.block.9': {
    en: '<strong>Force Majeure.</strong> Neither party will be deemed in breach hereunder for any cessation, interruption or delay in the performance of its obligations due to causes beyond its reasonable control, including earthquake, flood, or other natural disaster, act of God, labor controversy, civil disturbance, terrorism, war (whether or not officially declared), cyber attacks (e.g., denial of service attacks), or the inability to obtain sufficient supplies, transportation, or other essential commodity or service required in the conduct of its business, or any change in or the adoption of any law, regulation, judgment or decree for which the party could not reasonably prepare mitigation in advance.',
    'zh-CN':
      '<strong>Force Majeure.</strong> Neither party will be deemed in breach hereunder for any cessation, interruption or delay in the performance of its obligations due to causes beyond its reasonable control, including earthquake, flood, or other natural disaster, act of God, labor controversy, civil disturbance, terrorism, war (whether or not officially declared), cyber attacks (e.g., denial of service attacks), or the inability to obtain sufficient supplies, transportation, or other essential commodity or service required in the conduct of its business, or any change in or the adoption of any law, regulation, judgment or decree for which the party could not reasonably prepare mitigation in advance.'
  },
  'enterprise-msa.11-miscellaneous.block.10': {
    en: '<strong>Entire Agreement.</strong> This Agreement comprises the entire agreement between Customer and Comfy with respect to its subject matter, and supersedes all prior and contemporaneous proposals, statements, sales materials or presentations and agreements (oral and written). No oral or written information or advice given by Comfy, its agents or employees will create a warranty or in any way increase the scope of the warranties in this Agreement.',
    'zh-CN':
      '<strong>Entire Agreement.</strong> This Agreement comprises the entire agreement between Customer and Comfy with respect to its subject matter, and supersedes all prior and contemporaneous proposals, statements, sales materials or presentations and agreements (oral and written). No oral or written information or advice given by Comfy, its agents or employees will create a warranty or in any way increase the scope of the warranties in this Agreement.'
  },
  'enterprise-msa.12-exhibit-a.label': {
    en: 'EXHIBIT A',
    'zh-CN': 'EXHIBIT A'
  },
  'enterprise-msa.12-exhibit-a.title': {
    en: 'Exhibit A. Order Form',
    'zh-CN': 'Exhibit A. Order Form'
  },
  'enterprise-msa.12-exhibit-a.block.0': {
    en: 'The initial Order Form is attached as <strong>Exhibit A</strong> to the executed copy of this Agreement. Each Order Form is subject to the terms and conditions of this Agreement, and by executing an Order Form, Customer agrees to be bound by the terms and conditions of this Agreement.',
    'zh-CN':
      'The initial Order Form is attached as <strong>Exhibit A</strong> to the executed copy of this Agreement. Each Order Form is subject to the terms and conditions of this Agreement, and by executing an Order Form, Customer agrees to be bound by the terms and conditions of this Agreement.'
  },
  'enterprise-msa.12-exhibit-a.block.1': {
    en: 'This document reproduces the current template of the Enterprise Customer Agreement for reference only. The executed Agreement between Comfy and Customer, together with any signed Order Forms, governs the relationship between the parties. To request an executable copy, please contact <a href="mailto:sales@comfy.org" class="text-white underline">sales@comfy.org</a>.',
    'zh-CN':
      'This document reproduces the current template of the Enterprise Customer Agreement for reference only. The executed Agreement between Comfy and Customer, together with any signed Order Forms, governs the relationship between the parties. To request an executable copy, please contact <a href="mailto:sales@comfy.org" class="text-white underline">sales@comfy.org</a>.'
  },
  'enterprise-msa.page.title': {
    en: 'Enterprise MSA - Comfy',
    'zh-CN': 'Enterprise MSA - Comfy'
  },
  'enterprise-msa.page.description': {
    en: 'Comfy Enterprise Customer Agreement — the master services agreement that governs Comfy Enterprise deployments of Comfy Cloud, Comfy API, and related products.',
    'zh-CN':
      'Comfy Enterprise Customer Agreement — the master services agreement that governs Comfy Enterprise deployments of Comfy Cloud, Comfy API, and related products.'
  },
  'enterprise-msa.page.heading': {
    en: 'Enterprise Customer Agreement',
    'zh-CN': 'Enterprise Customer Agreement'
  },
  'enterprise-msa.page.tocLabel': {
    en: 'On this page',
    'zh-CN': 'On this page'
  },
  'enterprise-msa.page.effectiveDateLabel': {
    en: 'Effective Date',
    'zh-CN': 'Effective Date'
  },
  'enterprise-msa.page.parties': {
    en: 'This Enterprise Customer Agreement (the “Agreement”) is entered into by and between Comfy Organization, Inc., a Delaware corporation (“Comfy”), and the entity identified on the applicable Order Form (“Customer”), and is effective as of the date set forth on the applicable Order Form (the “Effective Date”).',
    'zh-CN':
      'This Enterprise Customer Agreement (the “Agreement”) is entered into by and between Comfy Organization, Inc., a Delaware corporation (“Comfy”), and the entity identified on the applicable Order Form (“Customer”), and is effective as of the date set forth on the applicable Order Form (the “Effective Date”).'
  },
  'footer.enterpriseMsa': {
    en: 'Enterprise MSA',
    'zh-CN': 'Enterprise MSA'
  },

  // Customers page
  'customers.hero.label': {
    en: 'CUSTOMER STORIES',
    'zh-CN': '客户故事'
  },
  'customers.hero.heading': {
    en: 'How the most innovative and creative companies use Comfy',
    'zh-CN': '最具创新力和创造力的公司如何使用 Comfy'
  },
  'customers.hero.body': {
    en: 'From solo artists to global studios — teams building the future of visual media run on ComfyUI.',
    'zh-CN':
      '从独立艺术家到全球工作室——构建视觉媒体未来的团队都在使用 ComfyUI。'
  },
  'customers.contact.label': { en: 'CONTACT', 'zh-CN': '联系' },
  'customers.contact.heading': {
    en: 'Interested in a case study with ComfyUI? Reach out <a href="https://docs.google.com/forms/d/e/1FAIpQLSd-Keeq1VIePeanQIsdHq9eYeDE82MHJTdvwdgpxCoEzo_CUg/viewform" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">here</a>',
    'zh-CN':
      '有兴趣与 ComfyUI 合作案例研究？点击<a href="https://docs.google.com/forms/d/e/1FAIpQLSd-Keeq1VIePeanQIsdHq9eYeDE82MHJTdvwdgpxCoEzo_CUg/viewform" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">此处</a>联系我们'
  },

  'customers.story.readMore': {
    en: 'READ MORE ON THIS TOPIC',
    'zh-CN': '阅读更多相关内容'
  },

  // Contact – FormSection
  'contact.form.badge': {
    en: 'CONTACT SALES',
    'zh-CN': '联系销售'
  },
  'contact.form.heading': {
    en: 'Create powerful workflows,\nscale without limits.',
    'zh-CN': '创建强大的工作流，\n无限扩展。'
  },
  'contact.form.description': {
    en: "From design studios to production houses, we're building a platform that empowers your team with access to powerful creation on demand. Let's explore what might work for your needs.",
    'zh-CN':
      '从设计工作室到制作公司，我们正在构建一个平台，让您的团队按需获取强大的创作能力。让我们一起探索适合您需求的方案。'
  },
  'contact.form.supportLink': {
    en: 'Looking for technical or product support?',
    'zh-CN': '需要技术或产品支持？'
  },
  'contact.form.supportLinkCta': {
    en: 'Find your answer here',
    'zh-CN': '在这里找到答案'
  },
  'contact.form.embedLoadErrorPrefix': {
    en: 'Unable to load the contact form. Email us at',
    'zh-CN': '联系表单无法加载。请发送邮件至'
  },
  'contact.form.embedLoadErrorSuffix': {
    en: "and we'll route your request.",
    'zh-CN': '我们会为您处理请求。'
  },

  'demos.category.templates': { en: 'TEMPLATES', 'zh-CN': '模板' },
  'demos.category.gettingStarted': { en: 'GETTING STARTED', 'zh-CN': '入门' },

  'demos.image-to-video.title': {
    en: 'Create a Video from an Image',
    'zh-CN': '从图片创建视频'
  },
  'demos.image-to-video.description': {
    en: 'Learn how to use the Image to Video workflow template in ComfyUI to generate short video clips from a single image.',
    'zh-CN':
      '了解如何使用 ComfyUI 中的图片转视频工作流模板，从单张图片生成短视频。'
  },
  'demos.image-to-video.transcript': {
    en: '<ol><li><strong>Open ComfyUI</strong> — Launch the application and you\'ll see the node-based workflow canvas where all your AI pipelines are built.</li><li><strong>Browse templates</strong> — Click the workflow templates button in the sidebar to browse available starting points.</li><li><strong>Select Image to Video</strong> — Find and select the "Image to Video" template from the list to load it onto your canvas.</li><li><strong>Upload your image</strong> — Click the image upload node and select the source image you want to animate.</li><li><strong>Run the workflow</strong> — Click the "Queue" button to execute the workflow and generate your video output.</li></ol>',
    'zh-CN':
      '<ol><li><strong>打开 ComfyUI</strong> — 启动应用程序，您将看到基于节点的工作流画布。</li><li><strong>浏览模板</strong> — 点击侧栏中的工作流模板按钮，浏览可用模板。</li><li><strong>选择图片转视频</strong> — 从列表中找到并选择"图片转视频"模板。</li><li><strong>上传图片</strong> — 点击图片上传节点，选择要动画化的源图片。</li><li><strong>运行工作流</strong> — 点击"排队"按钮执行工作流并生成视频输出。</li></ol>'
  },

  'demos.workflow-templates.title': {
    en: 'Browse Workflow Templates',
    'zh-CN': '浏览工作流模板'
  },
  'demos.workflow-templates.description': {
    en: "Explore ComfyUI's built-in workflow templates to quickly get started with common AI generation tasks.",
    'zh-CN': '探索 ComfyUI 内置的工作流模板，快速开始常见的 AI 生成任务。'
  },
  'demos.workflow-templates.transcript': {
    en: '<ol><li><strong>Open the template browser</strong> — Click the templates icon in the ComfyUI sidebar to open the template library.</li><li><strong>Browse categories</strong> — Templates are organized by task: image generation, video, upscaling, and more.</li><li><strong>Preview a template</strong> — Hover over any template to see a preview of its workflow and expected output.</li><li><strong>Load and customize</strong> — Click to load a template, then modify parameters to fit your needs.</li></ol>',
    'zh-CN':
      '<ol><li><strong>打开模板浏览器</strong> — 点击 ComfyUI 侧栏中的模板图标。</li><li><strong>浏览分类</strong> — 模板按任务分类：图像生成、视频、放大等。</li><li><strong>预览模板</strong> — 将鼠标悬停在模板上查看预览。</li><li><strong>加载并自定义</strong> — 点击加载模板，然后修改参数。</li></ol>'
  },

  'demos.community-workflows.title': {
    en: 'Explore and Use a Community Workflow from the Hub',
    'zh-CN': '探索并使用社区工作流'
  },
  'demos.community-workflows.description': {
    en: 'Discover how to find and get started with popular community workflows for generative AI projects.',
    'zh-CN': '了解如何查找并使用流行的社区工作流来构建生成式 AI 项目。'
  },
  'demos.community-workflows.transcript': {
    en: '<ol><li><strong>Open the Workflow Hub</strong> — From the ComfyUI sidebar, navigate to the community Workflow Hub to browse curated and trending workflows shared by the community.</li><li><strong>Browse popular workflows</strong> — Explore featured projects sorted by popularity, recency, and category to find one that matches your goal.</li><li><strong>Preview a workflow</strong> — Click a workflow card to see example outputs, required models, and a description of what it produces.</li><li><strong>Open in ComfyUI</strong> — Use the "Get Started" action to load the selected community workflow directly onto your canvas.</li><li><strong>Run and customize</strong> — Queue the workflow to generate your first result, then tweak prompts, models, and parameters to make it your own.</li></ol>',
    'zh-CN':
      '<ol><li><strong>打开工作流中心</strong> — 在 ComfyUI 侧栏中，进入社区工作流中心，浏览社区分享的精选和热门工作流。</li><li><strong>浏览热门工作流</strong> — 按热度、时间和分类浏览精选项目，找到符合需求的工作流。</li><li><strong>预览工作流</strong> — 点击工作流卡片，查看示例输出、所需模型和功能描述。</li><li><strong>在 ComfyUI 中打开</strong> — 使用"开始使用"按钮，将选中的社区工作流直接加载到画布。</li><li><strong>运行并自定义</strong> — 排队执行工作流以生成首个结果，然后调整提示词、模型和参数。</li></ol>'
  },

  'demos.nav.nextDemo': { en: "What's Next", 'zh-CN': '下一个演示' },
  'demos.nav.viewDemo': { en: 'View Demo', 'zh-CN': '查看演示' },
  'demos.nav.allDemos': { en: 'All Demos', 'zh-CN': '所有演示' },
  'demos.transcript.label': { en: 'Demo transcript', 'zh-CN': '演示文字记录' },
  'demos.transcript.note': {
    en: '(for accessibility & search)',
    'zh-CN': '（无障碍和搜索）'
  },
  'demos.loading': {
    en: 'Loading interactive demo…',
    'zh-CN': '正在加载互动演示…'
  },
  'demos.noscript': {
    en: 'This interactive demo requires JavaScript.',
    'zh-CN': '此互动演示需要 JavaScript。'
  },
  'demos.noscript.link': {
    en: 'View on Arcade →',
    'zh-CN': '在 Arcade 上查看 →'
  },
  'demos.duration.2min': { en: '~2 min', 'zh-CN': '~2 分钟' },
  'demos.difficulty.beginner': { en: 'Beginner', 'zh-CN': '入门' },
  'demos.difficulty.intermediate': {
    en: 'Intermediate',
    'zh-CN': '中级'
  },
  'demos.difficulty.advanced': { en: 'Advanced', 'zh-CN': '高级' },
  'demos.embed.label': {
    en: 'Interactive demo',
    'zh-CN': '互动演示'
  },
  'demos.comingSoon.title': {
    en: 'Coming Soon',
    'zh-CN': '即将推出'
  },
  'demos.comingSoon.body': {
    en: 'This page is being redesigned. Check back soon.',
    'zh-CN': '此页面正在重新设计中，请稍后再来。'
  },
  'demos.breadcrumb.demos': { en: 'Demos', 'zh-CN': '演示' },

  'customers.story.whatsNext': {
    en: "What's next?",
    'zh-CN': '接下来看什么？'
  },
  'customers.story.viewArticle': {
    en: 'VIEW ARTICLE',
    'zh-CN': '查看文章'
  },
  'carousel.previous': {
    en: 'Previous',
    'zh-CN': '上一条'
  },
  'carousel.next': {
    en: 'Next',
    'zh-CN': '下一条'
  },
  'customers.feedback.quote1': {
    en: 'ComfyUI is so important to us because it allows us to know that we always play on the bleeding edge. Not only because of the technology itself, but because of the entire community behind it. The community is what makes it so special.',
    'zh-CN':
      'ComfyUI 对我们非常重要，因为它让我们始终站在技术最前沿。不仅因为技术本身，更因为它背后的整个社区。社区才是让它如此特别的原因。'
  },
  'customers.feedback.name1': {
    en: 'PJ Pereira',
    'zh-CN': 'PJ Pereira'
  },
  'customers.feedback.role1': {
    en: 'Co-founder of Silverside AI',
    'zh-CN': 'Silverside AI 联合创始人'
  },
  'customers.feedback.quote2': {
    en: "We've used many different tools, but using ComfyUI puts artist empowerment to the forefront. It makes artists feel like they have control over the process. The more transparent we can be to how the models work, the more we feel like we're making something that only we could make.",
    'zh-CN':
      '我们使用过许多不同的工具，但 ComfyUI 将艺术家赋能放在了首位。它让艺术家感到自己掌控着整个过程。我们对模型工作方式越透明，就越觉得我们在创造只有我们才能做出的东西。'
  },
  'customers.feedback.name2': {
    en: 'Jeremy Sahlman',
    'zh-CN': 'Jeremy Sahlman'
  },
  'customers.feedback.role2': {
    en: 'Co-founder and Chief Creative Officer at Black Math',
    'zh-CN': 'Black Math 联合创始人兼首席创意官'
  },
  'customers.feedback.quote3': {
    en: 'ComfyUI is a game changer for our creative pipeline. The node-based workflow gives us the flexibility to experiment rapidly while maintaining full control over every step of the process.',
    'zh-CN':
      'ComfyUI 彻底改变了我们的创意管线。基于节点的工作流让我们能够快速实验，同时完全掌控流程的每一个步骤。'
  },
  'customers.feedback.name3': {
    en: 'Alex Chen',
    'zh-CN': 'Alex Chen'
  },
  'customers.feedback.role3': {
    en: 'Head of AI at Creative Studios',
    'zh-CN': 'Creative Studios AI 负责人'
  },

  // Models – UI keys
  'models.hero.eyebrow': {
    en: 'AI Model',
    'zh-CN': 'AI 模型'
  },
  'models.hero.primaryCta': {
    en: 'TRY IN COMFY',
    'zh-CN': '在 Comfy 中试用'
  },
  'models.hero.secondaryCta': {
    en: 'DOWNLOAD MODEL',
    'zh-CN': '下载模型'
  },
  'models.hero.cloudCta': {
    en: 'RUN ON CLOUD',
    'zh-CN': '云端运行'
  },
  'models.hero.tutorialCta': {
    en: 'VIEW TUTORIAL',
    'zh-CN': '查看教程'
  },
  'models.hero.blogLink': {
    en: 'Read blog post',
    'zh-CN': '阅读博客文章'
  },
  'models.hero.workflowCount': {
    en: '{count} workflows use this model',
    'zh-CN': '{count} 个工作流使用此模型'
  },
  'models.whatIs.heading': {
    en: 'What is {name}?',
    'zh-CN': '什么是 {name}？'
  },
  'models.whatIs.tutorialLink': {
    en: 'Read the full tutorial →',
    'zh-CN': '阅读完整教程 →'
  },
  'models.index.title': {
    en: 'Supported Models',
    'zh-CN': '支持的模型'
  },
  'models.index.subtitle': {
    en: "Run the world's leading AI models in ComfyUI",
    'zh-CN': '在 ComfyUI 中运行世界领先的 AI 模型'
  },
  'models.breadcrumb.models': {
    en: 'Supported Models',
    'zh-CN': '支持的模型'
  },

  // Models list page (/models)
  'models.list.label': { en: 'MODELS', 'zh-CN': '模型' },
  'models.list.heroCta': {
    en: 'Try {name} Now',
    'zh-CN': '立即试用 {name}'
  },
  'models.list.creations.title': {
    en: '{name} Image and Video Creations',
    'zh-CN': '{name} 图像与视频创作'
  },
  'models.list.creations.cta': {
    en: 'Explore Workflows',
    'zh-CN': '探索工作流'
  },
  'models.list.heroTitle.before': {
    en: '{name} in',
    'zh-CN': ''
  },
  'models.list.heroTitle.after': {
    en: '',
    'zh-CN': ' 中的 {name}'
  },
  'models.list.heroSubtitle': {
    en: 'From open-source diffusion checkpoints to partner APIs — every major model, with community workflow templates ready to run.',
    'zh-CN':
      '从开源扩散模型到合作伙伴 API，涵盖每一个主流模型，并附带可直接运行的社区工作流模板。'
  },
  'models.list.card.workflows': {
    en: '{count} workflows',
    'zh-CN': '{count} 个工作流'
  },
  'models.list.contact.label': {
    en: 'COMFY WORKFLOWS',
    'zh-CN': 'COMFY WORKFLOWS'
  },
  'models.showcase.label': { en: 'AI MODELS', 'zh-CN': 'AI 模型' },
  'models.showcase.heading': {
    en: 'Run the world’s\nleading AI models',
    'zh-CN': '运行全球领先的\nAI 模型'
  },
  'models.showcase.subtitle': {
    en: 'New models are added as they launch.',
    'zh-CN': '新模型发布后会第一时间上线。'
  },
  'models.showcase.cta': {
    en: 'EXPLORE WORKFLOWS',
    'zh-CN': '探索工作流'
  },
  'models.showcase.card.grokImagine': {
    en: 'Grok Imagine',
    'zh-CN': 'Grok Imagine'
  },
  'models.showcase.card.nanoBananaPro': {
    en: 'Nano Banana Pro',
    'zh-CN': 'Nano Banana Pro'
  },
  'models.showcase.card.ltx23': {
    en: 'LTX 2.3',
    'zh-CN': 'LTX 2.3'
  },
  'models.showcase.card.qwenAdvancedEdit': {
    en: 'Advanced image\nediting with Qwen',
    'zh-CN': '使用 Qwen 进行\n高级图像编辑'
  },
  'models.showcase.card.wan22TextToVideo': {
    en: 'Wan 2.2\ntext to video',
    'zh-CN': 'Wan 2.2\n文字转视频'
  },
  'models.list.contact.heading': {
    en: 'Pick a model and explore what the community has built. <a href="https://comfy.org/workflows" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Browse Comfy Workflows</a> for the newest workflows.',
    'zh-CN':
      '选择一个模型，浏览社区的创作成果。<a href="https://comfy.org/workflows" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">访问 Comfy Workflows</a> 查看最新工作流。'
  },

  // Payment status pages
  'payment.success.label': {
    en: 'PAYMENT',
    'zh-CN': '支付'
  },
  'payment.success.title': {
    en: 'Payment successful',
    'zh-CN': '支付成功'
  },
  'payment.success.subtitle': {
    en: "Thanks for your purchase. Your account has been credited and you're ready to keep building.",
    'zh-CN': '感谢您的购买。您的账户已充值完成，可以继续创作了。'
  },
  'payment.success.primaryCta': {
    en: 'CONTINUE TO COMFY CLOUD',
    'zh-CN': '前往 COMFY CLOUD'
  },
  'payment.success.secondaryCta': {
    en: 'VIEW USAGE & PAYMENTS',
    'zh-CN': '查看用量与支付'
  },
  'payment.failed.label': {
    en: 'PAYMENT',
    'zh-CN': '支付'
  },
  'payment.failed.title': {
    en: 'Unable to complete payment',
    'zh-CN': '无法完成支付'
  },
  'payment.failed.subtitle': {
    en: "Your payment didn't go through and you have not been charged. Reach out to support or read the subscription docs if you need help.",
    'zh-CN':
      '您的支付未能完成，未发生扣款。如需帮助，请联系支持或查阅订阅文档。'
  },
  'payment.failed.primaryCta': {
    en: 'CONTACT SUPPORT',
    'zh-CN': '联系支持'
  },
  'payment.failed.secondaryCta': {
    en: 'READ SUBSCRIPTION DOCS',
    'zh-CN': '查看订阅文档'
  },
  'payment.failed.statusPrompt.prefix': {
    en: 'Check our',
    'zh-CN': '请查看我们的'
  },
  'payment.failed.statusPrompt.statusLink': {
    en: 'status page',
    'zh-CN': '状态页面'
  },
  'payment.failed.statusPrompt.suffix': {
    en: 'for more information.',
    'zh-CN': '了解更多信息。'
  },

  // AffiliateHeroSection
  'affiliate.hero.label': { en: 'AFFILIATE', 'zh-CN': '联盟' },
  'affiliate.hero.headingHighlight': {
    en: 'Earn 30%',
    'zh-CN': '赚取 30%'
  },
  'affiliate.hero.headingMuted': {
    en: 'recurring commission for 3 months.',
    'zh-CN': '持续返佣 3 个月。'
  },
  'affiliate.hero.feature1': {
    en: '30% recurring commission for 3 months',
    'zh-CN': '30% 持续佣金，连续 3 个月'
  },
  'affiliate.hero.feature2': {
    en: '60-day cookie window',
    'zh-CN': '60 天 Cookie 窗口'
  },
  'affiliate.hero.feature3': {
    en: '$100 minimum payout',
    'zh-CN': '$100 起付'
  },
  'affiliate.hero.feature4': {
    en: 'Monthly payouts',
    'zh-CN': '每月结算'
  },
  'affiliate.hero.apply': { en: 'APPLY NOW', 'zh-CN': '立即申请' },
  'affiliate.hero.imageAlt': {
    en: 'Comfy affiliate program',
    'zh-CN': 'Comfy 联盟计划'
  },

  // AffiliateAudienceSection
  'affiliate.audience.heading': {
    en: "Who we're looking for",
    'zh-CN': '我们在寻找谁'
  },
  'affiliate.audience.subheading': {
    en: 'If you are...',
    'zh-CN': '如果您是……'
  },

  // AffiliateHowItWorksSection
  'affiliate.howItWorks.heading': {
    en: 'How it works',
    'zh-CN': '运作方式'
  },

  // AffiliateBenefitsSection
  'affiliate.benefits.heading': {
    en: 'Why ComfyUI for affiliate creators',
    'zh-CN': '为什么联盟创作者选择 ComfyUI'
  },

  // AffiliateBrandAssetsSection
  'affiliate.assets.heading': {
    en: 'Brand logos for your content',
    'zh-CN': '可用于您内容的品牌 Logo'
  },
  'affiliate.assets.subheading': {
    en: 'Banners, screenshots, and talking points are in your affiliate dashboard after approval. Get the <a href="https://comfy.org/brand" class="text-primary-comfy-yellow underline">full brand assets here</a>.',
    'zh-CN':
      '横幅图、截图和宣传文案将在获批后于联盟仪表盘中提供。点击<a href="https://comfy.org/brand" class="text-primary-comfy-yellow underline">此处获取完整品牌素材</a>。'
  },
  'affiliate.assets.ctaLabel': {
    en: 'Go to brand portal',
    'zh-CN': '前往品牌门户'
  },

  // AffiliateFAQSection
  'affiliate.faq.heading': {
    en: 'Frequently asked questions',
    'zh-CN': '常见问题'
  },

  // Affiliate page (/affiliates) — head metadata
  'affiliate.page.title': {
    en: 'Comfy.org Affiliate Program - Become a Partner',
    'zh-CN': 'Comfy.org 联盟计划 - 成为合作伙伴'
  },
  'affiliate.page.description': {
    en: 'Earn 30% recurring commission for 3 months on every Comfy Cloud subscription you refer. Apply to become a Comfy Partner.',
    'zh-CN':
      '为您推荐的每个 Comfy Cloud 订阅赚取 30% 持续佣金，连续 3 个月。立即申请成为 Comfy 合作伙伴。'
  },

  // AffiliateCtaSection
  'affiliate.cta.heading': {
    en: 'Ready to start earning?',
    'zh-CN': '准备好开始赚取佣金了吗？'
  },
  'affiliate.cta.apply': {
    en: 'APPLY NOW',
    'zh-CN': '立即申请'
  },
  'affiliate.cta.termsLabel': {
    en: 'Read the affiliate program terms',
    'zh-CN': '阅读联盟计划条款'
  },

  // Launches page (/launches) — head metadata
  // zh-CN strings pending native review (see apps/website/.scratch/drops-page/PRD.md)
  'launches.page.title': {
    en: 'ComfyUI Live Demo & Q&A - June 29 Launch Livestream',
    'zh-CN': 'ComfyUI 直播演示与问答 - 6 月 29 日发布直播'
  },
  'launches.page.description': {
    en: 'Join the ComfyUI livestream on June 29 for a hands-on product demo and live Q&A. See what’s new across desktop, cloud, and community, and get your questions answered.',
    'zh-CN':
      '6 月 29 日加入 ComfyUI 直播，观看实操产品演示并参与实时问答。了解桌面、云端和社区的最新内容，并获得解答。'
  },

  // Launches page (/launches) — hero section
  // zh-CN strings pending native review (see apps/website/.scratch/drops-page/PRD.md)
  'launches.hero.title': {
    en: 'Everything new in ComfyUI',
    'zh-CN': 'ComfyUI 全新内容'
  },
  'launches.hero.primary': {
    en: 'Download Desktop',
    'zh-CN': '下载桌面版'
  },
  'launches.hero.secondary': {
    en: 'Try Cloud for free',
    'zh-CN': '免费试用云端'
  },
  'launches.hero.visualAlt': {
    en: 'Comfy',
    'zh-CN': 'Comfy'
  },

  // Launches page (/launches) — subscribe banner
  // zh-CN strings pending native review (see apps/website/.scratch/drops-page/PRD.md)
  'launches.banner.text': {
    en: 'Now turn your agent into a creative technologist.',
    'zh-CN': '现在，让你的智能体成为创意技术专家。'
  },
  'launches.banner.cta': {
    en: 'Start Comfy MCP',
    'zh-CN': '启动 Comfy MCP'
  },

  // Launches page (/launches) — closing CTA
  // zh-CN strings pending native review (see apps/website/.scratch/drops-page/PRD.md)
  'launches.cta.heading': {
    en: 'Everything Comfy ships. All in one place.',
    'zh-CN': 'Comfy 的全部内容，一处尽享。'
  },
  'launches.cta.primary': {
    en: 'Open Comfy Cloud',
    'zh-CN': '打开 Comfy Cloud'
  },
  'launches.cta.secondary': {
    en: 'Try Workflow',
    'zh-CN': '试用工作流'
  },

  // Launches page (/launches) — launches grid
  // zh-CN strings pending native review (see apps/website/.scratch/drops-page/PRD.md)
  'launches.section.title': {
    en: 'Latest Launches',
    'zh-CN': '最新发布'
  },

  'ltx.meta.title': {
    en: 'LTX 2.5 on Comfy: Open-Source AI Video Model',
    'zh-CN': 'Comfy 上的 LTX 2.5：开源 AI 视频模型'
  },
  'ltx.meta.description': {
    en: 'Run LTX 2.5 on Comfy. Open weights, free to run on your own GPU, or directed on the canvas alongside every other model on Comfy Cloud.',
    'zh-CN':
      '在 Comfy 上运行 LTX 2.5。开放权重，可在你自己的 GPU 上免费运行，也可以在画布上与其他所有模型一同执导，支持 Comfy Cloud。'
  },
  'ltx.breadcrumb.model': { en: 'LTX 2.5', 'zh-CN': 'LTX 2.5' },
  'ltx.breadcrumb.updated': {
    en: 'Updated August 2026',
    'zh-CN': '更新于 2026 年 8 月'
  },
  'ltx.hero.title': {
    en: 'LTX 2.5 is here',
    'zh-CN': 'LTX 2.5 已上线'
  },
  'ltx.hero.description': {
    en: 'LTX is the fastest video generation model on the planet, and this version sharpens prompt adherence, visuals, and audio quality across the board. With a new Diffusion Fidelity Rendering capability, fine textures, faces, and complex shots hold up at cinematic-grade detail.',
    'zh-CN':
      'LTX 是全球最快的视频生成模型，这一版本全面提升了提示词遵循度、画面表现与音频质量。凭借全新的 Diffusion Fidelity Rendering 能力，细腻的纹理、人物面部与复杂镜头都能保持电影级的细节。'
  },
  'ltx.hero.tagOpenSource': { en: 'Open Source', 'zh-CN': '开源' },
  'ltx.hero.tagPartnerNode': { en: 'Partner Node', 'zh-CN': '合作伙伴节点' },
  'ltx.hero.tagImageToVideo': { en: 'Image to Video', 'zh-CN': '图像转视频' },
  'ltx.hero.tagTextToVideo': { en: 'Text to Video', 'zh-CN': '文本转视频' },
  'ltx.models.heading': {
    en: 'Made with LTX 2.5',
    'zh-CN': '用 LTX 2.5 制作'
  },
  'ltx.faq.heading': {
    en: 'Q&A',
    'zh-CN': '问答'
  },
  'ltx.hero.primaryCta': {
    en: 'RUN LTX 2.5',
    'zh-CN': '运行 LTX 2.5'
  },
  'ltx.hero.secondaryCta': { en: 'TRY WORKFLOWS', 'zh-CN': '试用工作流' },
  'ltx.pricing.banner.title': {
    en: "Start Comfy Cloud for free. Upgrade when you're ready.",
    'zh-CN': '免费开始使用 Comfy Cloud，准备好了再升级。'
  },
  'ltx.pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'ltx.pricing.banner.cta': { en: 'TRY FREE', 'zh-CN': '免费试用' },
  'ltx.runOptions.heading': {
    en: 'One engine, every way to run it',
    'zh-CN': '同一引擎，多种运行方式'
  },
  'ltx.runOptions.subtitle': {
    en: 'Run LTX 2.5 in the browser today. Batch campaigns with the API, or bring it in-house.',
    'zh-CN': '今天就在浏览器中运行 LTX 2.5。用 API 批量制作，或部署到自有环境。'
  },
  'ltx.runOptions.cta': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'ltx.reviews.heading': {
    en: '4+ million Comfy creators say',
    'zh-CN': '400 万+ Comfy 创作者这样说'
  },
  'ltx.reviews.highlightTitle': {
    en: 'Comfy MCP: now turn your agent into a creative technologist.',
    'zh-CN': 'Comfy MCP：让你的智能体成为创意技术专家。'
  },
  'ltx.reviews.highlightDescription': {
    en: 'Your AI assistant can access the ecosystem, build workflows, and generate images, video, audio, or 3D.',
    'zh-CN':
      '你的 AI 助手可以接入整个生态、构建工作流，并生成图像、视频、音频或 3D 内容。'
  },
  'ltx.reviews.highlightCta': { en: 'GET STARTED', 'zh-CN': '开始使用' },

  // Seedance 2.5 SEO page (/seedance-2.5). zh-CN hand-translated; some body
  // copy carries placeholder intent from Figma and may change (June, CRE-145).
  'seedance.meta.title': {
    en: 'Seedance 2.5 on Comfy — Cinematic AI Video Model',
    'zh-CN': 'Comfy 上的 Seedance 2.5 — 电影级 AI 视频模型'
  },
  'seedance.meta.description': {
    en: 'Run ByteDance Seedance 2.5 on Comfy: multi-shot cinematic video with native audio, from text or image. Draft free on Wan 2.2 and spend credits only on the final render.',
    'zh-CN':
      '在 Comfy 上运行字节跳动 Seedance 2.5：从文本或图像生成带原生音频的多镜头电影级视频。先用 Wan 2.2 免费打样，只在最终渲染时消耗积分。'
  },
  'seedance.breadcrumb.model': { en: 'Seedance 2.5', 'zh-CN': 'Seedance 2.5' },
  'seedance.breadcrumb.updated': {
    en: 'Updated July 2026',
    'zh-CN': '更新于 2026 年 7 月'
  },
  'seedance.hero.title': {
    en: 'Seedance 2.5 is here',
    'zh-CN': 'Seedance 2.5 已上线'
  },
  'seedance.hero.description': {
    en: "ByteDance's cinematic video model — multi-shot sequences with native audio, text or image in. You direct on the canvas; Seedance renders the cut. Now available in 1080p with video extension.",
    'zh-CN':
      '字节跳动的电影级视频模型：多镜头序列，原生音频，支持文本或图像输入。你在画布上执导，Seedance 负责渲染成片。现已支持 1080p 及视频扩展。'
  },
  'seedance.hero.primaryCta': {
    en: 'RUN SEEDANCE 2.5',
    'zh-CN': '运行 Seedance 2.5'
  },
  'seedance.hero.secondaryCta': { en: 'TRY WORKFLOWS', 'zh-CN': '试用工作流' },
  'seedance.models.heading': {
    en: 'Shot on Seedance',
    'zh-CN': '用 Seedance 拍摄'
  },
  'seedance.faq.heading': {
    en: 'Q&A',
    'zh-CN': '问答'
  },
  'seedance.hero.tagPartnerNode': {
    en: 'Partner node',
    'zh-CN': '合作伙伴节点'
  },
  'seedance.hero.tagImageToVideo': {
    en: 'Image to Video',
    'zh-CN': '图像生成视频'
  },
  'seedance.hero.tagTextToVideo': {
    en: 'Text to Video',
    'zh-CN': '文本生成视频'
  },
  'seedance.hero.promptSample': {
    en: 'Saturated neon color, mirror-ball light flecks, soft glow bloom,',
    'zh-CN': '饱和的霓虹色彩、镜面球光斑、柔和的辉光晕染，'
  },
  'seedance.hero.promptCta': {
    en: 'GENERATE VIDEO',
    'zh-CN': '生成视频'
  },
  'seedance.pricing.banner.title': {
    en: "Start Comfy Cloud for free. Upgrade when you're ready.",
    'zh-CN': '免费开始使用 Comfy Cloud，准备好了再升级。'
  },
  'seedance.pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'seedance.pricing.banner.cta': { en: 'TRY FREE', 'zh-CN': '免费试用' },
  'seedance.steps.heading': {
    en: 'How to direct your first shot',
    'zh-CN': '如何执导你的第一个镜头'
  },
  'seedance.steps.step': { en: 'Step', 'zh-CN': '步骤' },
  'seedance.steps.primaryCta': {
    en: 'RUN WAN 2.2 FOR FREE',
    'zh-CN': '免费运行 Wan 2.2'
  },
  'seedance.steps.secondaryCta': {
    en: 'RUN SEEDANCE 2.5',
    'zh-CN': '运行 Seedance 2.5'
  },
  'seedance.runOptions.heading': {
    en: 'One engine, every way to run it',
    'zh-CN': '同一引擎，多种运行方式'
  },
  'seedance.runOptions.subtitle': {
    en: 'Run Seedance in the browser today. Batch campaigns with the API, or bring it in-house.',
    'zh-CN':
      '今天就在浏览器中运行 Seedance。用 API 批量制作，或部署到自有环境。'
  },
  // shared across all four run-option cards; the per-product `products.*.cta`
  // labels overflow on mobile
  'seedance.runOptions.cta': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'seedance.reviews.heading': {
    en: '4+ million Comfy creators say',
    'zh-CN': '400 万+ Comfy 创作者这样说'
  },
  'seedance.reviews.highlightTitle': {
    en: 'Comfy MCP: now turn your agent into a creative technologist.',
    'zh-CN': 'Comfy MCP：让你的智能体成为创意技术专家。'
  },
  'seedance.reviews.highlightDescription': {
    en: 'Your AI assistant can access the ecosystem, build workflows, and generate images, video, audio, or 3D.',
    'zh-CN':
      '你的 AI 助手可以接入整个生态、构建工作流，并生成图像、视频、音频或 3D 内容。'
  },
  'seedance.reviews.highlightCta': { en: 'GET STARTED', 'zh-CN': '开始使用' },
  // Events page (/events)
  // zh-CN strings pending native review
  'events.page.title': {
    en: 'Events - Livestreams, Hackathons & Community Meetups | Comfy',
    'zh-CN': '活动 - 直播、黑客松与社区聚会 | Comfy'
  },
  'events.page.description': {
    en: 'Upcoming livestreams, hackathons, and events worldwide. Join upcoming Comfy events or catch up on past livestreams, hackathons, and community meetups.',
    'zh-CN':
      '即将举行的直播、黑客松以及遍布全球的活动。参加即将举行的 Comfy 活动，或回看过往的直播、黑客松和社区聚会。'
  },
  'events.hero.eyebrow': { en: 'EVENTS', 'zh-CN': '活动' },
  'events.hero.title': {
    en: 'Creators, all in one place',
    'zh-CN': '创作者，齐聚一堂'
  },
  'events.hero.subtitle': {
    en: 'Upcoming livestreams, hackathons, and events worldwide',
    'zh-CN': '即将举行的直播、黑客松以及遍布全球的活动'
  },
  'events.hero.prevSlide': {
    en: 'Previous featured event',
    'zh-CN': '上一个精选活动'
  },
  'events.hero.nextSlide': {
    en: 'Next featured event',
    'zh-CN': '下一个精选活动'
  },
  'events.upcoming.title': {
    en: 'Upcoming events',
    'zh-CN': '即将举行的活动'
  },
  'events.upcoming.livestream': { en: 'Livestream', 'zh-CN': '直播' },
  'events.upcoming.addToCalendar': {
    en: 'Add to calendar',
    'zh-CN': '添加到日历'
  },
  'events.upcoming.calendarGoogle': {
    en: 'Google Calendar',
    'zh-CN': 'Google 日历'
  },
  'events.upcoming.calendarApple': {
    en: 'Apple Calendar',
    'zh-CN': 'Apple 日历'
  },
  'events.upcoming.calendarOutlook': {
    en: 'Outlook',
    'zh-CN': 'Outlook'
  },
  'events.past.title': {
    en: 'See our past events',
    'zh-CN': '回顾过往活动'
  },
  'events.past.filterAll': { en: 'ALL', 'zh-CN': '全部' },
  'events.past.watchNow': { en: 'WATCH NOW', 'zh-CN': '立即观看' },
  'events.past.loadMore': { en: 'LOAD MORE', 'zh-CN': '加载更多' },
  'events.videoDialog.close': { en: 'Close', 'zh-CN': '关闭' },
  'events.category.livestream': { en: 'Livestream', 'zh-CN': '直播' },
  'events.category.hackathon': { en: 'Hackathon', 'zh-CN': '黑客松' },
  'events.category.community': { en: 'Community', 'zh-CN': '社区' },

  // Brand Portal page (/brand)
  'brand.page.title': {
    en: 'Brand — Comfy',
    'zh-CN': '品牌 — Comfy'
  },
  'brand.page.description': {
    en: 'The Comfy brand portal: logos, color, typography, and voice. Everything you need to build something that looks and sounds like Comfy.',
    'zh-CN':
      'Comfy 品牌门户：标志、色彩、字体与语调。打造与 Comfy 观感一致、表达一致所需的一切。'
  },
  'brand.hero.label': {
    en: 'Brand Portal',
    'zh-CN': '品牌门户'
  },
  'brand.hero.heading': {
    en: 'Create with ComfyUI',
    'zh-CN': '用 ComfyUI 创作'
  },
  'brand.hero.subheading': {
    en: 'Logo, color, type, and voice. Everything you need to build something that looks and sounds like us.',
    'zh-CN': '标志、色彩、字体与语调。打造与我们观感一致、表达一致所需的一切。'
  },
  'brand.hero.viewGuidelines': {
    en: 'View brand guidelines',
    'zh-CN': '查看品牌规范'
  },
  'brand.hero.downloadLogos': {
    en: 'Download logos',
    'zh-CN': '下载标志'
  },
  'brand.logos.heading': {
    en: 'One mark, many dimensions.',
    'zh-CN': '一个标志，多种维度。'
  },
  'brand.logos.subheading': {
    en: 'Logos come in light and dark options. Use as provided. Do not distort, recolor, or outline. Make sure the logo is legible against its background.',
    'zh-CN':
      '标志提供浅色和深色两种版本。请按原样使用，不要变形、改色或描边。确保标志在其背景上清晰可辨。'
  },
  'brand.colors.heading': {
    en: 'Every color earns its place.',
    'zh-CN': '每种颜色都各得其所。'
  },
  'brand.colors.subheading': {
    en: 'Our color palette helps build brand recognition. When people think of Comfy, we want them to associate it with the following colors.',
    'zh-CN':
      '我们的调色板有助于建立品牌辨识度。当人们想到 Comfy 时，我们希望他们联想到以下这些颜色。'
  },
  'brand.colors.copy': {
    en: 'Copy',
    'zh-CN': '复制'
  },
  'brand.colors.copied': {
    en: 'Copied',
    'zh-CN': '已复制'
  },
  'brand.voice.heading': {
    en: 'Precise, never cute.',
    'zh-CN': '精准，绝不卖弄。'
  },
  'brand.voice.direct.title': {
    en: 'Direct',
    'zh-CN': '直接'
  },
  'brand.voice.direct.body': {
    en: 'We state things. We don’t hedge, qualify, or suggest. Short sentences. Active voice. One idea at a time.',
    'zh-CN':
      '我们直陈其事。不含糊、不设限、不暗示。短句。主动语态。一次只讲一个观点。'
  },
  'brand.voice.precise.title': {
    en: 'Precise',
    'zh-CN': '精准'
  },
  'brand.voice.precise.body': {
    en: 'We use the real names for things. Nodes, samplers, seeds, checkpoints. We don’t talk around the product or reach for metaphor when the technical term is already good.',
    'zh-CN':
      '我们直呼其名：nodes、samplers、seeds、checkpoints。当技术术语已经足够贴切时，我们不绕弯子，也不借用比喻。'
  },
  'brand.voice.human.title': {
    en: 'Human-first',
    'zh-CN': '以人为先'
  },
  'brand.voice.human.body': {
    en: 'The human creates. Comfy makes every step visible. We never write as though the AI is doing the work.',
    'zh-CN':
      '创作的是人。Comfy 让每一步都清晰可见。我们绝不把功劳写成是 AI 完成的。'
  },
  'brand.voice.antihype.title': {
    en: 'Anti-hype',
    'zh-CN': '拒绝浮夸'
  },
  'brand.voice.antihype.body': {
    en: 'We don’t write “stunning,” “revolutionary,” or “effortless.” We don’t promise magic. Our tagline says exactly what we mean: Method, not magic.',
    'zh-CN':
      '我们不写“惊艳”“革命性”或“毫不费力”。我们不承诺魔法。我们的口号恰如其分：方法，而非魔法。'
  },
  'brand.voice.doLabel': {
    en: 'Do',
    'zh-CN': '推荐'
  },
  'brand.voice.dontLabel': {
    en: 'Don’t',
    'zh-CN': '避免'
  },
  'brand.voice.do.0': {
    en: 'Route your prompt through a ControlNet. Wire the output to the VAE decode.',
    'zh-CN': '让你的 prompt 经过 ControlNet，再将输出连接到 VAE decode。'
  },
  'brand.voice.do.1': {
    en: 'Comfy runs on your hardware. Nothing leaves your machine.',
    'zh-CN': 'Comfy 在你自己的硬件上运行。任何数据都不会离开你的机器。'
  },
  'brand.voice.dont.0': {
    en: 'Simply connect your AI blocks and watch the magic happen!',
    'zh-CN': '只需连接你的 AI 模块，见证奇迹的发生！'
  },
  'brand.voice.dont.1': {
    en: 'Oops! Something went wrong. Please try again later.',
    'zh-CN': '哎呀！出了点问题，请稍后再试。'
  },
  'brand.trademark.heading': {
    en: 'Trademark guidelines.',
    'zh-CN': '商标使用规范。'
  },
  'brand.trademark.body1': {
    en: 'Comfy and ComfyUI are trademarks of Comfy Org. You’re welcome to reference them in content that accurately describes your work with our platform. Tutorials, reviews, integrations, and affiliate content all qualify.',
    'zh-CN':
      'Comfy 和 ComfyUI 是 Comfy Org 的商标。欢迎在准确描述你与我们平台相关工作的内容中引用它们。教程、评测、集成以及联盟内容均可。'
  },
  'brand.trademark.body2': {
    en: 'A few rules: don’t modify the logo, don’t use the Comfy name in your own product or company name, and don’t present your content in a way that implies official endorsement or partnership beyond what’s been agreed.',
    'zh-CN':
      '几条规则：不要修改标志，不要在你自己的产品或公司名称中使用 Comfy 这一名称，也不要以暗示官方认可或合作关系（超出双方已达成的约定）的方式呈现你的内容。'
  },
  'brand.trademark.body3': {
    en: 'For permissions outside these guidelines,',
    'zh-CN': '如需本规范之外的授权，请'
  },
  'brand.trademark.contact': {
    en: 'Contact Us',
    'zh-CN': '联系我们'
  },
  'brand.questions.heading': {
    en: 'Questions?',
    'zh-CN': '有疑问？'
  },
  'brand.questions.body': {
    en: 'For press, partnerships, or anything outside these guidelines,',
    'zh-CN': '如涉及媒体、合作，或本规范未涵盖的任何事宜，请'
  },
  'brand.questions.contact': {
    en: 'Contact Us',
    'zh-CN': '联系我们'
  },

  // Shared by every model-launch gallery card (see templates/model-launch).
  'modelLaunch.tagFree': { en: 'Free', 'zh-CN': '免费' },
  'modelLaunch.tagPremium': { en: 'Premium', 'zh-CN': '高级' },
  // Flux 3 model page (/flux-3)
  'flux3.meta.title': {
    en: 'Flux 3 on Comfy — Video With Native Audio',
    'zh-CN': 'Comfy 上的 Flux 3 — 带原生音频的视频模型'
  },
  'flux3.meta.description': {
    en: "Run Flux 3 on Comfy: Black Forest Labs' multimodal model generates video with native audio, up to 20 seconds in one generation, from text, image, video or keyframes.",
    'zh-CN':
      '在 Comfy 上运行 Flux 3：Black Forest Labs 的多模态模型可生成带原生音频的视频，单次生成最长 20 秒，支持文本、图像、视频或关键帧输入。'
  },
  'flux3.breadcrumb.model': { en: 'Flux 3', 'zh-CN': 'Flux 3' },
  'flux3.breadcrumb.updated': {
    en: 'Updated August 2026',
    'zh-CN': '更新于 2026 年 8 月'
  },
  'flux3.hero.title': {
    en: 'Flux 3',
    'zh-CN': 'Flux 3'
  },
  'flux3.hero.titleRest': {
    en: ' is here',
    'zh-CN': ' 已上线'
  },
  'flux3.hero.description': {
    en: 'Flux 3 generates video with native audio, up to 20 seconds in a single generation. Go text to video or image to video. Run it on Comfy Cloud today. Open weights coming soon.',
    'zh-CN':
      'Flux 3 可生成带原生音频的视频，单次生成最长 20 秒。支持文本生成视频与图像生成视频。今天就在 Comfy Cloud 上运行它。开源权重即将推出。'
  },
  'flux3.hero.tagPartnerNodes': {
    en: 'Partner nodes',
    'zh-CN': '合作伙伴节点'
  },
  'flux3.hero.tagOpenWeightsSoon': {
    en: 'Open weights coming soon',
    'zh-CN': '开源权重即将推出'
  },
  'flux3.hero.primaryCta': {
    en: 'RUN FLUX 3',
    'zh-CN': '运行 Flux 3'
  },
  'flux3.hero.secondaryCta': {
    en: 'TRY WORKFLOWS',
    'zh-CN': '试用工作流'
  },
  'flux3.cta.heading': {
    en: 'Twenty seconds with sound, in one generation.',
    'zh-CN': '二十秒，自带声音，一次生成。'
  },
  'flux3.cta.primaryCta': {
    en: 'RUN FLUX 3',
    'zh-CN': '运行 Flux 3'
  },
  'flux3.cta.secondaryCta': {
    en: 'TRY WORKFLOWS',
    'zh-CN': '试用工作流'
  },
  'flux3.pricing.banner.title': {
    en: "Start Comfy Cloud for free. Upgrade when you're ready.",
    'zh-CN': '免费开始使用 Comfy Cloud，准备好了再升级。'
  },
  'flux3.pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'flux3.pricing.banner.cta': { en: 'TRY FREE', 'zh-CN': '免费试用' },
  'flux3.faq.heading': {
    en: 'Q&A',
    'zh-CN': '问答'
  },
  'flux3.models.heading': {
    en: 'Made with Flux 3',
    'zh-CN': '用 Flux 3 制作'
  },
  'flux3.runOptions.heading': {
    en: 'One engine, every way to run it',
    'zh-CN': '同一引擎，多种运行方式'
  },
  'flux3.runOptions.subtitle': {
    en: 'Run Flux 3 in the browser today. Batch campaigns with the API, or bring it in-house.',
    'zh-CN': '今天就在浏览器中运行 Flux 3。用 API 批量制作，或部署到自有环境。'
  },
  'flux3.runOptions.cta': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'flux3.reviews.heading': {
    en: '4+ million Comfy creators say',
    'zh-CN': '超过 400 万 Comfy 创作者这样说'
  },
  'flux3.reviews.highlightTitle': {
    en: 'Comfy MCP: now turn your agent into a creative technologist.',
    'zh-CN': 'Comfy MCP：让你的智能体成为创意技术专家。'
  },
  'flux3.reviews.highlightDescription': {
    en: 'Your AI assistant can access the ecosystem, build workflows, and generate images, video, audio, or 3D.',
    'zh-CN':
      '你的 AI 助手可以接入整个生态、构建工作流，并生成图像、视频、音频或 3D 内容。'
  },
  'flux3.reviews.highlightCta': { en: 'GET STARTED', 'zh-CN': '开始使用' },
  'footer.flux3': { en: 'Flux 3', 'zh-CN': 'Flux 3' },
  // Wan Animate 2 model page (/wan-animate-2)
  'wanAnimate2.meta.title': {
    en: 'Wan Animate 2 on Comfy — Open-Source Character Animation',
    'zh-CN': 'Comfy 上的 Wan Animate 2 — 开源角色动画模型'
  },
  'wanAnimate2.meta.description': {
    en: 'Run Wan Animate 2 on Comfy: upload a reference image of your character plus a driving video, and it transfers that motion onto your character. Open source, on Comfy Cloud or your own hardware.',
    'zh-CN':
      '在 Comfy 上运行 Wan Animate 2：上传角色参考图和一段驱动视频，即可把动作迁移到你的角色上。开源模型，可在 Comfy Cloud 或自有硬件上运行。'
  },
  'wanAnimate2.breadcrumb.model': {
    en: 'Wan Animate 2',
    'zh-CN': 'Wan Animate 2'
  },
  'wanAnimate2.breadcrumb.updated': {
    en: 'Updated August 2026',
    'zh-CN': '更新于 2026 年 8 月'
  },
  'wanAnimate2.hero.title': {
    en: 'Wan Animate 2 is here',
    'zh-CN': 'Wan Animate 2 已上线'
  },
  'wanAnimate2.hero.description': {
    en: 'Introducing Wan Animate 2, the new state of the art model for character animation: upload a reference image of your character plus a video of the motion you want, and it transfers that motion onto your character.',
    'zh-CN':
      '隆重推出 Wan Animate 2，业界领先的角色动画模型：上传一张角色参考图，再加上一段你想要的动作视频，它就会把该动作迁移到你的角色上。'
  },
  'wanAnimate2.hero.primaryCta': {
    en: 'RUN WAN ANIMATE 2',
    'zh-CN': '运行 Wan Animate 2'
  },
  'wanAnimate2.hero.tagOpenSource': {
    en: 'Open Source',
    'zh-CN': '开源'
  },
  'wanAnimate2.hero.tagReferenceToVideo': {
    en: 'Reference to Video',
    'zh-CN': '参考图生成视频'
  },
  'wanAnimate2.pricing.banner.title': {
    en: "Start Comfy Cloud for free. Upgrade when you're ready.",
    'zh-CN': '免费开始使用 Comfy Cloud，准备好了再升级。'
  },
  'wanAnimate2.pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'wanAnimate2.pricing.banner.cta': { en: 'TRY FREE', 'zh-CN': '免费试用' },
  'wanAnimate2.steps.heading': {
    en: 'How to direct your first shot',
    'zh-CN': '如何执导你的第一个镜头'
  },
  'wanAnimate2.steps.step': { en: 'Step', 'zh-CN': '步骤' },
  'wanAnimate2.steps.primaryCta': {
    en: 'RUN WAN ANIMATE 2',
    'zh-CN': '运行 Wan Animate 2'
  },
  'wanAnimate2.runOptions.heading': {
    en: 'One engine, every way to run it',
    'zh-CN': '同一引擎，多种运行方式'
  },
  'wanAnimate2.runOptions.subtitle': {
    en: 'Build workflows in the browser today. Batch campaigns with the API, or bring it in-house.',
    'zh-CN': '今天就在浏览器中构建工作流。用 API 批量制作，或部署到自有环境。'
  },
  'wanAnimate2.runOptions.cta': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'wanAnimate2.reviews.heading': {
    en: '4+ million Comfy creators say',
    'zh-CN': '400 万+ Comfy 创作者这样说'
  },
  'wanAnimate2.reviews.highlightTitle': {
    en: 'Comfy MCP: now turn your agent into a creative technologist.',
    'zh-CN': 'Comfy MCP：让你的智能体成为创意技术专家。'
  },
  'wanAnimate2.reviews.highlightDescription': {
    en: 'Your AI assistant can access the ecosystem, build workflows, and generate images, video, audio, or 3D.',
    'zh-CN':
      '你的 AI 助手可以接入整个生态、构建工作流，并生成图像、视频、音频或 3D 内容。'
  },
  'wanAnimate2.reviews.highlightCta': {
    en: 'GET STARTED',
    'zh-CN': '开始使用'
  },
  'footer.wanAnimate2': { en: 'Wan Animate 2', 'zh-CN': 'Wan Animate 2' },
  'footer.ltx': { en: 'LTX 2.5', 'zh-CN': 'LTX 2.5' },
  'modelLaunch.copyPrompt': { en: 'Copy prompt', 'zh-CN': '复制提示词' },
  // Wan 3.0 model page (/wan-3.0)
  'wan3.meta.title': {
    en: 'Wan 3.0 on Comfy — Text, Image and Reference to Video',
    'zh-CN': 'Comfy 上的 Wan 3.0 — 文生、图生与参考生视频'
  },
  'wan3.meta.description': {
    en: 'Run Wan 3.0 on Comfy Cloud. Generate up to 30 seconds of video from a text prompt, an image, or video, image and audio references, with sound produced alongside the picture.',
    'zh-CN':
      '在 Comfy Cloud 上运行 Wan 3.0。可从文字提示词、图像，或视频、图像与音频参考生成最长 30 秒的视频，并同时生成画面与声音。'
  },
  'wan3.breadcrumb.model': { en: 'Wan 3.0', 'zh-CN': 'Wan 3.0' },
  'wan3.breadcrumb.updated': {
    en: 'Updated August 2026',
    'zh-CN': '更新于 2026 年 8 月'
  },
  'wan3.hero.title': { en: 'Wan 3.0 is here', 'zh-CN': 'Wan 3.0 已上线' },
  'wan3.hero.description': {
    en: "Wan 3.0 is a step change from previous Wan models. It generates what earlier versions couldn't: a full 30-second scene in one take, as low as 480p for speed and iteration, and up to 1080p for production quality. Available on Comfy Cloud and via Partner Nodes today.",
    'zh-CN':
      'Wan 3.0 相比以往的 Wan 模型是一次跨越式提升。它能做到早期版本做不到的事：一镜到底生成完整的 30 秒场景，低至 480p 以便快速迭代，最高 1080p 达到成片质量。现已在 Comfy Cloud 及合作伙伴节点上提供。'
  },
  'wan3.hero.tagTextToVideo': { en: 'Text to Video', 'zh-CN': '文生视频' },
  'wan3.hero.tagImageToVideo': { en: 'Image to Video', 'zh-CN': '图生视频' },
  'wan3.hero.tagReferenceToVideo': {
    en: 'Reference to Video',
    'zh-CN': '参考生视频'
  },
  'wan3.hero.primaryCta': { en: 'RUN WAN 3.0', 'zh-CN': '运行 Wan 3.0' },
  'wan3.hero.secondaryCta': {
    en: 'BROWSE WORKFLOWS',
    'zh-CN': '浏览工作流'
  },
  'wan3.pricing.banner.title': {
    en: "Start Comfy Cloud for free. Upgrade when you're ready.",
    'zh-CN': '免费开始使用 Comfy Cloud，准备好了再升级。'
  },
  'wan3.pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'wan3.pricing.banner.cta': { en: 'TRY FREE', 'zh-CN': '免费试用' },
  'wan3.faq.heading': { en: 'Q&A', 'zh-CN': '问答' },
  'wan3.runOptions.heading': {
    en: 'One engine, every way to run it',
    'zh-CN': '同一引擎，多种运行方式'
  },
  'wan3.runOptions.subtitle': {
    en: 'Build workflows in the browser today. Batch campaigns with the API, or bring it in-house.',
    'zh-CN': '今天就在浏览器中搭建工作流。用 API 批量制作，或部署到自有环境。'
  },
  'wan3.runOptions.cta': { en: 'LEARN MORE', 'zh-CN': '了解更多' },
  'wan3.reviews.heading': {
    en: '4+ million Comfy creators say',
    'zh-CN': '超过 400 万 Comfy 创作者这样说'
  },
  'wan3.reviews.highlightTitle': {
    en: 'Comfy MCP: now turn your agent into a creative technologist.',
    'zh-CN': 'Comfy MCP：让你的智能体成为创意技术专家。'
  },
  'wan3.reviews.highlightDescription': {
    en: 'Your AI assistant can access the ecosystem, build workflows, and generate images, video, audio, or 3D.',
    'zh-CN':
      '你的 AI 助手可以接入整个生态、构建工作流，并生成图像、视频、音频或 3D 内容。'
  },
  'wan3.reviews.highlightCta': { en: 'GET STARTED', 'zh-CN': '开始使用' },
  'footer.wan3': { en: 'Wan 3.0', 'zh-CN': 'Wan 3.0' },
  'minimax.meta.title': {
    en: 'MiniMax H3 on Comfy — Open-Weight Video Model',
    'zh-CN': 'Comfy 上的 MiniMax H3 — 开源权重视频模型'
  },
  'minimax.meta.description': {
    en: 'Run MiniMax H3 on Comfy: Open Weights or Partner Nodes, multi-modal in/out, native stereo audio on every clip, up to 2K and 5-15s per generation. Free to start.',
    'zh-CN':
      '在 Comfy 上运行 MiniMax H3：以开源权重形式提供，也可通过合作伙伴节点使用，多模态输入/输出，每个片段都带原生立体声音频，最高 2K，每次生成 5–15 秒。免费开始使用。'
  },
  'minimax.breadcrumb.model': { en: 'MiniMax H3', 'zh-CN': 'MiniMax H3' },
  // MiniMax Music 3 SEO page (/minimax-music-3). zh-CN hand-translated.
  'minimaxMusic3.meta.title': {
    en: 'MiniMax Music 3 on Comfy — Open-Weights Music Model',
    'zh-CN': 'Comfy 上的 MiniMax Music 3 — 开源权重音乐模型'
  },
  'minimaxMusic3.meta.description': {
    en: 'Run MiniMax Music 3 on Comfy. Open weights for text to music, directed on the canvas alongside every other model, on Comfy Cloud or your own GPU.',
    'zh-CN':
      '在 Comfy 上运行 MiniMax Music 3。文本生成音乐的开源权重模型，可在画布上与其他所有模型一同执导，支持 Comfy Cloud 或你自己的 GPU。'
  },
  'minimaxMusic3.breadcrumb.model': {
    en: 'MiniMax Music 3',
    'zh-CN': 'MiniMax Music 3'
  },
  'minimaxMusic3.breadcrumb.updated': {
    en: 'Updated August 2026',
    'zh-CN': '更新于 2026 年 8 月'
  },
  'minimaxMusic3.hero.titleModel': {
    en: 'MiniMax Music 3',
    'zh-CN': 'MiniMax Music 3'
  },
  'minimaxMusic3.hero.titleRest': { en: ' is here', 'zh-CN': ' 已上线' },
  'minimaxMusic3.hero.description': {
    en: 'Full songs up to five minutes in one generation. Feed lyrics and a music description, and get coherent structure, expressive vocals, and evolving arrangements. Quality holds steady across the whole track, and the open weights are free to use commercially under Apache 2.0.',
    'zh-CN':
      '一次生成最长五分钟的完整歌曲。输入歌词和音乐描述，即可获得连贯的结构、富有表现力的人声和层层递进的编曲。整首曲目质量稳定如一，且开源权重依据 Apache 2.0 许可可免费商用。'
  },
  'minimaxMusic3.hero.tagOpenWeights': {
    en: 'Open Weight',
    'zh-CN': '开源权重'
  },
  'minimaxMusic3.hero.tagTextToMusic': {
    en: 'Text to Audio',
    'zh-CN': '文本生成音频'
  },
  'minimaxMusic3.hero.primaryCta': {
    en: 'RUN WORKFLOW',
    'zh-CN': '运行工作流'
  },
  'minimaxMusic3.hero.secondaryCta': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'minimaxMusic3.faq.heading': { en: 'Q&A', 'zh-CN': '问答' },
  'minimaxMusic3.pricing.banner.title': {
    en: "Start free. Upgrade when you're ready.",
    'zh-CN': '免费开始，准备好了再升级。'
  },
  'minimaxMusic3.pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'minimaxMusic3.pricing.banner.cta': {
    en: 'TRY FREE',
    'zh-CN': '免费试用'
  },
  'minimaxMusic3.steps.heading': {
    en: 'Make your first song',
    'zh-CN': '制作你的第一首歌'
  },
  'minimaxMusic3.steps.step': { en: 'Step', 'zh-CN': '步骤' },
  'minimaxMusic3.steps.primaryCta': {
    en: 'RUN WORKFLOW',
    'zh-CN': '运行工作流'
  },
  'minimaxMusic3.steps.secondaryCta': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'minimaxMusic3.runOptions.heading': {
    en: 'One engine, every way to run it',
    'zh-CN': '同一引擎，多种运行方式'
  },
  'minimaxMusic3.runOptions.subtitle': {
    en: 'Run MiniMax Music 3 in the browser today. Batch with the API, or bring it in-house.',
    'zh-CN':
      '今天就在浏览器中运行 MiniMax Music 3。用 API 批量生成，或部署到自有环境。'
  },
  'minimaxMusic3.runOptions.cta': { en: 'LEARN MORE', 'zh-CN': '了解更多' },
  'minimaxMusic3.reviews.heading': {
    en: '4+ million Comfy creators say',
    'zh-CN': '400 万+ Comfy 创作者这样说'
  },
  'minimaxMusic3.reviews.highlightTitle': {
    en: 'Comfy MCP: now turn your agent into a creative technologist.',
    'zh-CN': 'Comfy MCP：让你的智能体成为创意技术专家。'
  },
  'minimaxMusic3.reviews.highlightDescription': {
    en: 'Your AI assistant can access the ecosystem, build workflows, and generate images, video, audio, or 3D.',
    'zh-CN':
      '你的 AI 助手可以接入整个生态、构建工作流，并生成图像、视频、音频或 3D 内容。'
  },
  'minimaxMusic3.reviews.highlightCta': {
    en: 'GET STARTED',
    'zh-CN': '开始使用'
  },
  'minimax.breadcrumb.updated': {
    en: 'Updated August 2026',
    'zh-CN': '更新于 2026 年 8 月'
  },
  // The hero h1 renders titleModel bright and titleRest muted (Figma two-tone
  // heading); together they read "MiniMax H3 is here".
  'minimax.hero.titleModel': {
    en: 'MiniMax H3',
    'zh-CN': 'MiniMax H3'
  },
  'minimax.hero.titleRest': {
    en: ' is here',
    'zh-CN': ' 已上线'
  },
  'minimax.hero.description': {
    en: 'Full multi-modal I/O, native stereo clip. Up to 2K, 5 to 15s per generation. H3 actually conditions on input audio where others overwrite or drop it. H3 is available as Open Weights and through Partner Nodes.',
    'zh-CN':
      '完整的多模态输入/输出，每个片段都带原生立体声。最高 2K，每次生成 5 到 15 秒。H3 会真正以输入音频为条件进行生成，而其他模型往往覆盖或丢弃它。H3 以开源权重形式提供，也可通过合作伙伴节点使用。'
  },
  'minimax.hero.primaryCta': {
    en: 'RUN MINIMAX H3',
    'zh-CN': '运行 MiniMax H3'
  },
  'minimax.hero.secondaryCta': { en: 'TRY WORKFLOWS', 'zh-CN': '试用工作流' },
  'minimax.hero.tagOpenWeights': { en: 'Open Weights', 'zh-CN': '开源权重' },
  'minimax.hero.tagPartnerNodes': {
    en: 'Partner Nodes',
    'zh-CN': '合作伙伴节点'
  },
  'minimax.models.heading': {
    en: 'Made with MiniMax H3',
    'zh-CN': '用 MiniMax H3 制作'
  },
  'minimax.faq.heading': {
    en: 'Q&A',
    'zh-CN': '问答'
  },
  'minimax.cta.heading': {
    en: 'Up to 2K, with sound, in one generation.',
    'zh-CN': '最高 2K，自带声音，一次生成。'
  },
  'minimax.cta.primaryCta': {
    en: 'RUN MINIMAX H3',
    'zh-CN': '运行 MiniMax H3'
  },
  'minimax.cta.secondaryCta': {
    en: 'TRY WORKFLOWS',
    'zh-CN': '试用工作流'
  },
  'minimax.runOptions.heading': {
    en: 'One engine, every way to run it',
    'zh-CN': '同一引擎，多种运行方式'
  },
  'minimax.runOptions.subtitle': {
    en: 'Run MiniMax in the browser today. Batch campaigns with the API, or bring it in-house.',
    'zh-CN': '今天就在浏览器中运行 MiniMax。用 API 批量制作，或部署到自有环境。'
  },
  // shared across all four run-option cards; the per-product `products.*.cta`
  // labels overflow on mobile
  'minimax.runOptions.cta': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'minimax.reviews.heading': {
    en: '4+ million Comfy creators say',
    'zh-CN': '400 万+ Comfy 创作者这样说'
  },
  'minimax.reviews.highlightTitle': {
    en: 'Comfy MCP: now turn your agent into a creative technologist.',
    'zh-CN': 'Comfy MCP：让你的智能体成为创意技术专家。'
  },
  'minimax.reviews.highlightDescription': {
    en: 'Your AI assistant can access the ecosystem, build workflows, and generate images, video, audio, or 3D.',
    'zh-CN':
      '你的 AI 助手可以接入整个生态、构建工作流，并生成图像、视频、音频或 3D 内容。'
  },
  'minimax.reviews.highlightCta': { en: 'GET STARTED', 'zh-CN': '开始使用' },
  'minimax.pricing.banner.title': {
    en: "Start free. Upgrade when you're ready.",
    'zh-CN': '免费开始，准备好了再升级。'
  },
  'minimax.pricing.banner.subtitle': {
    en: '5 free runs on real GPUs — no credit card required.',
    'zh-CN': '在真实 GPU 上免费运行 5 次 — 无需信用卡。'
  },
  'minimax.pricing.banner.cta': { en: 'TRY FREE', 'zh-CN': '免费试用' },
  // FDCT page (/forward-deployed-creatives) — Forward Deployed Creatives
  'fdct.meta.title': {
    en: 'Forward Deployed Creatives | Comfy',
    'zh-CN': '前沿驻场创意人才 | Comfy'
  },
  'fdct.meta.description': {
    en: 'Comfy experts who embed with your team, build your ComfyUI workflows, and teach your team to scale them.',
    'zh-CN':
      'Comfy 专家驻场加入你的团队，为你构建 ComfyUI 工作流，并教会你的团队扩展规模。'
  },
  'fdct.hero.title': {
    en: 'Forward Deployed Creatives',
    'zh-CN': '前沿驻场创意人才'
  },
  'fdct.hero.subtitle': {
    en: 'Comfy experts who embed with your team, build your ComfyUI workflows, and teach your team to scale them.',
    'zh-CN':
      'Comfy 专家驻场加入你的团队，为你构建 ComfyUI 工作流，并教会你的团队扩展规模。'
  },
  'fdct.hero.eyebrow': {
    en: 'creative services',
    'zh-CN': '创意服务'
  },
  'fdct.hero.contactCta': { en: 'Contact us', 'zh-CN': '联系我们' },
  'fdct.builders.title': {
    en: 'Builders, not advisors',
    'zh-CN': '实干者，而非顾问'
  },
  'fdct.builders.lead': {
    en: 'From “is this possible?” to a workflow your team owns. A Forward Deployed Creative is the person who builds it.',
    'zh-CN':
      '从“这可能吗？”到你的团队自己拥有的工作流。前沿驻场创意人才就是把它构建出来的人。'
  },
  'fdct.builders.nodeLabel': {
    en: 'A Forward Deployed Creative',
    'zh-CN': '一位前沿驻场创意人才'
  },
  'fdct.builders.reason1': {
    en: 'validates the use case. We build the workflow and install it in your environment.',
    'zh-CN': '验证用例。我们构建工作流，并将其部署到你的环境中。'
  },
  'fdct.builders.reason2': {
    en: 'teaches your team to run it. Training and enablement are a part of the process.',
    'zh-CN': '教你的团队运行它。培训与赋能是流程的一部分。'
  },
  'fdct.builders.reason3': {
    en: 'comes from real production. Feature film, commercial, experiential work that shipped.',
    'zh-CN': '来自真实制作。电影长片、商业广告与体验项目，都是实际交付的作品。'
  },
  'fdct.builders.reason4': {
    en: 'leaves you something you own. You keep the workflow and your team is trained to change it.',
    'zh-CN':
      '留下真正属于你的成果。工作流归你所有，你的团队经过培训后可自行修改。'
  },
  'fdct.howItWorks.title': { en: 'How it works', 'zh-CN': '如何运作' },
  'fdct.howItWorks.step1.title': { en: 'Validate', 'zh-CN': '验证' },
  'fdct.howItWorks.step1.description': {
    en: 'We prove the outcome is achievable on your own material.',
    'zh-CN': '我们用你自己的素材证明目标成果切实可行。'
  },
  'fdct.howItWorks.step2.title': { en: 'Build', 'zh-CN': '构建' },
  'fdct.howItWorks.step2.description': {
    en: 'Inside your Comfy Enterprise environment.',
    'zh-CN': '在你的 Comfy Enterprise 环境中。'
  },
  'fdct.howItWorks.step3.title': { en: 'Enable', 'zh-CN': '赋能' },
  'fdct.howItWorks.step3.description': {
    en: 'We train your team to run, modify, and extend it themselves.',
    'zh-CN': '我们培训你的团队独立运行、修改和扩展它。'
  },
  'fdct.howItWorks.step4.title': { en: 'Own', 'zh-CN': '拥有' },
  'fdct.howItWorks.step4.description': {
    en: 'What we build is yours, and you can change it without us.',
    'zh-CN': '我们构建的成果归你所有，你无需我们也能修改它。'
  },
  'fdct.howItWorks.footnote': {
    en: "The direct line stays open. We're here when your team needs us.",
    'zh-CN': '直达通道始终敞开。你的团队需要时，我们随时都在。'
  },
  'fdct.whatYouGet.title': { en: 'What you will get', 'zh-CN': '你将获得什么' },
  'fdct.whatYouGet.item1': {
    en: 'Use-case validation and a proof-of-concept build',
    'zh-CN': '用例验证与概念验证构建'
  },
  'fdct.whatYouGet.item2': {
    en: 'A production-grade workflow, built and installed',
    'zh-CN': '生产级工作流，构建并完成部署'
  },
  'fdct.whatYouGet.item3': {
    en: 'Enablement until your team is self-sufficient',
    'zh-CN': '持续赋能，直到你的团队能够独立运作'
  },
  'fdct.whatYouGet.item4': {
    en: 'White-glove access under your enterprise agreement',
    'zh-CN': '企业协议下的白手套贴心服务'
  },
  'fdct.whatYouGet.item5': {
    en: 'Reusable creative assets your team keeps',
    'zh-CN': '可复用的创意资产，归你的团队所有'
  },
  'fdct.technologists.title': {
    en: 'Featured creatives',
    'zh-CN': '精选创意人才'
  },
  'fdct.technologists.lead': {
    en: 'Forward Deployed Creatives come from real production: feature film, commercial, and experiential backgrounds, with ComfyUI on the back end of shipped work. We match creatives to each engagement based on the work, your stack, and the timeline.',
    'zh-CN':
      '前沿驻场创意人才来自真实制作一线：拥有电影长片、商业广告与体验项目背景，ComfyUI 支撑着已交付的作品。我们会根据项目内容、你的技术栈和时间表，为每次合作匹配合适的创意人才。'
  },
  'fdct.technologists.seeWork': {
    en: 'See {name}’s work',
    'zh-CN': '查看 {name} 的作品'
  },
  'fdct.technologists.close': { en: 'Close', 'zh-CN': '关闭' },
  'fdct.technologists.dougHogan.description': {
    en: "Doug's work spans Netflix, Universal Studios, Warner Bros., and Samsung, with deep expertise in VFX and studio production. As a Nuke compositor and Python tool builder, he teaches VFX, Nuke, and generative AI.",
    'zh-CN':
      'Doug 的作品遍及 Netflix、环球影业、华纳兄弟和三星，在视觉特效与影棚制作方面拥有深厚经验。作为 Nuke 合成师和 Python 工具开发者，他教授 VFX、Nuke 和生成式 AI。'
  },
  'fdct.technologists.chrisV.description': {
    en: "Chris's work spans global brands, artists, Fortune 500 keynote stages, and Art Basel Miami, with deep expertise in generative AI and production infrastructure. Sitting between artist and engineer, he architects custom VFX and AI pipelines.",
    'zh-CN':
      'Chris 的作品覆盖全球品牌、艺术家、财富 500 强主题演讲舞台以及迈阿密巴塞尔艺术展，在生成式 AI 与制作基础设施方面拥有深厚经验。他游走于艺术家与工程师之间，构建定制的 VFX 与 AI 流水线。'
  },
  'fdct.technologists.robLosch.description': {
    en: "Rob has been in ComfyUI since day one. He has numerous workflows covering marketing and advertising, and he can pinpoint the exact workflow you're looking for.",
    'zh-CN':
      'Rob 从第一天起就活跃在 ComfyUI。他拥有大量覆盖营销与广告场景的工作流，并能精准找到你正在寻找的那一个。'
  },
  'fdct.technologists.robertPaige.description': {
    en: "Robert's work spans rapid-growth companies like Instacart and Lyft, with deep expertise in creative ecosystems and AI integration. At the intersection of craft and system, he architects production infrastructure that helps organizations tell their story.",
    'zh-CN':
      'Robert 曾服务于 Instacart、Lyft 等高速成长的公司，在创意生态与 AI 集成方面拥有深厚经验。他游走于工艺与系统之间，构建帮助组织讲好品牌故事的制作基础设施。'
  },
  'fdct.tags.entertainment': { en: 'Entertainment', 'zh-CN': '娱乐' },
  'fdct.tags.nuke': { en: 'Nuke', 'zh-CN': 'Nuke' },
  'fdct.tags.vfx': { en: 'VFX', 'zh-CN': 'VFX' },
  'fdct.tags.generativeAi': { en: 'Generative AI', 'zh-CN': '生成式 AI' },
  'fdct.tags.production': { en: 'Production', 'zh-CN': '制作' },
  'fdct.tags.marketing': { en: 'Marketing', 'zh-CN': '营销' },
  'fdct.tags.advertising': { en: 'Advertising', 'zh-CN': '广告' },
  'fdct.tags.imageGeneration': { en: 'Image Generation', 'zh-CN': '图像生成' },
  'fdct.tags.imageToVideo': { en: 'Image to Video', 'zh-CN': '图生视频' },
  'fdct.tags.audioEditing': { en: 'Audio Editing', 'zh-CN': '音频编辑' },
  'fdct.tags.characterReference': {
    en: 'Character Reference',
    'zh-CN': '角色参考'
  },
  'fdct.tags.video': { en: 'Video', 'zh-CN': '视频' },
  'fdct.tags.virtualTryOn': { en: 'Virtual Try On', 'zh-CN': '虚拟试穿' },
  'fdct.tags.fashion': { en: 'Fashion', 'zh-CN': '时尚' },
  'fdct.tags.imageEdit': { en: 'Image Edit', 'zh-CN': '图像编辑' },
  'fdct.tags.inpainting': { en: 'Inpainting', 'zh-CN': '局部重绘' },
  'fdct.tags.film': { en: 'Film', 'zh-CN': '电影' },
  'fdct.tags.architecture': { en: 'Architecture', 'zh-CN': '建筑' },
  'fdct.projects.title': { en: 'Featured projects', 'zh-CN': '精选项目' },
  // Workflow-card titles (also used as the card image alt text). Proper nouns
  // and model names (Seedance, LTX, LoRA, Nano Banana, LLM, OOH, VFX) stay in
  // Latin; the zh-CN copy localizes only the descriptive parts and still needs
  // a native review pass, like the descriptions below.
  'fdct.projects.productAdvertisementVideo.title': {
    en: 'Product Advertisement Video',
    'zh-CN': '产品广告视频'
  },
  'fdct.projects.ltxCleanplateForVfx.title': {
    en: 'LTX Cleanplate for VFX',
    'zh-CN': 'LTX 视觉特效空景板'
  },
  'fdct.projects.lipdubLoraVoiceClone.title': {
    en: 'LTX 2.3 - Lipdub LoRA + Voice Clone',
    'zh-CN': 'LTX 2.3 - 对口型 LoRA + 语音克隆'
  },
  'fdct.projects.vfxUtilities.title': {
    en: 'VFX Utilities',
    'zh-CN': '视觉特效工具集'
  },
  'fdct.projects.viralVideosCharacterSwap.title': {
    en: 'Seedance 2.0 - Viral Videos Character Swap',
    'zh-CN': 'Seedance 2.0 - 热门视频角色替换'
  },
  'fdct.projects.faceSwapWorkflow.title': {
    en: 'Face Swap Workflow',
    'zh-CN': '换脸工作流'
  },
  'fdct.projects.virtualTryOn4In1.title': {
    en: 'Virtual Try On with Character - 4 in 1',
    'zh-CN': '角色虚拟试穿 - 4 合 1'
  },
  'fdct.projects.characterOutfitFashionVideo.title': {
    en: 'Character & Outfit to Fashion Video',
    'zh-CN': '角色与服装转时尚视频'
  },
  'fdct.projects.talentCasting.title': {
    en: 'Talent Casting',
    'zh-CN': '试镜选角'
  },
  'fdct.projects.seedanceLlmPromptHelper.title': {
    en: 'Seedance 2.0 + LLM Prompt Helper',
    'zh-CN': 'Seedance 2.0 + LLM 提示词助手'
  },
  'fdct.projects.nanoBanana2LiteImageEdit.title': {
    en: 'Nano Banana 2 Lite: Image Edit',
    'zh-CN': 'Nano Banana 2 Lite：图像编辑'
  },
  'fdct.projects.changeAnyObjects.title': {
    en: 'Change Any Objects',
    'zh-CN': '替换任意物体'
  },
  'fdct.projects.storyboardToVideoSeedance.title': {
    en: 'Storyboard To Video - Seedance 2.0',
    'zh-CN': '分镜转视频 - Seedance 2.0'
  },
  'fdct.projects.oohVisualization.title': {
    en: 'Comfy for Advertising - OOH Visualization',
    'zh-CN': 'Comfy 广告应用 - OOH 户外可视化'
  },
  'fdct.projects.photoToBlueprintToModel.title': {
    en: 'Photo to Blueprint to Model',
    'zh-CN': '照片转蓝图转模型'
  },
  'fdct.projects.generateRealisticVariations.title': {
    en: 'Generate Realistic Variations',
    'zh-CN': '生成逼真变体'
  },
  // Workflow-card descriptions in the technologist dialog; en copy is
  // placeholder until final descriptions land (the design mock is lorem).
  'fdct.projects.productAdvertisementVideo.description': {
    en: 'Turn product stills into a polished advertisement spot, from generated shots to final cut.',
    'zh-CN': '将产品静态图转化为精良的广告片，从生成镜头到最终成片一气呵成。'
  },
  'fdct.projects.ltxCleanplateForVfx.description': {
    en: 'Generate clean plates for VFX compositing with LTX, removing subjects while keeping the shot intact.',
    'zh-CN':
      '使用 LTX 为视觉特效合成生成空景板，在保留镜头原貌的同时移除拍摄主体。'
  },
  'fdct.projects.lipdubLoraVoiceClone.description': {
    en: 'Lipdub a performance with LTX 2.3, pairing a LoRA-trained look with a cloned voice track.',
    'zh-CN': '使用 LTX 2.3 为表演对口型，将 LoRA 训练的形象与克隆音轨相结合。'
  },
  'fdct.projects.vfxUtilities.description': {
    en: 'A utility kit for VFX shots: passes, mattes, and helpers for image and video work.',
    'zh-CN':
      '面向视觉特效镜头的实用工具集：分层通道、遮罩以及图像和视频处理辅助工具。'
  },
  'fdct.projects.viralVideosCharacterSwap.description': {
    en: 'Swap characters into trending video formats with Seedance 2.0 while keeping motion intact.',
    'zh-CN':
      '使用 Seedance 2.0 将角色替换进热门视频模板，同时完整保留原有动作。'
  },
  'fdct.projects.faceSwapWorkflow.description': {
    en: 'Swap a face across a full video while preserving the original performance and lighting.',
    'zh-CN': '在整段视频中替换人脸，同时保留原有表演与光影效果。'
  },
  // en copy for Chris's highlights comes from the workflows hub pages.
  'fdct.projects.virtualTryOn4In1.description': {
    en: "Create virtual try-ons with your character and outfit images using ComfyUI's Nano Banana Pro model. Generate 4 variations in one prompt.",
    'zh-CN':
      '使用 ComfyUI 的 Nano Banana Pro 模型，用你的角色与服装图像生成虚拟试穿效果，一条提示词即可生成 4 个变体。'
  },
  'fdct.projects.characterOutfitFashionVideo.description': {
    en: 'Transform character and outfit images into dynamic fashion videos.',
    'zh-CN': '将角色与服装图像转化为动感的时尚视频。'
  },
  'fdct.projects.talentCasting.description': {
    en: 'Turn a headshot into a branded still and a quick motion test for casting previs, using Gemini image-to-image and Kling image-to-video.',
    'zh-CN':
      '通过 Gemini 图生图与 Kling 图生视频，将头像照片转化为品牌风格静帧与快速动态测试，用于选角预览。'
  },
  // Robert Paige's highlights — en copy from the workflows hub pages.
  'fdct.projects.seedanceLlmPromptHelper.description': {
    en: 'Feed two reference images and a short text description; an LLM writes a detailed Seedance 2.0 prompt and generates the video.',
    'zh-CN':
      '输入两张参考图和一句简单描述，LLM 会自动生成详细的 Seedance 2.0 提示词并产出视频。'
  },
  'fdct.projects.nanoBanana2LiteImageEdit.description': {
    en: "Edit an image with Nano Banana 2 Lite, Google Gemini's fastest image model, with a side-by-side of the original and result.",
    'zh-CN':
      '使用 Google Gemini 系列中最快的图像模型 Nano Banana 2 Lite 编辑图像，并生成原图与结果的并排对比。'
  },
  'fdct.projects.changeAnyObjects.description': {
    en: 'Replace objects in a video from a text prompt or reference image, using SAM3 masking and Wan2.1 VACE.',
    'zh-CN':
      '通过文本提示或参考图替换视频中的物体，由 SAM3 遮罩与 Wan2.1 VACE 模型驱动。'
  },
  'fdct.faq.title': { en: 'Q&A', 'zh-CN': '问答' },
  'fdct.faq.q1': {
    en: 'Can this be a consulting or professional-services contract standalone?',
    'zh-CN': '可以单独签订咨询或专业服务合同吗？'
  },
  'fdct.faq.a1': {
    en: 'No. It is an add-on to your Comfy enterprise agreement. We bring deep Comfy expertise to your use case, as an optional add on to your enterprise contract.',
    'zh-CN':
      '不可以。它是你 Comfy 企业协议的附加服务。我们将深厚的 Comfy 专业能力带到你的用例中，作为企业合同的可选附加项。'
  },
  'fdct.faq.q2': {
    en: 'Is it included in every enterprise contract?',
    'zh-CN': '每份企业合同都包含这项服务吗？'
  },
  'fdct.faq.a2': {
    en: 'No. It is available to any enterprise customer as an add-on, not bundled automatically into every contract.',
    'zh-CN':
      '不包含。它作为附加服务向所有企业客户开放，不会自动捆绑进每份合同。'
  },
  'fdct.faq.q3': {
    en: 'Will someone be embedded full-time with our team?',
    'zh-CN': '会有人全职驻场加入我们的团队吗？'
  },
  'fdct.faq.a3': {
    en: 'Forward Deployed Creatives work with you on defined milestones and deliverables, with optional in-person time as well. We will customize this based on what your team needs.',
    'zh-CN':
      '前沿驻场创意人才按明确的里程碑和交付物与你协作，也可选择安排现场时间。我们会根据你团队的需求定制协作方式。'
  },
  'fdct.faq.q4': {
    en: 'What happens after the initial build?',
    'zh-CN': '初始构建完成之后会怎样？'
  },
  'fdct.faq.a4': {
    en: 'You own the workflow and your team is trained to change it. We provide ongoing support and stay available under the enterprise agreement for the next thing, plus optional workshops and one-on-one training.',
    'zh-CN':
      '工作流归你所有，你的团队经过培训后可以自行修改。我们在企业协议下提供持续支持、随时待命迎接下一个项目，还可选择工作坊和一对一培训。'
  },
  'fdct.faq.q5': {
    en: 'Who are the people we would actually work with?',
    'zh-CN': '我们实际会和哪些人合作？'
  },
  'fdct.faq.a5': {
    en: 'Production-credible creatives from feature film, commercial, and experiential backgrounds. Short intro bios/videos on the solution page let you see who you are getting before you sign.',
    'zh-CN':
      '来自电影长片、商业广告和体验项目背景、具备真实制作履历的创意人才。解决方案页面上的简短介绍和视频，让你在签约前就能了解将与谁合作。'
  },
  'fdct.bands.enterprise.label': {
    en: 'FOR ENTERPRISE',
    'zh-CN': '面向企业'
  },
  'fdct.bands.enterprise.text': {
    en: "Tell us what you're trying to make. A Forward Deployed Creative can validate it and help you build from there.",
    'zh-CN':
      '告诉我们你想做什么。前沿驻场创意人才可以验证它，并帮助你从此开始构建。'
  },
  'fdct.bands.enterprise.cta': { en: 'Contact us', 'zh-CN': '联系我们' },
  'fdct.closing.title': {
    en: 'Build your custom workflows with Comfy experts.',
    'zh-CN': '与 Comfy 专家一起构建你的定制工作流。'
  }
} as const satisfies Record<string, Record<Locale, string>>

type TranslationKey = keyof typeof translations

type LocalizedText = Record<Locale, string>

export function t(key: TranslationKey, locale: Locale = 'en'): string {
  return translations[key][locale] ?? translations[key].en
}

export const translationKeys = Object.keys(translations) as TranslationKey[]

export function hasKey(key: string): boolean {
  return key in translations
}

export type { Locale, LocalizedText, TranslationKey }
