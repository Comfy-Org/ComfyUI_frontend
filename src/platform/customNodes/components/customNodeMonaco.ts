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

export { monaco }
