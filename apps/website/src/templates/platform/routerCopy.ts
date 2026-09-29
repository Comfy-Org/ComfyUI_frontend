import type { FaqItem } from '../../components/common/FAQSection.vue'
import type { NamedValues } from '../../i18n/interpolate'
import { interpolate } from '../../i18n/interpolate'
import type { Locale } from '../../i18n/translations'

type LocalizedText = { readonly en: string } & Partial<Record<Locale, string>>

// The Router landing page's copy lives with the page rather than in the
// sitewide translations chunk, which every route pays for.
const copy = {
  'platform.router.badge.label': {
    en: 'ROUTER',
    'zh-CN': 'ROUTER'
  },
  'platform.router.cta.getApiKey': {
    en: 'Get an API Key',
    'zh-CN': '获取 API 密钥'
  },
  'platform.router.cta.browseModels': {
    en: 'Browse Models',
    'zh-CN': '浏览模型'
  },
  'platform.router.migrate.title': {
    en: 'Migrate to Comfy Router with your agent',
    'zh-CN': '用你的智能体迁移到 Comfy Router'
  },
  'platform.router.migrate.subtitle': {
    en: "Help me migrate this project's existing model integration to Comfy Router.",
    'zh-CN': '帮我把这个项目现有的模型集成迁移到 Comfy Router。'
  },
  'platform.router.migrate.copyPrompt': {
    en: 'COPY PROMPT',
    'zh-CN': '复制提示词'
  },
  'platform.router.migrate.copied': { en: 'COPIED', 'zh-CN': '已复制' },
  'platform.router.proof.caption': {
    en: 'The same models 3M+ ComfyUI users already use, now behind one API.',
    'zh-CN': '300 万+ ComfyUI 用户正在使用的同一批模型，现在都在一个 API 之后。'
  },
  'platform.router.code.heading': {
    en: 'Choose the provider in one line.',
    'zh-CN': '一行代码，选择供应商。'
  },
  'platform.router.code.supporting': {
    en: 'Change the provider. Keep everything else.',
    'zh-CN': '更换供应商，其余代码不变。'
  },
  'platform.router.code.providerLabel': {
    en: 'Provider',
    'zh-CN': '供应商'
  },
  'platform.router.video.alt': {
    en: 'Comfy Router explained: one API, your choice of provider for every job',
    'zh-CN': 'Comfy Router 介绍：一个 API，每个任务都由你选择供应商'
  },
  'platform.router.section1.heading': {
    en: 'Integrate once. Add models as you go.',
    'zh-CN': '集成一次，模型随时添加。'
  },
  'platform.router.section1.body': {
    en: 'Every provider you add brings another SDK, another key, another job lifecycle, and another set of errors. Build that once through Comfy Router, and the next model is one line.',
    'zh-CN':
      '每新增一个供应商，就多一套 SDK、一个密钥、一套任务生命周期和一组错误处理。通过 Comfy Router 一次性搭建好这些，之后每加一个模型只需一行代码。'
  },
  'platform.router.section2.heading': {
    en: 'Better availability. Better prices. No subscription.',
    'zh-CN': '更高可用性。更优价格。无需订阅。'
  },
  'platform.router.section2.body': {
    en: 'Run the same model on fal, Runware, or Wavespeed, and switch with one parameter when one is rate limited or another is cheaper. Comfy never switches the route for you, and every job reports the provider that ran it.',
    'zh-CN':
      '同一个模型可在 fal、Runware 或 Wavespeed 上运行，当某个供应商被限流或另一个更便宜时，只需改一个参数即可切换。Comfy 绝不会替你切换路由，每个任务都会报告实际运行它的供应商。'
  },
  'platform.router.section2.providersLabel': {
    en: 'Supported providers',
    'zh-CN': '受支持的供应商'
  },
  'platform.router.section2.providers': {
    en: 'fal · Runware · Wavespeed',
    'zh-CN': 'fal · Runware · Wavespeed'
  },
  'platform.router.coverage.heading': {
    en: 'Same models. More places to run them.',
    'zh-CN': '同样的模型，更多运行选择。'
  },
  'platform.router.coverage.body': {
    en: "Every model runs on Comfy by default, you can set `model_provider` to run them on another provider. We're starting with the highest-traffic models, more models and providers are coming soon.",
    'zh-CN':
      '每个模型默认在 Comfy 上运行，你可以设置 `model_provider` 让它们在其他供应商上运行。我们从流量最高的模型开始，更多模型和供应商即将上线。'
  },
  'platform.router.coverage.modelColumn': {
    en: 'MODEL',
    'zh-CN': '模型'
  },
  'platform.router.coverage.moreModels': {
    en: '+{count} more models',
    'zh-CN': '另有 {count} 个模型'
  },
  'platform.router.coverage.moreModelsSuffix': {
    en: 'run on Comfy',
    'zh-CN': '在 Comfy 上运行'
  },
  'platform.router.coverage.browseAll': {
    en: 'Browse all {count} models',
    'zh-CN': '浏览全部 {count} 个模型'
  },
  'platform.router.coverage.served': {
    en: 'Served',
    'zh-CN': '可提供服务'
  },
  'platform.router.coverage.notServed': {
    en: 'Not served',
    'zh-CN': '不提供服务'
  },
  'platform.router.section3.heading': {
    en: 'Hit a concurrency limit? Queue the job.',
    'zh-CN': '遇到并发限制？把任务排入队列。'
  },
  'platform.router.section3.body': {
    en: 'And let Comfy handle the wait. Use `submit` to get a request ID immediately. The job runs when a slot opens, and you can use the ID to check progress and retrieve the result. Or use `subscribe` to submit the job and wait until it completes.',
    'zh-CN':
      '让 Comfy 替你等待。使用 `submit` 立即获得请求 ID。任务会在有空闲槽位时运行，你可以用这个 ID 查询进度并获取结果。或者使用 `subscribe` 提交任务并等待其完成。'
  },
  'platform.router.roadmap.eyebrow': {
    en: 'Roadmap',
    'zh-CN': '路线图'
  },
  'platform.router.roadmap.heading': {
    en: 'Coming soon to the same API.',
    'zh-CN': '即将登陆同一个 API。'
  },
  'platform.router.roadmap.subtitle': {
    en: 'Provider choice is the foundation. Everything below arrives on the integration you ship today.',
    'zh-CN': '供应商选择是基础。以下所有能力都会加入到你今天集成的这个 API 上。'
  },
  'platform.router.roadmap.1.title': {
    en: 'Comfy workflows',
    'zh-CN': 'Comfy 工作流'
  },
  'platform.router.roadmap.1.description': {
    en: 'Run a ComfyUI workflow from the same SDK. Just like models.',
    'zh-CN': '用同一个 SDK 运行 ComfyUI 工作流，就像调用模型一样。'
  },
  'platform.router.roadmap.1.details': {
    en: 'Workflows run today through the Comfy API on the Developer Platform. Router support brings them behind the same key, the same job surface, and the same credits as every model call, so a pipeline you build in ComfyUI ships to your app as one request.',
    'zh-CN':
      '工作流目前通过开发者平台上的 Comfy API 运行。Router 支持将把它们纳入同一个密钥、同一个任务接口和同一份积分，你在 ComfyUI 中构建的流水线只需一次请求即可接入你的应用。'
  },
  'platform.router.roadmap.2.title': {
    en: 'Routing strategies',
    'zh-CN': '路由策略'
  },
  'platform.router.roadmap.2.description': {
    en: 'Name the policy: reliable, fast_start, fast_finish, or lowest_cost.',
    'zh-CN': '指定策略：reliable、fast_start、fast_finish 或 lowest_cost。'
  },
  'platform.router.roadmap.2.details': {
    en: 'Name the outcome you want instead of a provider. Comfy picks a route that fits the policy, and every job still reports the provider that ran it. Ordered fallback arrives alongside: a backup list Comfy uses only when a retry is known to be safe.',
    'zh-CN':
      '不再指定供应商，而是指定你想要的结果。Comfy 会选择符合策略的路由，每个任务仍会报告实际执行的供应商。有序回退也将同步推出：仅在确认可安全重试时才启用备用列表。'
  },
  'platform.router.roadmap.3.title': {
    en: 'Route by use case',
    'zh-CN': '按使用场景路由'
  },
  'platform.router.roadmap.3.description': {
    en: 'Request an upscale, a background removal, or an animation, and Comfy picks a model or workflow that can do it.',
    'zh-CN':
      '请求一次放大、抠图或动画生成，Comfy 会自动选择能完成任务的模型或工作流。'
  },
  'platform.router.roadmap.3.details': {
    en: 'Describe the task instead of the model. Comfy matches it to a model or workflow that can do it, on a provider that is up, so new models slot in without a change on your side.',
    'zh-CN':
      '描述任务而不是模型。Comfy 会匹配一个能完成该任务的模型或工作流，并在可用的供应商上运行，新模型上线时你无需改动任何代码。'
  },
  'platform.router.roadmap.4.title': {
    en: 'BYOK',
    'zh-CN': '自带密钥（BYOK）'
  },
  'platform.router.roadmap.4.description': {
    en: 'Use your own provider key for supported models while keeping the same Comfy Router integration.',
    'zh-CN':
      '在支持的模型上使用你自己的供应商密钥，同时保留同一套 Comfy Router 集成。'
  },
  'platform.router.roadmap.4.details': {
    en: 'Connect your own provider credentials and run supported models through the same Comfy Router API. Keep one SDK and job lifecycle while usage and billing for those calls stay with your provider.',
    'zh-CN':
      '接入你自己的供应商凭据，通过同一套 Comfy Router API 运行支持的模型。SDK 和任务生命周期保持不变，这些调用的用量与计费仍归属于你的供应商。'
  },
  'platform.router.roadmap.learnMore': {
    en: 'LEARN MORE',
    'zh-CN': '了解更多'
  },
  'platform.router.faq.heading': {
    en: 'FAQ',
    'zh-CN': '常见问题'
  },
  'platform.router.faq.1.q': {
    en: 'Why not call fal, Runware, or Wavespeed directly?',
    'zh-CN': '为什么不直接调用 fal、Runware 或 Wavespeed？'
  },
  'platform.router.faq.1.a': {
    en: 'You can, and plenty of teams do. Comfy Router earns its place when you need more than one: the same model on more than one provider, one key and one job surface, and a route you pick. Each provider routes to itself. Comfy Router gives you one surface across them.',
    'zh-CN':
      '你当然可以，很多团队也是这么做的。但当你需要不止一个供应商时，Comfy Router 就有了价值：同一个模型可在多个供应商上运行，只用一个密钥和一套任务接口，路由由你选择。每个供应商只路由到它自己，Comfy Router 让你用一套接口覆盖所有供应商。'
  },
  'platform.router.faq.2.q': {
    en: 'Is Comfy Router “OpenRouter for media”?',
    'zh-CN': 'Comfy Router 是“媒体版的 OpenRouter”吗？'
  },
  'platform.router.faq.2.a': {
    en: 'OpenRouter is known for routing language models. Comfy Router is built for generative media: large assets, model-specific controls, and jobs that run for minutes.',
    'zh-CN':
      'OpenRouter 以路由语言模型著称。Comfy Router 则是为生成式媒体打造的：大体积资源、模型专属的控制参数，以及可能运行数分钟的任务。'
  },
  'platform.router.faq.3.q': {
    en: 'Does Comfy pick the provider for me?',
    'zh-CN': 'Comfy 会替我选择供应商吗？'
  },
  'platform.router.faq.3.a': {
    en: 'Not at launch. You name the provider and Comfy runs it there. Nothing is swapped behind your back.',
    'zh-CN':
      '目前发布阶段不会。你指定供应商，Comfy 就在那里运行，绝不会在背后替你更换。'
  },
  'platform.router.faq.4.q': {
    en: 'What happens if my provider is unavailable?',
    'zh-CN': '如果我指定的供应商不可用怎么办？'
  },
  'platform.router.faq.4.a': {
    en: 'The request fails on the provider you chose, with no silent substitution. Ordered fallback is on the roadmap: a backup list, used only when a retry is known to be safe.',
    'zh-CN':
      '请求会在你选择的供应商上失败，不会被静默替换。有序的故障转移已在路线图上：一份备用列表，仅在确认重试安全时才会启用。'
  },
  'platform.router.faq.5.q': {
    en: 'What happens when I hit my concurrency limit?',
    'zh-CN': '当我达到并发上限时会发生什么？'
  },
  'platform.router.faq.5.a': {
    en: 'Queue the job instead of retrying on a 429. Use submit to send the job and receive a request ID immediately; use that ID to check progress and retrieve the result on your own terms. If you want Comfy to wait for the result, use subscribe, which submits the job and polls until it completes. Queueing is available for all supported models.\n\n<a href="https://docs.comfy.org/tutorials/partner-nodes/concurrency-limits">Learn more about concurrency limits.</a>',
    'zh-CN':
      '把任务排入队列，而不是在收到 429 后自行重试。使用 submit 发送任务并立即获得请求 ID，之后可按自己的节奏用该 ID 查询进度、获取结果。如果希望 Comfy 代为等待结果，可使用 subscribe，它会提交任务并轮询直到完成。所有受支持的模型都支持排队。\n\n<a href="https://docs.comfy.org/tutorials/partner-nodes/concurrency-limits">了解更多并发限制信息。</a>'
  },
  'platform.router.faq.6.q': {
    en: 'How long do you keep my inputs and outputs?',
    'zh-CN': '我的输入和输出会保留多久？'
  },
  'platform.router.faq.6.a': {
    en: 'Inputs are kept for 24 hours after upload and outputs for 24 hours after generation. Then they’re deleted.',
    'zh-CN':
      '输入在上传后保留 24 小时，输出在生成后保留 24 小时，之后即被删除。'
  },
  'platform.router.faq.7.q': {
    en: 'I already use ComfyUI. What does Comfy Router add?',
    'zh-CN': '我已经在使用 ComfyUI 了，Comfy Router 还能带来什么？'
  },
  'platform.router.faq.7.a': {
    en: 'More ways to run the models you use. Reach supported models across providers, choose where they run, and switch when price, speed, or availability changes.',
    'zh-CN':
      '为你正在使用的模型提供更多运行方式。跨供应商调用受支持的模型，选择它们在哪里运行，并在价格、速度或可用性变化时随时切换。'
  },
  'platform.router.faq.8.q': {
    en: 'Can I call Comfy workflows too?',
    'zh-CN': '我也可以调用 Comfy 工作流吗？'
  },
  'platform.router.faq.8.a': {
    en: 'Not through Comfy Router yet. Workflows run today through the Comfy API on the Developer Platform, and Router support is on the roadmap.',
    'zh-CN':
      '目前还不能通过 Comfy Router 调用。工作流现在通过开发者平台上的 Comfy API 运行，Router 对工作流的支持已在路线图上。'
  },
  'platform.router.faq.9.q': {
    en: 'Where do my API keys, usage, and billing live?',
    'zh-CN': '我的 API 密钥、用量和账单在哪里管理？'
  },
  'platform.router.faq.9.a': {
    en: 'On the Developer Platform. Your API keys, run history, credits, and payments live there.',
    'zh-CN': '在开发者平台。你的 API 密钥、运行记录、积分和付款都在那里。'
  },
  'platform.router.faq.10.q': {
    en: 'Can I bring my own provider key?',
    'zh-CN': '我可以使用自己的供应商密钥吗？'
  },
  'platform.router.faq.10.a': {
    en: 'BYOK is available for select models on Enterprise. Access is enabled by request.\n\n<a href="/enterprise">Contact Enterprise Sales</a>',
    'zh-CN':
      '在企业版中，部分模型支持自带密钥（BYOK），需申请开通。\n\n<a href="/zh-CN/enterprise">联系企业销售</a>'
  },
  'platform.router.faq.11.q': {
    en: 'How is Comfy Router priced?',
    'zh-CN': 'Comfy Router 如何计费？'
  },
  'platform.router.faq.11.a': {
    en: 'Comfy Router uses the same Comfy credits that cover Partner Nodes, Comfy Cloud workflow runs, and other supported model calls. Per-model pricing is listed in the model catalog, so you can see the cost for each model before you run it.',
    'zh-CN':
      'Comfy Router 使用与 Partner Nodes、Comfy Cloud 工作流运行及其他受支持模型调用相同的 Comfy 积分。每个模型的价格都列在模型目录中，运行前即可查看费用。'
  },
  'platform.router.faq.12.q': {
    en: 'Do I need a Comfy subscription?',
    'zh-CN': '我需要订阅 Comfy 吗？'
  },
  'platform.router.faq.12.a': {
    en: 'No. Router runs on credits. Add credits and start calling models.',
    'zh-CN': '不需要。Router 使用积分运行。充值积分后即可开始调用模型。'
  },
  'platform.router.closing.headingAfterBadge': {
    en: 'Start building with Comfy Router today.',
    'zh-CN': '现在就开始使用 Comfy Router 构建。'
  },
  'platform.router.closing.subtitle': {
    en: 'Call frontier media models, choose your provider, get better pricing and availability. All behind one API.',
    'zh-CN':
      '调用前沿媒体模型，自由选择供应商，获得更好的价格与可用性，一切都在一个 API 之内。'
  }
} satisfies Record<string, LocalizedText>

export type RouterCopyKey = keyof typeof copy

export function routerT(
  key: RouterCopyKey,
  locale: Locale = 'en',
  named: NamedValues = {}
): string {
  const entry: LocalizedText = copy[key]
  return interpolate(entry[locale] ?? entry.en, named)
}

function isRouterCopyKey(key: string): key is RouterCopyKey {
  return key in copy
}

/** The FAQ entries, in order, for as many numbered pairs as the copy holds. */
export function routerFaq(locale: Locale = 'en'): FaqItem[] {
  const items: FaqItem[] = []
  for (let n = 1; ; n += 1) {
    const question = `platform.router.faq.${n}.q`
    const answer = `platform.router.faq.${n}.a`
    if (!isRouterCopyKey(question) || !isRouterCopyKey(answer)) return items
    items.push({
      question: routerT(question, locale),
      answer: routerT(answer, locale)
    })
  }
}
