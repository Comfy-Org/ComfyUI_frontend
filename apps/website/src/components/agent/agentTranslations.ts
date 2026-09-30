import type { Locale, LocalizedText } from '../../i18n/translations'

const translations = {
  'agentPage.meta.title': {
    en: 'Comfy Agent — The first agent for craft',
    'zh-CN': 'Comfy Agent — 为创作而生的第一个智能体'
  },
  'agentPage.meta.description': {
    en: 'Comfy Agent is available now in Comfy Cloud, with local support coming soon. It builds, runs, and reviews workflows while you edit the canvas.',
    'zh-CN':
      'Comfy Agent 现已在 Comfy Cloud 上线，本地支持即将推出。你在画布上编辑的同时，它负责构建、运行并检查工作流。'
  },
  'agentPage.hero.titleLine1': { en: 'Comfy Agent:', 'zh-CN': 'Comfy Agent：' },
  'agentPage.hero.titleLine2': {
    en: 'The first agent for craft',
    'zh-CN': '为与你并肩创作而生'
  },
  'agentPage.hero.subtitle': {
    en: 'Describe what you want right inside ComfyUI. It plans, builds and runs workflows. Editing the canvas while you work, it crafts side by side with you.',
    'zh-CN':
      '请直接在 ComfyUI 里描述你的想法，Comfy Agent 会规划、构建并运行工作流，还能与你同时编辑画布，互不干扰。'
  },
  'agentPage.workflow.regionLabel': {
    en: 'Comfy Agent building workflows',
    'zh-CN': 'Comfy Agent 构建工作流'
  },
  'agentPage.workflow.userCursorLabel': {
    en: 'User collaborating with the agent',
    'zh-CN': '用户与智能体协作'
  },
  'agentPage.cta': { en: 'Try Comfy Agent', 'zh-CN': '试用 Comfy Agent' },
  'agentPage.capabilities.eyebrow': { en: 'The agent', 'zh-CN': 'Agent' },
  'agentPage.capabilities.heading': {
    en: 'Your teammate inside ComfyUI',
    'zh-CN': 'ComfyUI 界面里的队友'
  },
  'agentPage.capabilities.1.title': {
    en: 'Workflow Master',
    'zh-CN': '工作流专家'
  },
  'agentPage.capabilities.1.alt': {
    en: 'A collection of creative images and community workflows',
    'zh-CN': '一组创意图像与社区工作流'
  },
  'agentPage.capabilities.1.bullet.1': {
    en: 'Curated knowledge for model recommendations and node selection.',
    'zh-CN': '精选知识库，用于推荐模型和选择节点'
  },
  'agentPage.capabilities.1.bullet.2': {
    en: 'Builds, edits, explains, and debugs workflows',
    'zh-CN': '构建、编辑、讲解并调试工作流'
  },
  'agentPage.capabilities.1.bullet.3': {
    en: 'Runs generations with your permission',
    'zh-CN': '在你的许可下运行生成任务'
  },
  'agentPage.capabilities.2.title': {
    en: 'Real-time Collaboration',
    'zh-CN': '实时协作'
  },
  'agentPage.capabilities.2.alt': {
    en: 'A user and Comfy Agent editing a shared node workflow',
    'zh-CN': '用户与 Comfy Agent 共同编辑节点工作流'
  },
  'agentPage.capabilities.2.bullet.1': {
    en: 'Edits the canvas together with you, in real time',
    'zh-CN': '与你实时共同编辑画布'
  },
  'agentPage.capabilities.2.bullet.2': {
    en: 'References assets or nodes directly from the graph or library',
    'zh-CN': '直接从画布或素材库中引用资产或节点'
  },
  'agentPage.capabilities.2.bullet.3': {
    en: 'Understands assets visually. It sees what you see',
    'zh-CN': '能够从视觉上理解素材，它看到的就是你看到的'
  },
  'agentPage.capabilities.3.title': {
    en: 'Vibe Crafting',
    'zh-CN': 'Vibe Crafting'
  },
  'agentPage.capabilities.3.alt': {
    en: 'Headphone workflow with connected 3D camera and color controls',
    'zh-CN': '连接了 3D 相机和色彩控制的耳机工作流'
  },
  'agentPage.capabilities.3.bullet.1': {
    en: 'Local custom-node support is coming soon',
    'zh-CN': '本地自定义节点支持即将推出'
  },
  'agentPage.capabilities.3.bullet.2': {
    en: 'Creates your own skills, or uses public preset skills',
    'zh-CN': '创建你自己的技能，或使用公开的预设技能'
  },
  'agentPage.capabilities.3.bullet.3': {
    en: 'Runs up to 5 agent chats in parallel, with full history',
    'zh-CN': '最多可并行运行 5 个智能体对话，并保留完整历史记录'
  },
  'agentPage.usecases.eyebrow': { en: 'Use cases', 'zh-CN': '应用场景' },
  'agentPage.usecases.heading': {
    en: 'One canvas, every industry',
    'zh-CN': '一块画布，服务各行各业'
  },
  'agentPage.usecases.subheading': {
    en: 'Studios run these workflows in production today, on Comfy.',
    'zh-CN': '各大工作室如今已在 Comfy 上将这些工作流用于实际生产。'
  },
  'agentPage.usecases.featured.ariaLabel': {
    en: 'Animation, from story to screen — by 852話 | Andidea',
    'zh-CN': '动画：从故事到银幕 — 作者：852話 | Andidea'
  },
  'agentPage.usecases.featured.byline': {
    en: 'By 852話 | Andidea',
    'zh-CN': '作者：852話 | Andidea'
  },
  'agentPage.usecases.featured.title': {
    en: 'Animation, from story to screen',
    'zh-CN': '动画：从故事到银幕'
  },
  'agentPage.usecases.featured.description': {
    en: 'Bring characters and imagined worlds into the same creative workflow. The agent helps shape the look, explore a scene, and compare generation results. Made by one artist in 100 hours with Comfy Agent.',
    'zh-CN':
      '把角色和想象中的世界带入同一条创作流程。智能体帮助塑造画面风格、探索场景并比较生成结果。由一位艺术家使用 Comfy Agent，在 100 小时内完成。'
  },
  'agentPage.usecases.featured.tag': { en: 'Animation', 'zh-CN': '动画' },
  'agentPage.usecases.featured.cta': {
    en: "See how it's made",
    'zh-CN': '了解制作过程'
  },
  'agentPage.usecases.brief.1.byline': {
    en: 'By Doug Hogan',
    'zh-CN': '作者：Doug Hogan'
  },
  'agentPage.usecases.brief.1.title': {
    en: 'VFX: isolate, mask, and refine',
    'zh-CN': 'VFX特效：抠像、蒙版与精修'
  },
  'agentPage.usecases.brief.1.description': {
    en: 'Take a shot from image to compositing passes. Isolate the subject, generate masks, and work with depth and normals in one workflow.',
    'zh-CN':
      '把一个镜头从图像一路做到合成通道。在同一条工作流中抠出主体、生成蒙版，并处理深度与法线贴图。'
  },
  'agentPage.usecases.brief.1.tag': { en: 'VFX', 'zh-CN': '视效' },
  'agentPage.usecases.brief.1.ariaLabel': {
    en: 'VFX: isolate, mask, and refine — by Doug Hogan',
    'zh-CN': 'VFX特效：抠像、蒙版与精修 — 作者：Doug Hogan'
  },
  'agentPage.usecases.brief.2.byline': {
    en: 'By shanef3d',
    'zh-CN': '作者：shanef3d'
  },
  'agentPage.usecases.brief.2.title': {
    en: 'Product imagery, from brief to campaign',
    'zh-CN': '高端广告：从灵感到完整营销方案'
  },
  'agentPage.usecases.brief.2.description': {
    en: 'Build a product scene with precision in Blender. Explore rendering, lighting, materials, and composition, then refine the details on the canvas.',
    'zh-CN':
      '在 Blender 中精确搭建产品场景，探索渲染、灯光、材质与构图，再到画布上精修细节。'
  },
  'agentPage.usecases.brief.2.tag': { en: 'Marketing', 'zh-CN': '营销' },
  'agentPage.usecases.brief.2.ariaLabel': {
    en: 'Product imagery, from brief to campaign — by shanef3d',
    'zh-CN': '高端广告：从灵感到完整营销方案 — 作者：shanef3d'
  },
  'agentPage.difference.headingLine1': {
    en: 'Every result is a workflow, not',
    'zh-CN': '每一个结果都是一条工作流，'
  },
  'agentPage.difference.headingLine2': {
    en: 'just an asset.',
    'zh-CN': '而不仅仅是一个素材文件。'
  },
  'agentPage.difference.body': {
    en: 'Everywhere else, you get the output file. With ComfyUI, Comfy Agent hands you the pipeline that made it: every node, seed, sampler, and model. Reuse it at any time.',
    'zh-CN':
      '在别处，你只能拿到最终的输出文件。而在 ComfyUI 里，Comfy Agent 会把产出它的整条流水线交给你：每一个节点、种子、采样器和模型，随时可以复用。'
  },
  'agentPage.start.heading': {
    en: 'Where to start from',
    'zh-CN': '从哪里开始'
  },
  'agentPage.start.subheading': {
    en: 'Available on Comfy Cloud now, with local support coming soon.',
    'zh-CN': '现已支持 Comfy Cloud，本地支持即将推出。'
  },
  'agentPage.start.cloud.heading': {
    en: 'Comfy Cloud',
    'zh-CN': 'Comfy Cloud'
  },
  'agentPage.start.cloud.body': {
    en: 'Try on Comfy Cloud to get free tokens. No setup needed. The agent is there when you log in. You can start with all your saved workflows and assets.',
    'zh-CN':
      '在 Comfy Cloud 上领取免费对话次数试用，无需任何配置。登录后智能体就在那里，你可以直接用上已保存的所有工作流和素材。'
  },
  'agentPage.start.cloud.noAccount': {
    en: 'No account yet?',
    'zh-CN': '还没有账号？'
  },
  'agentPage.start.cloud.cta': { en: 'Sign up for free', 'zh-CN': '免费注册' },
  'agentPage.start.local.heading': {
    en: 'Running ComfyUI locally',
    'zh-CN': '在本地运行 ComfyUI'
  },
  'agentPage.start.local.body': {
    en: 'Agent on local ComfyUI is coming soon. Your GPU, your models, your custom nodes. The agent walks you through setup, picks models that fit your hardware, customizes your environment, and vibe codes all the tools you need.',
    'zh-CN':
      '本地 ComfyUI 上的智能体即将上线。你的 GPU、你的模型、你的自定义节点。智能体会带你完成配置、挑选适合你硬件的模型、定制你的环境，并为你即兴编写所需的所有工具。'
  },
  'agentPage.start.local.cta': {
    en: 'Let me know when available',
    'zh-CN': '上线时通知我'
  },
  'agentPage.comparison.heading': {
    en: 'Which one should I use?',
    'zh-CN': '如何选择'
  },
  'agentPage.comparison.featureSr': { en: 'Feature', 'zh-CN': '功能' },
  'agentPage.comparison.colAgent': {
    en: 'Comfy Agent',
    'zh-CN': 'Comfy Agent'
  },
  'agentPage.comparison.colMcp': { en: 'Comfy MCP', 'zh-CN': 'Comfy MCP' },
  'agentPage.comparison.1.label': { en: 'What is it', 'zh-CN': '这是什么' },
  'agentPage.comparison.1.agent.1': {
    en: 'The agent built into the Comfy app.',
    'zh-CN': '内置于 Comfy 应用中的智能体。'
  },
  'agentPage.comparison.1.agent.2': {
    en: 'Chat and build on the canvas together.',
    'zh-CN': '边聊天边在画布上一起构建。'
  },
  'agentPage.comparison.1.agent.3': {
    en: 'Curated knowledge and native tools to operate ComfyUI.',
    'zh-CN': '精选知识库与原生工具，用于操作 ComfyUI。'
  },
  'agentPage.comparison.1.mcp.1': {
    en: 'Your own agent, connected to ComfyUI.',
    'zh-CN': '你自己的智能体，连接到 ComfyUI。'
  },
  'agentPage.comparison.2.label': { en: 'Best for', 'zh-CN': '适合谁' },
  'agentPage.comparison.2.agent.1': {
    en: 'Both beginners to advanced builders.',
    'zh-CN': '从新手到高级创作者都适用。'
  },
  'agentPage.comparison.2.agent.2': {
    en: 'See the agent build and edit workflows real time',
    'zh-CN': '实时看着智能体构建和编辑工作流'
  },
  'agentPage.comparison.2.agent.3': {
    en: 'Ask about existing workflows',
    'zh-CN': '可以询问已有的工作流'
  },
  'agentPage.comparison.2.mcp.1': {
    en: 'People who already work in another agent.',
    'zh-CN': '已经在其他智能体中工作的人。'
  },
  'agentPage.comparison.3.label': { en: 'Requires', 'zh-CN': '所需条件' },
  'agentPage.comparison.3.agent.1': {
    en: 'Ready-to-go agent integration.',
    'zh-CN': '开箱即用的智能体集成。'
  },
  'agentPage.comparison.3.agent.2': {
    en: 'Try for free. Uses your existing Comfy Credits.',
    'zh-CN': '免费试用，使用你现有的 Comfy Credits。'
  },
  'agentPage.comparison.3.mcp.1': {
    en: 'Your own agent.',
    'zh-CN': '你自己的智能体。'
  },
  'agentPage.comparison.3.mcp.2': {
    en: 'Comfy Cloud or a local ComfyUI setup.',
    'zh-CN': 'Comfy Cloud 或本地 ComfyUI 环境。'
  },
  'agentPage.comparison.4.label': { en: 'Runs on', 'zh-CN': '运行环境' },
  'agentPage.comparison.4.agent.1': {
    en: 'Comfy Cloud GPUs now; local GPUs coming soon',
    'zh-CN': '现支持 Comfy Cloud GPU；本地 GPU 即将推出'
  },
  'agentPage.comparison.4.mcp.1': {
    en: 'Comfy Cloud GPUs, or your local GPU',
    'zh-CN': 'Comfy Cloud 的 GPU，或你本地的 GPU'
  },
  'agentPage.comparison.5.label': { en: 'Custom nodes', 'zh-CN': '自定义节点' },
  'agentPage.comparison.5.agent.1': {
    en: 'Cloud-supported nodes on Cloud.',
    'zh-CN': '云端支持的节点可在 Cloud 上使用。'
  },
  'agentPage.comparison.5.agent.2': {
    en: 'Any local node when local support launches.',
    'zh-CN': '本地支持推出后可使用任意本地节点。'
  },
  'agentPage.comparison.5.mcp.1': {
    en: 'Cloud-supported on Cloud.',
    'zh-CN': '云端支持的节点可在 Cloud 上使用。'
  },
  'agentPage.comparison.5.mcp.2': {
    en: 'Any node on local.',
    'zh-CN': '本地可使用任意节点。'
  },
  'agentPage.faq.heading': { en: 'Q&A', 'zh-CN': '问答' },
  'agentPage.faq.1.q': {
    en: 'How do people usually use it?',
    'zh-CN': '大家通常怎么用它？'
  },
  'agentPage.faq.1.a': {
    en: 'Key capabilities:\n- Builds, edits, reads, runs, and debugs workflows, running a task end to end\n- Builds in real time while you keep editing the graph\n- Curated knowledge for model recommendations and parameter tips\n- References assets and nodes, dragged straight from the asset library\n- Visual understanding of assets anywhere in Comfy\n- Creates, saves, and deletes skills\n- Up to 5 agent chats in parallel, with full chat history\n\nComing soon:\n- Local support, including creating custom nodes and model/node downloads\n- GPU detection and workflow recommendations\n- LLM model selection',
    'zh-CN':
      '核心能力：\n- 构建、编辑、读取、运行并调试工作流，端到端完成一项任务\n- 在你继续编辑图表的同时实时构建\n- 精选知识库，用于模型推荐和参数建议\n- 引用素材和节点，直接从素材库拖入\n- 在 Comfy 中的任何位置对素材进行视觉理解\n- 创建、保存并删除技能\n- 最多可并行运行 5 个智能体对话，并保留完整聊天记录\n\n即将上线：\n- 本地支持，包括创建自定义节点和下载模型/节点\n- GPU 检测与工作流推荐\n- LLM 模型选择'
  },
  'agentPage.faq.2.q': {
    en: 'What model powers it?',
    'zh-CN': '它底层是什么语言模型？'
  },
  'agentPage.faq.2.a': {
    en: 'Frontier models by Anthropic. We always provide the strongest we can offer for the job. Choices for switching LLMs is on the way. What they lack alone, the agent adds: full context of your workflow, your errors, and Comfy itself.',
    'zh-CN':
      '由 Anthropic 的前沿模型驱动。我们始终为这项任务提供能给出的最强模型，切换 LLM 的选项也正在路上。单靠模型本身欠缺的部分，由智能体来补足：你工作流的完整上下文、你的错误信息，以及 Comfy 本身的知识。'
  },
  'agentPage.faq.3.q': {
    en: 'Do you plan to support local LLMs?',
    'zh-CN': '你们计划支持本地 LLM 吗？'
  },
  'agentPage.faq.3.a': {
    en: 'Yes. We have local LLM support in the roadmap. ComfyUI can do the memory management for both the image / video models and the LLMs at the same time.',
    'zh-CN':
      '会的。本地 LLM 支持已经在路线图上。ComfyUI 可以同时管理图像/视频模型和 LLM 的显存。'
  },
  'agentPage.faq.4.q': {
    en: 'Does it work with my existing workflows?',
    'zh-CN': '它能用于我已有的工作流吗？'
  },
  'agentPage.faq.4.a': {
    en: 'Yes. Open any workflow and the agent reads the whole graph. Describe what you want to change, or point at an error, and keep editing together. You can also reference another workflow in the chat.',
    'zh-CN':
      '可以。打开任意工作流，智能体都会读取整个图表。描述你想要更改的内容，或指出一个错误，就可以一起继续编辑。你也可以在对话中引用另一条工作流。'
  },
  'agentPage.faq.5.q': {
    en: 'Will it run generations without asking?',
    'zh-CN': '它会不经询问就运行生成任务吗？'
  },
  'agentPage.faq.5.a': {
    en: 'You decide. By default the agent will ask your confirmation to run any generations. In auto mode it runs and iterates on its own until the result is ready.',
    'zh-CN':
      '由你决定。默认情况下，智能体在运行任何生成任务前都会先征求你的确认。在自动模式下，它会自行运行并迭代，直到结果就绪。'
  },
  'agentPage.faq.6.q': { en: 'What does it cost?', 'zh-CN': '它的费用如何？' },
  'agentPage.faq.6.a': {
    en: 'Today, we provide some free tokens for new users to try the chat.\n\nNormally, Comfy Agent consumes the Comfy Credits for LLM tokens. Your existing credits can apply to it already. See the pricing page for plans and usage details.',
    'zh-CN':
      '目前，我们会为新用户提供一些免费代币，用于试用对话功能。\n\n正常情况下，Comfy Agent 会消耗 Comfy Credits 来支付 LLM token 费用。你现有的积分即可直接用于它。具体方案和用量详情请查看定价页面。'
  },
  'agentPage.faq.6.linkLabel': { en: 'See pricing', 'zh-CN': '查看定价' },
  'agentPage.faq.7.q': {
    en: 'Can it run locally?',
    'zh-CN': '它能在本地运行吗？'
  },
  'agentPage.faq.7.a': {
    en: 'Local support is coming soon. The same agent will run in your local ComfyUI, working on workflows based on your GPU, your models, and your custom nodes. It will walk you through setup, pick models that fit your hardware, and build the tools you need.',
    'zh-CN':
      '本地支持即将推出。同一个智能体将在你的本地 ComfyUI 中运行，基于你的 GPU、模型和自定义节点来处理工作流。它会带你完成配置、挑选适合你硬件的模型，并构建你需要的工具。'
  },
  'agentPage.faq.8.q': {
    en: 'Does the agent replace the canvas?',
    'zh-CN': '智能体会取代画布吗？'
  },
  'agentPage.faq.8.a': {
    en: 'No. The canvas stays at the center. The agent builds with you on it, every control stays where it is, and you keep the editable workflow behind every result.',
    'zh-CN':
      '不会。画布始终是核心。智能体和你一起在画布上构建，所有控制项都保留在原处，每一个结果背后都留有可编辑的工作流。'
  },
  'agentPage.faq.9.q': {
    en: 'How is this different from asking ChatGPT?',
    'zh-CN': '这和直接问 ChatGPT 有什么不同？'
  },
  'agentPage.faq.9.a': {
    en: 'ChatGPT only gives you instructions to follow. Comfy Agent works directly on your canvas. It sees your workflow and your errors, answers your questions, and also builds and runs the graph, and reviews the output. It doesn’t just see the entire setup, but also execute tasks for you.',
    'zh-CN':
      'ChatGPT 只能给你一份需要自己照做的说明。Comfy Agent 则直接在你的画布上工作：它能看到你的工作流和错误信息，回答你的问题，同时还会构建并运行图表、检查输出结果。它不仅能看到整套配置，还能替你把任务真正执行出来。'
  }
} satisfies Record<string, LocalizedText>

type AgentTranslationKey = keyof typeof translations

export function tAgent(key: AgentTranslationKey, locale: Locale): string {
  const entry: LocalizedText = translations[key]
  return entry[locale] ?? entry.en
}
