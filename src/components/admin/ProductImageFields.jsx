import { useRef, useState } from 'react'

const MAX_GALLERY = 4

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona únicamente archivos de imagen.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reader.onabort = () => reject(new Error('No se pudo leer la imagen. Selecciónala nuevamente.'))
    reader.readAsDataURL(file)
  })
}

function ImagePicker({ label, onFiles, multiple = false }) {
  const input = useRef(null)
  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple={multiple} hidden
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
  const reading = useRef(false)

  async function load(files, onLoaded, available = 1) {
    if (reading.current) return
    if (files.length > available) {
      setError(`Puedes agregar hasta ${MAX_GALLERY} imágenes en la galería.`)
      return
    }
    setError('')
    reading.current = true
    onReadingChange(true)
    try {
      onLoaded(await Promise.all(files.map(readImage)))
    } catch (error) {
      setError(error.message)
    } finally {
      reading.current = false
      onReadingChange(false)
    }
  }

  function remove(name, value) {
    setError('')
    onChange(name, value)
  }

  return (
    <fieldset className="mb-4" disabled={disabled}>
      <legend className="fs-5 fw-semibold">Imágenes <small className="text-muted fw-normal">(opcional)</small></legend>
      <p className="form-text">Una imagen principal y hasta {MAX_GALLERY} imágenes locales en la galería.</p>
      {error && <p className="alert alert-danger py-2" role="alert">{error}</p>}
      <div className="mb-3">
        {cover ? (
          <ImagePreview source={cover} label="Imagen principal"
            onReplace={files => load(files, ([image]) => onChange('imagen', image))}
            onRemove={() => remove('imagen', '')} />
        ) : <ImagePicker label="Seleccionar imagen principal" onFiles={files => load(files, ([image]) => onChange('imagen', image))} />}
      </div>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {gallery.map((image, index) => (
          <ImagePreview key={index} source={image} label={`Imagen ${index + 1} de la galería`}
            onReplace={files => load(files, ([replacement]) => onChange('imagenes', gallery.map((item, i) => i === index ? replacement : item)))}
            onRemove={() => remove('imagenes', gallery.filter((_, i) => i !== index))} />
        ))}
      </div>
      {gallery.length < MAX_GALLERY && (
        <ImagePicker label="Agregar imágenes a la galería" multiple
          onFiles={files => load(files, images => onChange('imagenes', [...gallery, ...images]), MAX_GALLERY - gallery.length)} />
      )}
    </fieldset>
  )
}
