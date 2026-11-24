import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATALOG_CATEGORIES } from '../../config/catalogCategories'
import { calculateOfferPrice, getCategoryFields, OFFER_PERCENTAGES } from '../../config/productForm'
import { formatCLP } from '../../utils/currency'
import { getRawgGame, importRawgGame } from '../../services/rawgService'
import RawgGameSearch from '../../components/admin/RawgGameSearch'
import ProductImageFields from '../../components/admin/ProductImageFields'
import { normalizeProductCode, validateProductForm } from '../../utils/productValidation'
import { createProduct } from '../../services/productService'

const initialValues = {
  product: {
    codigo: '', nombre: '', categoria: '', precio: '', porcentajeOferta: '', imagen: '', imagenes: [],
    descripcionCorta: '', descripcionLarga: '', enOferta: false,
  },
  inventory: { stock: '', stockCritico: '' },
}

const productFields = [
  { name: 'codigo', label: 'Código comercial', required: true, help: 'Mínimo 3 caracteres. Se normaliza a mayúsculas al salir del campo o validar.' },
  { name: 'nombre', label: 'Nombre', required: true, maxLength: 100 },
  { name: 'precio', label: 'Precio (CLP)', type: 'number', min: 1, required: true },
  { name: 'descripcionCorta', label: 'Descripción corta', multiline: true, maxLength: 120 },
  { name: 'descripcionLarga', label: 'Descripción larga', multiline: true, maxLength: 500 },
]

const inventoryFields = [
  { name: 'stock', label: 'Stock inicial', type: 'number', min: 0, required: true },
  { name: 'stockCritico', label: 'Stock crítico', inputMode: 'numeric', help: 'Vacío representa un stock crítico sin definir (null).' },
]

