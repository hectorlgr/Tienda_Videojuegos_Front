import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getDescriptionText, sanitizeDescription } from '../../utils/productDescription'
import RichTextEditor from '../common/RichTextEditor'

const storageKey = 'checkpoint-editorial-posts'
const bodyLimit = 5000
const emptyDraft = { title: '', summary: '', body: '' }

function readPosts() {
  const posts = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
  if (!Array.isArray(posts)) return []
  return posts.filter(post => post && ['id', 'title', 'summary', 'body'].every(field => typeof post[field] === 'string'))
}

export default function LocalEditorialPosts() {
  const canWrite = useAuth()?.user?.rol === 'administrador'
  const [posts, setPosts] = useState(() => {
    try {
      return readPosts()
    } catch {
      return []
    }
  })
  const [draft, setDraft] = useState(emptyDraft)
  const [editorVersion, setEditorVersion] = useState(0)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function updateDraft(field, value) {
    setDraft(previous => ({ ...previous, [field]: value }))
    setSaved(false)
  }

  function savePost(event) {
    event.preventDefault()
    if (!canWrite) return
    setError('')
    setSaved(false)
    const body = sanitizeDescription(draft.body, true)
    const bodyLength = getDescriptionText(body).length
    if (!draft.title.trim() || !bodyLength || bodyLength > bodyLimit) {
      setError(`Ingresa un título y un cuerpo de hasta ${bodyLimit} caracteres.`)
      return
    }

    try {
      const post = {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        body,
      }
      const nextPosts = [post, ...readPosts()]
      window.localStorage.setItem(storageKey, JSON.stringify(nextPosts))
      setPosts(nextPosts)
      setDraft(emptyDraft)
      setEditorVersion(version => version + 1)
      setSaved(true)
    } catch {
      setError('No se pudo guardar la publicación en este navegador.')
    }
  }

  if (!canWrite && posts.length === 0) return null

  return (
    <section className="section" aria-labelledby="editorial-posts-title">
      <div className="container">
        <h2 id="editorial-posts-title" className="reviews-section-title">Publicaciones locales</h2>
        <p className="text-muted">Guardadas en este navegador.</p>
        {canWrite && (
          <form onSubmit={savePost} className="noticia-card mb-4">
            <div className="mb-3">
              <label htmlFor="editorial-title" className="form-label">Título</label>
              <input id="editorial-title" className="form-control" required maxLength={120}
                value={draft.title} onChange={event => updateDraft('title', event.target.value)} />
            </div>
            <div className="mb-3">
              <label htmlFor="editorial-summary" className="form-label">Resumen (opcional)</label>
              <textarea id="editorial-summary" className="form-control" rows={2} maxLength={250}
                value={draft.summary} onChange={event => updateDraft('summary', event.target.value)} />
            </div>
            <div className="mb-3">
              <span id="editorial-body-label" className="form-label d-block">Cuerpo de la publicación</span>
              <RichTextEditor key={editorVersion} id="editorial-body" value={draft.body}
                onChange={value => updateDraft('body', value)} maxLength={bodyLimit} long allowLinks />
            </div>
            {error && <p role="alert" className="text-danger">{error}</p>}
            {saved && <p role="status" className="text-success">Publicación guardada.</p>}
            <button className="btn btn-dark" type="submit">Guardar publicación</button>
          </form>
        )}
        {posts.map(post => (
          <article key={post.id} className="noticia-card mb-3">
            <h3>{post.title}</h3>
            {post.summary && <p>{post.summary}</p>}
            <div className="product-rich-description"
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(post.body, true) }} />
          </article>
        ))}
      </div>
    </section>
  )
}
