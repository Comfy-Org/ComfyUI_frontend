import type { LocalizedText } from '../i18n/translations'

interface PricingFaq {
  id: string
  question: LocalizedText
  answer: LocalizedText
}

export const pricingFaqs: readonly PricingFaq[] = [
  {
    id: 'how-does-pricing-work',
    question: {
      en: 'How does Comfy Cloud pricing actually work?',
      'zh-CN': 'Comfy Cloud 的定价究竟是如何运作的？'
    },
    answer: {
      en: "Every plan includes a monthly pool of <strong>credits</strong>. Credits are spent on two things: <strong>active GPU time</strong> while a workflow is running, and <strong>Partner Nodes</strong> (proprietary models like Nano Banana Pro). You're never charged for idle time. Building or editing a workflow costs nothing. You only spend while a job is actually running.",
      'zh-CN':
        '每个计划都包含每月的<strong>积分</strong>池。积分用于两类消耗：工作流运行时的<strong>活跃 GPU 时间</strong>，以及<strong>合作伙伴节点</strong>（如 Nano Banana Pro 等专有模型）。空闲时间不会计费。构建或编辑工作流完全免费。只有任务真正运行时才会扣费。'
    }
  },
  {
    id: 'what-is-a-credit-worth',
    question: {
      en: "What's a credit worth? How far does it go?",
      'zh-CN': '一个积分价值多少？能用多久？'
    },
    answer: {
      en: 'Credits map to GPU runtime, so mileage depends on the workflow. As a reference point, a five-second video* uses roughly <strong>11 credits</strong>, so Standard covers a few hundred per month, Creator about double that, and Pro enough for over a thousand.\n\n*Based on 5s videos using the Wan 2.2 Image-to-Video template at default settings (81 frames, 18fps, 640×640, 4-step sampler). Heavier models, higher resolutions, and the inclusion of Partner nodes use more.',
      'zh-CN':
        '积分对应 GPU 运行时长，因此具体能用多少取决于工作流本身。作为参考：一段 5 秒视频*大约消耗 <strong>11 积分</strong>，因此 Standard 每月可支持数百段，Creator 约为其两倍，Pro 则足以生成一千多段。\n\n*基于使用 Wan 2.2 图生视频模板在默认设置（81 帧、18fps、640×640、4-step sampler）下生成 5 秒视频的估算。更复杂的模型、更高分辨率以及加入合作伙伴节点会消耗更多积分。'
    }
  },
  {
    id: 'run-out-of-credits',
    question: {
      en: 'What happens when I run out of credits?',
      'zh-CN': '积分用完了会怎样？'
    },
    answer: {
      en: 'You can buy <strong>top-up credits</strong> at any time without changing plans. Monthly credits are spent first; top-ups are only drawn down once your monthly allowance is used up. Top-up credits stay valid for <strong>1 year</strong> from purchase.',
      'zh-CN':
        '您可以随时购买<strong>充值积分</strong>，无需更换计划。月度积分会优先消耗；只有当月度额度用完后，才会开始使用充值积分。充值积分自购买之日起 <strong>1 年</strong>内有效。'
    }
  },
  {
    id: 'do-credits-roll-over',
    question: {
      en: 'Do unused credits roll over?',
      'zh-CN': '未使用的积分会顺延吗？'
    },
    answer: {
      en: "Monthly plan credits reset each billing cycle and don't roll over. <strong>Top-up credits do persist.</strong> They're valid for a year and aren't affected by your monthly reset. Credits work on Comfy Cloud, and on Comfy Desktop <strong>only when calling Partner Nodes.</strong> Comfy Desktop itself is free.",
      'zh-CN':
        '月度计划积分在每个计费周期重置，不会顺延。<strong>但充值积分会保留。</strong>有效期为一年，且不受每月重置的影响。积分可在 Comfy Cloud 上使用，在 Comfy 桌面版上<strong>仅在调用合作伙伴节点时使用</strong>。Comfy 桌面版本身免费。'
    }
  },
  {
    id: 'difference-between-plans',
    question: {
      en: "What's the difference between Standard, Creator, and Pro?",
      'zh-CN': 'Standard、Creator 和 Pro 有什么区别？'
    },
    answer: {
      en: '<strong>Standard -</strong> 30-min max runtime per workflow, 1 concurrent workflow via API. For individuals building workflows.\n\n<strong>Creator -</strong> Everything in Standard plus the ability to <strong>import your own models</strong> (from CivitAI or Hugging Face) and run up to 3 workflows concurrently via API.\n\n<strong>Pro -</strong> Everything in Creator plus <strong>longer runtime (up to 1 hour)</strong> per workflow and up to 5 concurrent workflows via API. For teams running Comfy in production.',
      'zh-CN':
        '<strong>Standard -</strong> 单个工作流最长运行 30 分钟，API 支持 1 个并发工作流。适合构建工作流的个人。\n\n<strong>Creator -</strong> 包含 Standard 的全部功能，并新增<strong>导入自有模型</strong>（来自 CivitAI 或 Hugging Face）的能力，API 支持最多 3 个并发工作流。\n\n<strong>Pro -</strong> 包含 Creator 的全部功能，并提供<strong>更长的运行时长（最长 1 小时）</strong>，API 支持最多 5 个并发工作流。适合在生产环境中运行 Comfy 的团队。'
    }
  },
  {
    id: 'how-does-team-plan-work',
    question: {
      en: 'How does the Team Plan work?',
      'zh-CN': '团队计划是如何运作的？'
    },
    answer: {
      en: 'The Team Plan puts your whole team on <strong>one shared credit pool.</strong> Every member draws from the same balance, so you\'re not juggling separate subscriptions. Key things to know:\n\n<strong>One pool, shared.</strong> Everyone generates against the same credit balance.\n<strong>Invite by email.</strong> Add teammates, and resend or revoke access any time.\n<strong>Owners manage billing.</strong> Assign owners who handle payment and buy top-ups for the team.\n<strong>Upgrade in place.</strong> Move an existing workspace to a team and your workflows, models, and assets stay attached.\n\nChoose your monthly credit commitment that fits your team. <a href="https://cloud.comfy.org/?pricing=team" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Get started today.</a>',
      'zh-CN':
        '团队计划让整个团队共享<strong>一个积分池</strong>。每位成员都从同一余额中扣费，无需分别管理多个订阅。要点：\n\n<strong>一池共享。</strong>所有人都从同一积分余额中生成内容。\n<strong>邮箱邀请。</strong>添加团队成员，随时重新发送或撤销访问权限。\n<strong>所有者管理账单。</strong>指定所有者负责付款，并为团队购买充值积分。\n<strong>原地升级。</strong>将现有工作区升级为团队工作区，您的工作流、模型和资产都将保留。\n\n选择适合您团队的每月积分承诺。<a href="https://cloud.comfy.org/?pricing=team" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">立即开始。</a>'
    }
  },
  {
    id: 'team-spending-controls',
    question: {
      en: 'Can I control how my team spends credits?',
      'zh-CN': '我可以控制团队消耗积分的方式吗？'
    },
    answer: {
      en: "Today, owners control the shared pool and top-ups. We're actively building finer-grained controls: <strong>spending limits</strong> at the user, project, and workspace level, <strong>per-project budgets and chargebacks</strong>, <strong>auto-recharge</strong> when the pool runs low, and <strong>self-serve teams beyond 50 seats</strong>.",
      'zh-CN':
        '目前，所有者掌控共享积分池和充值。我们正在积极开发更细粒度的控制功能：用户、项目和工作区级别的<strong>消费上限</strong>、<strong>按项目预算与分摊</strong>、积分池余额不足时的<strong>自动充值</strong>，以及<strong>超过 50 个席位的自助式团队</strong>。'
    }
  },
  {
    id: 'team-per-seat-pricing',
    question: {
      en: 'Is Team pricing per-seat? Can I add a freelancer just for a project?',
      'zh-CN':
        '团队计划是按席位计费吗？我可以为某个项目临时加入一位自由职业者吗？'
    },
    answer: {
      en: 'No. Team pricing is based on <strong>your monthly credit commit</strong>, not per-seat. Invite a freelancer, they draw from the shared credit pool while they\'re working, then remove them when the project wraps. <strong>No charge for adding or removing people.</strong> Member count is capped at <strong>50</strong> today; if you hit the cap, <a href="https://portal.usepylon.com/comfy-org/forms/question" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">contact support</a> for additional seats.',
      'zh-CN':
        '不是。团队定价基于<strong>您每月承诺的积分量</strong>，而非按席位计费。邀请自由职业者后，他们在工作期间从共享积分池中扣费，项目结束后再将其移除即可。<strong>添加或移除成员都不收取额外费用。</strong>目前成员数量上限为 <strong>50</strong> 人；如果您达到上限，请<a href="https://portal.usepylon.com/comfy-org/forms/question" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">联系支持</a>以增加席位。'
    }
  },
  {
    id: 'team-upgrade-carryover',
    question: {
      en: 'What carries over when I upgrade my workspace to a Team plan?',
      'zh-CN': '将工作区升级为团队计划时，哪些内容会保留？'
    },
    answer: {
      en: "Everything stays. You're upgrading the workspace itself, so <strong>workflows, models, run history, and top-up credits all remain attached</strong>. The only exception: unused monthly credits from your old plan expire at the end of your current billing cycle, since you're moving to a new credit allowance. <strong>Top-up credits carry over.</strong>",
      'zh-CN':
        '全部保留。您升级的是工作区本身，因此<strong>工作流、模型、运行历史和充值积分都会保留</strong>。唯一例外：原计划中未使用的月度积分会在当前计费周期结束时失效，因为您将获得新的月度积分额度。<strong>充值积分会顺延。</strong>'
    }
  },
  {
    id: 'team-tier-pricing',
    question: {
      en: 'What do the Team plan tiers cost, and how does the discount work?',
      'zh-CN': '团队计划各档次的价格是多少？折扣是怎么算的？'
    },
    answer: {
      en: 'Team plans come in <strong>five tiers from $200 to $2,500/month</strong>, set by a credit-commit slider. A bigger monthly commit means a bigger discount: <strong>annual plans go up to 20% off, monthly plans up to 10%</strong>. The discount starts at the $400 tier (5% annual / 2.5% monthly) and scales from there.',
      'zh-CN':
        '团队计划共有<strong>五个档次，从每月 $200 到 $2,500</strong>，通过积分承诺滑块进行调整。月度承诺越高，折扣越大：<strong>年付计划最高 20% 折扣，月付计划最高 10% 折扣</strong>。折扣自 $400 档位起（年付 5% / 月付 2.5%），并由此递增。'
    }
  },
  {
    id: 'team-collaboration-features',
    question: {
      en: 'What collaboration features are included at launch?',
      'zh-CN': '首发时包含哪些协作功能？'
    },
    answer: {
      en: 'At launch, a Team plan gives you <strong>shared infrastructure</strong>: one credit pool, one bill, one set of admins. <strong>Workflow and asset sharing inside the workspace is coming soon.</strong> In the meantime, to hand off, share the workflow, export the workflow JSON, or drop a Comfy-generated asset into another canvas.',
      'zh-CN':
        '在首发阶段，团队计划为您提供<strong>共享基础设施</strong>：一个积分池、一份账单、一组管理员。<strong>工作区内的工作流与资产共享功能即将上线。</strong>在此之前，您可以通过共享工作流、导出工作流 JSON 或将 Comfy 生成的资产拖入另一画布来完成交接。'
    }
  },
  {
    id: 'team-concurrency',
    question: {
      en: 'How does concurrency work on a Team plan? Can multiple members run workflows at the same time?',
      'zh-CN': '团队计划的并发是如何运作的？多名成员可以同时运行工作流吗？'
    },
    answer: {
      en: 'Yes. On a Team plan, the workspace has a greater concurrency limit per member than the Pro plan. If you run into issues you can request additional support for your team plan limits <a href="https://comfy-org.portal.usepylon.com/forms/team-plan-requests" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">here</a>.',
      'zh-CN':
        '可以。在团队计划中，工作区的每位成员并发上限高于 Pro 计划。如果您遇到问题，可以<a href="https://comfy-org.portal.usepylon.com/forms/team-plan-requests" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">在此处</a>为您的团队计划上限申请额外支持。'
    }
  },
  {
    id: 'runtime-and-concurrency-limits',
    question: {
      en: 'What are the runtime and concurrency limits?',
      'zh-CN': '运行时长和并发的限制是什么？'
    },
    answer: {
      en: 'Each workflow has a max runtime of <strong>30 minutes</strong> on Standard and Creator, raised to <strong>1 hour</strong> on Pro. Jobs over the limit are cancelled automatically to keep the system fair and stable. You can queue up to <strong>100 workflows</strong> at once, and run <strong>1 / 3 / 5</strong> concurrently via API on Standard / Creator / Pro. If you need to increase your Team plan concurrency limit, seats or API rate limits, contact us <a href="https://comfy-org.portal.usepylon.com/forms/team-plan-requests" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">here</a>.',
      'zh-CN':
        'Standard 和 Creator 上，单个工作流的最长运行时长为 <strong>30 分钟</strong>；Pro 上提升至 <strong>1 小时</strong>。超出限制的任务会被自动取消，以保持系统的公平与稳定。您可以同时排队最多 <strong>100 个工作流</strong>，并在 Standard / Creator / Pro 上通过 API 分别并发运行 <strong>1 / 3 / 5</strong> 个工作流。如果您需要提高团队计划的并发上限、席位或 API 速率限制，请<a href="https://comfy-org.portal.usepylon.com/forms/team-plan-requests" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">点击此处</a>联系我们。'
    }
  },
  {
    id: 'run-workflows-via-api',
    question: {
      en: 'Can I run workflows via API?',
      'zh-CN': '我可以通过 API 运行工作流吗？'
    },
    answer: {
      en: 'Yes. Run Comfy workflows programmatically via API. Concurrency limits scale with your plan: 1 / 3 / 5 on Standard / Creator / Pro. It\'s built for integrating ComfyUI into your apps, automating batch jobs, or running production pipelines. If you need to request increasing limits you can do so <a href="https://comfy-org.portal.usepylon.com/forms/team-plan-requests" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">here</a>.',
      'zh-CN':
        '可以。通过 API 以编程方式运行 Comfy 工作流。并发上限随您的计划扩展：Standard / Creator / Pro 分别为 1 / 3 / 5。它专为将 ComfyUI 集成到您的应用、自动化批处理任务或运行生产管线而打造。如果您需要申请提高上限，可以<a href="https://comfy-org.portal.usepylon.com/forms/team-plan-requests" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">在此处</a>提交。'
    }
  },
  {
    id: 'partner-nodes-cost',
    question: {
      en: 'What are Partner Nodes, and do they cost extra?',
      'zh-CN': '什么是合作伙伴节点？它们会额外收费吗？'
    },
    answer: {
      en: 'Partner Nodes let you run proprietary models (like Nano Banana Pro) directly inside your workflow. They draw from the same credit pool as your subscription (no separate bill); how much each call costs depends on the model and parameters you set. These credits work across both Comfy Cloud and Comfy Desktop. <a href="https://docs.comfy.org/tutorials/partner-nodes/overview" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Read more about Partner Nodes</a>.',
      'zh-CN':
        '合作伙伴节点让您直接在工作流中运行专有模型（如 Nano Banana Pro）。它们从与您订阅相同的积分池中扣费（不会单独出账单）；每次调用的费用取决于模型以及您设置的参数。这些积分在 Comfy Cloud 和 Comfy 桌面版上均可使用。<a href="https://docs.comfy.org/tutorials/partner-nodes/overview" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">了解更多关于合作伙伴节点的信息</a>。'
    }
  },
  {
    id: 'change-cancel-plan-refunds',
    question: {
      en: 'Can I change or cancel my plan? Do you offer refunds?',
      'zh-CN': '我可以更改或取消我的计划吗？你们提供退款吗？'
    },
    answer: {
      en: "You can cancel any time. Cancelling stops all future payments immediately, and your plan stays active until the end of the period you've already paid for. For refunds, submit a support ticket. These are reviewed by our team case by case.",
      'zh-CN':
        '您可以随时取消。取消后会立即停止所有后续付款，而您的计划在已付费周期结束前仍保持有效。如需退款，请提交支持工单。我们的团队会逐一进行审核。'
    }
  },
  {
    id: 'find-invoices-tax-id',
    question: {
      en: "Where can I find my invoices or add my company's tax ID?",
      'zh-CN': '我在哪里可以找到发票或添加公司的税号？'
    },
    answer: {
      en: "You can manage all billing details directly through your Stripe portal. Go to Settings → Plans & Credits → Invoice History to open it. From there, you can view and download invoices, update your billing information, and add your company's tax ID.",
      'zh-CN':
        '您可以直接通过 Stripe 门户管理所有账单信息。前往 设置 → 计划与积分 → 发票历史 即可打开。在那里，您可以查看和下载发票、更新账单信息，并添加公司的税号。'
    }
  },
  {
    id: 'running-comfy-at-scale',
    question: {
      en: "What if I'm running Comfy at scale?",
      'zh-CN': '如果我在大规模运行 Comfy 怎么办？'
    },
    answer: {
      en: 'For teams running Comfy in production and at scale, Enterprise adds higher API rate limits, advanced security, and dedicated support. <a href="https://comfy.org/cloud/enterprise" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">Learn more about Enterprise</a> or reach out at <a href="mailto:enterprise@comfy.org" class="text-primary-comfy-yellow underline">enterprise@comfy.org</a>.',
      'zh-CN':
        '对于在生产环境中大规模运行 Comfy 的团队，企业版提供更高的 API 速率限制、高级安全性和专属支持。<a href="https://comfy.org/cloud/enterprise" target="_blank" rel="noopener noreferrer" class="text-primary-comfy-yellow underline">了解更多关于企业版的信息</a>，或通过 <a href="mailto:enterprise@comfy.org" class="text-primary-comfy-yellow underline">enterprise@comfy.org</a> 与我们联系。'
    }
  }
] as const
