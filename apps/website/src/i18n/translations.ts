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
    en: 'Grok Imagine',
    'zh-CN': 'Grok Imagine'
  },
  'cloud.aiModels.card.nanoBananaPro': {
    en: 'Nano Banana Pro',
    'zh-CN': 'Nano Banana Pro'
  },
  'cloud.aiModels.card.ltx23': {
    en: 'LTX 2.3',
    'zh-CN': 'LTX 2.3'
  },
  'cloud.aiModels.card.qwenImageEdit': {
    en: 'Advanced image\nediting with Qwen',
    'zh-CN': 'Qwen 高级\n图像编辑'
  },
  'cloud.aiModels.card.wan22TextToVideo': {
    en: 'Wan 2.2\ntext to video',
    'zh-CN': 'Wan 2.2\n文生视频'
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
  }
} as const satisfies Record<string, Record<Locale, string>>

type TranslationKey = keyof typeof translations

export function t(key: TranslationKey, locale: Locale = 'en'): string {
  return translations[key][locale] ?? translations[key].en
}

export type { Locale, TranslationKey }
