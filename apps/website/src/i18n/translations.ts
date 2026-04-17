type Locale = 'en' | 'zh-CN'

const translations = {
  // HeroSection
  'hero.title': {
    en: 'Professional Control\nof Visual AI',
    'zh-CN': '视觉 AI 的\n专业控制'
  },
  'hero.subtitle': {
    en: 'Comfy is the AI creation engine for visual professionals who demand control over every model, every parameter, and every output.',
    'zh-CN':
      'Comfy 是面向视觉专业人士的 AI 创作引擎，让您掌控每个模型、每个参数和每个输出。'
  },

  // ProductShowcaseSection
  'showcase.subtitle1': {
    en: 'Connect models, processing steps, and outputs on a canvas where every decision is visible and every step is inspectable.',
    'zh-CN':
      '在画布上连接模型、处理步骤和输出，每个决策都可见，每个步骤都可检查。'
  },
  'showcase.subtitle2': {
    en: 'Start from a community template or build from scratch.',
    'zh-CN': '从社区模板开始，或从零构建。'
  },
  'showcase.feature1.title': {
    en: 'Full Control with Nodes',
    'zh-CN': '节点式完全控制'
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
    en: 'Community Workflows on Comfy Hub',
    'zh-CN': 'Comfy Hub 上的社区工作流'
  },
  'showcase.feature3.description': {
    en: 'Browse and remix thousands of community-shared workflows. Start from a proven template and customize it to your needs.',
    'zh-CN':
      '浏览和混搭数千个社区共享的工作流。从经过验证的模板开始，按需自定义。'
  },
  'showcase.badgeHow': { en: 'HOW', 'zh-CN': '如何' },
  'showcase.badgeWorks': { en: 'WORKS', 'zh-CN': '运作' },

  // UseCaseSection
  'useCase.label': {
    en: 'Industries that create with ComfyUI',
    'zh-CN': '使用 ComfyUI 创作的行业'
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
    en: 'Video Games',
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
    'zh-CN':
      '由 60,000+ 节点、数千个工作流\n和一个比任何公司都更快构建的社区驱动。'
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
    en: 'Download Local',
    'zh-CN': '下载本地版'
  },
  'getStarted.step1.launchCloud': {
    en: 'Launch Cloud',
    'zh-CN': '启动云端'
  },
  'getStarted.step1.or': {
    en: ' or ',
    'zh-CN': '或'
  },
  'getStarted.step2.title': {
    en: 'Load a workflow',
    'zh-CN': '加载工作流'
  },
  'getStarted.step2.description': {
    en: 'Start from a community template or build your own.',
    'zh-CN': '从社区模板开始，或自行构建。'
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
    en: 'Comfy\nLocal',
    'zh-CN': 'Comfy\n本地版'
  },
  'products.local.description': {
    en: 'Run ComfyUI on your own hardware.',
    'zh-CN': '在您自己的硬件上运行 ComfyUI。'
  },
  'products.local.cta': {
    en: 'SEE LOCAL FEATURES',
    'zh-CN': '查看本地版特性'
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
    'zh-CN': '查看云端特性'
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
    'zh-CN': '查看 API 特性'
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
    'zh-CN': '查看企业版特性'
  },

  // CaseStudySpotlightSection
  'caseStudy.label': {
    en: 'Customer Stories',
    'zh-CN': '客户故事'
  },
  'caseStudy.heading': {
    en: 'See Comfy\nin the real world',
    'zh-CN': '看看 Comfy\n在真实世界中的应用'
  },
  'caseStudy.subheading': {
    en: 'Videos & case studies from teams building with Comfy',
    'zh-CN': '来自使用 Comfy 构建的团队的视频和案例研究'
  },
  'caseStudy.watchVideos': {
    en: 'WATCH VIDEOS',
    'zh-CN': '观看视频'
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
    en: 'SET UP SSO',
    'zh-CN': '设置 SSO'
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
    en: 'ComfyUI Enterprise adds managed infrastructure, team controls, and dedicated support to the workflows your organization already builds.',
    'zh-CN':
      'ComfyUI 企业版为你的组织已有的工作流添加托管基础设施、团队控制和专属支持。'
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
    en: 'Why would I pay for Comfy Cloud if Local is free?',
    'zh-CN': '既然本地版免费，为什么还要付费使用 Comfy Cloud？'
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
    en: 'Can I use my local workflows in Comfy Cloud?',
    'zh-CN': '我可以在 Comfy Cloud 中使用本地工作流吗？'
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
    en: 'Local',
    'zh-CN': '本地版'
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
    en: 'DOWNLOAD LOCAL',
    'zh-CN': '下载本地版'
  },
  'download.hero.installGithub': {
    en: 'INSTALL FROM GITHUB',
    'zh-CN': '从 GITHUB 安装'
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
    en: 'Powerful GPUs with end-\nto-end security built-in',
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
    en: 'Run open-source models like Wan 2.2, Flux, LTX and Qwen alongside partner models like Nano Banana, Seedance, Seedream, Grok, Kling, Hunyuan 3D and more. Every model on Comfy Cloud is cleared for commercial use. No license ambiguity. All through one credit balance.',
    'zh-CN':
      '运行 Wan 2.2、Flux、LTX 和 Qwen 等开源模型，以及 Nano Banana、Seedance、Seedream、Grok、Kling、Hunyuan 3D 等合作伙伴模型。Comfy Cloud 上的每个模型都已获得商业使用许可。无许可证歧义。通过统一的积分余额使用。'
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
    en: 'Community workflows,\nunlimited customization\nthrough pre-installed\ncustom nodes',
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
  'cloud.aiModels.card.seendance20': {
    en: 'Seendance 2.0',
    'zh-CN': 'Seendance 2.0'
  },
  'cloud.aiModels.card.qwenImageEdit': {
    en: 'Qwen\nImage Edit',
    'zh-CN': 'Qwen\n图像编辑'
  },
  'cloud.aiModels.card.wan22TextToVideo': {
    en: 'Wan 2.2',
    'zh-CN': 'Wan 2.2'
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
    en: 'Cloud runs on powerful remote GPUs and is accessible from any device. Local runs entirely on your computer, giving you full control and offline use.',
    'zh-CN':
      'Cloud 在强大的远程 GPU 上运行，可从任何设备访问。本地版完全在您的电脑上运行，提供完全控制和离线使用。'
  },
  'cloud.faq.3.q': {
    en: 'Which version should I choose, Comfy Cloud or local ComfyUI (self-hosted)?',
    'zh-CN': '我应该选择 Comfy Cloud 还是本地 ComfyUI（自托管）？'
  },
  'cloud.faq.3.a': {
    en: "Comfy Cloud (beta) has zero setup, is easy to share with your team, and is faster than most GPUs you can run on a desktop workstation. You can immediately run the best models and workflows from the community on Comfy Cloud.\nLocal ComfyUI is infinitely customizable, works offline, and you don't need to worry about queue times. However, depending on what you want to create, you might need to have a good GPU and some amount of technical knowledge to install community-created custom nodes.",
    'zh-CN':
      'Comfy Cloud（测试版）无需任何设置，方便与团队共享，比大多数桌面工作站 GPU 更快。您可以立即在 Comfy Cloud 上运行社区中最好的模型和工作流。\n本地 ComfyUI 可以无限定制，支持离线工作，无需担心排队时间。但根据您的创作需求，可能需要一块好的 GPU 以及一定的技术知识来安装社区创建的自定义节点。'
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
    en: 'Comfy Cloud runs on Blackwell RTX 6000 Pros — 96GB VRAM.',
    'zh-CN': 'Comfy Cloud 运行在 Blackwell RTX 6000 Pro 上——96GB 显存。'
  },
  'cloud.faq.6.q': {
    en: 'Can I use my existing workflows with Comfy Cloud?',
    'zh-CN': '我可以在 Comfy Cloud 上使用现有的工作流吗？'
  },
  'cloud.faq.6.a': {
    en: 'Yes, your workflows work across Local and Cloud. Just note that only the most popular custom nodes are supported for now, but more will be added soon.',
    'zh-CN':
      '可以，您的工作流在本地和云端都能使用。请注意，目前仅支持最热门的自定义节点，但很快会添加更多。'
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
    en: 'You can always check Cloud to see the list of extensions and models that we support, for free.\nCurrently, we support a wide variety of preinstalled models.\nFor those on the Creator or Pro plans, you can bring in your own fine-tuned LoRAs from CivitAI to perfect your own style.\nImporting from HuggingFace and direct file upload for larger models is on our roadmap.',
    'zh-CN':
      '您可以随时在 Cloud 上免费查看我们支持的扩展和模型列表。\n目前我们支持大量预装模型。\n对于 Creator 或 Pro 计划用户，您可以导入自己从 CivitAI 微调的 LoRA 来打造专属风格。\n从 HuggingFace 导入和大型模型的直接上传功能已在我们的路线图中。'
  },
  'cloud.faq.9.q': {
    en: 'Can I run long or multiple workflows?',
    'zh-CN': '我可以运行长时间或多个工作流吗？'
  },
  'cloud.faq.9.a': {
    en: "Each workflow can run for up to 30 minutes, with one active job at a time. We're adding higher tiers and parallel runs soon for even more flexibility.",
    'zh-CN':
      '每个工作流最长可运行 30 分钟，同时运行一个活跃任务。我们即将推出更高层级和并行运行，提供更大灵活性。'
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
    en: 'How does pricing for Comfy Cloud work?',
    'zh-CN': 'Comfy Cloud 的定价是怎样的？'
  },
  'cloud.faq.11.a': {
    en: 'Your monthly plan grants you a single credit balance that you can spend anywhere. Partner Nodes (formerly API nodes) will have set credit prices per usage. For Cloud workflows, you will be charged credits based on the exact duration of your workflow run — longer runs consume more credits.',
    'zh-CN':
      '您的月度计划会授予一个可在任何地方使用的积分余额。合作伙伴节点（原 API 节点）按使用量设定积分价格。对于云端工作流，将根据工作流运行的确切时长收取积分——运行时间越长消耗的积分越多。'
  },
  'cloud.faq.12.q': {
    en: "What's the difference between Partner Node credits and my Cloud subscription?",
    'zh-CN': '合作伙伴节点积分和我的 Cloud 订阅有什么区别？'
  },
  'cloud.faq.12.a': {
    en: 'Comfy Cloud has a credit system that is used for both Partner nodes (formerly API nodes) and running workflows on cloud.\n1. Partner Nodes (Pay-as-you-go): These nodes (formerly called API nodes) run third-party models via API calls and can be used on both Comfy Cloud and Local/Self-Hosted ComfyUI. Each node has its own usage cost, determined by the API provider, and we directly match their pricing.\n2. Running workflows on cloud: Exclusive to Comfy Cloud, you get a set amount of credits per month, with the amount differing based on your plan. More credits can be topped up anytime. Credits are only used up for GPU time while workflows are running — not while editing or building them. No idle costs, no setup, and no infrastructure to manage.',
    'zh-CN':
      'Comfy Cloud 有一个积分系统，用于合作伙伴节点（原 API 节点）和在云端运行工作流。\n1. 合作伙伴节点（按需付费）：这些节点（原称 API 节点）通过 API 调用运行第三方模型，可在 Comfy Cloud 和本地/自托管 ComfyUI 上使用。每个节点有其自身的使用成本，由 API 提供商决定，我们直接匹配他们的定价。\n2. 在云端运行工作流：Comfy Cloud 专属，您每月获得一定数量的积分，数量根据您的计划而不同。积分可随时充值。积分仅在工作流运行时用于 GPU 时间——编辑或构建时不消耗。无闲置成本，无需设置，无需管理基础设施。'
  },
  'cloud.faq.13.q': {
    en: 'Can I cancel my subscription?',
    'zh-CN': '我可以取消订阅吗？'
  },
  'cloud.faq.13.a': {
    en: "Yes. You can cancel your subscription anytime through your account's billing settings, powered by Stripe. Your plan will remain active until the end of your current billing period.",
    'zh-CN':
      '可以。您可以随时通过账户的账单设置取消订阅（由 Stripe 提供支持）。您的计划将在当前计费周期结束前保持有效。'
  },
  'cloud.faq.14.q': {
    en: "Where can I find my invoices or add my company's tax ID?",
    'zh-CN': '我在哪里可以找到发票或添加公司税号？'
  },
  'cloud.faq.14.a': {
    en: "You can manage all billing details directly through your Stripe portal.\nGo to Settings → Plans & Credits → Invoice History to open the Stripe portal. From there, you can view and download invoices, update your billing information, and add your company's tax ID.",
    'zh-CN':
      '您可以通过 Stripe 门户直接管理所有账单详情。\n前往设置 → 计划与积分 → 发票历史以打开 Stripe 门户。在那里，您可以查看和下载发票、更新账单信息并添加公司税号。'
  },
  'cloud.faq.15.q': {
    en: 'Will ComfyUI always be free to run locally?',
    'zh-CN': 'ComfyUI 本地运行会一直免费吗？'
  },
  'cloud.faq.15.a': {
    en: "Yes, absolutely. ComfyUI will always be free and open source. You can deploy it however you want, such as downloading it from GitHub, using Docker, custom setups, etc.\n\nComfy Cloud is an optional hosted service for those who prefer convenience, accessibility, or don't have powerful GPUs.",
    'zh-CN':
      '是的，绝对如此。ComfyUI 将始终免费且开源。您可以按任何方式部署它，例如从 GitHub 下载、使用 Docker、自定义设置等。\n\nComfy Cloud 是一项可选的托管服务，适合偏好便捷性、可访问性或没有强大 GPU 的用户。'
  },

  'buildWhat.row1': { en: 'BUILD WHAT', 'zh-CN': '构建' },
  'buildWhat.row2a': { en: "DOESN'T EXIST", 'zh-CN': '尚不存在的' },
  'buildWhat.row2b': { en: 'YET', 'zh-CN': '事物' },

  // PriceSection
  'pricing.title': { en: 'Pricing', 'zh-CN': '价格' },
  'pricing.subtitle': {
    en: 'Access cloud-powered ComfyUI workflows with straightforward, usage-based pricing.',
    'zh-CN': '通过简单透明、按使用量计费的方式，访问云端 ComfyUI 工作流。'
  },
  'pricing.badge.popular': { en: 'MOST POPULAR', 'zh-CN': '最受欢迎' },
  'pricing.plan.period': { en: '/month', 'zh-CN': '/月' },

  'pricing.plan.free.label': { en: 'FREE', 'zh-CN': '免费版' },
  'pricing.plan.free.summary': {
    en: "Explore Comfy's possibilities",
    'zh-CN': '探索 Comfy 的可能性'
  },
  'pricing.plan.free.price': { en: '$0', 'zh-CN': '$0' },
  'pricing.plan.free.credits': {
    en: 'Includes 400 monthly credits',
    'zh-CN': '每月包含 400 积分'
  },
  'pricing.plan.free.estimate': {
    en: '~35 5s videos using the Wan 2.2 Image-to-Video template*',
    'zh-CN': '约可生成 35 个 5 秒视频（使用 Wan 2.2 图生视频模板）*'
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
  'pricing.plan.standard.summary': {
    en: 'For individuals creating workflows',
    'zh-CN': '面向个人工作流创作者'
  },
  'pricing.plan.standard.price': { en: '$20', 'zh-CN': '$20' },
  'pricing.plan.standard.credits': {
    en: 'Includes 4,200 monthly credits with top-ups available',
    'zh-CN': '每月包含 4,200 积分，并支持充值'
  },
  'pricing.plan.standard.estimate': {
    en: '~380 5s videos using the Wan 2.2 Image-to-Video template*',
    'zh-CN': '约可生成 380 个 5 秒视频（使用 Wan 2.2 图生视频模板）*'
  },
  'pricing.plan.standard.cta': {
    en: 'SUBSCRIBE TO STANDARD',
    'zh-CN': '订阅标准版'
  },
  'pricing.plan.standard.featureIntro': {
    en: 'Everything in Free, plus:',
    'zh-CN': '包含免费版全部能力，另加：'
  },
  'pricing.plan.standard.feature1': {
    en: '30-minute max runtime per workflow',
    'zh-CN': '单个工作流最长运行 30 分钟'
  },
  'pricing.plan.standard.feature2': {
    en: 'Add more credits anytime',
    'zh-CN': '可随时增加积分'
  },

  'pricing.plan.creator.label': { en: 'CREATOR', 'zh-CN': '创作者版' },
  'pricing.plan.creator.summary': {
    en: 'Professionals and small teams building fine-tuned, repeatable workflows',
    'zh-CN': '面向专业人士与小团队，构建可复用、精细调优的工作流'
  },
  'pricing.plan.creator.price': { en: '$35', 'zh-CN': '$35' },
  'pricing.plan.creator.credits': {
    en: 'Includes 7,400 monthly credits with top-ups available',
    'zh-CN': '每月包含 7,400 积分，并支持充值'
  },
  'pricing.plan.creator.estimate': {
    en: '~670 5s videos using the Wan 2.2 Image-to-Video template*',
    'zh-CN': '约可生成 670 个 5 秒视频（使用 Wan 2.2 图生视频模板）*'
  },
  'pricing.plan.creator.cta': {
    en: 'SUBSCRIBE TO CREATOR',
    'zh-CN': '订阅创作者版'
  },
  'pricing.plan.creator.featureIntro': {
    en: 'Everything in Standard, plus:',
    'zh-CN': '包含标准版全部能力，另加：'
  },
  'pricing.plan.creator.feature1': {
    en: 'Import your own LoRAs',
    'zh-CN': '导入你自己的 LoRA'
  },
  'pricing.plan.creator.feature2': {
    en: 'Up to 5 seats per workspace (coming soon!)',
    'zh-CN': '每个工作区最多 5 个席位（即将上线）'
  },
  'pricing.plan.creator.nextUp': {
    en: 'Next Up: Team Collaboration Features',
    'zh-CN': '下一步：团队协作功能'
  },

  'pricing.plan.pro.label': { en: 'PRO', 'zh-CN': '专业版' },
  'pricing.plan.pro.summary': {
    en: 'For growing teams running Comfy in production',
    'zh-CN': '面向在生产环境使用 Comfy 的成长型团队'
  },
  'pricing.plan.pro.price': { en: '$100', 'zh-CN': '$100' },
  'pricing.plan.pro.credits': {
    en: 'Includes 21,100 monthly credits with top-ups available',
    'zh-CN': '每月包含 21,100 积分，并支持充值'
  },
  'pricing.plan.pro.estimate': {
    en: '~1,915 5s videos using the Wan 2.2 Image-to-Video template*',
    'zh-CN': '约可生成 1,915 个 5 秒视频（使用 Wan 2.2 图生视频模板）*'
  },
  'pricing.plan.pro.cta': { en: 'SUBSCRIBE TO PRO', 'zh-CN': '订阅专业版' },
  'pricing.plan.pro.featureIntro': {
    en: 'Everything in Creator, plus:',
    'zh-CN': '包含创作者版全部能力，另加：'
  },
  'pricing.plan.pro.feature1': {
    en: 'Longer workflow runtime (up to 1 hour)',
    'zh-CN': '更长工作流运行时长（最长 1 小时）'
  },
  'pricing.plan.pro.feature2': {
    en: 'Up to 20 seats per workspace (coming soon!)',
    'zh-CN': '每个工作区最多 20 个席位（即将上线）'
  },
  'pricing.plan.pro.nextUp': {
    en: 'Next Up: Advanced Team Collaboration Features',
    'zh-CN': '下一步：高级团队协作功能'
  },

  'pricing.enterprise.label': { en: 'ENTERPRISE', 'zh-CN': '企业版' },
  'pricing.enterprise.heading': {
    en: 'Looking for Enterprise Solutions?',
    'zh-CN': '在寻找企业级解决方案？'
  },
  'pricing.enterprise.description': {
    en: 'For teams running Comfy in production, and at scale.',
    'zh-CN': '面向在生产环境和规模化场景中运行 Comfy 的团队。'
  },
  'pricing.enterprise.cta': { en: 'CONTACT US', 'zh-CN': '联系我们' },
  'pricing.enterprise.featureIntro': {
    en: 'Everything in Pro, plus:',
    'zh-CN': '包含专业版全部能力，另加：'
  },
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

  // GalleryHeroSection
  'gallery.label': { en: 'GALLERY', 'zh-CN': '画廊' },
  'gallery.heroTitle.before': {
    en: 'Built, tweaked, and dreamed in',
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
  'gallery.detail.visitHub': {
    en: 'VISIT COMMUNITY HUB',
    'zh-CN': '访问社区中心'
  },
  // ContactSection
  'gallery.contact.label': { en: 'CONTACT', 'zh-CN': '联系' },
  'gallery.contact.heading': {
    en: 'Questions? Reach out!',
    'zh-CN': '有问题？联系我们！'
  },
  'gallery.contact.cta': { en: 'CONTACT US', 'zh-CN': '联系我们' },

  // AboutHeroSection
  'about.hero.label': { en: 'ABOUT', 'zh-CN': '关于' },
  'about.hero.heading': {
    en: 'Build the tools that reward creative skill',
    'zh-CN': '打造奖励创造力的工具'
  },
  'about.hero.body': {
    en: 'The team behind Comfy is small, intense, and building what we intend to be our life\u2019s work.',
    'zh-CN': 'Comfy 背后的团队规模虽小，但充满热情，致力于打造我们毕生的事业。'
  },
  'about.hero.cta': { en: 'SEE OPEN ROLES', 'zh-CN': '查看开放职位' },

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
  'careers.hero.label': { en: 'CAREERS', 'zh-CN': 'CAREERS' },
  'careers.hero.heading': {
    en: 'Building an operating\nsystem for Gen AI',
    'zh-CN': '构建生成式 AI 的\n\u201C操作系统\u201D'
  },
  'careers.hero.body1': {
    en: "We're building the world's leading visual AI platform \u2014 open, modular, and designed for those who want control, quality and scale in their creative process.",
    'zh-CN':
      '我们是全球领先的视觉 AI 平台\u2014\u2014一个开放、模块化的系统，任何人都可以精确地构建、定制和自动化 AI 工作流，并拥有完全的控制权。'
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

  // SiteNav
  'nav.products': { en: 'PRODUCTS', 'zh-CN': '产品' },
  'nav.pricing': { en: 'PRICING', 'zh-CN': '价格' },
  'nav.community': { en: 'COMMUNITY', 'zh-CN': '社区' },
  'nav.resources': { en: 'RESOURCES', 'zh-CN': '资源' },
  'nav.company': { en: 'COMPANY', 'zh-CN': '公司' },
  'nav.comfyLocal': { en: 'Comfy Local', 'zh-CN': 'Comfy 本地版' },
  'nav.comfyCloud': { en: 'Comfy Cloud', 'zh-CN': 'Comfy Cloud' },
  'nav.comfyApi': { en: 'Comfy API', 'zh-CN': 'Comfy API' },
  'nav.comfyEnterprise': {
    en: 'Comfy Enterprise',
    'zh-CN': 'Comfy 企业版'
  },
  'nav.comfyHub': { en: 'Comfy Hub', 'zh-CN': 'Comfy Hub' },
  'nav.gallery': { en: 'Gallery', 'zh-CN': '画廊' },
  'nav.blogs': { en: 'Blogs', 'zh-CN': '博客' },
  'nav.github': { en: 'GitHub', 'zh-CN': 'GitHub' },
  'nav.discord': { en: 'Discord', 'zh-CN': 'Discord' },
  'nav.docs': { en: 'Docs', 'zh-CN': '文档' },
  'nav.youtube': { en: 'YouTube', 'zh-CN': 'YouTube' },
  'nav.aboutUs': { en: 'About Us', 'zh-CN': '关于我们' },
  'nav.careers': { en: 'Careers', 'zh-CN': '招聘' },
  'nav.customerStories': { en: 'Customer Stories', 'zh-CN': '客户故事' },
  'nav.downloadLocal': { en: 'DOWNLOAD LOCAL', 'zh-CN': '下载本地版' },
  'nav.launchCloud': { en: 'LAUNCH CLOUD', 'zh-CN': '启动云端' },
  'nav.menu': { en: 'Menu', 'zh-CN': '菜单' },
  'nav.toggleMenu': { en: 'Toggle menu', 'zh-CN': '切换菜单' },
  'nav.back': { en: 'BACK', 'zh-CN': '返回' },
  'nav.badgeNew': { en: 'NEW', 'zh-CN': '新' },

  // SiteFooter
  'footer.tagline': {
    en: 'The most powerful workflow engine for visual AI.',
    'zh-CN': '最强大的视觉 AI 工作流引擎。'
  },
  'footer.products': { en: 'Products', 'zh-CN': '产品' },
  'footer.resources': { en: 'Resources', 'zh-CN': '资源' },
  'footer.company': { en: 'Company', 'zh-CN': '公司' },
  'footer.contact': { en: 'Contact', 'zh-CN': '联系我们' },
  'footer.about': { en: 'About', 'zh-CN': '关于' },
  'footer.termsOfService': { en: 'Terms of Service', 'zh-CN': '服务条款' },
  'footer.privacyPolicy': { en: 'Privacy Policy', 'zh-CN': '隐私政策' },
  'footer.support': { en: 'Support', 'zh-CN': '支持' },
  'footer.blog': { en: 'Blog', 'zh-CN': '博客' },
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
    en: 'This policy is effective as of April 18, 2025.',
    'zh-CN': '本政策自 2025 年 4 月 18 日起生效。'
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

  // ── Terms of Service ──────────────────────────────────────────────
  'tos.intro.label': { en: 'INTRO', 'zh-CN': '简介' },
  'tos.intro.block.0': {
    en: 'Welcome to the ComfyUI offering, provided by Comfy Organization, Inc.',
    'zh-CN': '欢迎使用由 Comfy Organization, Inc. 提供的 ComfyUI 产品。'
  },
  'tos.intro.block.1': {
    en: 'Please read these Terms of Service (these "Terms") carefully, as they constitute a legally binding agreement between Comfy Organization, Inc., a Delaware corporation ("Comfy Org," "We," "Us," or "Our"), and an end-user ("You" and "Your") and apply to Your use of the Services (as defined below). In case You are subscribing to the Services as a representative of or on behalf of an entity (e.g., Your employer, the "Client" or "Entity"), Your acceptance of these Terms also binds the Client or Entity, and any reference in these Terms to "You" shall also mean the "Client" or "Entity" and its affiliates.',
    'zh-CN':
      '请仔细阅读本服务条款（以下简称"条款"），因为它们构成 Comfy Organization, Inc.（一家特拉华州公司，以下简称"Comfy Org"、"我们"）与最终用户（"您"）之间具有法律约束力的协议，并适用于您对服务（定义见下文）的使用。如果您以实体（例如您的雇主，即"客户"或"实体"）的代表身份或代表其订阅服务，您对本条款的接受也约束该客户或实体，本条款中对"您"的任何引用也应指"客户"或"实体"及其关联方。'
  },
  'tos.intro.block.2': {
    en: 'You hereby agree to accept these Terms by (a) either using the Services, or (b) by opening an account under a username. BEFORE YOU DO EITHER OF THOSE, PLEASE READ THESE TERMS CAREFULLY. IF YOU DO NOT WANT TO AGREE TO THESE TERMS, YOU MUST NOT USE THE SERVICES OR SET UP AN ACCOUNT.',
    'zh-CN':
      '您特此同意通过以下方式接受本条款：(a) 使用服务，或 (b) 以用户名开设账户。在您执行上述任何操作之前，请仔细阅读本条款。如果您不同意本条款，则不得使用服务或设置账户。'
  },
  'tos.intro.block.3': {
    en: 'You also agree to abide by other Comfy Org rules and policies, including our Privacy Policy https://www.comfy.org/privacy-policy (which explains what information we collect from You and how we protect it) that are expressly incorporated into and are a part of these Terms. Please read them carefully.',
    'zh-CN':
      '您还同意遵守 Comfy Org 的其他规则和政策，包括我们的隐私政策 https://www.comfy.org/privacy-policy（该政策说明了我们从您处收集的信息以及如何保护这些信息），这些规则和政策明确纳入本条款并构成其组成部分。请仔细阅读。'
  },
  'tos.intro.block.4': {
    en: 'Once you accept these Terms You are bound by them until they are terminated. See Section 10 (Term and Termination).',
    'zh-CN':
      '一旦您接受本条款，您将受其约束，直至条款终止。请参阅第 10 条（期限和终止）。'
  },
  'tos.intro.block.5': {
    en: 'By accessing or using the Software or Services in any way, You represent that (1) You have read, understand, and hereby agree to be bound by these Terms, (2) You are of legal age to form a binding contract with Comfy Org, and (3) You have the authority to enter into these Terms personally or on behalf of the Client Entity. If You do not agree to be bound by, or cannot conform with, these Terms, You may not use the Services. You will be legally and financially responsible for all actions using or accessing the Services, including the actions of anyone You allow to access Your Account.',
    'zh-CN':
      '通过以任何方式访问或使用软件或服务，您声明：(1) 您已阅读、理解并特此同意受本条款的约束，(2) 您已达到与 Comfy Org 签订具有约束力的合同的法定年龄，(3) 您有权以个人身份或代表客户实体签订本条款。如果您不同意受本条款约束或无法遵守本条款，则不得使用服务。您将对使用或访问服务的所有行为承担法律和财务责任，包括您允许访问您账户的任何人的行为。'
  },
  'tos.intro.block.6': {
    en: 'IF YOU ACCEPT THESE TERMS, YOU AND COMFY ORG AGREE TO RESOLVE DISPUTES IN BINDING, INDIVIDUAL ARBITRATION AND GIVE UP THE RIGHT TO GO TO COURT INDIVIDUALLY OR AS PART OF A CLASS ACTION.',
    'zh-CN':
      '如果您接受本条款，您和 COMFY ORG 同意通过具有约束力的个人仲裁解决争议，并放弃以个人身份或作为集体诉讼一部分提起诉讼的权利。'
  },
  'tos.definitions.label': { en: 'DEFINITIONS', 'zh-CN': '定义' },
  'tos.definitions.title': { en: '1. Definitions', 'zh-CN': '1. 定义' },
  'tos.definitions.block.0': {
    en: '"Business User" mean an entity or individual using the Software or Services primarily for business, commercial, or professional purposes.',
    'zh-CN':
      '"商业用户"指主要出于商业、贸易或专业目的使用软件或服务的实体或个人。'
  },
  'tos.definitions.block.1': {
    en: '"ComfyUI Branding" means the names, logos, and associated trademarks owned or in progress of being owned by Comfy Org, Inc.',
    'zh-CN':
      '"ComfyUI 品牌"指 Comfy Org, Inc. 拥有或正在申请拥有的名称、标志和相关商标。'
  },
  'tos.definitions.block.2': {
    en: '"ComfyUI Software" or "Software" means the open-source software product named "ComfyUI," including its desktop applications, source code, and user interface elements.',
    'zh-CN':
      '"ComfyUI 软件"或"软件"指名为"ComfyUI"的开源软件产品，包括其桌面应用程序、源代码和用户界面元素。'
  },
  'tos.definitions.block.3': {
    en: '"Customer Data" means any data, content, information, prompts, or workflows that You submit, upload, transmit, or process through the Software or Services.',
    'zh-CN':
      '"客户数据"指您通过软件或服务提交、上传、传输或处理的任何数据、内容、信息、提示词或工作流。'
  },
  'tos.definitions.block.4': {
    en: '"Consumer User" means an individual using the Software or Services primarily for personal, family, or household purposes.',
    'zh-CN': '"消费者用户"指主要出于个人、家庭或家用目的使用软件或服务的个人。'
  },
  'tos.definitions.block.5': {
    en: '"Intellectual Property Rights" means all (i) patents, patent disclosures, and inventions (whether patentable or not), (ii) trademarks, (iii) copyrights and copyrightable works (including computer programs), and rights in data and databases, and (iv) all other intellectual property rights, in each case whether registered or unregistered and including all applications for, and renewals or extensions of, such rights, and all similar or equivalent rights or forms of protection in any part of the world.',
    'zh-CN':
      '"知识产权"指所有 (i) 专利、专利披露和发明（无论是否可获得专利），(ii) 商标，(iii) 版权和可受版权保护的作品（包括计算机程序）以及数据和数据库权利，(iv) 所有其他知识产权，在每种情况下无论已注册或未注册，包括所有此类权利的申请、续展或延期，以及世界任何地区的所有类似或等同的权利或保护形式。'
  },
  'tos.definitions.block.6': {
    en: '"Open Source License" means the specific open-source license(s) governing the ComfyUI Software, primarily the GNU General Public License v3 (GPLv3) for its UI elements and potentially other components.',
    'zh-CN':
      '"开源许可证"指管辖 ComfyUI 软件的特定开源许可证，主要是用于其 UI 元素的 GNU 通用公共许可证第 3 版 (GPLv3) 以及可能适用于其他组件的许可证。'
  },
  'tos.definitions.block.7': {
    en: '"Providers" means certain third-party service providers utilized by Comfy Org for certain functionality, including hosting and payment processing.',
    'zh-CN':
      '"提供商"指 Comfy Org 用于某些功能的特定第三方服务提供商，包括托管和支付处理。'
  },
  'tos.definitions.block.8': {
    en: '"Services" means all current and future commercial and auxiliary services provided by Comfy Org in connection with the ComfyUI Software, including but not limited to:',
    'zh-CN':
      '"服务"指 Comfy Org 与 ComfyUI 软件相关的所有当前和未来的商业及辅助服务，包括但不限于：'
  },
  'tos.definitions.block.9': {
    en: 'Commercial services:',
    'zh-CN': '商业服务：'
  },
  'tos.definitions.block.10': {
    en: 'Comfy Cloud — paid and fully managed cloud based ComfyUI hosted in our data centers\nAPI Nodes — paid integrations with third-party API services available within ComfyUI\nSupport, Training, Consulting — paid services related to ComfyUI',
    'zh-CN':
      'Comfy Cloud——付费的、完全托管的、基于云的 ComfyUI，托管在我们的数据中心\nAPI 节点——ComfyUI 中可用的与第三方 API 服务的付费集成\n支持、培训、咨询——与 ComfyUI 相关的付费服务'
  },
  'tos.definitions.block.11': {
    en: 'Open source services:',
    'zh-CN': '开源服务：'
  },
  'tos.definitions.block.12': {
    en: 'Custom Node Registry — marketplace of custom nodes freely available to ComfyUI users\nAny other hosted experiences or tools offered by Comfy Org.',
    'zh-CN':
      '自定义节点 Registry——ComfyUI 用户免费使用的自定义节点市场\nComfy Org 提供的任何其他托管体验或工具。'
  },
  'tos.license.label': { en: 'LICENSE', 'zh-CN': '许可' },
  'tos.license.title': {
    en: '2. ComfyUI Software License',
    'zh-CN': '2. ComfyUI 软件许可'
  },
  'tos.license.block.0': {
    en: 'Open Source Nature. The ComfyUI Software itself is open-source and distributed under the terms of the GNU General Public License v3 (GPLv3), or other specific open-source licenses for particular components, as applicable. Your rights to use, modify, and distribute the ComfyUI Software are governed by the respective Open Source Licenses.',
    'zh-CN':
      '开源性质。ComfyUI 软件本身是开源的，根据 GNU 通用公共许可证第 3 版 (GPLv3) 或其他适用于特定组件的开源许可证的条款进行分发。您使用、修改和分发 ComfyUI 软件的权利受相应开源许可证的约束。'
  },
  'tos.license.block.1': {
    en: 'No Charge for Software. Comfy Org explicitly acknowledges that we do not charge for the ComfyUI Software itself. The fees outlined in these Terms are solely for the Services we provide around the Software, such as hosting, compute, and additional functionalities.',
    'zh-CN':
      '软件免费。Comfy Org 明确承认我们不对 ComfyUI 软件本身收费。本条款中列出的费用仅用于我们围绕软件提供的服务，例如托管、计算和附加功能。'
  },
  'tos.license.block.2': {
    en: 'Service Updates. You understand that the Software is evolving, and features and benefits You receive upon Your initial use may change. You acknowledge and agree that Comfy Org may update the Software with or without notifying You, including adding or removing features, products, or functionalities.',
    'zh-CN':
      '服务更新。您理解软件在不断发展，您初次使用时获得的功能和优势可能会发生变化。您承认并同意 Comfy Org 可能会在通知或不通知您的情况下更新软件，包括添加或删除功能、产品或特性。'
  },
  'tos.using-services.label': { en: 'USAGE', 'zh-CN': '使用服务' },
  'tos.using-services.title': {
    en: '3. Using the Services',
    'zh-CN': '3. 使用服务'
  },
  'tos.using-services.block.0': {
    en: 'Open Source Nature. The ComfyUI Software itself is open-source and distributed under the terms of the GNU General Public License v3 (GPLv3), or other specific open-source licenses for particular components, as applicable. Your rights to use, modify, and distribute the ComfyUI Software are governed by the respective Open Source Licenses.',
    'zh-CN':
      '开源性质。ComfyUI 软件本身是开源的，根据 GNU 通用公共许可证第 3 版 (GPLv3) 或其他适用于特定组件的开源许可证的条款进行分发。您使用、修改和分发 ComfyUI 软件的权利受相应开源许可证的约束。'
  },
  'tos.using-services.block.1': {
    en: 'No Charge for Software. Comfy Org explicitly acknowledges that we do not charge for the ComfyUI Software itself. The fees outlined in these Terms are solely for the Services we provide around the Software, such as hosting, compute, and additional functionalities.',
    'zh-CN':
      '软件免费。Comfy Org 明确承认我们不对 ComfyUI 软件本身收费。本条款中列出的费用仅用于我们围绕软件提供的服务，例如托管、计算和附加功能。'
  },
  'tos.using-services.block.2': {
    en: 'Service Updates. You understand that the Software is evolving, and features and benefits You receive upon Your initial use may change. You acknowledge and agree that Comfy Org may update the Software with or without notifying You, including adding or removing features, products, or functionalities.',
    'zh-CN':
      '服务更新。您理解软件在不断发展，您初次使用时获得的功能和优势可能会发生变化。您承认并同意 Comfy Org 可能会在通知或不通知您的情况下更新软件，包括添加或删除功能、产品或特性。'
  },
  'tos.responsibilities.label': { en: 'RESPONSIBILITIES', 'zh-CN': '您的责任' },
  'tos.responsibilities.title': {
    en: '4. Your Responsibilities',
    'zh-CN': '4. 您的责任'
  },
  'tos.responsibilities.block.0': {
    en: 'You are responsible for your use of the Services and any content you create, share, or distribute through them. You agree to use the Services in a manner that is lawful, respectful, and consistent with these Terms. You are solely responsible for maintaining the security of your account credentials.',
    'zh-CN':
      '您应对使用服务以及通过服务创建、共享或分发的任何内容负责。您同意以合法、尊重他人且符合本条款的方式使用服务。您全权负责维护账户凭据的安全。'
  },
  'tos.restrictions.label': { en: 'RESTRICTIONS', 'zh-CN': '限制' },
  'tos.restrictions.title': {
    en: '5. Use Restrictions',
    'zh-CN': '5. 使用限制'
  },
  'tos.restrictions.block.0': {
    en: 'You agree not to misuse the Services. This includes, but is not limited to:',
    'zh-CN': '您同意不滥用服务，包括但不限于：'
  },
  'tos.restrictions.block.1': {
    en: 'Attempting to gain unauthorized access to any part of the Services\nUsing the Services to distribute malware, viruses, or harmful code\nInterfering with or disrupting the integrity or performance of the Services\nScraping, crawling, or using automated means to access the Services without permission\nPublishing custom nodes or workflows that contain malicious code or violate third-party rights',
    'zh-CN':
      '试图未经授权访问服务的任何部分\n利用服务传播恶意软件、病毒或有害代码\n干扰或破坏服务的完整性或性能\n未经许可使用自动化手段抓取或爬取服务\n发布包含恶意代码或侵犯第三方权利的自定义节点或工作流'
  },
  'tos.accounts.label': { en: 'ACCOUNTS', 'zh-CN': '账户' },
  'tos.accounts.title': {
    en: '6. Accounts and User Information',
    'zh-CN': '6. 账户和用户信息'
  },
  'tos.accounts.block.0': {
    en: 'Certain features of the Services may require you to create an account. You agree to provide accurate and complete information when creating your account and to keep this information up to date. You are responsible for all activity that occurs under your account. We reserve the right to suspend or terminate accounts that violate these Terms.',
    'zh-CN':
      '服务的某些功能可能要求您创建账户。您同意在创建账户时提供准确、完整的信息，并及时更新。您对账户下发生的所有活动负责。我们保留暂停或终止违反本条款的账户的权利。'
  },
  'tos.ip.label': { en: 'IP RIGHTS', 'zh-CN': '知识产权' },
  'tos.ip.title': {
    en: '7. Intellectual Property Rights',
    'zh-CN': '7. 知识产权'
  },
  'tos.ip.block.0': {
    en: 'The Services, excluding open-source components, are owned by Comfy and are protected by intellectual property laws. The Comfy name, logo, and branding are trademarks of Comfy Org, Inc. You retain ownership of any User Content you create. By submitting User Content to the Services, you grant Comfy a non-exclusive, worldwide, royalty-free license to host, display, and distribute such content as necessary to operate the Services.',
    'zh-CN':
      '除开源组件外，服务归 Comfy 所有并受知识产权法保护。Comfy 名称、标志和品牌是 Comfy Org, Inc. 的商标。您保留您创建的任何用户内容的所有权。向服务提交用户内容即表示您授予 Comfy 一项非排他性、全球性、免版税的许可，以在运营服务所需的范围内托管、展示和分发此类内容。'
  },
  'tos.distribution.label': { en: 'DISTRIBUTION', 'zh-CN': '分发' },
  'tos.distribution.title': {
    en: '8. Model and Workflow Distribution',
    'zh-CN': '8. 模型和工作流分发'
  },
  'tos.distribution.block.0': {
    en: 'When you distribute models, workflows, or custom nodes through the Registry or Services, you represent that you have the right to distribute such content and that it does not infringe any third-party rights. You are responsible for specifying an appropriate license for any content you distribute. Comfy does not claim ownership of content distributed through the Registry.',
    'zh-CN':
      '当您通过 Registry 或服务分发模型、工作流或自定义节点时，您声明您有权分发此类内容且其不侵犯任何第三方权利。您有责任为分发的内容指定适当的许可证。Comfy 不主张对通过 Registry 分发的内容的所有权。'
  },
  'tos.fees.label': { en: 'FEES', 'zh-CN': '费用' },
  'tos.fees.title': { en: '9. Fees and Payment', 'zh-CN': '9. 费用和付款' },
  'tos.fees.block.0': {
    en: 'Certain Services may be offered for a fee. If you choose to use paid features, you agree to pay all applicable fees as described at the time of purchase. Fees are non-refundable except as required by law or as expressly stated in these Terms. Comfy reserves the right to change pricing with reasonable notice.',
    'zh-CN':
      '某些服务可能需要付费。如果您选择使用付费功能，则同意支付购买时所述的所有适用费用。除法律要求或本条款明确规定外，费用不予退还。Comfy 保留在合理通知后变更定价的权利。'
  },
  'tos.termination.label': { en: 'TERMINATION', 'zh-CN': '终止' },
  'tos.termination.title': {
    en: '10. Term and Termination',
    'zh-CN': '10. 期限和终止'
  },
  'tos.termination.block.0': {
    en: 'These Terms remain in effect while you use the Services. You may stop using the Services at any time. Comfy may suspend or terminate your access to the Services at any time, with or without cause and with or without notice. Upon termination, your right to use the Services will immediately cease. Sections that by their nature should survive termination will continue to apply.',
    'zh-CN':
      '在您使用服务期间，本条款持续有效。您可随时停止使用服务。Comfy 可随时暂停或终止您对服务的访问，无论是否有原因，也无论是否事先通知。终止后，您使用服务的权利将立即终止。按其性质应在终止后继续有效的条款将继续适用。'
  },
  'tos.warranties.label': { en: 'WARRANTIES', 'zh-CN': '免责' },
  'tos.warranties.title': {
    en: '11. Disclaimer of Warranties',
    'zh-CN': '11. 免责声明'
  },
  'tos.warranties.block.0': {
    en: 'THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. COMFY DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.',
    'zh-CN':
      '服务按"现状"和"可用"基础提供，不附带任何形式的明示或暗示保证，包括但不限于对适销性、特定用途适用性和非侵权性的暗示保证。Comfy 不保证服务将不间断、无错误或安全。'
  },
  'tos.liability.label': { en: 'LIABILITY', 'zh-CN': '责任限制' },
  'tos.liability.title': {
    en: '12. Limitation of Liability',
    'zh-CN': '12. 责任限制'
  },
  'tos.liability.block.0': {
    en: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, COMFY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICES. COMFY'S TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY YOU TO COMFY IN THE TWELVE MONTHS PRECEDING THE CLAIM.",
    'zh-CN':
      '在法律允许的最大范围内，Comfy 不对任何间接、附带、特殊、后果性或惩罚性损害，或任何利润或收入损失（无论是直接还是间接产生的），或任何数据、使用、商誉或其他无形损失承担责任。Comfy 的总责任不超过您在索赔前十二个月内向 Comfy 支付的金额。'
  },
  'tos.indemnification.label': { en: 'INDEMNIFICATION', 'zh-CN': '赔偿' },
  'tos.indemnification.title': {
    en: '13. Indemnification',
    'zh-CN': '13. 赔偿'
  },
  'tos.indemnification.block.0': {
    en: 'You agree to indemnify, defend, and hold harmless Comfy, its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses arising out of or in any way connected with your access to or use of the Services, your User Content, or your violation of these Terms.',
    'zh-CN':
      '您同意赔偿、辩护并使 Comfy 及其管理人员、董事、员工和代理人免受因您访问或使用服务、您的用户内容或您违反本条款而产生的或与之相关的任何索赔、责任、损害、损失和费用。'
  },
  'tos.governing-law.label': { en: 'GOVERNING LAW', 'zh-CN': '适用法律' },
  'tos.governing-law.title': {
    en: '14. Governing Law and Dispute Resolution',
    'zh-CN': '14. 适用法律和争议解决'
  },
  'tos.governing-law.block.0': {
    en: 'These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of laws principles. Any disputes arising under these Terms shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive relief in any court of competent jurisdiction.',
    'zh-CN':
      '本条款受特拉华州法律管辖并据其解释，不适用其冲突法原则。因本条款引起的任何争议应根据美国仲裁协会的规则通过有约束力的仲裁解决，但任何一方均可在有管辖权的法院寻求禁令救济。'
  },
  'tos.miscellaneous.label': { en: 'MISCELLANEOUS', 'zh-CN': '其他' },
  'tos.miscellaneous.title': { en: '15. Miscellaneous', 'zh-CN': '15. 其他' },
  'tos.miscellaneous.block.0': {
    en: 'These Terms constitute the entire agreement between you and Comfy regarding the Services. If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in effect. Our failure to enforce any right or provision of these Terms will not be considered a waiver. We may assign our rights under these Terms. You may not assign your rights without our prior written consent.',
    'zh-CN':
      '本条款构成您与 Comfy 之间关于服务的完整协议。如果本条款的任何条款被认定为不可执行，其余条款将继续有效。我们未能执行本条款的任何权利或条款不构成放弃。我们可以转让本条款下的权利。未经我们事先书面同意，您不得转让您的权利。'
  },
  'tos.contact.label': { en: 'CONTACT', 'zh-CN': '联系' },
  'tos.contact.title': { en: 'Contact Us', 'zh-CN': '联系我们' },
  'tos.contact.block.0': {
    en: 'If you have questions about these Terms, please contact us at <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a>.',
    'zh-CN':
      '如果您对本条款有任何疑问，请通过 <a href="mailto:legal@comfy.org" class="text-white underline">legal@comfy.org</a> 与我们联系。'
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
  'customers.story.series-entertainment.category': {
    en: 'CASE STUDY',
    'zh-CN': '案例研究'
  },
  'customers.story.series-entertainment.title': {
    en: 'How Series Entertainment Rebuilt Game and Video Production with ComfyUI',
    'zh-CN': 'Series Entertainment 如何使用 ComfyUI 重塑游戏和视频制作'
  },
  'customers.story.series-entertainment.body': {
    en: 'Series Entertainment transformed their game and video production pipeline by integrating ComfyUI into their creative workflow, enabling rapid iteration and unprecedented control over AI-generated assets.',
    'zh-CN':
      'Series Entertainment 通过将 ComfyUI 集成到创意工作流程中，彻底改变了游戏和视频制作管线，实现了快速迭代和对 AI 生成资产的前所未有的控制。'
  },
  'customers.story.open-story-movement.category': {
    en: 'CASE STUDY',
    'zh-CN': '案例研究'
  },
  'customers.story.open-story-movement.title': {
    en: 'How Open Source Is Fueling the Open Story Movement — and a Financially Successful Future for Artists in the Age of AI',
    'zh-CN': '开源如何推动 Open Story 运动——以及 AI 时代艺术家的财务成功未来'
  },
  'customers.story.open-story-movement.body': {
    en: 'The Open Story Movement leverages ComfyUI and open-source tools to empower independent artists, creating new pathways to creative freedom and financial sustainability in the AI era.',
    'zh-CN':
      'Open Story 运动利用 ComfyUI 和开源工具赋能独立艺术家，在 AI 时代为创作自由和财务可持续性开辟新路径。'
  },
  'customers.story.moment-factory.category': {
    en: 'CASE STUDY',
    'zh-CN': '案例研究'
  },
  'customers.story.moment-factory.title': {
    en: 'How Moment Factory Reimagined 3D Projection Mapping at Architectural Scale with ComfyUI',
    'zh-CN': 'Moment Factory 如何使用 ComfyUI 在建筑尺度重新定义 3D 投影映射'
  },
  'customers.story.moment-factory.body': {
    en: 'Moment Factory used ComfyUI to reimagine their 3D projection mapping pipeline, enabling architectural-scale visual experiences with AI-driven content generation and real-time iteration.',
    'zh-CN':
      'Moment Factory 使用 ComfyUI 重新定义了 3D 投影映射管线，通过 AI 驱动的内容生成和实时迭代，实现建筑尺度的视觉体验。'
  },
  'customers.story.ubisoft-chord.category': {
    en: 'USE CASE DEEP DIVE',
    'zh-CN': '深度用例'
  },
  'customers.story.ubisoft-chord.title': {
    en: 'How Ubisoft Open-Sources the CHORD Model and ComfyUI Nodes for End-to-End PBR Material Generation',
    'zh-CN': '育碧如何开源 CHORD 模型和 ComfyUI 节点，实现端到端 PBR 材质生成'
  },
  'customers.story.ubisoft-chord.body': {
    en: 'Ubisoft open-sourced the CHORD model with custom ComfyUI nodes, enabling end-to-end PBR material generation that streamlines game asset creation across their studios.',
    'zh-CN':
      '育碧开源了 CHORD 模型及自定义 ComfyUI 节点，实现端到端 PBR 材质生成，简化了旗下各工作室的游戏资产创建流程。'
  },
  'customers.story.readMore': {
    en: 'READ MORE ON THIS TOPIC',
    'zh-CN': '阅读更多相关内容'
  },

  // Customer Detail: Series Entertainment
  'customers.detail.series-entertainment.topic-1.label': {
    en: 'THE STORY',
    'zh-CN': '故事'
  },
  'customers.detail.series-entertainment.topic-1.title': {
    en: 'Title Section: At Comfy UI',
    'zh-CN': '标题章节：Comfy UI'
  },
  'customers.detail.series-entertainment.topic-1.block.0.heading': {
    en: 'Title Section: At Comfy UI lorem ipsum',
    'zh-CN': '标题章节：Comfy UI Lorem Ipsum'
  },
  'customers.detail.series-entertainment.topic-1.block.1': {
    en: 'Series Entertainment transformed their game and video production pipeline by integrating ComfyUI into their creative workflow, enabling rapid iteration and unprecedented control over AI-generated assets.',
    'zh-CN':
      'Series Entertainment 通过将 ComfyUI 集成到创意工作流程中，彻底改变了游戏和视频制作管线，实现了快速迭代和对 AI 生成资产的前所未有的控制。'
  },
  'customers.detail.series-entertainment.topic-1.block.2': {
    en: 'By combining node-based workflows with their existing tools, Series Entertainment achieved a seamless integration that reduced production time while maintaining full artistic control over the creative process.',
    'zh-CN':
      '通过将基于节点的工作流与现有工具相结合，Series Entertainment 实现了无缝集成，在保持对创作过程的完全艺术控制的同时减少了制作时间。'
  },
  'customers.detail.series-entertainment.topic-1.block.3.src': {
    en: '/images/customers/detail-big-image.webp',
    'zh-CN': '/images/customers/detail-big-image.webp'
  },
  'customers.detail.series-entertainment.topic-1.block.3.alt': {
    en: 'Series Entertainment workflow',
    'zh-CN': 'Series Entertainment 工作流'
  },
  'customers.detail.series-entertainment.topic-1.block.3.caption': {
    en: 'Caption: lorem ipsum dolor sit amet consectetur.',
    'zh-CN': '说明：图片描述文案。'
  },
  'customers.detail.series-entertainment.topic-1.block.4.text': {
    en: 'ComfyUI is so important to us because it allows us to know that we always play on the bleeding edge. Not only because of the technology itself, but because of the entire community behind it.',
    'zh-CN':
      'ComfyUI 对我们非常重要，因为它让我们始终站在技术最前沿。不仅因为技术本身，更因为它背后的整个社区。'
  },
  'customers.detail.series-entertainment.topic-1.block.4.name': {
    en: 'PJ Pereira',
    'zh-CN': 'PJ Pereira'
  },
  'customers.detail.series-entertainment.topic-1.block.5': {
    en: 'Lorem ipsum dolor sit amet consectetur.\nLorem ipsum dolor sit amet consectetur.\nLorem ipsum dolor sit amet consectetur.\nLorem ipsum dolor sit amet consectetur.',
    'zh-CN': '列表项一\n列表项二\n列表项三\n列表项四'
  },
  'customers.detail.series-entertainment.topic-1.block.6.ol': {
    en: 'Lorem ipsum dolor sit amet consectetur.\nLorem ipsum dolor sit amet consectetur.\nLorem ipsum dolor sit amet consectetur.\nLorem ipsum dolor sit amet consectetur.',
    'zh-CN': '有序列表项一\n有序列表项二\n有序列表项三\n有序列表项四'
  },
  'customers.detail.series-entertainment.topic-1.block.7': {
    en: 'Series Entertainment transformed their game and video production pipeline by integrating ComfyUI into their creative workflow, enabling rapid iteration and unprecedented control over AI-generated assets.',
    'zh-CN':
      'Series Entertainment 通过将 ComfyUI 集成到创意工作流程中，彻底改变了游戏和视频制作管线，实现了快速迭代和对 AI 生成资产的前所未有的控制。'
  },
  'customers.detail.series-entertainment.topic-1.block.8': {
    en: 'By combining node-based workflows with their existing tools, Series Entertainment achieved a seamless integration that reduced production time while maintaining full artistic control over the creative process.',
    'zh-CN':
      '通过将基于节点的工作流与现有工具相结合，Series Entertainment 实现了无缝集成，在保持对创作过程的完全艺术控制的同时减少了制作时间。'
  },
  'customers.detail.series-entertainment.topic-2.label': {
    en: 'CUSTOM WORKFLOWS',
    'zh-CN': '自定义工作流'
  },
  'customers.detail.series-entertainment.topic-2.title': {
    en: 'Building Custom Workflows',
    'zh-CN': '构建自定义工作流'
  },
  'customers.detail.series-entertainment.topic-2.block.0': {
    en: 'The team at Series Entertainment developed custom ComfyUI workflows that integrated directly with their game engine, allowing artists to generate and iterate on assets in real-time during the production process.',
    'zh-CN':
      'Series Entertainment 团队开发了与游戏引擎直接集成的自定义 ComfyUI 工作流，使艺术家能够在制作过程中实时生成和迭代资产。'
  },
  'customers.detail.series-entertainment.topic-2.block.1': {
    en: 'This approach eliminated the traditional bottleneck of waiting for renders and enabled a more fluid creative process where changes could be previewed instantly.',
    'zh-CN':
      '这种方法消除了等待渲染的传统瓶颈，实现了更流畅的创作过程，可以即时预览更改。'
  },
  'customers.detail.series-entertainment.topic-3.label': {
    en: 'AI ASSETS',
    'zh-CN': 'AI 资产'
  },
  'customers.detail.series-entertainment.topic-3.title': {
    en: 'AI-Driven Asset Generation',
    'zh-CN': 'AI 驱动的资产生成'
  },
  'customers.detail.series-entertainment.topic-3.block.0': {
    en: "Using ComfyUI's node-based system, the team created pipelines for generating textures, concept art, and environmental assets that matched their specific art direction and quality standards.",
    'zh-CN':
      '利用 ComfyUI 基于节点的系统，团队创建了用于生成纹理、概念艺术和环境资产的管线，以匹配其特定的艺术方向和质量标准。'
  },
  'customers.detail.series-entertainment.topic-3.block.1': {
    en: 'The flexibility of the node system meant that artists could experiment with different approaches without writing code, maintaining creative control throughout the process.',
    'zh-CN':
      '节点系统的灵活性意味着艺术家可以在不编写代码的情况下尝试不同的方法，在整个过程中保持创作控制。'
  },
  'customers.detail.series-entertainment.topic-4.label': {
    en: 'PIPELINE',
    'zh-CN': '管线集成'
  },
  'customers.detail.series-entertainment.topic-4.title': {
    en: 'Production Pipeline Integration',
    'zh-CN': '生产管线集成'
  },
  'customers.detail.series-entertainment.topic-4.block.0': {
    en: 'ComfyUI was integrated into their existing production pipeline through custom nodes and API connections, enabling automated batch processing and consistent output across multiple projects.',
    'zh-CN':
      'ComfyUI 通过自定义节点和 API 连接集成到现有生产管线中，实现了自动化批处理和多个项目之间的一致输出。'
  },
  'customers.detail.series-entertainment.topic-4.block.1': {
    en: "The team built custom nodes for their specific needs, extending ComfyUI's capabilities to handle game-specific asset requirements and format conversions.",
    'zh-CN':
      '团队根据特定需求构建了自定义节点，扩展了 ComfyUI 的功能以处理特定于游戏的资产需求和格式转换。'
  },
  'customers.detail.series-entertainment.topic-5.label': {
    en: 'COMMUNITY',
    'zh-CN': '社区'
  },
  'customers.detail.series-entertainment.topic-5.title': {
    en: 'Community and Collaboration',
    'zh-CN': '社区与协作'
  },
  'customers.detail.series-entertainment.topic-5.block.0': {
    en: 'Series Entertainment actively participates in the ComfyUI community, sharing custom nodes and workflows that benefit other studios and creators working on similar challenges.',
    'zh-CN':
      'Series Entertainment 积极参与 ComfyUI 社区，分享自定义节点和工作流，使面临类似挑战的其他工作室和创作者受益。'
  },
  'customers.detail.series-entertainment.topic-5.block.1': {
    en: 'The open nature of ComfyUI enabled collaboration across teams, with shared workflows and custom nodes creating a standardized approach to AI-assisted content creation.',
    'zh-CN':
      'ComfyUI 的开放性使团队之间的协作成为可能，共享的工作流和自定义节点创建了一种标准化的 AI 辅助内容创作方法。'
  },
  'customers.detail.series-entertainment.topic-6.label': {
    en: 'RESULTS',
    'zh-CN': '成果'
  },
  'customers.detail.series-entertainment.topic-6.title': {
    en: 'Results and Impact',
    'zh-CN': '成果与影响'
  },
  'customers.detail.series-entertainment.topic-6.block.0': {
    en: 'The integration of ComfyUI resulted in a significant reduction in production time and costs while simultaneously improving the quality and consistency of AI-generated assets across all their projects.',
    'zh-CN':
      'ComfyUI 的集成显著减少了制作时间和成本，同时提高了所有项目中 AI 生成资产的质量和一致性。'
  },
  'customers.detail.series-entertainment.topic-6.block.1.text': {
    en: 'ComfyUI is so important to us because it allows us to know that we always play on the bleeding edge. Not only because of the technology itself, but because of the entire community behind it. The community is what makes it so special.',
    'zh-CN':
      'ComfyUI 对我们非常重要，因为它让我们始终站在技术最前沿。不仅因为技术本身，更因为它背后的整个社区。社区才是让它如此特别的原因。'
  },
  'customers.detail.series-entertainment.topic-6.block.1.name': {
    en: 'PJ Pereira',
    'zh-CN': 'PJ Pereira'
  },
  'customers.detail.series-entertainment.topic-6.block.2.label': {
    en: 'AUTHOR',
    'zh-CN': '作者'
  },
  'customers.detail.series-entertainment.topic-6.block.2.name': {
    en: 'PJ Pereira',
    'zh-CN': 'PJ Pereira'
  },
  'customers.detail.series-entertainment.topic-6.block.2.role': {
    en: 'Co-founder of Silverside AI',
    'zh-CN': 'Silverside AI 联合创始人'
  },

  // Customer Detail: Open Story Movement
  'customers.detail.open-story-movement.topic-1.label': {
    en: 'THE STORY',
    'zh-CN': '故事'
  },
  'customers.detail.open-story-movement.topic-1.title': {
    en: 'Empowering Independent Artists',
    'zh-CN': '赋能独立艺术家'
  },
  'customers.detail.open-story-movement.topic-1.block.0.heading': {
    en: 'The Open Story Movement and ComfyUI',
    'zh-CN': 'Open Story 运动与 ComfyUI'
  },
  'customers.detail.open-story-movement.topic-1.block.1': {
    en: 'The Open Story Movement leverages ComfyUI and open-source tools to empower independent artists, creating new pathways to creative freedom and financial sustainability in the AI era.',
    'zh-CN':
      'Open Story 运动利用 ComfyUI 和开源工具赋能独立艺术家，在 AI 时代为创作自由和财务可持续性开辟新路径。'
  },
  'customers.detail.open-story-movement.topic-1.block.2': {
    en: 'By making powerful AI tools accessible to everyone, the movement demonstrates how open-source technology can democratize creative production without sacrificing quality.',
    'zh-CN':
      '通过让强大的 AI 工具对每个人都可用，该运动展示了开源技术如何在不牺牲质量的情况下实现创意制作的民主化。'
  },
  'customers.detail.open-story-movement.topic-1.block.3.src': {
    en: '/images/customers/detail-big-image.webp',
    'zh-CN': '/images/customers/detail-big-image.webp'
  },
  'customers.detail.open-story-movement.topic-1.block.3.alt': {
    en: 'Open Story Movement workflow',
    'zh-CN': 'Open Story 运动工作流'
  },
  'customers.detail.open-story-movement.topic-1.block.3.caption': {
    en: 'Artists collaborate on open-source AI workflows.',
    'zh-CN': '艺术家们在开源 AI 工作流上协作。'
  },
  'customers.detail.open-story-movement.topic-1.block.4.text': {
    en: "We've used many different tools, but using ComfyUI puts artist empowerment to the forefront. It makes artists feel like they have control over the process.",
    'zh-CN':
      '我们使用过许多不同的工具，但 ComfyUI 将艺术家赋能放在了首位。它让艺术家感到自己掌控着整个过程。'
  },
  'customers.detail.open-story-movement.topic-1.block.4.name': {
    en: 'Jeremy Sahlman',
    'zh-CN': 'Jeremy Sahlman'
  },
  'customers.detail.open-story-movement.topic-1.block.5': {
    en: 'Open-source AI tools for creative production\nCommunity-driven workflow development\nAccessible to independent creators\nFinancially sustainable model for artists',
    'zh-CN':
      '用于创意制作的开源 AI 工具\n社区驱动的工作流开发\n独立创作者可访问\n艺术家的可持续财务模式'
  },
  'customers.detail.open-story-movement.topic-1.block.6.ol': {
    en: 'Establish open-source creative pipelines\nBuild community around shared workflows\nDemocratize access to AI tools\nCreate sustainable revenue models',
    'zh-CN':
      '建立开源创意管线\n围绕共享工作流建立社区\n民主化 AI 工具访问\n创建可持续的收入模式'
  },
  'customers.detail.open-story-movement.topic-1.block.7': {
    en: 'The movement has grown to include hundreds of independent artists who use ComfyUI as their primary creative tool, demonstrating the viability of open-source AI in professional production.',
    'zh-CN':
      '该运动已发展到包括数百名以 ComfyUI 为主要创作工具的独立艺术家，证明了开源 AI 在专业制作中的可行性。'
  },
  'customers.detail.open-story-movement.topic-1.block.8': {
    en: 'By sharing workflows and custom nodes, the community continues to push the boundaries of what independent creators can achieve with AI-assisted tools.',
    'zh-CN':
      '通过共享工作流和自定义节点，社区继续推动独立创作者使用 AI 辅助工具所能实现的边界。'
  },
  'customers.detail.open-story-movement.topic-2.label': {
    en: 'OPEN SOURCE',
    'zh-CN': '开源'
  },
  'customers.detail.open-story-movement.topic-2.title': {
    en: 'Creative Freedom Through Open Source',
    'zh-CN': '通过开源实现创作自由'
  },
  'customers.detail.open-story-movement.topic-2.block.0': {
    en: 'The open-source nature of ComfyUI allows artists to customize every aspect of their creative pipeline, from model selection to post-processing, without vendor lock-in.',
    'zh-CN':
      'ComfyUI 的开源特性允许艺术家自定义创意管线的每个方面，从模型选择到后处理，无需供应商锁定。'
  },
  'customers.detail.open-story-movement.topic-2.block.1': {
    en: 'This freedom has led to unprecedented creative experimentation, with artists developing entirely new visual styles and techniques made possible by the flexibility of the node-based system.',
    'zh-CN':
      '这种自由带来了前所未有的创作实验，艺术家们利用基于节点系统的灵活性开发出全新的视觉风格和技术。'
  },
  'customers.detail.open-story-movement.topic-3.label': {
    en: 'COMMUNITY',
    'zh-CN': '社区'
  },
  'customers.detail.open-story-movement.topic-3.title': {
    en: 'Community-Driven Development',
    'zh-CN': '社区驱动的开发'
  },
  'customers.detail.open-story-movement.topic-3.block.0': {
    en: 'The community around the Open Story Movement contributes custom nodes, shares workflows, and collaborates on improving the tools that make AI-assisted storytelling possible.',
    'zh-CN':
      'Open Story 运动周围的社区贡献自定义节点、共享工作流，并合作改进使 AI 辅助叙事成为可能的工具。'
  },
  'customers.detail.open-story-movement.topic-3.block.1': {
    en: 'Regular community events and workshops help new artists get started with ComfyUI, lowering the barrier to entry for AI-assisted creative work.',
    'zh-CN':
      '定期的社区活动和工作坊帮助新艺术家开始使用 ComfyUI，降低了 AI 辅助创作工作的入门门槛。'
  },
  'customers.detail.open-story-movement.topic-4.label': {
    en: 'SUSTAINABILITY',
    'zh-CN': '可持续性'
  },
  'customers.detail.open-story-movement.topic-4.title': {
    en: 'Financial Sustainability',
    'zh-CN': '财务可持续性'
  },
  'customers.detail.open-story-movement.topic-4.block.0': {
    en: 'The Open Story Movement has developed innovative models for artists to monetize their ComfyUI expertise, from selling custom workflows to offering AI-assisted creative services.',
    'zh-CN':
      'Open Story 运动为艺术家开发了创新的盈利模式，从出售自定义工作流到提供 AI 辅助创意服务。'
  },
  'customers.detail.open-story-movement.topic-4.block.1': {
    en: 'These models demonstrate that open-source tools can support sustainable careers for independent artists in the AI era.',
    'zh-CN': '这些模式证明，开源工具可以在 AI 时代支持独立艺术家的可持续职业。'
  },
  'customers.detail.open-story-movement.topic-5.label': {
    en: 'EMPOWERMENT',
    'zh-CN': '赋能'
  },
  'customers.detail.open-story-movement.topic-5.title': {
    en: 'Artist Empowerment',
    'zh-CN': '艺术家赋能'
  },
  'customers.detail.open-story-movement.topic-5.block.0': {
    en: 'ComfyUI gives artists unprecedented control over AI generation, allowing them to maintain their unique creative voice while leveraging the power of AI models.',
    'zh-CN':
      'ComfyUI 赋予艺术家对 AI 生成的前所未有的控制力，使他们能够在利用 AI 模型的力量的同时保持独特的创作声音。'
  },
  'customers.detail.open-story-movement.topic-5.block.1': {
    en: 'The node-based interface makes complex AI pipelines accessible to artists without programming backgrounds, democratizing access to cutting-edge technology.',
    'zh-CN':
      '基于节点的界面使没有编程背景的艺术家也能使用复杂的 AI 管线，使尖端技术的使用民主化。'
  },
  'customers.detail.open-story-movement.topic-6.label': {
    en: 'LOOKING FORWARD',
    'zh-CN': '展望未来'
  },
  'customers.detail.open-story-movement.topic-6.title': {
    en: 'Looking Forward',
    'zh-CN': '展望未来'
  },
  'customers.detail.open-story-movement.topic-6.block.0': {
    en: 'The Open Story Movement continues to grow, with new artists and studios joining every month to build on the foundation of open-source AI creative tools.',
    'zh-CN':
      'Open Story 运动持续增长，每月都有新的艺术家和工作室加入，在开源 AI 创作工具的基础上进行建设。'
  },
  'customers.detail.open-story-movement.topic-6.block.1.text': {
    en: "We've used many different tools, but using ComfyUI puts artist empowerment to the forefront. It makes artists feel like they have control over the process. The more transparent we can be to how the models work, the more we feel like we're making something that only we could make.",
    'zh-CN':
      '我们使用过许多不同的工具，但 ComfyUI 将艺术家赋能放在了首位。它让艺术家感到自己掌控着整个过程。我们对模型工作方式越透明，就越觉得我们在创造只有我们才能做出的东西。'
  },
  'customers.detail.open-story-movement.topic-6.block.1.name': {
    en: 'Jeremy Sahlman',
    'zh-CN': 'Jeremy Sahlman'
  },
  'customers.detail.open-story-movement.topic-6.block.2.label': {
    en: 'AUTHOR',
    'zh-CN': '作者'
  },
  'customers.detail.open-story-movement.topic-6.block.2.name': {
    en: 'Jeremy Sahlman',
    'zh-CN': 'Jeremy Sahlman'
  },
  'customers.detail.open-story-movement.topic-6.block.2.role': {
    en: 'Co-founder and Chief Creative Officer at Black Math',
    'zh-CN': 'Black Math 联合创始人兼首席创意官'
  },

  // Customer Detail: Moment Factory
  'customers.detail.moment-factory.topic-1.label': {
    en: 'THE STORY',
    'zh-CN': '故事'
  },
  'customers.detail.moment-factory.topic-1.title': {
    en: 'Reimagining Projection Mapping',
    'zh-CN': '重新定义投影映射'
  },
  'customers.detail.moment-factory.topic-1.block.0.heading': {
    en: 'Architectural-Scale Visual Experiences',
    'zh-CN': '建筑尺度的视觉体验'
  },
  'customers.detail.moment-factory.topic-1.block.1': {
    en: 'Moment Factory used ComfyUI to reimagine their 3D projection mapping pipeline, enabling architectural-scale visual experiences with AI-driven content generation and real-time iteration.',
    'zh-CN':
      'Moment Factory 使用 ComfyUI 重新定义了 3D 投影映射管线，通过 AI 驱动的内容生成和实时迭代，实现建筑尺度的视觉体验。'
  },
  'customers.detail.moment-factory.topic-1.block.2': {
    en: 'The integration of ComfyUI into their creative pipeline allowed for unprecedented flexibility in generating and modifying projection content at massive scales.',
    'zh-CN':
      '将 ComfyUI 集成到创意管线中，使得在大规模上生成和修改投影内容具有前所未有的灵活性。'
  },
  'customers.detail.moment-factory.topic-1.block.3.src': {
    en: '/images/customers/detail-big-image.webp',
    'zh-CN': '/images/customers/detail-big-image.webp'
  },
  'customers.detail.moment-factory.topic-1.block.3.alt': {
    en: 'Moment Factory projection mapping',
    'zh-CN': 'Moment Factory 投影映射'
  },
  'customers.detail.moment-factory.topic-1.block.3.caption': {
    en: 'AI-generated content projected onto architectural surfaces.',
    'zh-CN': 'AI 生成的内容投影到建筑表面。'
  },
  'customers.detail.moment-factory.topic-1.block.4.text': {
    en: 'ComfyUI is a game changer for our creative pipeline. The node-based workflow gives us the flexibility to experiment rapidly while maintaining full control over every step of the process.',
    'zh-CN':
      'ComfyUI 彻底改变了我们的创意管线。基于节点的工作流让我们能够快速实验，同时完全掌控流程的每一个步骤。'
  },
  'customers.detail.moment-factory.topic-1.block.4.name': {
    en: 'Alex Chen',
    'zh-CN': 'Alex Chen'
  },
  'customers.detail.moment-factory.topic-1.block.5': {
    en: 'Real-time content generation\nArchitectural-scale projection mapping\nAI-driven visual effects\nSeamless pipeline integration',
    'zh-CN': '实时内容生成\n建筑尺度投影映射\nAI 驱动的视觉效果\n无缝管线集成'
  },
  'customers.detail.moment-factory.topic-1.block.6.ol': {
    en: 'Design AI-assisted projection workflows\nTest content at architectural scale\nIterate in real-time\nDeploy to projection systems',
    'zh-CN':
      '设计 AI 辅助投影工作流\n在建筑尺度测试内容\n实时迭代\n部署到投影系统'
  },
  'customers.detail.moment-factory.topic-1.block.7': {
    en: 'The team developed custom workflows specifically designed for projection mapping, creating content that adapts to complex architectural surfaces and environments.',
    'zh-CN':
      '团队专门为投影映射开发了自定义工作流，创建了适应复杂建筑表面和环境的内容。'
  },
  'customers.detail.moment-factory.topic-1.block.8': {
    en: 'This innovative approach has set new standards in the immersive experience industry, demonstrating how AI tools can enhance large-scale creative installations.',
    'zh-CN':
      '这种创新方法为沉浸式体验行业树立了新标准，展示了 AI 工具如何增强大规模创意装置。'
  },
  'customers.detail.moment-factory.topic-2.label': {
    en: 'REAL-TIME',
    'zh-CN': '实时迭代'
  },
  'customers.detail.moment-factory.topic-2.title': {
    en: 'Real-Time Iteration',
    'zh-CN': '实时迭代'
  },
  'customers.detail.moment-factory.topic-2.block.0': {
    en: 'ComfyUI enabled Moment Factory to iterate on projection content in real-time, dramatically reducing the time from concept to deployment for large-scale installations.',
    'zh-CN':
      'ComfyUI 使 Moment Factory 能够实时迭代投影内容，大大缩短了大型装置从概念到部署的时间。'
  },
  'customers.detail.moment-factory.topic-2.block.1': {
    en: 'The ability to preview and adjust AI-generated content directly on architectural surfaces transformed their creative process.',
    'zh-CN':
      '直接在建筑表面上预览和调整 AI 生成内容的能力改变了他们的创作过程。'
  },
  'customers.detail.moment-factory.topic-3.label': {
    en: 'SCALING',
    'zh-CN': '扩展'
  },
  'customers.detail.moment-factory.topic-3.title': {
    en: 'Scaling Creative Content',
    'zh-CN': '扩展创意内容'
  },
  'customers.detail.moment-factory.topic-3.block.0': {
    en: 'With ComfyUI, Moment Factory can generate vast amounts of unique visual content needed for large-scale installations, maintaining consistency while ensuring each piece is unique.',
    'zh-CN':
      '借助 ComfyUI，Moment Factory 可以生成大型装置所需的大量独特视觉内容，在保持一致性的同时确保每件作品都是独一无二的。'
  },
  'customers.detail.moment-factory.topic-3.block.1': {
    en: 'The automated pipeline processes content for specific architectural geometries, ensuring perfect alignment with physical surfaces.',
    'zh-CN': '自动化管线处理特定建筑几何形状的内容，确保与物理表面完美对齐。'
  },
  'customers.detail.moment-factory.topic-4.label': {
    en: 'INNOVATION',
    'zh-CN': '创新'
  },
  'customers.detail.moment-factory.topic-4.title': {
    en: 'Technical Innovation',
    'zh-CN': '技术创新'
  },
  'customers.detail.moment-factory.topic-4.block.0': {
    en: 'The team developed custom ComfyUI nodes specifically for projection mapping, handling complex geometric transformations and surface-aware content generation.',
    'zh-CN':
      '团队专门为投影映射开发了自定义 ComfyUI 节点，处理复杂的几何变换和表面感知内容生成。'
  },
  'customers.detail.moment-factory.topic-4.block.1': {
    en: 'These technical innovations push the boundaries of what is possible with AI-assisted architectural projection.',
    'zh-CN': '这些技术创新推动了 AI 辅助建筑投影的可能性边界。'
  },
  'customers.detail.moment-factory.topic-5.label': {
    en: 'IMMERSIVE',
    'zh-CN': '沉浸式'
  },
  'customers.detail.moment-factory.topic-5.title': {
    en: 'Immersive Experiences',
    'zh-CN': '沉浸式体验'
  },
  'customers.detail.moment-factory.topic-5.block.0': {
    en: 'ComfyUI helps create immersive experiences that transform public spaces, combining AI-generated content with architectural surfaces to create memorable installations.',
    'zh-CN':
      'ComfyUI 帮助创建改变公共空间的沉浸式体验，将 AI 生成的内容与建筑表面结合，创造令人难忘的装置。'
  },
  'customers.detail.moment-factory.topic-5.block.1': {
    en: 'The technology enables a new form of artistic expression that merges digital creativity with physical architecture.',
    'zh-CN': '该技术实现了一种将数字创造力与物理建筑融合的新型艺术表达形式。'
  },
  'customers.detail.moment-factory.topic-6.label': {
    en: 'THE FUTURE',
    'zh-CN': '未来'
  },
  'customers.detail.moment-factory.topic-6.title': {
    en: 'Future of Projection Art',
    'zh-CN': '投影艺术的未来'
  },
  'customers.detail.moment-factory.topic-6.block.0': {
    en: 'Moment Factory continues to push the boundaries of projection mapping with ComfyUI, exploring new ways to create immersive experiences at unprecedented scales.',
    'zh-CN':
      'Moment Factory 继续使用 ComfyUI 推动投影映射的边界，探索以前所未有的规模创造沉浸式体验的新方式。'
  },
  'customers.detail.moment-factory.topic-6.block.1.text': {
    en: 'ComfyUI is a game changer for our creative pipeline. The node-based workflow gives us the flexibility to experiment rapidly while maintaining full control over every step of the process.',
    'zh-CN':
      'ComfyUI 彻底改变了我们的创意管线。基于节点的工作流让我们能够快速实验，同时完全掌控流程的每一个步骤。'
  },
  'customers.detail.moment-factory.topic-6.block.1.name': {
    en: 'Alex Chen',
    'zh-CN': 'Alex Chen'
  },
  'customers.detail.moment-factory.topic-6.block.2.label': {
    en: 'AUTHOR',
    'zh-CN': '作者'
  },
  'customers.detail.moment-factory.topic-6.block.2.name': {
    en: 'Alex Chen',
    'zh-CN': 'Alex Chen'
  },
  'customers.detail.moment-factory.topic-6.block.2.role': {
    en: 'Head of AI at Creative Studios',
    'zh-CN': 'Creative Studios AI 负责人'
  },

  // Customer Detail: Ubisoft CHORD
  'customers.detail.ubisoft-chord.topic-1.label': {
    en: 'THE STORY',
    'zh-CN': '故事'
  },
  'customers.detail.ubisoft-chord.topic-1.title': {
    en: 'End-to-End PBR Material Generation',
    'zh-CN': '端到端 PBR 材质生成'
  },
  'customers.detail.ubisoft-chord.topic-1.block.0.heading': {
    en: 'The CHORD Model and ComfyUI Integration',
    'zh-CN': 'CHORD 模型与 ComfyUI 集成'
  },
  'customers.detail.ubisoft-chord.topic-1.block.1': {
    en: 'Ubisoft open-sourced the CHORD model with custom ComfyUI nodes, enabling end-to-end PBR material generation that streamlines game asset creation across their studios.',
    'zh-CN':
      '育碧开源了 CHORD 模型及自定义 ComfyUI 节点，实现端到端 PBR 材质生成，简化了旗下各工作室的游戏资产创建流程。'
  },
  'customers.detail.ubisoft-chord.topic-1.block.2': {
    en: 'The integration allows artists to generate physically-based rendering materials directly within ComfyUI, maintaining full control over texture quality and material properties.',
    'zh-CN':
      '该集成允许艺术家直接在 ComfyUI 中生成基于物理的渲染材质，完全控制纹理质量和材质属性。'
  },
  'customers.detail.ubisoft-chord.topic-1.block.3.src': {
    en: '/images/customers/detail-big-image.webp',
    'zh-CN': '/images/customers/detail-big-image.webp'
  },
  'customers.detail.ubisoft-chord.topic-1.block.3.alt': {
    en: 'CHORD PBR material generation',
    'zh-CN': 'CHORD PBR 材质生成'
  },
  'customers.detail.ubisoft-chord.topic-1.block.3.caption': {
    en: 'PBR materials generated using the CHORD model in ComfyUI.',
    'zh-CN': '使用 ComfyUI 中的 CHORD 模型生成的 PBR 材质。'
  },
  'customers.detail.ubisoft-chord.topic-1.block.4.text': {
    en: 'The CHORD model represents a breakthrough in AI-assisted material creation, enabling artists to generate production-quality PBR textures with unprecedented speed and control.',
    'zh-CN':
      'CHORD 模型代表了 AI 辅助材质创建的突破，使艺术家能够以前所未有的速度和控制力生成制作质量的 PBR 纹理。'
  },
  'customers.detail.ubisoft-chord.topic-1.block.4.name': {
    en: 'Ubisoft La Forge Team',
    'zh-CN': '育碧 La Forge 团队'
  },
  'customers.detail.ubisoft-chord.topic-1.block.5': {
    en: 'Albedo map generation\nNormal map generation\nRoughness map generation\nMetallic map generation',
    'zh-CN': '反照率贴图生成\n法线贴图生成\n粗糙度贴图生成\n金属度贴图生成'
  },
  'customers.detail.ubisoft-chord.topic-1.block.6.ol': {
    en: 'Install CHORD ComfyUI nodes\nConfigure material generation pipeline\nGenerate PBR texture sets\nExport to game engine',
    'zh-CN':
      '安装 CHORD ComfyUI 节点\n配置材质生成管线\n生成 PBR 纹理集\n导出到游戏引擎'
  },
  'customers.detail.ubisoft-chord.topic-1.block.7': {
    en: 'The CHORD model generates complete PBR material sets from simple text descriptions or reference images, dramatically accelerating the material creation process.',
    'zh-CN':
      'CHORD 模型从简单的文本描述或参考图像生成完整的 PBR 材质集，大大加速了材质创建过程。'
  },
  'customers.detail.ubisoft-chord.topic-1.block.8': {
    en: 'By open-sourcing both the model and the ComfyUI integration, Ubisoft has contributed a powerful tool to the game development community.',
    'zh-CN':
      '通过开源模型和 ComfyUI 集成，育碧为游戏开发社区贡献了一个强大的工具。'
  },
  'customers.detail.ubisoft-chord.topic-2.label': {
    en: 'OPEN SOURCE',
    'zh-CN': '开源'
  },
  'customers.detail.ubisoft-chord.topic-2.title': {
    en: 'Open-Source Contribution',
    'zh-CN': '开源贡献'
  },
  'customers.detail.ubisoft-chord.topic-2.block.0': {
    en: "Ubisoft's decision to open-source the CHORD model demonstrates the company's commitment to advancing the game development community through shared innovation.",
    'zh-CN':
      '育碧开源 CHORD 模型的决定展示了该公司致力于通过共享创新推进游戏开发社区的承诺。'
  },
  'customers.detail.ubisoft-chord.topic-2.block.1': {
    en: 'The custom ComfyUI nodes make the CHORD model accessible to any developer or artist, regardless of their technical background.',
    'zh-CN':
      '自定义 ComfyUI 节点使 CHORD 模型对任何开发者或艺术家都可用，无论其技术背景如何。'
  },
  'customers.detail.ubisoft-chord.topic-3.label': {
    en: 'PBR PIPELINE',
    'zh-CN': 'PBR 管线'
  },
  'customers.detail.ubisoft-chord.topic-3.title': {
    en: 'PBR Pipeline Integration',
    'zh-CN': 'PBR 管线集成'
  },
  'customers.detail.ubisoft-chord.topic-3.block.0': {
    en: 'The CHORD model integrates seamlessly with existing PBR pipelines, generating materials that are immediately usable in modern game engines like Unreal Engine and Unity.',
    'zh-CN':
      'CHORD 模型与现有 PBR 管线无缝集成，生成可直接在虚幻引擎和 Unity 等现代游戏引擎中使用的材质。'
  },
  'customers.detail.ubisoft-chord.topic-3.block.1': {
    en: 'Artists can fine-tune generated materials through the ComfyUI interface, adjusting parameters to match specific art direction requirements.',
    'zh-CN':
      '艺术家可以通过 ComfyUI 界面微调生成的材质，调整参数以满足特定的艺术方向要求。'
  },
  'customers.detail.ubisoft-chord.topic-4.label': {
    en: 'COLLABORATION',
    'zh-CN': '协作'
  },
  'customers.detail.ubisoft-chord.topic-4.title': {
    en: 'Cross-Studio Collaboration',
    'zh-CN': '跨工作室协作'
  },
  'customers.detail.ubisoft-chord.topic-4.block.0': {
    en: "The CHORD model and ComfyUI nodes enable consistent material generation across Ubisoft's global network of studios, ensuring unified visual quality.",
    'zh-CN':
      'CHORD 模型和 ComfyUI 节点在育碧全球工作室网络中实现了一致的材质生成，确保统一的视觉质量。'
  },
  'customers.detail.ubisoft-chord.topic-4.block.1': {
    en: 'Shared workflows and configurations mean that teams across the world can produce materials that meet the same quality standards.',
    'zh-CN':
      '共享的工作流和配置意味着世界各地的团队可以制作符合相同质量标准的材质。'
  },
  'customers.detail.ubisoft-chord.topic-5.label': {
    en: 'COMMUNITY',
    'zh-CN': '社区'
  },
  'customers.detail.ubisoft-chord.topic-5.title': {
    en: 'Community Impact',
    'zh-CN': '社区影响'
  },
  'customers.detail.ubisoft-chord.topic-5.block.0': {
    en: 'Since its release, the CHORD model has been adopted by independent developers and small studios, demonstrating the power of open-source tools in democratizing game development.',
    'zh-CN':
      '自发布以来，CHORD 模型已被独立开发者和小型工作室采用，展示了开源工具在民主化游戏开发中的力量。'
  },
  'customers.detail.ubisoft-chord.topic-5.block.1': {
    en: 'The ComfyUI community has built upon the CHORD nodes, creating extended workflows that combine material generation with other AI-assisted tasks.',
    'zh-CN':
      'ComfyUI 社区在 CHORD 节点的基础上进行了扩展，创建了将材质生成与其他 AI 辅助任务相结合的扩展工作流。'
  },
  'customers.detail.ubisoft-chord.topic-6.label': {
    en: 'THE FUTURE',
    'zh-CN': '未来'
  },
  'customers.detail.ubisoft-chord.topic-6.title': {
    en: 'Future Development',
    'zh-CN': '未来发展'
  },
  'customers.detail.ubisoft-chord.topic-6.block.0': {
    en: "Ubisoft continues to develop and improve the CHORD model, with plans for additional material types and enhanced integration with ComfyUI's evolving ecosystem.",
    'zh-CN':
      '育碧继续开发和改进 CHORD 模型，计划增加更多材质类型并加强与 ComfyUI 不断发展的生态系统的集成。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.1.text': {
    en: 'The CHORD model represents a breakthrough in AI-assisted material creation, enabling artists to generate production-quality PBR textures with unprecedented speed and control.',
    'zh-CN':
      'CHORD 模型代表了 AI 辅助材质创建的突破，使艺术家能够以前所未有的速度和控制力生成制作质量的 PBR 纹理。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.1.name': {
    en: 'Ubisoft La Forge Team',
    'zh-CN': '育碧 La Forge 团队'
  },
  'customers.detail.ubisoft-chord.topic-6.block.2.label': {
    en: 'AUTHOR',
    'zh-CN': '作者'
  },
  'customers.detail.ubisoft-chord.topic-6.block.2.name': {
    en: 'Ubisoft La Forge Team',
    'zh-CN': '育碧 La Forge 团队'
  },
  'customers.detail.ubisoft-chord.topic-6.block.2.role': {
    en: 'Ubisoft Research & Development',
    'zh-CN': '育碧研发'
  },

  'customers.story.whatsNext': {
    en: "What's next?",
    'zh-CN': '接下来看什么？'
  },
  'customers.story.backToStories': {
    en: '← BACK TO CUSTOMER STORIES',
    'zh-CN': '← 返回客户故事'
  },
  'customers.story.viewArticle': {
    en: 'VIEW ARTICLE',
    'zh-CN': '查看文章'
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
  }
} as const satisfies Record<string, Record<Locale, string>>

type TranslationKey = keyof typeof translations

export function t(key: TranslationKey, locale: Locale = 'en'): string {
  return translations[key][locale] ?? translations[key].en
}

export const translationKeys = Object.keys(translations) as TranslationKey[]

export function hasKey(key: string): boolean {
  return key in translations
}

export type { Locale, TranslationKey }
