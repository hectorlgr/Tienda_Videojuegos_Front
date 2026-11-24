import { useRef, useState } from 'react'

import { uploadProductImage } from '../../services/productService'
import { isExternalImageUrl } from '../../utils/assets'

const MAX_GALLERY = 4
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function ImagePicker({ label, onFiles, multiple = false }) {
  const input = useRef(null)
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} hidden
        onChange={event => {
          const files = Array.from(event.target.files)
          event.target.value = ''
          if (files.length) onFiles(files)
        }} />
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => input.current.click()}>{label}</button>
    </>
  )
}

function ImagePreview({ source, label, onReplace, onRemove }) {
  return (
    <div className="border rounded p-2">
      <img src={source} alt={label} width={112} height={96} className="d-block rounded object-fit-cover mb-2" />
      <div className="d-flex flex-wrap gap-2">
        <ImagePicker label={`Reemplazar ${label.toLowerCase()}`} onFiles={onReplace} />
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRemove}>Eliminar {label.toLowerCase()}</button>
      </div>
    </div>
  )
}

export default function ProductImageFields({ cover, gallery, disabled, onChange, onReadingChange }) {
  const [error, setError] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [galleryUrl, setGalleryUrl] = useState('')
  const reading = useRef(false)

  async function load(files, onLoaded, available = 1) {
    if (reading.current) return
    if (files.length > available) {
      setError(`Puedes agregar hasta ${MAX_GALLERY} imágenes en la galería.`)
      return
    }
    if (files.some(file => !IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES)) {
      setError('Selecciona imágenes JPEG, PNG o WebP de hasta 5 MiB cada una.')
      return
    }
    setError('')
    reading.current = true
    onReadingChange(true)
    try {
      const results = await Promise.allSettled(files.map(uploadProductImage))
      const images = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      const failure = results.find(result => result.status === 'rejected')
      if (images.length) onLoaded(images)
      if (failure) setError(failure.reason.message)
    } finally {
      reading.current = false
      onReadingChange(false)
    }
  }

  function addExternalUrl(value, reset, apply) {
    const url = value.trim()
    if (!isExternalImageUrl(url)) {
      setError('Ingresa una URL válida que comience con http:// o https://.')
      return
    }
    setError('')
    apply(url)
    reset('')
  }

  function setCover(url) {
    onChange('imagen', url)
  }

  function setGallery(images) {
    onChange('imagenes', [...new Set(images)].filter(url => url !== cover))
  }

  function remove(name, value) {
    setError('')
    onChange(name, value)
  }

  return (
    <fieldset className="mb-4" disabled={disabled}>
      <legend className="fs-5 fw-semibold">Imágenes <small className="text-muted fw-normal">(opcional)</small></legend>
      <p className="form-text">Una imagen principal y hasta {MAX_GALLERY} imágenes en la galería.</p>
      {error && <p className="alert alert-danger py-2" role="alert">{error}</p>}
      <div className="mb-3">
        {cover ? (
          <ImagePreview source={cover} label="Imagen principal"
            onReplace={files => load(files, ([image]) => setCover(image))}
            onRemove={() => remove('imagen', '')} />
        ) : <ImagePicker label="Seleccionar imagen principal" onFiles={files => load(files, ([image]) => onChange('imagen', image))} />}
      </div>
      <div className="input-group mb-3">
        <input type="url" aria-label="URL de portada" className="form-control" placeholder="https://…" value={coverUrl}
          onChange={event => setCoverUrl(event.target.value)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            addExternalUrl(coverUrl, setCoverUrl, setCover)
          }} />
        <button type="button" className="btn btn-outline-secondary" disabled={!coverUrl.trim()}
          onClick={() => addExternalUrl(coverUrl, setCoverUrl, setCover)}>Usar URL de portada</button>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {gallery.map((image, index) => (
          <ImagePreview key={index} source={image} label={`Imagen ${index + 1} de la galería`}
            onReplace={files => load(files, ([replacement]) => setGallery(gallery.map((item, i) => i === index ? replacement : item)))}
            onRemove={() => remove('imagenes', gallery.filter((_, i) => i !== index))} />
        ))}
      </div>
      {gallery.length < MAX_GALLERY && (
        <>
          <ImagePicker label="Agregar imágenes a la galería" multiple
            onFiles={files => load(files, images => setGallery([...gallery, ...images]), MAX_GALLERY - gallery.length)} />
          <div className="input-group mt-2">
            <input type="url" aria-label="URL de galería" className="form-control" placeholder="https://…" value={galleryUrl}
              onChange={event => setGalleryUrl(event.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                addExternalUrl(galleryUrl, setGalleryUrl, url => setGallery([...gallery, url]))
              }} />
            <button type="button" className="btn btn-outline-secondary" disabled={!galleryUrl.trim()}
              onClick={() => addExternalUrl(galleryUrl, setGalleryUrl, url => setGallery([...gallery, url]))}>Agregar URL a la galería</button>
          </div>
        </>
      )}
    </fieldset>
  )
}
