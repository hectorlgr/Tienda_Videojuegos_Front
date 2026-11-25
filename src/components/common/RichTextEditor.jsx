import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { getDescriptionText, sanitizeDescription } from '../../utils/productDescription'

const shortTools = [
  { label: 'Negrita', name: 'bold', apply: chain => chain.toggleBold() },
  { label: 'Cursiva', name: 'italic', apply: chain => chain.toggleItalic() },
]

const longTools = [
  ...shortTools,
  { label: 'Subtítulo', name: 'heading', apply: (chain, level) => chain.toggleHeading({ level }) },
  { label: 'Lista con viñetas', name: 'bulletList', apply: chain => chain.toggleBulletList() },
  { label: 'Lista numerada', name: 'orderedList', apply: chain => chain.toggleOrderedList() },
]

export default function RichTextEditor({ id, value, onChange, maxLength, long, allowLinks = false, disabled, invalid, describedBy }) {
  const tools = long ? longTools : shortTools
  const headingLevel = allowLinks ? 4 : 3
  const editor = useEditor({
    extensions: [StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: allowLinks ? { openOnClick: false, autolink: false } : false,
      strike: false,
      underline: false,
      heading: long ? { levels: [headingLevel] } : false,
      bulletList: long,
      orderedList: long,
      listItem: long,
      listKeymap: long,
    })],
    content: sanitizeDescription(value, allowLinks),
    editable: !disabled,
    onUpdate: ({ editor }) => onChange(editor.getText().trim() ? sanitizeDescription(editor.getHTML(), allowLinks) : ''),
  })
  const activeTools = useEditorState({
    editor,
    selector: ({ editor }) => tools.map(tool => editor?.isActive(tool.name) ?? false),
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled, false)
    editor.setOptions({
      editorProps: {
        attributes: {
          id,
          role: 'textbox',
          'aria-labelledby': `${id}-label`,
          'aria-describedby': [`${id}-count`, describedBy].filter(Boolean).join(' '),
          'aria-multiline': 'true',
          'aria-invalid': invalid ? 'true' : 'false',
          'aria-disabled': disabled ? 'true' : 'false',
        },
      },
    })
  }, [editor, disabled, id, describedBy, invalid])

  const length = getDescriptionText(value).length

  function addLink() {
    const href = window.prompt('Dirección del enlace (https:// o http://)')?.trim()
    if (!href) return
    if (!/^https?:\/\//i.test(href) || !URL.canParse(href)) {
      window.alert('Ingresa una dirección HTTP o HTTPS válida.')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  return (
    <>
      <div className={`product-description-editor border rounded${invalid ? ' border-danger' : ''}`}>
        <div className="d-flex flex-wrap gap-1 p-2 border-bottom">
          {tools.map(({ label, name, apply }, index) => (
            <button
              key={name}
              type="button"
              className={`btn btn-sm btn-outline-secondary${activeTools?.[index] ? ' active' : ''}`}
              disabled={disabled || !editor}
              aria-pressed={activeTools?.[index] ?? false}
              onClick={() => apply(editor.chain().focus(), headingLevel).run()}
            >
              {label}
            </button>
          ))}
          {allowLinks && (
            <button type="button" className="btn btn-sm btn-outline-secondary"
              disabled={disabled || !editor} onClick={addLink}>
              Añadir enlace
            </button>
          )}
        </div>
        <EditorContent editor={editor} />
      </div>
      <p id={`${id}-count`} className={`form-text mb-0${length > maxLength ? ' text-danger' : ''}`}>
        {length} de {maxLength} caracteres
      </p>
    </>
  )
}
