import * as monaco from 'monaco-editor'
// oxlint-disable import/default -- Vite supplies worker constructors as default exports.
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
// oxlint-enable import/default

type MonacoWorkerEnvironment = {
  getWorker: (_moduleId: string, label: string) => Worker
}

const workerHost = globalThis as typeof globalThis & {
  MonacoEnvironment?: MonacoWorkerEnvironment
}

workerHost.MonacoEnvironment ??= {
  getWorker: (_moduleId, label) => {
    if (label === 'json') return new JsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new CssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new HtmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new TsWorker()
    }
    return new EditorWorker()
  }
}

export function languageForCustomNodePath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'py':
    case 'pyw':
      return 'python'
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript'
    case 'json':
    case 'jsonc':
      return 'json'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'toml':
      return 'ini'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'shell'
    case 'css':
    case 'scss':
    case 'less':
    case 'html':
    case 'xml':
    case 'sql':
      return extension
    default:
      return 'plaintext'
  }
}

export { monaco }
