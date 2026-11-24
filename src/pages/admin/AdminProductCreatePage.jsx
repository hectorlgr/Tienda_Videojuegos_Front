import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CATALOG_CATEGORIES } from '../../config/catalogCategories'
import { calculateOfferPrice, DEFAULT_PRODUCT_ECOSYSTEM, getCategoryFields, OFFER_PERCENTAGES } from '../../config/productForm'
import { formatCLP } from '../../utils/currency'
import { getRawgPlatformNames } from '../../services/rawgService'
import RawgGameSearch from '../../components/admin/RawgGameSearch'
import ProductImageFields from '../../components/admin/ProductImageFields'
import { normalizeProductCode, validateProductForm } from '../../utils/productValidation'
import { findProductByCode } from '../../services/productService'
import { createProductWithInventory, ProductInventoryCreationError } from '../../services/productCreationService'

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
  const [codeError, setCodeError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [formVersion, setFormVersion] = useState(0)
  const [readingImages, setReadingImages] = useState(false)
  const readingImagesRef = useRef(false)
  const pending = phase !== 'idle' || readingImages
  const categoryFields = getCategoryFields(values.product.categoria)
  const price = Number(values.product.precio)
  const offerPrice = calculateOfferPrice(price, Number(values.product.porcentajeOferta))
  const pendingRef = useRef(false)
  const activeRef = useRef(false)
  const currentCodeRef = useRef('')
  const visibleErrors = { ...errors, ...(codeError ? { codigo: codeError } : {}) }

  useEffect(() => {
    activeRef.current = true
    return () => { activeRef.current = false }
  }, [])

  function changeValue(group, name, value) {
    if (name === 'codigo') {
      const code = normalizeProductCode(value)
      if (code !== currentCodeRef.current) setCodeError('')
      currentCodeRef.current = code
    }
    const nextGroup = { ...values[group], [name]: value }
    if (name === 'categoria') {
      const visible = getCategoryFields(value)
      for (const field of categoryFields) {
        if (!visible.some(nextField => nextField.name === field.name)) delete nextGroup[field.name]
      }
    }
    updateValues({ ...values, [group]: nextGroup })
  }

  function updateValues(next) {
    setSubmitError('')
    setValues(next)
    if (submitted) setErrors(validateProductForm(next))
  }

  function importGame(game) {
    updateValues({
      ...values,
      product: {
        ...values.product,
        nombre: game.name.slice(0, 100),
        descripcionCorta: game.description_raw.slice(0, 120),
        descripcionLarga: game.description_raw.slice(0, 500),
        plataforma: getRawgPlatformNames(game),
        imagen: game.background_image,
        franquicia: game.franchise ?? '',
      },
    })
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
    const localErrors = validateProductForm(next)
    setErrors(localErrors)
    setCodeError('')
    setSubmitError('')
    if (Object.keys(localErrors).length > 0) return

    const code = next.product.codigo
    currentCodeRef.current = code
    pendingRef.current = true
    setPhase('checking')
    try {
      const product = await findProductByCode(code)
      // Una respuesta tardía no corresponde a un código editado ni a una página desmontada.
      if (!activeRef.current || currentCodeRef.current !== code) return
      if (product) {
        setCodeError('Este código ya está registrado.')
        return
      }

      const productData = {
        codigo: code,
        nombre: next.product.nombre,
        categoria: next.product.categoria,
        ecosistema: next.product.categoria === 'figura'
          ? DEFAULT_PRODUCT_ECOSYSTEM
          : next.product.ecosistema || DEFAULT_PRODUCT_ECOSYSTEM,
        enOferta: next.product.enOferta,
        precio: Number(next.product.precio),
        // Sin oferta marcada, el precio de oferta no se guarda.
        precioOferta: next.product.enOferta ? calculateOfferPrice(Number(next.product.precio), Number(next.product.porcentajeOferta)) : null,
        imagen: next.product.imagen,
        imagenes: next.product.imagenes,
        descripcionCorta: next.product.descripcionCorta,
        descripcionLarga: next.product.descripcionLarga,
        ...Object.fromEntries(categoryFields
          .filter(field => field.name !== 'ecosistema' && next.product[field.name])
          .map(field => [field.name, next.product[field.name]])),
      }
      const inventoryData = {
        stock: Number(next.inventory.stock),
        stockCritico: next.inventory.stockCritico === '' ? null : Number(next.inventory.stockCritico),
      }

      setPhase('creating')
      await createProductWithInventory(productData, inventoryData)
      if (!activeRef.current) return
      if (addAnother) {
        setValues({ ...initialValues, product: { ...initialValues.product, categoria: next.product.categoria } })
        setErrors({})
        setSubmitted(false)
        currentCodeRef.current = ''
        setFormVersion(version => version + 1)
        setSuccess(`Se creó ${next.product.nombre} con su inventario inicial.`)
      } else {
        navigate('/admin/stock', { replace: true })
      }
    } catch (error) {
      if (activeRef.current) {
        setSubmitError(error instanceof ProductInventoryCreationError
          ? 'El producto fue creado, pero no fue posible registrar su inventario.'
          : 'No fue posible crear el producto. Inténtalo nuevamente.')
      }
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
                {values.product.categoria === 'juego' && <RawgGameSearch key={formVersion} onSelect={importGame} />}
                <div className="row g-3">
                  {productFields.map(field => renderField('product', field))}
                  {categoryFields.map(field => renderField('product', field))}
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
              <ProductImageFields key={formVersion} cover={values.product.imagen} gallery={values.product.imagenes}
                disabled={pending} onChange={(name, value) => changeValue('product', name, value)}
                onReadingChange={changeReadingImages} />
              <fieldset className="mb-4" disabled={pending}>
                <legend className="fs-5 fw-semibold">Inventario</legend>
                <div className="row g-3">{inventoryFields.map(field => renderField('inventory', field))}</div>
              </fieldset>
              <p className="text-muted" role="status">
                {phase === 'checking' ? 'Comprobando código...' : phase === 'creating' ? 'Creando producto e inventario...' : readingImages ? 'Preparando im?genes...' : ''}
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
