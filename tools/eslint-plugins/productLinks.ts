import type { Rule } from 'eslint'
import type { AST } from 'vue-eslint-parser'

const LINK_HOST_URL =
  /https?:\/\/(?:www\.|docs\.|blog\.|registry\.)?comfy\.org(?![\w.-])/
const SNAKE_CASE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/
const CONVENTION =
  'https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/docs/guidance/product-links.md'

type TemplateVisitor = Record<string, (node: never) => void>

interface TemplateParserServices {
  defineTemplateBodyVisitor(
    templateVisitor: TemplateVisitor,
    scriptVisitor?: Rule.RuleListener
  ): Rule.RuleListener
}

type ProductLinkCall = Rule.Node & { type: 'CallExpression' }

function isProductLinkCall(
  node: Rule.Node | null | undefined
): node is ProductLinkCall {
  return (
    node?.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'productLink'
  )
}

function isFirstProductLinkArgument(node: Rule.Node): boolean {
  const { parent } = node
  return isProductLinkCall(parent) && parent.arguments[0] === node
}

const requireUtm: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require comfy.org links to go through productLink so they carry UTM parameters'
    },
    messages: {
      untagged: `Wrap this comfy.org link in productLink(url, 'campaign') from '@/platform/links/productLink'. See ${CONVENTION}`,
      campaign: `The productLink campaign must be snake_case, e.g. 'help_center'. See ${CONVENTION}`
    },
    schema: []
  },
  create(context) {
    function checkText(node: Rule.Node | AST.Node, text: string) {
      if (!LINK_HOST_URL.test(text)) return
      const owner =
        node.type === 'TemplateElement' ? (node as Rule.Node).parent : node
      if (isFirstProductLinkArgument(owner as Rule.Node)) return
      context.report({ node, messageId: 'untagged' })
    }

    const literal = (node: Rule.Node) => {
      if (node.type === 'Literal' && typeof node.value === 'string')
        checkText(node, node.value)
    }
    const templateElement = (node: Rule.Node) => {
      if (node.type === 'TemplateElement') checkText(node, node.value.raw)
    }
    const call = (node: Rule.Node) => {
      if (!isProductLinkCall(node)) return
      const campaign = node.arguments.at(1)
      const text =
        campaign?.type === 'Literal' && typeof campaign.value === 'string'
          ? campaign.value
          : campaign?.type === 'TemplateLiteral' &&
              campaign.expressions.length === 0
            ? campaign.quasis[0]?.value.cooked
            : undefined
      if (
        campaign &&
        text !== undefined &&
        text !== null &&
        !SNAKE_CASE.test(text)
      )
        context.report({ node: campaign, messageId: 'campaign' })
    }

    const scriptVisitor: Rule.RuleListener = {
      Literal: literal,
      TemplateElement: templateElement,
      CallExpression: call
    }
    const services = context.sourceCode.parserServices as
      | Partial<TemplateParserServices>
      | undefined
    if (!services?.defineTemplateBodyVisitor) return scriptVisitor

    return services.defineTemplateBodyVisitor(
      {
        VLiteral: (node: AST.VLiteral) => checkText(node, node.value),
        Literal: literal,
        TemplateElement: templateElement,
        CallExpression: call
      },
      scriptVisitor
    )
  }
}

export default {
  meta: { name: 'product-links' },
  rules: { 'require-utm': requireUtm }
}
