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
  'gallery.detail.visitHub': {
    en: 'VISIT COMMUNITY HUB',
    'zh-CN': '访问社区中心'
  },
  // ContactSection
  'gallery.contact.label': { en: 'CONTACT', 'zh-CN': '联系' },
  'gallery.contact.heading': {
    en: 'Questions? Reach out!',
    'zh-CN': '有精彩作品想要分享？\n联系我们。'
  },
  'gallery.contact.cta': { en: 'Contact us', 'zh-CN': '联系我们' },

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
  'footer.sales': { en: 'Sales', 'zh-CN': '销售' },
  'footer.press': { en: 'Press', 'zh-CN': '媒体' },
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
    en: 'GAME & VIDEO PRODUCTION',
    'zh-CN': '游戏与视频制作'
  },
  'customers.story.series-entertainment.title': {
    en: 'How Series Entertainment Rebuilt Game and Video Production with ComfyUI',
    'zh-CN': 'Series Entertainment 如何使用 ComfyUI 重塑游戏和视频制作'
  },
  'customers.story.series-entertainment.body': {
    en: 'Scaling emotional storytelling across 100,000+ assets and multiple Netflix titles, using repeatable ComfyUI production systems.',
    'zh-CN':
      '使用可复用的 ComfyUI 生产系统，在 100,000+ 资产和多部 Netflix 作品中实现情感叙事的规模化。'
  },
  'customers.story.open-story-movement.category': {
    en: 'OPEN SOURCE × BRAND',
    'zh-CN': '开源 × 品牌'
  },
  'customers.story.open-story-movement.title': {
    en: 'How Doodles, SYSTMS, and Open-Source Tools Like ComfyUI Are Rewriting the Rules for Artists',
    'zh-CN': 'Doodles、SYSTMS 和 ComfyUI 等开源工具如何重写艺术家的规则'
  },
  'customers.story.open-story-movement.body': {
    en: 'Doodles and SYSTMS built Doodles AI — a generative platform powered by PRISM 1.0 — on open-source infrastructure including ComfyUI, proving that open-source workflows can power brand-quality, commercially successful products.',
    'zh-CN':
      'Doodles 和 SYSTMS 在包括 ComfyUI 在内的开源基础设施上构建了 Doodles AI——一个由 PRISM 1.0 驱动的生成平台，证明了开源工作流可以支撑品牌级、商业成功的产品。'
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
    en: 'AAA GAME PRODUCTION',
    'zh-CN': 'AAA 游戏制作'
  },
  'customers.story.ubisoft-chord.title': {
    en: 'Ubisoft Open-Sources the CHORD Model with ComfyUI for AAA PBR Material Generation',
    'zh-CN': '育碧开源 CHORD 模型，通过 ComfyUI 实现 AAA 级 PBR 材质生成'
  },
  'customers.story.ubisoft-chord.body': {
    en: 'Ubisoft La Forge open-sourced its CHORD PBR material estimation model with ComfyUI custom nodes, enabling end-to-end texture generation workflows for AAA game production.',
    'zh-CN':
      '育碧 La Forge 开源了 CHORD PBR 材质估算模型及 ComfyUI 自定义节点，为 AAA 游戏制作实现了端到端的纹理生成工作流。'
  },
  'customers.story.readMore': {
    en: 'READ MORE ON THIS TOPIC',
    'zh-CN': '阅读更多相关内容'
  },

  // Customer Detail: Series Entertainment
  // Topic 1: Intro
  'customers.detail.series-entertainment.topic-1.label': {
    en: 'INTRO',
    'zh-CN': '简介'
  },
  'customers.detail.series-entertainment.topic-1.block.0': {
    en: 'Series Entertainment builds story-driven games and short-form video experiences where characters, emotion, and visual consistency matter. As the scope of their work expanded across internal projects, partner collaborations, and Netflix titles, the team faced a growing challenge: they needed to produce more content, across more projects, without slowing down or losing consistency.',
    'zh-CN':
      'Series Entertainment 构建以故事为驱动的游戏和短视频体验，其中角色、情感和视觉一致性至关重要。随着工作范围扩展到内部项目、合作伙伴协作和 Netflix 作品，团队面临日益增长的挑战：他们需要在更多项目中生产更多内容，同时不能放慢速度或失去一致性。'
  },
  'customers.detail.series-entertainment.topic-1.block.1': {
    en: 'To meet that challenge, Series leveraged ComfyUI to scale their workflows. By building custom, repeatable workflows on top of ComfyUI, Series changed how they create characters, emotions, and video. The result was a scalable production system that supported over 100,000 assets, shipped Netflix games, and continues to power multiple projects in active development.',
    'zh-CN':
      '为了应对这一挑战，Series 利用 ComfyUI 扩展了工作流。通过在 ComfyUI 之上构建自定义的可复用工作流，Series 改变了创建角色、情感和视频的方式。最终打造出一个支持超过 100,000 个资产、交付 Netflix 游戏并持续为多个在研项目提供动力的可扩展生产系统。'
  },
  'customers.detail.series-entertainment.topic-1.block.2.src': {
    en: 'https://media.comfy.org/website/customers/series-entertainment/series.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/series-entertainment/series.webp'
  },
  'customers.detail.series-entertainment.topic-1.block.2.alt': {
    en: 'Series Entertainment game titles including Olympus Rising, Gilded Scales, Evergrove, and The Wandering Teahouse',
    'zh-CN':
      'Series Entertainment 游戏作品，包括 Olympus Rising、Gilded Scales、Evergrove 和 The Wandering Teahouse'
  },
  'customers.detail.series-entertainment.topic-1.block.2.caption': {
    en: 'Series Entertainment produces story-driven games and video experiences across multiple titles and visual styles.',
    'zh-CN':
      'Series Entertainment 制作跨多个作品和视觉风格的故事驱动游戏和视频体验。'
  },
  // Topic 2: The Output
  'customers.detail.series-entertainment.topic-2.label': {
    en: 'THE OUTPUT',
    'zh-CN': '产出成果'
  },
  'customers.detail.series-entertainment.topic-2.title': {
    en: 'The Output Series Achieved Using ComfyUI',
    'zh-CN': 'Series 使用 ComfyUI 达成的产出成果'
  },
  'customers.detail.series-entertainment.topic-2.block.0': {
    en: 'With ComfyUI integrated into its production workflows, Series achieved:',
    'zh-CN': '将 ComfyUI 集成到生产工作流后，Series 实现了：'
  },
  'customers.detail.series-entertainment.topic-2.block.1': {
    en: '100,000+ assets generated across games and video\n180× faster production speed\nSix distinct character emotions generated in seconds\n15 minutes of final video per creator per week\nMultiple Netflix titles shipped, with many more experiences in active development',
    'zh-CN':
      '在游戏和视频中生成超过 100,000 个资产\n180 倍的生产速度提升\n数秒内生成六种不同的角色情感\n每位创作者每周生产 15 分钟的最终视频\n多部 Netflix 作品交付，更多体验正在积极开发中'
  },
  'customers.detail.series-entertainment.topic-2.block.2': {
    en: 'These outputs span character assets, emotional variations, background consistency, and short-form video — all created through repeatable ComfyUI-powered workflows.',
    'zh-CN':
      '这些产出涵盖角色资产、情感变体、背景一致性和短视频——全部通过可复用的 ComfyUI 工作流创建。'
  },
  // Topic 3: The Problem
  'customers.detail.series-entertainment.topic-3.label': {
    en: 'THE PROBLEM',
    'zh-CN': '面临的问题'
  },
  'customers.detail.series-entertainment.topic-3.title': {
    en: 'The Problem Series Was Trying to Solve',
    'zh-CN': 'Series 试图解决的问题'
  },
  'customers.detail.series-entertainment.topic-3.block.0': {
    en: "Series' work depends on expressive characters and consistent visual identity. As projects grew in size and complexity, the team needed a way to scale content creation without breaking timelines.",
    'zh-CN':
      'Series 的工作依赖于富有表现力的角色和一致的视觉标识。随着项目规模和复杂度的增长，团队需要一种在不打破时间线的前提下扩展内容创作的方法。'
  },
  'customers.detail.series-entertainment.topic-3.block.1': {
    en: 'Traditional animation workflows rely on manual keyframing, multiple disconnected tools, and long production cycles that can stretch into weeks per video. Producing variations often means redoing work from scratch, and experimentation can be slow and expensive.',
    'zh-CN':
      '传统动画工作流依赖手动关键帧、多个断开的工具和漫长的制作周期——每个视频可能需要数周。制作变体通常意味着从头返工，实验过程缓慢且昂贵。'
  },
  'customers.detail.series-entertainment.topic-3.block.2': {
    en: 'Series needed workflows that could be reused across teams and projects, while still supporting emotional storytelling, character consistency, and fast iteration.',
    'zh-CN':
      'Series 需要能够在团队和项目间复用的工作流，同时仍然支持情感叙事、角色一致性和快速迭代。'
  },
  // Topic 4: The Solution
  'customers.detail.series-entertainment.topic-4.label': {
    en: 'THE SOLUTION',
    'zh-CN': '解决方案'
  },
  'customers.detail.series-entertainment.topic-4.title': {
    en: 'How Series Used ComfyUI to Solve the Problem',
    'zh-CN': 'Series 如何使用 ComfyUI 解决问题'
  },
  'customers.detail.series-entertainment.topic-4.block.0': {
    en: "Series rebuilt their production process around ComfyUI's node-based workflow system. Instead of treating generation as a one-off step, they treated workflows as long-term production assets. ComfyUI became the place where creative structure lived — from character creation to emotion generation to video output.",
    'zh-CN':
      'Series 围绕 ComfyUI 的节点式工作流系统重建了制作流程。他们不再将生成视为一次性步骤，而是将工作流作为长期生产资产。ComfyUI 成为了创意结构的所在——从角色创建到情感生成再到视频输出。'
  },
  'customers.detail.series-entertainment.topic-4.block.1.heading': {
    en: 'Emotion Generation at Scale',
    'zh-CN': '规模化情感生成'
  },
  'customers.detail.series-entertainment.topic-4.block.2': {
    en: 'Series built a custom avatar system using ComfyUI that generates six distinct emotions in seconds: Happy, Sad, Serious, Snarky, Thinking, and Surprised. This made it possible to create expressive characters with multiple emotional states without manually recreating each variation.',
    'zh-CN':
      'Series 使用 ComfyUI 构建了一个自定义头像系统，可在数秒内生成六种不同的情感：开心、悲伤、严肃、讽刺、思考和惊讶。这使得创建具有多种情感状态的表现力角色成为可能，而无需手动重新创建每个变体。'
  },
  'customers.detail.series-entertainment.topic-4.block.3.src': {
    en: 'https://media.comfy.org/website/customers/series-entertainment/panel.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/series-entertainment/panel.webp'
  },
  'customers.detail.series-entertainment.topic-4.block.3.alt': {
    en: 'ComfyUI Expression Editor node for facial expression manipulation',
    'zh-CN': 'ComfyUI 表情编辑器节点，用于面部表情操控'
  },
  'customers.detail.series-entertainment.topic-4.block.3.caption': {
    en: 'The Expression Editor node in ComfyUI enables fine-grained control over character emotions.',
    'zh-CN': 'ComfyUI 中的表情编辑器节点实现了对角色情感的精细控制。'
  },
  'customers.detail.series-entertainment.topic-4.block.4.heading': {
    en: 'Replicable Pipelines from Test to Production',
    'zh-CN': '从测试到生产的可复用管线'
  },
  'customers.detail.series-entertainment.topic-4.block.5': {
    en: "Using ComfyUI's modular node system, Series built four streamlined pipelines that support the full production cycle — from early exploration to final output. These workflows deliver results up to <strong>180× faster</strong> than traditional manual processes that can take six hours or more per asset, while maintaining production quality.",
    'zh-CN':
      '利用 ComfyUI 的模块化节点系统，Series 构建了四条精简管线，支持从早期探索到最终输出的完整生产周期。这些工作流的效率比传统手工流程（每个资产可能需要六小时以上）<strong>提高了 180 倍</strong>，同时保持生产品质。'
  },
  'customers.detail.series-entertainment.topic-4.block.6': {
    en: 'The pipelines range from quick 512×512 single-emotion tests to high-resolution batch generation, allowing teams to experiment quickly and move directly into production using the same workflows.',
    'zh-CN':
      '管线范围从快速的 512×512 单情感测试到高分辨率批量生成，使团队能够快速实验并使用相同的工作流直接进入生产。'
  },
  'customers.detail.series-entertainment.topic-4.block.7.src': {
    en: 'https://media.comfy.org/website/customers/series-entertainment/workflows.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/series-entertainment/workflows.webp'
  },
  'customers.detail.series-entertainment.topic-4.block.7.alt': {
    en: 'ComfyUI workflow for facial expression manipulation and upscaling pipeline',
    'zh-CN': 'ComfyUI 面部表情操控和放大管线工作流'
  },
  'customers.detail.series-entertainment.topic-4.block.7.caption': {
    en: 'A ComfyUI workflow showing parallel expression editing, upscaling, and face detailing pipelines.',
    'zh-CN': 'ComfyUI 工作流展示了并行的表情编辑、放大和面部细化管线。'
  },
  'customers.detail.series-entertainment.topic-4.block.8.heading': {
    en: 'Consistency Across Games and Branching Stories',
    'zh-CN': '跨游戏和分支叙事的一致性'
  },
  'customers.detail.series-entertainment.topic-4.block.9': {
    en: 'For multiple Netflix titles, Series used ComfyUI to build workflows that keep characters and backgrounds consistent across complex, branching narratives. Styling and consistency pipelines help ensure that characters stay visually aligned across scenes, emotions, and story paths — even as asset counts grow.',
    'zh-CN':
      '在多部 Netflix 作品中，Series 使用 ComfyUI 构建了工作流，确保角色和背景在复杂的分支叙事中保持一致。风格化和一致性管线帮助确保角色在场景、情感和故事路径之间保持视觉统一——即使资产数量不断增长。'
  },
  'customers.detail.series-entertainment.topic-4.block.10.src': {
    en: 'https://media.comfy.org/website/customers/series-entertainment/consistency.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/series-entertainment/consistency.webp'
  },
  'customers.detail.series-entertainment.topic-4.block.10.alt': {
    en: 'Consistent character across multiple scenes and emotional states',
    'zh-CN': '角色在多个场景和情感状态中保持一致'
  },
  'customers.detail.series-entertainment.topic-4.block.10.caption': {
    en: 'A single character maintained across six different scenes and emotional states using ComfyUI consistency pipelines.',
    'zh-CN': '使用 ComfyUI 一致性管线在六个不同场景和情感状态中保持同一角色。'
  },
  'customers.detail.series-entertainment.topic-4.block.11.heading': {
    en: 'Production at Scale with ComfyUI',
    'zh-CN': '使用 ComfyUI 实现规模化生产'
  },
  'customers.detail.series-entertainment.topic-4.block.12': {
    en: 'Series also uses ComfyUI as part of an AI-assisted animation pipeline that connects story development directly to image and video generation. This pipeline includes bot-assisted video generation, allowing creators to repeatedly run the same workflows to produce video efficiently. Using this approach, each creator can generate Lorespark videos at scale, delivering over <strong>15 minutes of final video per week</strong>.',
    'zh-CN':
      'Series 还将 ComfyUI 作为 AI 辅助动画管线的一部分，将故事开发直接连接到图像和视频生成。该管线包含机器人辅助视频生成，允许创作者反复运行相同的工作流以高效生产视频。使用这种方法，每位创作者可以规模化生成 Lorespark 视频，每周交付超过 <strong>15 分钟的最终视频</strong>。'
  },
  'customers.detail.series-entertainment.topic-4.block.13.src': {
    en: 'https://media.comfy.org/website/customers/series-entertainment/batch.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/series-entertainment/batch.webp'
  },
  'customers.detail.series-entertainment.topic-4.block.13.alt': {
    en: 'ComfyUI batch processing workflow using Nano Banana and Google Gemini',
    'zh-CN': 'ComfyUI 使用 Nano Banana 和 Google Gemini 的批处理工作流'
  },
  'customers.detail.series-entertainment.topic-4.block.13.caption': {
    en: 'A batch processing workflow connecting multiple character images to Nano Banana for style-consistent generation.',
    'zh-CN':
      '批处理工作流将多个角色图像连接到 Nano Banana，实现风格一致的生成。'
  },
  // Topic 5: Why ComfyUI
  'customers.detail.series-entertainment.topic-5.label': {
    en: 'WHY COMFYUI',
    'zh-CN': '为何选择 ComfyUI'
  },
  'customers.detail.series-entertainment.topic-5.title': {
    en: 'Why ComfyUI Worked for Series',
    'zh-CN': '为什么 ComfyUI 适合 Series'
  },
  'customers.detail.series-entertainment.topic-5.block.0': {
    en: 'ComfyUI worked well because its node-based structure makes workflows explicit and reusable — once a workflow is built, it can be refined and shared across projects. This allowed Series to turn video generation into a repeatable system rather than a one-off process.',
    'zh-CN':
      'ComfyUI 之所以有效，是因为其节点式结构使工作流显式且可复用——一旦构建了工作流，就可以在项目间优化和共享。这使 Series 能够将视频生成从一次性过程转变为可重复的系统。'
  },
  'customers.detail.series-entertainment.topic-5.block.1': {
    en: 'Batch execution and bot integration allow those workflows to run at scale. Because the same workflows support both low-resolution testing and high-resolution final output, teams can move from exploration to delivery without switching tools or rebuilding pipelines.',
    'zh-CN':
      '批量执行和机器人集成使这些工作流能够大规模运行。由于相同的工作流同时支持低分辨率测试和高分辨率最终输出，团队可以从探索无缝过渡到交付，无需切换工具或重建管线。'
  },
  'customers.detail.series-entertainment.topic-5.block.2': {
    en: 'Most importantly, ComfyUI let Series focus on building structure instead of relying on trial-and-error prompting. Emotions, consistency, and production logic live inside the workflows themselves.',
    'zh-CN':
      '最重要的是，ComfyUI 让 Series 专注于构建结构，而非依赖试错式提示。情感、一致性和生产逻辑都存在于工作流本身之中。'
  },
  'customers.detail.series-entertainment.topic-5.block.3.src': {
    en: 'https://media.comfy.org/website/customers/series-entertainment/scale.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/series-entertainment/scale.webp'
  },
  'customers.detail.series-entertainment.topic-5.block.3.alt': {
    en: 'Six variations of the same character generated with consistent style',
    'zh-CN': '以一致风格生成的同一角色的六个变体'
  },
  'customers.detail.series-entertainment.topic-5.block.3.caption': {
    en: 'Multiple pose and expression variations of a single character, generated at scale while maintaining visual consistency.',
    'zh-CN':
      '同一角色的多个姿态和表情变体，在保持视觉一致性的同时实现规模化生成。'
  },
  // Topic 6: Conclusion
  'customers.detail.series-entertainment.topic-6.label': {
    en: 'CONCLUSION',
    'zh-CN': '总结'
  },
  'customers.detail.series-entertainment.topic-6.title': {
    en: 'Conclusion',
    'zh-CN': '总结'
  },
  'customers.detail.series-entertainment.topic-6.block.0': {
    en: 'By making ComfyUI a core creative platform, Series Entertainment transformed how it produces games and video. What started as a need for scale and consistency became a workflow-driven production system that supports emotional storytelling, large asset volumes, and ongoing development across multiple teams.',
    'zh-CN':
      '通过将 ComfyUI 作为核心创意平台，Series Entertainment 彻底改变了游戏和视频的制作方式。最初只是对规模和一致性的需求，最终演变成一个以工作流驱动的生产系统，支持情感叙事、大规模资产和多团队的持续开发。'
  },
  'customers.detail.series-entertainment.topic-6.block.1.text': {
    en: 'For Series, ComfyUI is not an experiment. It is how entertainment gets made.',
    'zh-CN': '对 Series 来说，ComfyUI 不是实验。它就是娱乐内容的制作方式。'
  },
  'customers.detail.series-entertainment.topic-6.block.1.name': {
    en: 'Series Entertainment',
    'zh-CN': 'Series Entertainment'
  },

  // Customer Detail: Open Story Movement
  // Topic 1: Intro
  'customers.detail.open-story-movement.topic-1.label': {
    en: 'INTRO',
    'zh-CN': '简介'
  },
  'customers.detail.open-story-movement.topic-1.block.0': {
    en: "Doodles, the entertainment brand built around the iconic pastel-palette artwork of Canadian illustrator Scott Martin (known as Burnt Toast), is about to launch <strong>Doodles AI</strong> — a generative platform powered by <strong>PRISM 1.0</strong>, a generative image model trained on Doodles' extensive body of work that can reimagine people and objects in the unmistakable Doodles visual language.",
    'zh-CN':
      'Doodles 是一个围绕加拿大插画师 Scott Martin（又名 Burnt Toast）标志性柔和色彩作品构建的娱乐品牌，即将推出 <strong>Doodles AI</strong>——一个由 <strong>PRISM 1.0</strong> 驱动的生成平台，这是一个基于 Doodles 大量作品训练的生成图像模型，能够以标志性的 Doodles 视觉语言重新想象人物和物体。'
  },
  'customers.detail.open-story-movement.topic-1.block.1': {
    en: 'Behind the scenes, the engineering is being handled by <strong>SYSTMS</strong>, an AI studio whose tagline — "Engineering the Impossible" — reflects their approach to building bespoke creative pipelines using open-source infrastructure, including node-based workflow tools like ComfyUI.',
    'zh-CN':
      '幕后的工程由 <strong>SYSTMS</strong> 负责，这是一家 AI 工作室，其口号"Engineering the Impossible"反映了他们使用开源基础设施构建定制创意管线的方法，包括像 ComfyUI 这样的基于节点的工作流工具。'
  },
  'customers.detail.open-story-movement.topic-1.block.2.src': {
    en: 'https://media.comfy.org/website/customers/open-story-movement/cover.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/open-story-movement/cover.webp'
  },
  'customers.detail.open-story-movement.topic-1.block.2.alt': {
    en: 'Doodles AI generative platform powered by PRISM 1.0',
    'zh-CN': '由 PRISM 1.0 驱动的 Doodles AI 生成平台'
  },
  'customers.detail.open-story-movement.topic-1.block.2.caption': {
    en: 'The Doodles AI platform reimagines people and objects in the Doodles visual language.',
    'zh-CN': 'Doodles AI 平台以 Doodles 视觉语言重新想象人物和物体。'
  },
  'customers.detail.open-story-movement.topic-1.block.3': {
    en: 'The story of how these pieces came together offers a compelling blueprint for anyone watching the intersection of open-source, AI, artist-driven brands, and the emerging concept the Doodles team is calling "open story."',
    'zh-CN':
      '这些部分如何整合在一起的故事，为关注开源、AI、艺术家驱动品牌以及 Doodles 团队所称的"开放叙事"这一新兴概念交汇点的所有人提供了一个引人注目的蓝图。'
  },
  // Topic 2: IP Without Walls
  'customers.detail.open-story-movement.topic-2.label': {
    en: 'IP WITHOUT WALLS',
    'zh-CN': '无墙 IP'
  },
  'customers.detail.open-story-movement.topic-2.title': {
    en: 'IP Without Walls',
    'zh-CN': '无墙 IP'
  },
  'customers.detail.open-story-movement.topic-2.block.0': {
    en: "Artists have traditionally been protective of their IP, and for good reason. But the Doodles team is exploring a new model where the community doesn't just consume the brand — they co-create it. Every generation a user produces on the Doodles AI platform makes the model stronger.",
    'zh-CN':
      '艺术家传统上一直保护自己的知识产权，这有充分的理由。但 Doodles 团队正在探索一种新模式，社区不仅仅是消费品牌——他们共同创造品牌。用户在 Doodles AI 平台上生成的每一次创作都会使模型更强大。'
  },
  'customers.detail.open-story-movement.topic-2.block.1': {
    en: "Through reinforcement learning, user-generated content becomes part of the training data for future iterations of the PRISM. Users aren't just customers; they're collaborators shaping the brand's visual DNA.",
    'zh-CN':
      '通过强化学习，用户生成的内容成为 PRISM 未来迭代的训练数据的一部分。用户不仅仅是客户；他们是塑造品牌视觉 DNA 的协作者。'
  },
  'customers.detail.open-story-movement.topic-2.block.2.src': {
    en: 'https://media.comfy.org/website/customers/open-story-movement/walls.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/open-story-movement/walls.webp'
  },
  'customers.detail.open-story-movement.topic-2.block.2.alt': {
    en: 'Doodles community co-creation',
    'zh-CN': 'Doodles 社区共创'
  },
  'customers.detail.open-story-movement.topic-2.block.2.caption': {
    en: 'Users become collaborators, co-creating the Doodles brand through AI-generated content.',
    'zh-CN': '用户成为协作者，通过 AI 生成的内容共同创造 Doodles 品牌。'
  },
  'customers.detail.open-story-movement.topic-2.block.3': {
    en: 'As Scott Martin put it when he returned as CEO in early 2025, the goal is to recalibrate — creativity first, community at the center, art driving everything. Martin, who built his career as an illustrator working with Google, Snapchat, Dropbox, and Adobe before co-founding Doodles in 2021 alongside Evan Keast and Jordan Castro, understands both the commercial and artistic sides of this equation.',
    'zh-CN':
      '正如 Scott Martin 在 2025 年初重新担任 CEO 时所说，目标是重新校准——创意优先、社区为中心、艺术驱动一切。Martin 在 2021 年与 Evan Keast 和 Jordan Castro 共同创立 Doodles 之前，曾与 Google、Snapchat、Dropbox 和 Adobe 合作建立了自己的插画师职业生涯，他深谙这个等式的商业和艺术两面。'
  },
  // Topic 3: The Last Mile
  'customers.detail.open-story-movement.topic-3.label': {
    en: 'THE LAST MILE',
    'zh-CN': '最后一英里'
  },
  'customers.detail.open-story-movement.topic-3.title': {
    en: 'The Last Mile Is the Whole Game',
    'zh-CN': '最后一英里就是整个游戏'
  },
  'customers.detail.open-story-movement.topic-3.block.0': {
    en: 'Doodles AI represents something powerful: proof that open-source tools can power commercially successful, brand-quality products.',
    'zh-CN':
      'Doodles AI 代表着一种强大的证明：开源工具可以驱动商业成功、品牌级品质的产品。'
  },
  'customers.detail.open-story-movement.topic-3.block.1': {
    en: 'The SYSTMS team uses open-source tools in their rawest form, prioritizing control and innovation at the bleeding edge of the space. The fact that these same tools are now producing output with the kind of brand fidelity that differentiates Doodles from generalized platforms like MidJourney or Sora is significant. It\'s the "last mile" problem in creative AI — getting from 85% to 100% fidelity — and it\'s where the real value lies.',
    'zh-CN':
      'SYSTMS 团队以最原始的形式使用开源工具，在该领域的最前沿优先考虑控制和创新。这些工具现在能够生成具有品牌保真度的输出，使 Doodles 区别于 MidJourney 或 Sora 等通用平台，这一点意义重大。这就是创意 AI 中的"最后一英里"问题——从 85% 到 100% 的保真度——也是真正价值所在。'
  },
  'customers.detail.open-story-movement.topic-3.block.2': {
    en: "Doodles AI is a showcase of what's possible when open-source workflows meet professional creative direction. ComfyUI's powerful node-based platform allows users to package complex systems of open-source models, APIs, and other tools into consumer-facing applications, making it a natural fit for projects like this.",
    'zh-CN':
      'Doodles AI 展示了当开源工作流遇上专业创意方向时的可能性。ComfyUI 强大的基于节点的平台允许用户将开源模型、API 和其他工具的复杂系统打包成面向消费者的应用程序，使其成为此类项目的天然选择。'
  },
  'customers.detail.open-story-movement.topic-3.block.3.src': {
    en: 'https://media.comfy.org/website/customers/open-story-movement/workflow.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/open-story-movement/workflow.webp'
  },
  'customers.detail.open-story-movement.topic-3.block.3.alt': {
    en: 'ComfyUI workflow powering Doodles AI',
    'zh-CN': '驱动 Doodles AI 的 ComfyUI 工作流'
  },
  'customers.detail.open-story-movement.topic-3.block.3.caption': {
    en: 'Open-source workflows powering brand-quality generative output.',
    'zh-CN': '开源工作流驱动品牌级生成输出。'
  },
  // Topic 4: Coded DNA
  'customers.detail.open-story-movement.topic-4.label': {
    en: 'CODED DNA',
    'zh-CN': '编码 DNA'
  },
  'customers.detail.open-story-movement.topic-4.title': {
    en: 'Coded DNA',
    'zh-CN': '编码 DNA'
  },
  'customers.detail.open-story-movement.topic-4.block.0': {
    en: "Doodles AI launches with PRISM 1.0 as an image-to-image model, but the roadmap is ambitious: 2D and 3D output generation, video with sound, real-time AR, and gaming applications. Original Doodles holders receive 100 free generations on launch day — a deliberate move to seed the community and let them flood every timeline with the platform's output.",
    'zh-CN':
      'Doodles AI 以 PRISM 1.0 作为图像到图像模型推出，但路线图雄心勃勃：2D 和 3D 输出生成、带声音的视频、实时 AR 和游戏应用。原始 Doodles 持有者在发布当天获得 100 次免费生成——这是一个有意识的举措，旨在为社区注入活力，让他们用平台的输出刷遍每一条时间线。'
  },
  'customers.detail.open-story-movement.topic-4.block.1.src': {
    en: 'https://media.comfy.org/website/customers/open-story-movement/dna.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/open-story-movement/dna.webp'
  },
  'customers.detail.open-story-movement.topic-4.block.1.alt': {
    en: 'Doodles AI output examples',
    'zh-CN': 'Doodles AI 输出示例'
  },
  'customers.detail.open-story-movement.topic-4.block.1.caption': {
    en: 'Doodles AI output demonstrating brand-fidelity generative results.',
    'zh-CN': 'Doodles AI 输出展示品牌保真的生成结果。'
  },
  'customers.detail.open-story-movement.topic-4.block.2': {
    en: "The deeper play is alignment with the speed and scale of the entire AI industry. By building on open-source infrastructure and fostering a community of co-creators, Doodles has positioned itself to plug its \"coded DNA\" into future technologies that don't yet exist. It's a bet that openness — open source, open story, open creation — isn't just philosophically appealing but strategically sound.",
    'zh-CN':
      '更深层的布局是与整个 AI 行业的速度和规模保持一致。通过在开源基础设施上构建并培育共创者社区，Doodles 已将自己定位为可以将其"编码 DNA"接入尚未存在的未来技术。这是一个赌注：开放性——开源、开放叙事、开放创造——不仅在哲学上有吸引力，而且在战略上是明智的。'
  },
  // Topic 5: What It Means
  'customers.detail.open-story-movement.topic-5.label': {
    en: 'TAKEAWAY',
    'zh-CN': '要点'
  },
  'customers.detail.open-story-movement.topic-5.title': {
    en: 'What It Means for Artists',
    'zh-CN': '对艺术家意味着什么'
  },
  'customers.detail.open-story-movement.topic-5.block.0': {
    en: "For artists watching from the sidelines, the message is clear: the building blocks are here, the community is building, and the line between creator and consumer is disappearing. The question isn't whether open source will reshape creative industries. It's whether you'll be building with it when it does.",
    'zh-CN':
      '对于在场外观望的艺术家来说，信息很明确：构建模块已经就位，社区正在建设，创作者和消费者之间的界限正在消失。问题不在于开源是否会重塑创意产业。而在于当它发生时，你是否在用它构建。'
  },
  'customers.detail.open-story-movement.topic-5.block.1.src': {
    en: 'https://media.comfy.org/website/customers/open-story-movement/output.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/open-story-movement/output.webp'
  },
  'customers.detail.open-story-movement.topic-5.block.1.alt': {
    en: 'Doodles AI creative output',
    'zh-CN': 'Doodles AI 创意输出'
  },
  'customers.detail.open-story-movement.topic-5.block.1.caption': {
    en: 'Open-source tools powering brand-quality creative output at scale.',
    'zh-CN': '开源工具大规模驱动品牌级创意输出。'
  },
  'customers.detail.open-story-movement.topic-5.block.2.label': {
    en: 'LINKS',
    'zh-CN': '链接'
  },
  'customers.detail.open-story-movement.topic-5.block.2.name': {
    en: 'Doodles: doodles.app | SYSTMS: systms.ai | ComfyUI: comfy.org',
    'zh-CN': 'Doodles: doodles.app | SYSTMS: systms.ai | ComfyUI: comfy.org'
  },
  'customers.detail.open-story-movement.topic-5.block.2.role': {
    en: 'Official websites',
    'zh-CN': '官方网站'
  },

  // Customer Detail: Moment Factory
  // Topic 1: INTRO
  'customers.detail.moment-factory.topic-1.label': {
    en: 'INTRO',
    'zh-CN': '简介'
  },
  'customers.detail.moment-factory.topic-1.block.0': {
    en: 'How do you make generative AI work at architectural scale? Moment Factory used ComfyUI to fundamentally transform how they handle early concept, look development, and design exploration for architectural projection mapping.',
    'zh-CN':
      '如何让生成式 AI 在建筑尺度下发挥作用？Moment Factory 使用 ComfyUI 从根本上改变了他们在建筑投影映射中处理早期概念、外观开发和设计探索的方式。'
  },
  'customers.detail.moment-factory.topic-1.block.1': {
    en: 'Before ComfyUI, this phase was slower, more abstract, and carried greater risk. After ComfyUI, it became faster, more concrete, and spatially grounded from the start.',
    'zh-CN':
      '在使用 ComfyUI 之前，这一阶段更慢、更抽象，风险也更大。使用 ComfyUI 之后，它变得更快、更具体，从一开始就在空间上有了坚实的基础。'
  },
  'customers.detail.moment-factory.topic-1.block.2.src': {
    en: 'https://media.comfy.org/website/customers/moment-factory/hero.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/moment-factory/hero.webp'
  },
  'customers.detail.moment-factory.topic-1.block.2.alt': {
    en: 'Moment Factory architectural projection mapping',
    'zh-CN': 'Moment Factory 建筑投影映射'
  },
  'customers.detail.moment-factory.topic-1.block.2.caption': {
    en: 'Arched interior architectural projection by Moment Factory.',
    'zh-CN': 'Moment Factory 的拱形室内建筑投影。'
  },
  // Topic 2: BEFORE COMFY
  'customers.detail.moment-factory.topic-2.label': {
    en: 'BEFORE COMFY',
    'zh-CN': '使用前'
  },
  'customers.detail.moment-factory.topic-2.title': {
    en: 'Before ComfyUI: Slow Iteration, Abstract Decisions, Late Risk',
    'zh-CN': '使用 ComfyUI 之前：迭代缓慢、决策抽象、风险滞后'
  },
  'customers.detail.moment-factory.topic-2.block.0': {
    en: 'Early concept and look development traditionally relied on:',
    'zh-CN': '早期概念和外观开发传统上依赖于：'
  },
  'customers.detail.moment-factory.topic-2.block.1': {
    en: 'Static sketches\nReference decks\nMoodboards\nAbstract discussions about intent',
    'zh-CN': '静态草图\n参考资料集\n情绪板\n关于意图的抽象讨论'
  },
  'customers.detail.moment-factory.topic-2.block.2': {
    en: 'For architectural projection mapping, this creates a problem. You do not really know if something works until it is projected at scale. Seams, pixel density, spatial drift, and composition issues usually reveal themselves later in the process, when changes have a massive impact on production.',
    'zh-CN':
      '对于建筑投影映射来说，这带来了一个问题。在实际投影到建筑上之前，你无法真正知道某个方案是否可行。接缝、像素密度、空间偏移和构图问题通常在流程后期才暴露出来，而此时的修改对制作的影响是巨大的。'
  },
  'customers.detail.moment-factory.topic-2.block.3': {
    en: 'Traditionally, this means:',
    'zh-CN': '传统上，这意味着：'
  },
  'customers.detail.moment-factory.topic-2.block.4': {
    en: 'Fewer directions explored\nLonger back-and-forth cycles\nCreative decisions made without spatial proof\nRisk pushed downstream into production',
    'zh-CN':
      '探索的方向更少\n反复沟通的周期更长\n创意决策缺乏空间验证\n风险被推迟到制作阶段'
  },
  // Topic 3: WHAT CHANGED
  'customers.detail.moment-factory.topic-3.label': {
    en: 'WHAT CHANGED?',
    'zh-CN': '发生了什么变化？'
  },
  'customers.detail.moment-factory.topic-3.title': {
    en: 'What Changed with ComfyUI',
    'zh-CN': '使用 ComfyUI 后发生了什么变化'
  },
  'customers.detail.moment-factory.topic-3.block.0': {
    en: 'Moment Factory built a custom ComfyUI workflow and used it to enhance and accelerate large parts of early concept sketching, look-dev exploration, and part of the design phase.',
    'zh-CN':
      'Moment Factory 构建了自定义的 ComfyUI 工作流，并将其用于增强和加速早期概念草图、外观开发探索以及部分设计阶段。'
  },
  'customers.detail.moment-factory.topic-3.block.1': {
    en: 'They did not just generate images. They changed how decisions were made.',
    'zh-CN': '他们不仅仅是生成图像，而是改变了决策方式。'
  },
  'customers.detail.moment-factory.topic-3.block.2.heading': {
    en: '1. Iteration stopped being the bottleneck',
    'zh-CN': '1. 迭代不再是瓶颈'
  },
  'customers.detail.moment-factory.topic-3.block.3': {
    en: 'ComfyUI transformed the iteration process, making it faster, sharper, and more intentional. Grounded in real production parameters, they explored:',
    'zh-CN':
      'ComfyUI 改变了迭代过程，使其更快、更精准、更有目的性。基于真实的制作参数，他们探索了：'
  },
  'customers.detail.moment-factory.topic-3.block.4': {
    en: 'Over 20 main artistic directions\n20 to 40 iterations per direction\nStyles ranging from hyper-realism to illustrative engraving',
    'zh-CN':
      '20 多个主要艺术方向\n每个方向 20 到 40 次迭代\n风格从超写实到插画版画不等'
  },
  'customers.detail.moment-factory.topic-3.block.5.src': {
    en: 'https://media.comfy.org/website/customers/moment-factory/variations.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/moment-factory/variations.webp'
  },
  'customers.detail.moment-factory.topic-3.block.5.alt': {
    en: 'Grid of generated artistic variations',
    'zh-CN': '生成的艺术变体网格'
  },
  'customers.detail.moment-factory.topic-3.block.5.caption': {
    en: 'A grid of generated variations exploring different artistic directions.',
    'zh-CN': '探索不同艺术方向的生成变体网格。'
  },
  'customers.detail.moment-factory.topic-3.block.6': {
    en: 'The studio used batching and parameter tweaks to move quickly, while intentionally stress-testing the system to understand its limits.',
    'zh-CN':
      '工作室通过批处理和参数调整快速推进，同时有意地对系统进行压力测试以了解其极限。'
  },
  'customers.detail.moment-factory.topic-3.block.7.text': {
    en: "With any GenAI tool, it's easy to over-iterate, to believe the best result is always one click away. Imposing real production constraints, whether financial or time-based, was essential to ensure these explorations remained meaningful and truly impacted our pipelines.",
    'zh-CN':
      '使用任何生成式 AI 工具，都很容易过度迭代，认为最佳结果总是只差一次点击。施加真实的制作约束，无论是财务上还是时间上的，对于确保这些探索保持有意义并真正影响我们的管线至关重要。'
  },
  'customers.detail.moment-factory.topic-3.block.7.name': {
    en: 'Guillaume Borgomano | Senior Multimedia Director & Innovation Creative Lead @ Moment Factory',
    'zh-CN':
      'Guillaume Borgomano | Moment Factory 高级多媒体总监 & 创新创意负责人'
  },
  'customers.detail.moment-factory.topic-3.block.8': {
    en: 'That volume of exploration would not have been realistic in their previous workflow.',
    'zh-CN': '在他们之前的工作流中，如此大量的探索是不现实的。'
  },
  'customers.detail.moment-factory.topic-3.block.9.heading': {
    en: '2. Concept work moved from days to hours',
    'zh-CN': '2. 概念工作从数天缩短到数小时'
  },
  'customers.detail.moment-factory.topic-3.block.10': {
    en: 'The biggest acceleration happened early. What would normally involve days of back-and-forth between static concepts and reference decks could happen within a few hours.',
    'zh-CN':
      '最大的加速发生在早期阶段。通常需要在静态概念和参考资料集之间来回数天的工作，现在可以在几个小时内完成。'
  },
  'customers.detail.moment-factory.topic-3.block.11': {
    en: 'They generated intentionally low-resolution outputs around 2K, reviewed them quickly, and even generated new variations live on site. Those outputs could be checked directly in the media server timeline minutes later.',
    'zh-CN':
      '他们有意生成约 2K 的低分辨率输出，快速审查，甚至在现场实时生成新的变体。这些输出可以在几分钟后直接在媒体服务器时间线中查看。'
  },
  'customers.detail.moment-factory.topic-3.block.12': {
    en: 'This low-resolution stage was not about polish. It was about validation and decision-making. That shift alone changed the pace of the entire project.',
    'zh-CN':
      '这个低分辨率阶段不是关于打磨，而是关于验证和决策。仅这一转变就改变了整个项目的节奏。'
  },
  'customers.detail.moment-factory.topic-3.block.13.heading': {
    en: '3. Spatial credibility came first, not last',
    'zh-CN': '3. 空间可信度优先，而非滞后'
  },
  'customers.detail.moment-factory.topic-3.block.14': {
    en: 'A major reason this worked is that every generation was already spatially constrained. Moment Factory built the entire workflow around architectural surface templates, so outputs were pre-mapped from the start. The pipeline supported multiple template types in parallel, including flat UVs, 360 layouts, and camera-projection setups.',
    'zh-CN':
      '这之所以有效的一个主要原因是，每次生成已经在空间上受到约束。Moment Factory 围绕建筑表面模板构建了整个工作流，因此输出从一开始就是预映射的。管线同时支持多种模板类型，包括平面 UV、360 布局和相机投影设置。'
  },
  'customers.detail.moment-factory.topic-3.block.15': {
    en: 'ControlNet injected structural information from those templates directly into the diffusion process, enforcing scale, layout, and spatial logic early.',
    'zh-CN':
      'ControlNet 将这些模板的结构信息直接注入扩散过程，提前强制执行比例、布局和空间逻辑。'
  },
  'customers.detail.moment-factory.topic-3.block.16': {
    en: 'Because of this, visuals were already spatially credible during the concept phase. Abstract intent turned into shared reference points. The team could react to something grounded instead of imagining how it might look later.',
    'zh-CN':
      '因此，视觉效果在概念阶段就已经具有空间可信度。抽象的意图转变为共享的参考点。团队可以对有据可依的东西做出反应，而不是想象它以后可能的样子。'
  },
  'customers.detail.moment-factory.topic-3.block.17.heading': {
    en: '4. Approval no longer meant starting over',
    'zh-CN': '4. 审批不再意味着重新开始'
  },
  'customers.detail.moment-factory.topic-3.block.18': {
    en: 'Once a direction was approved, the workflow did not reset. They could:',
    'zh-CN': '一旦方向获批，工作流不会重置。他们可以：'
  },
  'customers.detail.moment-factory.topic-3.block.19': {
    en: 'Inpaint specific regions\nPreserve composition\nUpscale selected outputs to 18K in ~20 minutes',
    'zh-CN': '局部修复特定区域\n保留构图\n在约 20 分钟内将选定的输出放大到 18K'
  },
  'customers.detail.moment-factory.topic-3.block.20': {
    en: 'This completely changed how fast ideas moved from concept to projection-ready content. Previously, approval often meant rebuilding work. With ComfyUI, approval meant pushing forward.',
    'zh-CN':
      '这完全改变了创意从概念到投影就绪内容的速度。以前，审批通常意味着重新制作。有了 ComfyUI，审批意味着继续推进。'
  },
  'customers.detail.moment-factory.topic-3.block.21.heading': {
    en: '5. Fewer people, better collaboration',
    'zh-CN': '5. 更少的人，更好的协作'
  },
  'customers.detail.moment-factory.topic-3.block.22': {
    en: 'Once the system was stable, one main artist operated inside ComfyUI. Around that setup, two additional team members were continuously involved in art direction, prompt tuning, selection, and alignment discussions.',
    'zh-CN':
      '一旦系统稳定，一名主要艺术家在 ComfyUI 中操作。在此设置周围，另外两名团队成员持续参与艺术指导、提示词调优、选择和对齐讨论。'
  },
  'customers.detail.moment-factory.topic-3.block.23': {
    en: 'They had to define a new working methodology to keep creative intent at the center, but in practice, ComfyUI functioned as a shared exploration tool, not a solo technical setup.',
    'zh-CN':
      '他们必须定义新的工作方法以保持创意意图在核心位置，但在实践中，ComfyUI 作为共享的探索工具运作，而非单独的技术设置。'
  },
  'customers.detail.moment-factory.topic-3.block.24.heading': {
    en: '6. The moment it became undeniable',
    'zh-CN': '6. 不可否认的时刻'
  },
  'customers.detail.moment-factory.topic-3.block.25': {
    en: "Within Moment Factory's innovation team, it felt like a breakthrough early on — the level of malleability and control simply wasn't achievable with more rigid tools. But the real turning point came during an in-situ live demo, held at 25 Broadway. Late in the process, Moment Factory swapped the surface template and reran the entire pipeline without re-authoring a single asset. The composition held and the spatial logic remained intact. The content dropped straight into the media server timeline.",
    'zh-CN':
      '在 Moment Factory 的创新团队中，这在早期就感觉像是一个突破——这种程度的可塑性和控制力在更僵化的工具中根本无法实现。但真正的转折点出现在百老汇 25 号的一次现场演示中。在流程后期，Moment Factory 更换了表面模板，并重新运行了整个管线，没有重新制作任何资产。构图保持不变，空间逻辑完好无损。内容直接进入媒体服务器时间线。'
  },
  'customers.detail.moment-factory.topic-3.block.26': {
    en: 'The room went quiet.',
    'zh-CN': '全场安静了。'
  },
  'customers.detail.moment-factory.topic-3.block.27': {
    en: 'In that moment, it stopped being a promising experiment and became a shared realization. People weren\'t asking "what if" anymore — they were asking how to prompt, and in what other context it could apply.',
    'zh-CN':
      '在那一刻，它不再是一个有前景的实验，而成为一种共识。人们不再问"如果怎样"——他们在问如何编写提示词，以及它还能应用在哪些场景中。'
  },
  'customers.detail.moment-factory.topic-3.block.28': {
    en: "That's when it became undeniable: this wasn't just a powerful tool for R&D. It was a shift in how teams across Moment Factory could think, iterate, and produce.",
    'zh-CN':
      '那时它变得不可否认：这不仅仅是研发的强大工具，而是 Moment Factory 各团队思考、迭代和制作方式的一次转变。'
  },
  'customers.detail.moment-factory.topic-3.block.29.src': {
    en: 'https://media.comfy.org/website/customers/moment-factory/demo.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/moment-factory/demo.webp'
  },
  'customers.detail.moment-factory.topic-3.block.29.alt': {
    en: 'Moment Factory live projection mapping demo',
    'zh-CN': 'Moment Factory 现场投影映射演示'
  },
  'customers.detail.moment-factory.topic-3.block.29.caption': {
    en: 'Interior crowd view with projection mapping at architectural scale.',
    'zh-CN': '建筑尺度投影映射的室内观众视角。'
  },
  // Topic 4: WHY COMFYUI WAS CRITICAL
  'customers.detail.moment-factory.topic-4.label': {
    en: 'WHY COMFYUI WAS CRITICAL',
    'zh-CN': '为什么 ComfyUI 至关重要'
  },
  'customers.detail.moment-factory.topic-4.title': {
    en: 'Why ComfyUI Was Critical at Architectural Scale',
    'zh-CN': '为什么 ComfyUI 在建筑尺度至关重要'
  },
  'customers.detail.moment-factory.topic-4.block.0': {
    en: 'Moment Factory had been exploring diffusion-based workflows for projection mapping for years. The ambition was clear: use generative systems not just for images, but as structured spatial material within complex, large-scale environments.',
    'zh-CN':
      'Moment Factory 多年来一直在探索基于扩散的投影映射工作流。目标很明确：将生成系统不仅用于图像，还作为复杂大规模环境中的结构化空间素材。'
  },
  'customers.detail.moment-factory.topic-4.block.1': {
    en: 'What architectural scale demanded, however, was not just image generation. It required:',
    'zh-CN': '然而，建筑尺度所要求的不仅仅是图像生成，还需要：'
  },
  'customers.detail.moment-factory.topic-4.block.2': {
    en: 'Precise control over spatial conditioning\nThe ability to inject UV layouts and depth constraints directly into inference\nRapid template switching without breaking composition\nIterative refinement without rebuilding from scratch\nA pipeline that could evolve as constraints changed',
    'zh-CN':
      '对空间条件的精确控制\n将 UV 布局和深度约束直接注入推理的能力\n不破坏构图的快速模板切换\n无需从头重建的迭代优化\n可以随约束变化而发展的管线'
  },
  'customers.detail.moment-factory.topic-4.block.3': {
    en: 'This level of structural malleability was essential.',
    'zh-CN': '这种程度的结构可塑性是必不可少的。'
  },
  'customers.detail.moment-factory.topic-4.block.4': {
    en: "ComfyUI's node-based architecture allowed the team to design and reshape the workflow itself, not just the outputs. Conditioning logic, batching strategies, template inputs, and upscaling stages could be reconfigured as the project evolved.",
    'zh-CN':
      'ComfyUI 基于节点的架构使团队能够设计和重塑工作流本身，而不仅仅是输出。条件逻辑、批处理策略、模板输入和放大阶段可以随着项目的发展而重新配置。'
  },
  'customers.detail.moment-factory.topic-4.block.5': {
    en: 'Rather than adapting the project to fit a tool, the tool could be adapted to fit the architecture.',
    'zh-CN': '项目无需适应工具，工具可以适应建筑。'
  },
  'customers.detail.moment-factory.topic-4.block.6': {
    en: 'At that point, it became clear: achieving reliable architectural-scale generative workflows required a system flexible enough to be re-authored alongside the creative process. ComfyUI provided that flexibility.',
    'zh-CN':
      '在那一刻变得清晰：实现可靠的建筑尺度生成式工作流需要一个足够灵活的系统，可以在创意过程中被重新构建。ComfyUI 提供了这种灵活性。'
  },
  'customers.detail.moment-factory.topic-4.block.7.src': {
    en: 'https://media.comfy.org/website/customers/moment-factory/workflow.webp',
    'zh-CN':
      'https://media.comfy.org/website/customers/moment-factory/workflow.webp'
  },
  'customers.detail.moment-factory.topic-4.block.7.alt': {
    en: 'ComfyUI node-based workflow',
    'zh-CN': 'ComfyUI 基于节点的工作流'
  },
  'customers.detail.moment-factory.topic-4.block.7.caption': {
    en: 'Screenshot of the ComfyUI node-based workflow used by Moment Factory.',
    'zh-CN': 'Moment Factory 使用的 ComfyUI 基于节点工作流截图。'
  },
  // Topic 5: THE TAKEAWAY
  'customers.detail.moment-factory.topic-5.label': {
    en: 'THE TAKEAWAY',
    'zh-CN': '总结'
  },
  'customers.detail.moment-factory.topic-5.title': {
    en: 'The Takeaway',
    'zh-CN': '总结'
  },
  'customers.detail.moment-factory.topic-5.block.0': {
    en: 'ComfyUI did not make the creative decisions. The vision stayed human. The constraints were architectural, and the expectations were production-level from the start.',
    'zh-CN':
      'ComfyUI 没有做出创意决策。愿景始终是人类的。约束是建筑性的，期望从一开始就是制作级别的。'
  },
  'customers.detail.moment-factory.topic-5.block.1': {
    en: 'What ComfyUI brought to the table was structural flexibility. It allowed the workflow itself to be shaped and reshaped as the project evolved. Spatial inputs could be injected directly into inference. Templates could be swapped without collapsing the composition. Refinements could happen without rebuilding entire directions.',
    'zh-CN':
      'ComfyUI 带来的是结构灵活性。它允许工作流本身随着项目的发展而被塑造和重塑。空间输入可以直接注入推理。模板可以在不破坏构图的情况下切换。优化可以在不重建整个方向的情况下进行。'
  },
  'customers.detail.moment-factory.topic-5.block.2': {
    en: 'Generative systems stopped behaving like black boxes and started behaving like controllable material. Spatial logic was embedded early, and scaling to architectural resolution became a managed step rather than a gamble.',
    'zh-CN':
      '生成系统不再像黑箱一样运作，而开始像可控材料一样行为。空间逻辑被提前嵌入，扩展到建筑分辨率成为一个可管理的步骤，而非赌博。'
  },
  'customers.detail.moment-factory.topic-5.block.3': {
    en: 'The impact was not just speed. Decisions could be validated earlier, directly against geometry and projection conditions. Spatial alignment became part of concept development instead of a late-stage correction. That shift reduced uncertainty before entering production.',
    'zh-CN':
      '影响不仅仅是速度。决策可以更早地得到验证，直接针对几何形状和投影条件。空间对齐成为概念开发的一部分，而不是后期修正。这种转变减少了进入制作前的不确定性。'
  },
  'customers.detail.moment-factory.topic-5.block.4': {
    en: 'In that sense, ComfyUI did more than accelerate exploration. It made architectural-scale generative workflows structurally viable within real production constraints.',
    'zh-CN':
      '从这个意义上说，ComfyUI 不仅加速了探索，还使建筑尺度的生成式工作流在真实制作约束下具有结构可行性。'
  },
  'customers.detail.moment-factory.topic-5.block.5.label': {
    en: 'MOMENT FACTORY CONTRIBUTORS',
    'zh-CN': 'MOMENT FACTORY 贡献者'
  },
  'customers.detail.moment-factory.topic-5.block.5.name': {
    en: 'Guillaume Borgomano',
    'zh-CN': 'Guillaume Borgomano'
  },
  'customers.detail.moment-factory.topic-5.block.5.role': {
    en: 'Senior Multimedia Director & Innovation Creative Lead',
    'zh-CN': '高级多媒体总监 & 创新创意负责人'
  },
  'customers.detail.moment-factory.topic-5.block.5.name2': {
    en: 'Conner Tozier',
    'zh-CN': 'Conner Tozier'
  },
  'customers.detail.moment-factory.topic-5.block.5.role2': {
    en: 'Lead Motion Designer & Generative AI Lead',
    'zh-CN': '首席动效设计师 & 生成式 AI 负责人'
  },

  // Customer Detail: Ubisoft CHORD
  // Topic 1: Intro
  'customers.detail.ubisoft-chord.topic-1.label': {
    en: 'INTRO',
    'zh-CN': '简介'
  },
  'customers.detail.ubisoft-chord.topic-1.block.0': {
    en: 'Ubisoft La Forge has open-sourced its PBR material estimation model, <strong>CHORD (Chain of Rendering Decomposition)</strong>, together with <strong>ComfyUI-Chord</strong> custom node implementation to build an end-to-end material generation workflow with AI.',
    'zh-CN':
      '育碧 La Forge 开源了其 PBR 材质估算模型 <strong>CHORD（Chain of Rendering Decomposition）</strong>，以及 <strong>ComfyUI-Chord</strong> 自定义节点实现，用于构建端到端的 AI 材质生成工作流。'
  },
  'customers.detail.ubisoft-chord.topic-1.block.1': {
    en: 'The model weights and code are released with a Research-Only license. Beyond research, this is a significant step toward integrating ComfyUI into AAA-scale video game production workflows.',
    'zh-CN':
      '模型权重和代码以仅限研究的许可证发布。除了研究之外，这是将 ComfyUI 集成到 AAA 级视频游戏制作工作流中的重要一步。'
  },
  'customers.detail.ubisoft-chord.topic-1.block.2.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/cover.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/cover.webp'
  },
  'customers.detail.ubisoft-chord.topic-1.block.2.alt': {
    en: 'CHORD PBR material generation in ComfyUI',
    'zh-CN': 'ComfyUI 中的 CHORD PBR 材质生成'
  },
  'customers.detail.ubisoft-chord.topic-1.block.2.caption': {
    en: 'PBR materials generated using the CHORD model in ComfyUI.',
    'zh-CN': '使用 ComfyUI 中的 CHORD 模型生成的 PBR 材质。'
  },
  // Topic 2: The Problem
  'customers.detail.ubisoft-chord.topic-2.label': {
    en: 'THE PROBLEM',
    'zh-CN': '挑战'
  },
  'customers.detail.ubisoft-chord.topic-2.title': {
    en: 'PBR Material Production in AAA Games Today',
    'zh-CN': '当今 AAA 游戏中的 PBR 材质制作'
  },
  'customers.detail.ubisoft-chord.topic-2.block.0': {
    en: 'In AAA game development, PBR materials are the foundation of visual realism. Large-scale titles require hundreds of reusable materials, each with full Base Color, Normal, Height, Roughness, and Metalness maps that meet strict svBRDF standards.',
    'zh-CN':
      '在 AAA 游戏开发中，PBR 材质是视觉真实感的基础。大型游戏需要数百种可复用的材质，每种都包含完整的基础颜色、法线、高度、粗糙度和金属度贴图，并须满足严格的 svBRDF 标准。'
  },
  'customers.detail.ubisoft-chord.topic-2.block.1': {
    en: 'Traditionally, these assets are crafted by texture artists using photogrammetry, procedural tools, and extensive manual tuning — making the process time-consuming and highly expertise-dependent.',
    'zh-CN':
      '传统上，这些资产由纹理艺术家使用摄影测量、程序化工具和大量手动调整来制作——这使得流程耗时且高度依赖专业知识。'
  },
  'customers.detail.ubisoft-chord.topic-2.block.2': {
    en: "Ubisoft's Generative Base Material prototype directly targets this production bottleneck. The ComfyUI workflow outputs PBR texture sets that integrate directly into DCC tools and game engines for prototyping and placeholder assets.",
    'zh-CN':
      '育碧的生成式基础材质原型直接针对这一制作瓶颈。ComfyUI 工作流输出的 PBR 纹理集可直接集成到 DCC 工具和游戏引擎中，用于原型制作和占位资产。'
  },
  // Topic 3: Why ComfyUI
  'customers.detail.ubisoft-chord.topic-3.label': {
    en: 'WHY COMFYUI',
    'zh-CN': '为什么选择 ComfyUI'
  },
  'customers.detail.ubisoft-chord.topic-3.title': {
    en: 'Why Ubisoft Chose ComfyUI as The Workflow Platform',
    'zh-CN': '育碧为何选择 ComfyUI 作为工作流平台'
  },
  'customers.detail.ubisoft-chord.topic-3.block.0': {
    en: "Ubisoft's choice of ComfyUI is rooted in production realities. For large studios, the requirement is not another image generator — it is a controllable and integratable AI workflow platform that can meet the bespoke requirements of game development.",
    'zh-CN':
      '育碧选择 ComfyUI 源于生产实际需求。对于大型工作室来说，需要的不是另一个图像生成器——而是一个可控且可集成的 AI 工作流平台，能够满足游戏开发的定制需求。'
  },
  'customers.detail.ubisoft-chord.topic-3.block.1.text': {
    en: 'Considering the multi-stage nature of our prototype, ComfyUI provides us with an efficient framework to build integrated workflows doing texture image synthesis, material estimation and material upscaling. This also enables us to leverage state-of-the-art generative models and the powerful features of ComfyUI that provide fine-grain control to creators with ControlNets, image guidance, inpainting, and countless other options.',
    'zh-CN':
      '考虑到我们原型的多阶段特性，ComfyUI 为我们提供了一个高效的框架来构建集成工作流，涵盖纹理图像合成、材质估算和材质放大。这也使我们能够利用最先进的生成模型和 ComfyUI 的强大功能，通过 ControlNet、图像引导、修复等众多选项为创作者提供精细控制。'
  },
  'customers.detail.ubisoft-chord.topic-3.block.1.name': {
    en: 'Ubisoft La Forge Blog',
    'zh-CN': '育碧 La Forge 博客'
  },
  // Topic 4: The Pipeline
  'customers.detail.ubisoft-chord.topic-4.label': {
    en: 'THE PIPELINE',
    'zh-CN': '流水线'
  },
  'customers.detail.ubisoft-chord.topic-4.title': {
    en: '3 Stages of The Generative Base Material Pipeline',
    'zh-CN': '生成式基础材质流水线的三个阶段'
  },
  'customers.detail.ubisoft-chord.topic-4.block.0': {
    en: 'The CHORD model is integrated into a broader pipeline consisting of 3 core stages.',
    'zh-CN': 'CHORD 模型集成在一个更广泛的流水线中，由三个核心阶段组成。'
  },
  'customers.detail.ubisoft-chord.topic-4.block.1.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/pipeline.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/pipeline.webp'
  },
  'customers.detail.ubisoft-chord.topic-4.block.1.alt': {
    en: 'The 3-stage generative base material pipeline',
    'zh-CN': '三阶段生成式基础材质流水线'
  },
  'customers.detail.ubisoft-chord.topic-4.block.1.caption': {
    en: 'The 3-stage generative base material pipeline: texture generation, CHORD estimation, and upscaling.',
    'zh-CN': '三阶段生成式基础材质流水线：纹理生成、CHORD 估算和放大。'
  },
  'customers.detail.ubisoft-chord.topic-4.block.2.heading': {
    en: 'Stage 1 — Texture Image Generation',
    'zh-CN': '阶段一 — 纹理图像生成'
  },
  'customers.detail.ubisoft-chord.topic-4.block.3': {
    en: 'The first stage generates seamless, tileable 2D textures from text prompts or reference inputs such as lineart and height maps using a custom diffusion model with full conditional control.',
    'zh-CN':
      '第一阶段使用具有完全条件控制的自定义扩散模型，从文本提示或参考输入（如线稿和高度图）生成无缝、可平铺的 2D 纹理。'
  },
  'customers.detail.ubisoft-chord.topic-4.block.4.heading': {
    en: 'Stage 2 — CHORD Image-to-Material Estimation',
    'zh-CN': '阶段二 — CHORD 图像到材质估算'
  },
  'customers.detail.ubisoft-chord.topic-4.block.5': {
    en: 'A single texture is converted into a full set of PBR maps — including Base Color, Normal, Height, Roughness, and Metalness — using chained decomposition, unified multi-modal prediction, and efficient single-step diffusion inference for controllable and scalable results.',
    'zh-CN':
      '将单一纹理转换为完整的 PBR 贴图集——包括基础颜色、法线、高度、粗糙度和金属度——使用链式分解、统一多模态预测和高效的单步扩散推理，实现可控且可扩展的结果。'
  },
  'customers.detail.ubisoft-chord.topic-4.block.6.heading': {
    en: 'Stage 3 — Material Upscaling',
    'zh-CN': '阶段三 — 材质放大'
  },
  'customers.detail.ubisoft-chord.topic-4.block.7': {
    en: 'Since CHORD operates optimally at 1024 resolution, the third stage applies industrial-grade PBR upscaling. All channels are upscaled by 2x or 4x to produce 2K and 4K texture assets for real-time game production.',
    'zh-CN':
      '由于 CHORD 在 1024 分辨率下运行最佳，第三阶段应用工业级 PBR 放大。所有通道放大 2 倍或 4 倍，以生成用于实时游戏制作的 2K 和 4K 纹理资产。'
  },
  'customers.detail.ubisoft-chord.topic-4.block.8': {
    en: 'This complete pipeline enables artists to rapidly iterate on ideas and mix and match AI-generated outputs within their existing workflows, lowering the barrier to industrial-grade PBR material creation.',
    'zh-CN':
      '这条完整的流水线使艺术家能够快速迭代创意，在现有工作流中混合搭配 AI 生成的输出，降低了工业级 PBR 材质创建的门槛。'
  },
  // Topic 5: How to Try
  'customers.detail.ubisoft-chord.topic-5.label': {
    en: 'TRY IT',
    'zh-CN': '试用'
  },
  'customers.detail.ubisoft-chord.topic-5.title': {
    en: 'How to Try CHORD in ComfyUI',
    'zh-CN': '如何在 ComfyUI 中试用 CHORD'
  },
  'customers.detail.ubisoft-chord.topic-5.block.0': {
    en: 'Ubisoft has open-sourced the CHORD model weights, ComfyUI custom nodes, and example workflows covering the texture image generation stage and the image-to-material estimation stage of the pipeline.',
    'zh-CN':
      '育碧开源了 CHORD 模型权重、ComfyUI 自定义节点和示例工作流，涵盖流水线中的纹理图像生成阶段和图像到材质估算阶段。'
  },
  'customers.detail.ubisoft-chord.topic-5.block.1.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/workflow.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/workflow.webp'
  },
  'customers.detail.ubisoft-chord.topic-5.block.1.alt': {
    en: 'CHORD example workflow in ComfyUI',
    'zh-CN': 'ComfyUI 中的 CHORD 示例工作流'
  },
  'customers.detail.ubisoft-chord.topic-5.block.1.caption': {
    en: 'The CHORD example workflow in ComfyUI for end-to-end PBR material generation.',
    'zh-CN': 'ComfyUI 中端到端 PBR 材质生成的 CHORD 示例工作流。'
  },
  'customers.detail.ubisoft-chord.topic-5.block.2.ol': {
    en: 'Install or update ComfyUI to the latest version\nInstall the CHORD ComfyUI custom node from Ubisoft\nDownload the CHORD model and place it in ./ComfyUI/models/checkpoints\nLoad the CHORD example workflow in ComfyUI',
    'zh-CN':
      '安装或更新 ComfyUI 至最新版本\n从育碧安装 CHORD ComfyUI 自定义节点\n下载 CHORD 模型并放置在 ./ComfyUI/models/checkpoints 目录\n在 ComfyUI 中加载 CHORD 示例工作流'
  },
  'customers.detail.ubisoft-chord.topic-5.block.3': {
    en: 'You can switch the texture image generation model to any other image model, and use the workflow modules for each stage separately.',
    'zh-CN':
      '您可以将纹理图像生成模型替换为任何其他图像模型，也可以单独使用每个阶段的工作流模块。'
  },
  // Topic 6: Example Outputs
  'customers.detail.ubisoft-chord.topic-6.label': {
    en: 'RESULTS',
    'zh-CN': '成果'
  },
  'customers.detail.ubisoft-chord.topic-6.title': {
    en: 'Example Outputs',
    'zh-CN': '输出示例'
  },
  'customers.detail.ubisoft-chord.topic-6.block.0.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/example1.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/example1.webp'
  },
  'customers.detail.ubisoft-chord.topic-6.block.0.alt': {
    en: 'CHORD PBR material example output 1',
    'zh-CN': 'CHORD PBR 材质输出示例 1'
  },
  'customers.detail.ubisoft-chord.topic-6.block.0.caption': {
    en: 'Generated PBR material set showing Base Color, Normal, Height, Roughness, and Metalness maps.',
    'zh-CN': '生成的 PBR 材质集，展示基础颜色、法线、高度、粗糙度和金属度贴图。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.1.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/example2.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/example2.webp'
  },
  'customers.detail.ubisoft-chord.topic-6.block.1.alt': {
    en: 'CHORD PBR material example output 2',
    'zh-CN': 'CHORD PBR 材质输出示例 2'
  },
  'customers.detail.ubisoft-chord.topic-6.block.1.caption': {
    en: 'Another generated PBR material set demonstrating the variety of textures achievable with CHORD.',
    'zh-CN': '另一组生成的 PBR 材质集，展示 CHORD 可实现的多样纹理效果。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.2.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/example3.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/example3.webp'
  },
  'customers.detail.ubisoft-chord.topic-6.block.2.alt': {
    en: 'CHORD PBR material example output 3',
    'zh-CN': 'CHORD PBR 材质输出示例 3'
  },
  'customers.detail.ubisoft-chord.topic-6.block.2.caption': {
    en: 'Material generation output with full PBR channel decomposition.',
    'zh-CN': '具有完整 PBR 通道分解的材质生成输出。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.3.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/example4.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/example4.webp'
  },
  'customers.detail.ubisoft-chord.topic-6.block.3.alt': {
    en: 'CHORD PBR material example output 4',
    'zh-CN': 'CHORD PBR 材质输出示例 4'
  },
  'customers.detail.ubisoft-chord.topic-6.block.3.caption': {
    en: 'High-quality PBR texture set generated from a single input texture.',
    'zh-CN': '从单一输入纹理生成的高质量 PBR 纹理集。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.4.src': {
    en: 'https://media.comfy.org/website/customers/ubisoft/example5.webp',
    'zh-CN': 'https://media.comfy.org/website/customers/ubisoft/example5.webp'
  },
  'customers.detail.ubisoft-chord.topic-6.block.4.alt': {
    en: 'CHORD PBR material example output 5',
    'zh-CN': 'CHORD PBR 材质输出示例 5'
  },
  'customers.detail.ubisoft-chord.topic-6.block.4.caption': {
    en: 'Final rendered PBR material demonstrating production-ready quality.',
    'zh-CN': '最终渲染的 PBR 材质，展示可用于生产的质量。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.5': {
    en: 'The release of CHORD demonstrates how ComfyUI has grown from a community-driven tool into a platform for real production. Studio users can build end-to-end pipelines from prompt or reference input through texture generation, material estimation, PBR upscaling, and finally export to DCC tools or game engines. Each stage can also operate independently and be embedded into an existing production system.',
    'zh-CN':
      'CHORD 的发布表明，ComfyUI 已从一个社区驱动的工具成长为一个真正的生产平台。工作室用户可以构建端到端流水线，从提示或参考输入到纹理生成、材质估算、PBR 放大，最终导出到 DCC 工具或游戏引擎。每个阶段也可以独立运行并嵌入现有的生产系统中。'
  },
  'customers.detail.ubisoft-chord.topic-6.block.6.label': {
    en: 'AUTHOR',
    'zh-CN': '作者'
  },
  'customers.detail.ubisoft-chord.topic-6.block.6.name': {
    en: 'Jo Zhang',
    'zh-CN': 'Jo Zhang'
  },
  'customers.detail.ubisoft-chord.topic-6.block.6.role': {
    en: 'ComfyUI Blog',
    'zh-CN': 'ComfyUI 博客'
  },
  'customers.detail.ubisoft-chord.topic-6.block.6.name2': {
    en: 'Daxiong (Lin)',
    'zh-CN': 'Daxiong (Lin)'
  },
  'customers.detail.ubisoft-chord.topic-6.block.6.role2': {
    en: 'ComfyUI Blog',
    'zh-CN': 'ComfyUI 博客'
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
  'contact.form.firstName': {
    en: 'First name',
    'zh-CN': '名'
  },
  'contact.form.lastName': {
    en: 'Last Name',
    'zh-CN': '姓'
  },
  'contact.form.company': {
    en: 'Company',
    'zh-CN': '公司'
  },
  'contact.form.phone': {
    en: 'Phone Number (optional)',
    'zh-CN': '电话号码（可选）'
  },
  'contact.form.packageQuestion': {
    en: 'Are you interested in learning more about our Enterprise Services, which start at $100K annually, our individual packages, or our team packages?',
    'zh-CN':
      '您是否有兴趣了解更多关于我们的企业服务（年费起价 $100K）、个人套餐或团队套餐？'
  },
  'contact.form.packageIndividual': {
    en: 'INDIVIDUAL',
    'zh-CN': '个人'
  },
  'contact.form.packageTeams': {
    en: 'TEAMS',
    'zh-CN': '团队'
  },
  'contact.form.packageEnterprise': {
    en: 'ENTERPRISE',
    'zh-CN': '企业'
  },
  'contact.form.usingComfy': {
    en: 'Are you /your team currently using Comfy?',
    'zh-CN': '您/您的团队目前是否在使用 Comfy？'
  },
  'contact.form.usingYesProduction': {
    en: 'Yes, in production',
    'zh-CN': '是，在生产环境中'
  },
  'contact.form.usingYesTesting': {
    en: 'Yes, testing / experimenting',
    'zh-CN': '是，测试/实验中'
  },
  'contact.form.usingNotYet': {
    en: 'Not yet, evaluating',
    'zh-CN': '尚未使用，评估中'
  },
  'contact.form.usingOtherTools': {
    en: 'Not using Comfy yet, but using other GenAI tools',
    'zh-CN': '尚未使用 Comfy，但在使用其他 GenAI 工具'
  },
  'contact.form.lookingFor': {
    en: 'What are you looking for?',
    'zh-CN': '您在寻找什么？'
  },
  'contact.form.lookingForPlaceholder': {
    en: 'Tell us about your team needs, expected usage, or other specific requirements.',
    'zh-CN': '请告诉我们您的团队需求、预期使用情况或其他具体要求。'
  },
  'contact.form.submit': {
    en: 'SUBMIT',
    'zh-CN': '提交'
  },
  'contact.form.firstNamePlaceholder': {
    en: 'Jane',
    'zh-CN': 'Jane'
  },
  'contact.form.lastNamePlaceholder': {
    en: 'Smith',
    'zh-CN': 'Smith'
  },
  'contact.form.companyPlaceholder': {
    en: 'jane@acme.org',
    'zh-CN': 'jane@acme.org'
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