export default function AdminProductCreatePage() {
  const navigate = useNavigate()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [rawgGame, setRawgGame] = useState(null)
  const [rawgPreview, setRawgPreview] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [formVersion, setFormVersion] = useState(0)
  const [readingImages, setReadingImages] = useState(false)
  const readingImagesRef = useRef(false)
  const pending = phase !== 'idle' || readingImages
  const categoryFields = getCategoryFields(values.product.categoria, rawgGame !== null)
  const price = Number(values.product.precio)
  const offerPrice = calculateOfferPrice(price, Number(values.product.porcentajeOferta))
  const pendingRef = useRef(false)
  const activeRef = useRef(false)
  const visibleErrors = errors

  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false }
  }, [])

  const rawgId = rawgGame?.rawgId
  useEffect(() => {
    if (!rawgId) return
    let active = true
    getRawgGame(rawgId).then(
      game => { if (active) setRawgPreview({ rawgId, game }) },
      error => { if (active) setRawgPreview({ rawgId, error: error.message }) },
    )
    return () => { active = false }
  }, [rawgId])
  const preview = rawgId === rawgPreview?.rawgId ? rawgPreview : null

  function changeValue(group, name, value) {
    const nextGroup = { ...values[group], [name]: value }
    if (name === 'categoria') {
      const visible = getCategoryFields(value)
      for (const field of categoryFields) {
        if (!visible.some(nextField => nextField.name === field.name)) delete nextGroup[field.name]
      }
    }
    if (name === 'imagen') nextGroup.imagenes = nextGroup.imagenes.filter(url => url !== value)
    updateValues({ ...values, [group]: nextGroup }, name === 'categoria' ? null : rawgGame)
  }

  function updateValues(next, selectedGame = rawgGame) {
    setSubmitError('')
    setValues(next)
    if (submitted) setErrors(validateProductForm(next, selectedGame))
  }

  function selectRawgGame(game) {
    setRawgGame(game)
    updateValues({
      ...values,
      product: {
        ...values.product,
        plataforma: game.plataformas?.includes(values.product.plataforma)
          ? values.product.plataforma
          : game.plataformas?.length === 1 ? game.plataformas[0] : '',
      },
    }, game)
  }

  function useManualMode() {
    setRawgGame(null)
    updateValues(values, null)
  }

  function changeReadingImages(reading) {
    readingImagesRef.current = reading
    setReadingImages(reading)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (pendingRef.current || readingImagesRef.current) return
    const addAnother = event.nativeEvent.submitter?.value === 'add-another'
    setSuccess('')
    const next = {
      product: {
        ...Object.fromEntries(Object.entries(values.product).map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value])),
        codigo: normalizeProductCode(values.product.codigo),
      },
      inventory: {
        stock: values.inventory.stock.trim(),
        stockCritico: values.inventory.stockCritico.trim(),
      },
    }
    setValues(next)
    setSubmitted(true)
    const localErrors = validateProductForm(next, rawgGame)
    setErrors(localErrors)
    setSubmitError('')
    if (Object.keys(localErrors).length > 0) return

    pendingRef.current = true
    setPhase('creating')
    try {
      const productData = { ...next.product, precioOferta: offerPrice }
      if (rawgGame) {
        await importRawgGame(rawgGame.rawgId, productData, next.inventory)
      } else {
        await createProduct(productData, next.inventory)
      }
      if (!activeRef.current) return
      if (addAnother) {
        setValues({ ...initialValues, product: { ...initialValues.product, categoria: next.product.categoria } })
        setErrors({})
        setSubmitted(false)
        setRawgGame(null)
        setFormVersion(version => version + 1)
        setSuccess(`Se creó ${rawgGame?.nombre ?? next.product.nombre} con su inventario inicial.`)
      } else {
        navigate('/admin/stock', { replace: true })
      }
    } catch (error) {
      if (activeRef.current) setSubmitError(error.message || 'No fue posible crear el producto.')
    } finally {
      pendingRef.current = false
      if (activeRef.current) setPhase('idle')
    }
  }

  function renderField(group, field) {
    const { name, label, required, maxLength, multiline, options, help, type = 'text', min, inputMode } = field
    const id = `new-product-${name}`
    const props = {
      id, name, required, maxLength,
      value: values[group][name] ?? '',
      onChange: event => changeValue(group, name, event.target.value),
      className: `${options ? 'form-select' : 'form-control'}${visibleErrors[name] ? ' is-invalid' : ''}`,
      'aria-invalid': visibleErrors[name] ? true : undefined,
      'aria-describedby': [help && `${id}-help`, visibleErrors[name] && `${id}-error`].filter(Boolean).join(' ') || undefined,
    }
    return (
      <div className="col-12 col-md-6" key={name}>
        <label htmlFor={id} className="form-label fw-semibold">
          {label}{!required && <span className="text-muted fw-normal"> (opcional)</span>}
        </label>
        {options ? (
          <select {...props}>
            <option value="">Selecciona una opción</option>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : multiline ? (
          <textarea {...props} rows={3} />
        ) : (
          <input
            {...props}
            type={type}
            inputMode={inputMode}
            min={min}
            step={type === 'number' ? 1 : undefined}
            max={type === 'number' ? Number.MAX_SAFE_INTEGER : undefined}
            onBlur={name === 'codigo' ? () => changeValue(group, name, normalizeProductCode(values[group][name])) : undefined}
          />
        )}
        {help && <p id={`${id}-help`} className="form-text mb-0">{help}</p>}
        {visibleErrors[name] && <div id={`${id}-error`} className="invalid-feedback">{visibleErrors[name]}</div>}
      </div>
    )
  }

  return (
    <section className="section admin-product-create-page" aria-labelledby="new-product-title">
      <title>Nuevo producto — CheckPoint Store</title>
      <div className="container">
        <div className="card shadow-sm">
          <div className="card-header bg-secondary text-white text-center py-3">
            <h1 id="new-product-title" className="mb-0 fs-4">Nuevo producto</h1>
          </div>
          <div className="card-body p-3 p-md-4">
            <p className="text-muted">Completa los datos del producto y su inventario inicial.</p>
            <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
              {success && <p className="alert alert-success" role="status">{success}</p>}
              <div role="alert">
                {Object.keys(visibleErrors).length > 0 && (
                  <p className="alert alert-danger">Revisa los campos indicados: {Object.keys(visibleErrors).length} con errores.</p>
                )}
                {submitError && <p className="alert alert-danger">{submitError}</p>}
              </div>
              <fieldset className="mb-4" disabled={pending}>
                <legend className="fs-5 fw-semibold">Producto</legend>
                <div className="row g-3 mb-3">
                  {renderField('product', { name: 'categoria', label: 'Categoría', required: true, options: CATALOG_CATEGORIES })}
                </div>
                {values.product.categoria === 'juego' && <RawgGameSearch key={formVersion} onSelect={selectRawgGame} />}
                {rawgGame && (
                  <div className="alert alert-info">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <span>Importar <strong>{rawgGame.nombre}</strong>. Elige una plataforma y un formato para esta variante.</span>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={useManualMode}>
                        Volver al modo manual
                      </button>
                    </div>
                    {preview?.game?.descripcion && <p className="mt-2 mb-1">{preview.game.descripcion}</p>}
                    {preview?.game?.generos?.length > 0 && <p className="small mb-1">Géneros {preview.game.generos.join(', ')}</p>}
                    {rawgGame.plataformas?.length > 0 && <p className="small mb-0">Plataformas {rawgGame.plataformas.join(', ')}</p>}
                    {preview?.error && <p className="small mb-0" role="status">{preview.error}</p>}
                  </div>
                )}
                <div className="row g-3">
                  {productFields.filter(field => !rawgGame || ['codigo', 'precio'].includes(field.name))
                    .map(field => renderField('product', field))}
                  {categoryFields.map(field => renderField('product',
                    rawgGame && field.name === 'plataforma'
                      ? { ...field, options: rawgGame.plataformas?.map(name => ({ value: name, label: name })) }
                      : field,
                  ))}
                </div>
                <div className="form-check mt-3">
                  <input
                    id="new-product-enOferta"
                    name="enOferta"
                    type="checkbox"
                    className="form-check-input"
                    checked={values.product.enOferta}
                    onChange={event => changeValue('product', 'enOferta', event.target.checked)}
                  />
                  <label htmlFor="new-product-enOferta" className="form-check-label">Producto en oferta</label>
                </div>
                {values.product.enOferta && (
                  <div className="mt-3">
                    <div className="row g-3">
                      {renderField('product', {
                        name: 'porcentajeOferta',
                        label: 'Descuento',
                        required: true,
                        options: OFFER_PERCENTAGES.map(percentage => ({ value: percentage, label: `${percentage}%` })),
                      })}
                    </div>
                    <div aria-live="polite">
                      {offerPrice > 0 && offerPrice < price && (
                        <p className="alert alert-info mt-3 mb-0">
                          <strong>Precio final {formatCLP(offerPrice)}</strong>
                          <span className="ms-3">Ahorro {formatCLP(price - offerPrice)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </fieldset>
              {!rawgGame && (
                <ProductImageFields key={formVersion} cover={values.product.imagen} gallery={values.product.imagenes}
                  disabled={pending} onChange={(name, value) => changeValue('product', name, value)}
                  onReadingChange={changeReadingImages} />
              )}
              <fieldset className="mb-4" disabled={pending}>
                <legend className="fs-5 fw-semibold">Inventario</legend>
                <div className="row g-3">{inventoryFields.map(field => renderField('inventory', field))}</div>
              </fieldset>
              <p className="text-muted" role="status">
                {phase === 'creating' ? 'Guardando producto...' : readingImages ? 'Subiendo imágenes...' : ''}
              </p>
              <div className="d-grid d-sm-flex gap-2">
                <button type="submit" className="btn btn-dark py-2" disabled={pending}>Crear producto</button>
                <button type="submit" value="add-another" className="btn btn-outline-secondary py-2" disabled={pending}>
                  Guardar y agregar otro
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
