import { Editor as TiptapEditor } from '@tiptap/core'
import TiptapLink from '@tiptap/extension-link'
import TiptapTable from '@tiptap/extension-table'
import TiptapTableCell from '@tiptap/extension-table-cell'
import TiptapTableHeader from '@tiptap/extension-table-header'
import TiptapTableRow from '@tiptap/extension-table-row'
import TiptapStarterKit from '@tiptap/starter-kit'
import { Markdown as TiptapMarkdown } from 'tiptap-markdown'

/**
 * Builds the read-only Tiptap markdown editor mounted into an existing element.
 *
 * Imported only via dynamic import() from useMarkdownWidget so the ~0.7MB Tiptap
 * bundle stays off the app's boot path (vendor-tiptap is otherwise a static
 * dependency of a boot chunk).
 */
export function createMarkdownEditor(
  element: HTMLElement,
  content: string
): TiptapEditor {
  TiptapMarkdown.configure({
    html: false,
    breaks: true,
    transformPastedText: true
  })
  return new TiptapEditor({
    element,
    extensions: [
      TiptapStarterKit,
      TiptapMarkdown,
      TiptapLink,
      TiptapTable,
      TiptapTableCell,
      TiptapTableHeader,
      TiptapTableRow
    ],
    content,
    editable: false
  })
}
