import { Editor as TiptapEditor } from '@tiptap/core'
import {
  Table as TiptapTable,
  TableCell as TiptapTableCell,
  TableHeader as TiptapTableHeader,
  TableRow as TiptapTableRow
} from '@tiptap/extension-table'
import TiptapStarterKit from '@tiptap/starter-kit'
import { Markdown as TiptapMarkdown } from 'tiptap-markdown'

export function createMarkdownEditor(container: HTMLElement, content: string) {
  TiptapMarkdown.configure({
    html: false,
    breaks: true,
    transformPastedText: true
  })
  return new TiptapEditor({
    element: (editorElement) => container.prepend(editorElement),
    extensions: [
      TiptapStarterKit,
      TiptapMarkdown,
      TiptapTable,
      TiptapTableCell,
      TiptapTableHeader,
      TiptapTableRow
    ],
    content,
    editable: false
  })
}
