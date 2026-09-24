import type { Locale, LocalizedText, TranslationKey } from './translations'
import { localize, t as shared } from './translations'

// The Hub's own copy. Every page on the site downloads the shared table, so
// copy for a section still behind a flag lives here instead and travels only
// with the Hub's own islands.
const hub = {
  'workshop.v2.meta.title': {
    en: 'Hub - Comfy',
    'zh-CN': 'Hub - Comfy'
  },
  'workshop.v2.meta.description': {
    en: 'Every model Comfy can run, and the workflows built on them.',
    'zh-CN': 'Comfy 可运行的全部模型，以及基于它们构建的工作流。'
  },
  'workshop.v2.eyebrow': { en: 'Hub', 'zh-CN': 'Hub' },
  'workshop.v2.back': { en: 'Back to hub', 'zh-CN': '返回 Hub' },
  'workshop.v2.searchShort': { en: 'Search', 'zh-CN': '搜索' },
  'workshop.v2.allOf': { en: 'All {kind}', 'zh-CN': '全部{kind}' },
  'workshop.v2.browseAll': {
    en: 'Browse all {n} {kind}',
    'zh-CN': '浏览全部 {n} 个{kind}'
  },
  'workshop.v2.heading': {
    en: 'What will you make next?',
    'zh-CN': '接下来你想创造什么？'
  },
  'workshop.v2.subtitle': {
    en: 'Models and the workflows built on them, by what you want to make.',
    'zh-CN': '按你想做的东西浏览模型、工作流和应用。'
  },
  'workshop.v2.kind.label': { en: 'Show', 'zh-CN': '显示' },
  'workshop.v2.kind.models': { en: 'Models', 'zh-CN': '模型' },
  'workshop.v2.kind.workflows': { en: 'Workflows', 'zh-CN': '工作流' },
  'workshop.v2.card.runsOn': {
    en: 'Runs on {model}',
    'zh-CN': '运行于 {model}'
  },
  'workshop.v2.card.ownEndpoint': {
    en: 'Own endpoint',
    'zh-CN': '需自建端点'
  },
  'workshop.v2.sort.label': { en: 'Sort', 'zh-CN': '排序' },
  'workshop.v2.sort.popular': { en: 'Most popular', 'zh-CN': '推荐' },
  'workshop.v2.sort.name': { en: 'Name A to Z', 'zh-CN': '名称 A 到 Z' },
  'workshop.v2.sort.newest': { en: 'Newest', 'zh-CN': '最新' },
  'workshop.v2.sort.narrowed': {
    en: 'Only {type} can be ordered this way',
    'zh-CN': '只有{type}支持这种排序'
  },
  'workshop.v2.showing': {
    en: 'Showing {shown} of {total}',
    'zh-CN': '显示 {shown} / {total}'
  },
  'workshop.v2.loadMore': { en: 'Show more', 'zh-CN': '显示更多' },
  'workshop.v2.empty': {
    en: 'Nothing here matches',
    'zh-CN': '没有同时满足这些条件的结果'
  },
  'workshop.v2.emptyHint': {
    en: 'Try fewer words, or another tab.',
    'zh-CN': '去掉一个筛选条件以扩大范围。'
  },
  'workshop.v2.clear': { en: 'Clear', 'zh-CN': '清除' },
  'workshop.v2.workflow.back': {
    en: 'Back to the Hub',
    'zh-CN': '返回 Hub'
  },
  'workshop.v2.workflow.runsOn': { en: 'Runs on', 'zh-CN': '运行于' },
  'workshop.v2.workflow.runsOnNote': {
    en: 'The models this workflow calls.',
    'zh-CN': '此工作流调用的模型。目录中收录的会附带链接。'
  },
  'workshop.v2.workflow.howItWorks': {
    en: 'How it works',
    'zh-CN': '工作方式'
  },
  'workshop.v2.workflow.perRun': {
    en: '{count} per run',
    'zh-CN': '每次运行 {count} 个'
  },
  'workshop.v2.workflow.details': { en: 'Details', 'zh-CN': '详情' },
  'workshop.v2.workflow.runCount': {
    en: '{count} run | {count} runs',
    'zh-CN': '{count} 次运行'
  },
  'workshop.v2.workflow.added': {
    en: 'Added {date}',
    'zh-CN': '添加于 {date}'
  },
  'workshop.v2.workflow.runsCloud': {
    en: 'Runs on Comfy Cloud',
    'zh-CN': '在 Comfy Cloud 上运行'
  },
  'workshop.v2.workflow.runsOwn': {
    en: 'Runs on a deployment of your own',
    'zh-CN': '在你自己的部署上运行'
  },
  'workshop.v2.workflow.download': {
    en: 'Download the JSON',
    'zh-CN': '下载 JSON'
  },
  'workshop.v2.workflow.tutorial': {
    en: 'Read the tutorial',
    'zh-CN': '查看教程'
  },
  'workshop.v2.workflow.openWeights': {
    en: 'Open weights',
    'zh-CN': '开放权重'
  },
  'workshop.v2.card.customNodes': {
    en: 'Custom nodes',
    'zh-CN': '自定义节点'
  },
  'workshop.v2.api.title': {
    en: 'Build with this workflow',
    'zh-CN': '用这个工作流开发'
  },
  'workshop.v2.api.leadCloud': {
    en: "Run the whole workflow through Comfy Cloud's API: upload your inputs, submit a job, and download the outputs.",
    'zh-CN':
      '通过 Comfy Cloud 的 API 运行整个工作流：上传输入、提交任务、下载输出。'
  },
  'workshop.v2.api.leadOwn': {
    en: 'Run this workflow on a Comfy API deployment of your own, with its models and custom nodes.',
    'zh-CN':
      '在你自己的 Comfy API 部署上运行此工作流，连同它的模型和自定义节点。'
  },
  'workshop.v2.api.noteCloud': {
    en: 'Needs a paid Cloud plan and available credits.',
    'zh-CN': '需要付费的 Cloud 方案和可用额度。'
  },
  'workshop.v2.api.noteOwn': {
    en: 'Deploy it first: set COMFY_BASE_URL to the address your deployment answers on.',
    'zh-CN': '先完成部署：将 COMFY_BASE_URL 设为你的部署地址。'
  },
  'workshop.v2.api.deployDocs': {
    en: 'Set up a Comfy API deployment',
    'zh-CN': '配置 Comfy API 部署'
  },
  'workshop.v2.api.setup': {
    en: 'Download {file}, put your input files beside your script, and set COMFY_API_KEY in the environment. The examples carry whatever the form holds now.',
    'zh-CN':
      '下载 {file}，把输入文件放在脚本旁边，并在环境中设置 COMFY_API_KEY。示例会带上表单当前的内容。'
  },
  'workshop.v2.api.localFiles': {
    en: 'Local input files',
    'zh-CN': '本地输入文件'
  },
  'workshop.v2.api.language': { en: 'Code language', 'zh-CN': '代码语言' },
  'workshop.v2.api.copy': { en: 'Copy snippet', 'zh-CN': '复制代码' },
  'workshop.v2.api.copied': { en: 'Copied', 'zh-CN': '已复制' },
  'workshop.v2.api.curlNote': {
    en: 'This submits once and reads the job. Poll the returned urls.self until it finishes, then fetch its outputs.',
    'zh-CN':
      '这段代码提交一次并读取任务。轮询返回的 urls.self 直到完成，再取回输出。'
  },
  'workshop.v2.api.downloadGraph': {
    en: 'Download the API graph',
    'zh-CN': '下载 API 节点图'
  },
  'workshop.v2.api.apiKey': { en: 'Get an API key', 'zh-CN': '获取 API 密钥' },
  'workshop.v2.api.docs': { en: 'API documentation', 'zh-CN': 'API 文档' },
  'workshop.v2.workflow.graph': { en: 'The graph', 'zh-CN': '节点图' },
  'workshop.v2.workflow.about': {
    en: 'About this workflow',
    'zh-CN': '关于此工作流'
  },
  'workshop.v2.workflow.graphNote': {
    en: 'See what it does before you open it in ComfyUI or download it.',
    'zh-CN': '在用 ComfyUI 打开或下载之前，先看看它做什么。'
  },
  'workshop.v2.workflow.graphAlt': {
    en: 'The nodes of this workflow and the links between them',
    'zh-CN': '此工作流的节点及其连接'
  },
  'workshop.v2.workflow.graphHint': {
    en: 'Read-only \u00b7 drag to pan',
    'zh-CN': '仅供查看 \u00b7 拖动平移'
  },
  'workshop.v2.workflow.graphLoading': {
    en: 'Loading the graph',
    'zh-CN': '正在加载节点图'
  },
  'workshop.v2.workflow.graphFailed': {
    en: 'The graph could not be loaded. The download still works.',
    'zh-CN': '节点图加载失败，下载仍然可用。'
  },
  'workshop.v2.workflow.zoomIn': { en: 'Zoom in', 'zh-CN': '放大' },
  'workshop.v2.workflow.zoomOut': { en: 'Zoom out', 'zh-CN': '缩小' },
  'workshop.v2.workflow.zoomReset': { en: 'Reset', 'zh-CN': '重置' },
  'workshop.v2.workflow.copyApi': {
    en: 'Copy to Comfy API',
    'zh-CN': '复制到 Comfy API'
  },
  'workshop.v2.workflow.copyApiNote': {
    en: 'Copies the workflow, its model and its custom nodes to your own Comfy API workspace, where you can deploy it.',
    'zh-CN':
      '将工作流及其模型和自定义节点复制到你自己的 Comfy API 工作区，你可以在那里部署它。'
  },
  'workshop.v2.workflow.openCloud': {
    en: 'Open in Comfy Cloud',
    'zh-CN': '在 Comfy Cloud 中打开'
  },
  'workshop.v2.workflow.openCloudNote': {
    en: 'Opens in your own Cloud account, ready to run and to edit.',
    'zh-CN': '在你自己的 Cloud 账户中打开，可直接运行和编辑。'
  },
  'workshop.v2.workflow.downloadNote': {
    en: 'The graph as a file, to open in ComfyUI on your own machine.',
    'zh-CN': '以文件形式下载该图，可在本机的 ComfyUI 中打开。'
  },
  'workshop.v2.workflow.tutorialNote': {
    en: 'A written walkthrough of what this graph does, step by step.',
    'zh-CN': '这张图的逐步图文讲解。'
  },
  'workshop.v2.workflow.tabRun': { en: 'Playground', 'zh-CN': '演练场' },
  'workshop.v2.workflow.tabAbout': { en: 'Details', 'zh-CN': '详情' },
  'workshop.v2.workflow.tabs': {
    en: 'Run this workflow, or look at how it is built',
    'zh-CN': '运行此工作流，或查看它的构成'
  },
  'workshop.v2.run.run': { en: 'Run workflow', 'zh-CN': '运行工作流' },
  'workshop.v2.run.cancel': { en: 'Cancel this run', 'zh-CN': '取消本次运行' },
  'workshop.v2.run.resume': {
    en: 'Pick the run back up',
    'zh-CN': '继续跟踪这次运行'
  },
  'workshop.v2.run.uploading': {
    en: 'Sending your files',
    'zh-CN': '正在上传你的文件'
  },
  'workshop.v2.run.sending': {
    en: 'Handing the workflow over',
    'zh-CN': '正在提交工作流'
  },
  'workshop.v2.run.reconnecting': {
    en: 'Finding your run again',
    'zh-CN': '正在重新连接你的运行'
  },
  'workshop.v2.run.queued': { en: 'Waiting its turn', 'zh-CN': '排队中' },
  'workshop.v2.run.waking': {
    en: 'Waking its server',
    'zh-CN': '正在唤醒服务器'
  },
  'workshop.v2.run.wakingHint': {
    en: 'The first run takes longer.',
    'zh-CN': '首次运行会慢一些。'
  },
  'workshop.v2.run.generating': { en: 'Generating…', 'zh-CN': '生成中…' },
  'workshop.v2.run.cancelled': {
    en: 'This run was cancelled before it finished.',
    'zh-CN': '这次运行在完成前已取消。'
  },
  'workshop.v2.run.runAgain': { en: 'Run it again', 'zh-CN': '重新运行' },
  'workshop.v2.run.failed': {
    en: 'The run failed. Keep your answers as they are and try again. If credits were spent without a result, contact support with the run ID.',
    'zh-CN':
      '运行失败。请保持当前填写内容后重试。若已扣除积分却没有结果，请携带运行 ID 联系支持。'
  },
  'workshop.v2.run.rejected': {
    en: 'Cloud would not accept this workflow. Check your answers before running it again.',
    'zh-CN': 'Cloud 未接受此工作流。请检查填写内容后再运行。'
  },
  'workshop.v2.run.blocked': {
    en: 'This workspace blocks one of the providers this workflow calls. A workspace owner can allow it in Cloud settings.',
    'zh-CN':
      '该工作区禁用了此工作流调用的某个提供方。工作区所有者可在 Cloud 设置中放行。'
  },
  'workshop.v2.run.unavailable': {
    en: 'Cloud cannot run this workflow right now. Try again in a few minutes.',
    'zh-CN': 'Cloud 目前无法运行此工作流，请几分钟后重试。'
  },
  'workshop.v2.run.expired': {
    en: 'Your session expired. Sign in again to run this workflow.',
    'zh-CN': '登录状态已过期。请重新登录后运行此工作流。'
  },
  'workshop.v2.workflow.factWhere': { en: 'Where', 'zh-CN': '运行位置' },
  'workshop.v2.workflow.factOutput': { en: 'Output', 'zh-CN': '输出' },
  'workshop.v2.workflow.factRuns': { en: 'Runs', 'zh-CN': '运行次数' },
  'workshop.v2.workflow.factWeights': { en: 'Weights', 'zh-CN': '权重' },
  'workshop.v2.workflow.factAuthor': { en: 'Author', 'zh-CN': '作者' },
  'workshop.v2.workflow.factAdded': { en: 'Added', 'zh-CN': '收录于' },
  'workshop.v2.workflow.related': {
    en: 'Workflows like this one',
    'zh-CN': '相似的工作流'
  },
  'workshop.v2.model.noRun': {
    en: 'This model cannot be run here yet.',
    'zh-CN': 'Router 尚未提供该模型可运行的操作。'
  },
  'workshop.v2.model.filter': { en: 'Filter by model', 'zh-CN': '按模型筛选' },
  'workshop.v2.model.allModels': { en: 'All models', 'zh-CN': '全部模型' },
  'workshop.v2.model.operations': { en: 'Operations', 'zh-CN': '操作' },
  'workshop.v2.model.operationsNote': {
    en: 'Pick what you want it to do.',
    'zh-CN':
      '注册表按操作逐条列出该模型。这里它们合并为一张卡片，操作是一个选项。'
  },
  'workshop.v2.model.openModel': {
    en: 'Open the model page',
    'zh-CN': '打开模型页面'
  },
  'workshop.v2.browseAllWorkflows': {
    en: 'Browse all workflows',
    'zh-CN': '浏览全部工作流'
  },
  'workshop.v2.model.workflows': {
    en: 'Made with this model',
    'zh-CN': '用此模型做的'
  },
  'workshop.v2.model.workflowsNote': {
    en: 'Workflows and apps that run on it.',
    'zh-CN': '基于它运行的工作流与应用。'
  }
} as const satisfies Record<string, LocalizedText>

export type HubKey = keyof typeof hub | TranslationKey

const own = (key: HubKey): key is keyof typeof hub => key in hub

export function tHub(key: HubKey, locale: Locale = 'en'): string {
  return own(key) ? localize(hub[key], locale) : shared(key, locale)
}

export const hubKeys = Object.keys(hub) as (keyof typeof hub)[]
