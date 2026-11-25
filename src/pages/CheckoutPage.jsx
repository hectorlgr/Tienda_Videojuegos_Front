import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ShippingDestination from '../components/store/ShippingDestination'
import { SHIPPING_REGIONS } from '../config/shippingRegions'
import { useCartDetails } from '../hooks/useCartDetails'
import { useAuth } from '../hooks/useAuth'
import { useCart } from '../hooks/useCart'
import { createOrder } from '../services/orderService'
import { getProfile } from '../services/profileService'
import { initialCheckoutDelivery, normalizeCheckoutDelivery, validateCheckout } from '../utils/checkoutValidation'
import { calculateCartTotal, calculateLineSubtotal, calculateProductsSubtotal, isValidPrice } from '../utils/cartCalculations'
import { formatCLP } from '../utils/currency'
import { getEffectivePrice } from '../utils/pricing'

const deliveryFields = [
  { name: 'destinatario', label: 'Destinatario', maxLength: 255 },
  { name: 'telefono', label: 'Teléfono', type: 'tel', maxLength: 30 },
  { name: 'direccion', label: 'Dirección', maxLength: 255 },
]

const CONDITIONS_VERSION = 'CHECKPOINT_COMPRA_V1'

function readAttempt(key) {
  try {
    const attempt = JSON.parse(sessionStorage.getItem(key))
    return typeof attempt?.id === 'string' && Array.isArray(attempt.body?.items) ? attempt : null
  } catch {
    return null
  }
}

function saveAttempt(key, attempt) {
  try {
    if (attempt) sessionStorage.setItem(key, JSON.stringify(attempt))
    else sessionStorage.removeItem(key)
  } catch {
    // El intento sigue disponible en memoria durante esta visita.
  }
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { lines, loading, error } = useCartDetails()
  const { user } = useAuth()
  const { items, clearCart } = useCart()
  const [delivery, setDelivery] = useState(() => initialCheckoutDelivery(user))
  const editedFields = useRef(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [sending, setSending] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const attemptKey = `checkout-attempt-${user.id}`
  const [attempt, setAttempt] = useState(() => readAttempt(attemptKey))
  const submitting = useRef(false)
  const needsDelivery = lines.some(({ product }) => product?.categoria !== 'juego' || product?.formato !== 'digital')
  const shippingCost = needsDelivery ? 3990 : 0
  const subtotal = !loading && !error ? calculateProductsSubtotal(lines) : null
  const total = calculateCartTotal(subtotal, shippingCost)
  const validCart = lines.length > 0 && lines.length <= 100 &&
    lines.every(line => calculateLineSubtotal(line) !== null && line.cantidad <= line.stock)
  const canConfirm = validCart && Number.isSafeInteger(total) && total > 0
  const errors = submitted ? validateCheckout(delivery) : {}

  useEffect(() => {
    if (!needsDelivery) return
    let active = true
    getProfile().then(profile => {
      if (!active) return
      const defaults = initialCheckoutDelivery(profile)
      const updates = Object.entries(defaults).filter(([field, value]) => value && !editedFields.current.has(field))
      setDelivery(current => ({ ...current, ...Object.fromEntries(updates) }))
    }).catch(() => {
      // El formulario sigue disponible para completar los datos manualmente.
    })
    return () => { active = false }
  }, [needsDelivery, user.id])

  function changeDelivery(changes) {
    for (const field of Object.keys(changes)) editedFields.current.add(field)
    setDelivery(current => ({ ...current, ...changes }))
  }

  async function confirmOrder() {
    if (submitting.current) return
    setPaymentError('')
    let purchase = attempt
    if (!purchase) {
      if (!accepted || !canConfirm) return
      const normalized = normalizeCheckoutDelivery(delivery)
      const nextErrors = needsDelivery ? validateCheckout(normalized) : {}
      setDelivery(normalized)
      setSubmitted(true)
      if (Object.keys(nextErrors).length > 0) return

      const { regionId, ...contact } = normalized
      purchase = {
        id: crypto.randomUUID(),
        body: {
          items: lines.map(({ productoId, cantidad }) => ({ productoId, cantidad })),
          entrega: needsDelivery ? { ...contact, region: regionId, referencia: null } : null,
          limiteTotalClp: total,
          aceptacion: { versionCondiciones: CONDITIONS_VERSION, aceptaPrecioVigenteHastaLimite: true },
        },
      }
      setAttempt(purchase)
      saveAttempt(attemptKey, purchase)
    }

    submitting.current = true
    setSending(true)
    try {
      const { status, data } = await createOrder(purchase.body, purchase.id)
      if (![200, 201].includes(status) || data?.resultado !== 'PEDIDO_CREADO' ||
          !Number.isSafeInteger(data.pedidoId) || data.pedidoId <= 0) {
        setPaymentError('Tu pedido aún no está confirmado. Reintenta en unos segundos para consultar el mismo intento.')
        return
      }
      setAttempt(null)
      saveAttempt(attemptKey, null)
      const purchased = purchase.body.items
      if (items.length === purchased.length && items.every(item =>
        purchased.some(line => line.productoId === item.productoId && line.cantidad === item.cantidad))) clearCart()
      navigate('/compra-exitosa', { replace: true, state: { pedidoId: data.pedidoId, estadoPedido: data.estadoPedido } })
    } catch (failure) {
      if ([400, 413, 415, 422].includes(failure.status)) {
        setAttempt(null)
        saveAttempt(attemptKey, null)
        setAccepted(false)
        setPaymentError('No pudimos completar el pedido. Revisa el stock, los precios y los datos de entrega antes de volver a intentar.')
      } else {
        setPaymentError(failure.status === 409
          ? 'Este intento requiere revisión. Revisa Mis Pedidos antes de volver a comprar.'
          : 'No pudimos confirmar el pedido. Puedes reintentar con la misma clave sin crear un duplicado.')
      }
    } finally {
      submitting.current = false
      setSending(false)
    }
  }

  function changeRegion(regionId) {
    const nextRegion = SHIPPING_REGIONS.find(option => option.id === regionId)
    changeDelivery({
      regionId,
      comuna: nextRegion?.comunas.includes(delivery.comuna) ? delivery.comuna : '',
    })
  }

  return (
    <section className="section checkout-page" aria-labelledby="checkout-title">
      <title>Checkout — CheckPoint Store</title>
      <div className="container">
        <h1 id="checkout-title" className="mb-4">Checkout</h1>
        {paymentError && <p className="alert alert-danger" role="alert">{paymentError}</p>}
        <div aria-busy={loading}>
          {attempt ? (
            <section className="card shadow-sm p-3 p-md-4" aria-label="Pedido en proceso">
              <p>Intento de compra por hasta {formatCLP(attempt.body.limiteTotalClp)}.</p>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-success" onClick={confirmOrder} disabled={sending}>
                  {sending ? 'Confirmando pedido…' : 'Reintentar confirmación'}
                </button>
                <Link className="btn btn-outline-dark" to="/perfil">Ir a Mi Perfil</Link>
              </div>
            </section>
          ) : loading ? (
            <p className="catalog-state" role="status">Cargando tu compra…</p>
          ) : error ? (
            <p className="catalog-state" role="alert">No pudimos cargar los productos de tu carrito. Inténtalo más tarde.</p>
          ) : lines.length === 0 ? (
            <p className="catalog-state" role="status">Tu carrito está vacío.</p>
          ) : (
            <div className="row g-4 align-items-start">
              {needsDelivery && <div className="col-12 col-lg-7">
                <section className="card shadow-sm p-3 p-md-4" aria-labelledby="delivery-title">
                  <h2 id="delivery-title" className="fs-4 mb-3">Datos de entrega</h2>
                  <div role="alert">
                    {submitted && Object.keys(errors).length > 0 && (
                      <p className="alert alert-danger">Revisa los campos indicados.</p>
                    )}
                  </div>
                  <div className="row g-3">
                    {deliveryFields.map(({ name, label, type = 'text', maxLength }) => (
                      <div className="col-12 col-md-6" key={name}>
                        <label className="form-label" htmlFor={`checkout-${name}`}>{label}</label>
                        <input
                          id={`checkout-${name}`}
                          name={name}
                          type={type}
                          maxLength={maxLength}
                          className={`form-control${errors[name] ? ' is-invalid' : ''}`}
                          aria-invalid={errors[name] ? true : undefined}
                          aria-describedby={errors[name] ? `checkout-${name}-error` : undefined}
                          value={delivery[name]}
                          onChange={event => changeDelivery({ [name]: event.target.value })}
                        />
                        {errors[name] && <div id={`checkout-${name}-error`} className="invalid-feedback">{errors[name]}</div>}
                      </div>
                    ))}
                  </div>
                  <ShippingDestination
                    regionId={delivery.regionId}
                    comuna={delivery.comuna}
                    onRegionChange={changeRegion}
                    onComunaChange={comuna => changeDelivery({ comuna })}
                    errors={errors}
                  />
                </section>
              </div>}
              <div className="col-12 col-lg-5">
                <section className="card shadow-sm p-3 p-md-4 text-break" aria-labelledby="summary-title">
                  <h2 id="summary-title" className="fs-4 mb-3">Resumen de compra</h2>
                  <ul className="list-unstyled mb-0" aria-label="Productos de la compra">
                    {lines.map(line => {
                      const lineSubtotal = calculateLineSubtotal(line)
                      return (
                        <li key={line.productoId} className="border-bottom pb-3 mb-3">
                          <h3 className="fs-6">{line.product?.nombre ?? 'Producto no disponible'}</h3>
                          <p className="mb-1">Cantidad: {line.cantidad}</p>
                          <p className="mb-1">Precio unitario: {isValidPrice(getEffectivePrice(line.product)) ? formatCLP(getEffectivePrice(line.product)) : 'No disponible'}</p>
                          <p className="mb-0 fw-semibold">Subtotal: {lineSubtotal !== null ? formatCLP(lineSubtotal) : 'No disponible'}</p>
                        </li>
                      )
                    })}
                  </ul>
                  <dl className="mb-0" aria-live="polite">
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <dt>Subtotal</dt>
                      <dd>{subtotal !== null ? formatCLP(subtotal) : 'No disponible'}</dd>
                    </div>
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <dt>Envío</dt>
                      <dd>{formatCLP(shippingCost)}</dd>
                    </div>
                    <div className="d-flex flex-wrap justify-content-between gap-2 border-top pt-3 fw-bold">
                      <dt>Total</dt>
                      <dd>{total !== null ? formatCLP(total) : 'Pendiente'}</dd>
                    </div>
                  </dl>
                  <div className="d-grid gap-2 mt-3">
                    {!validCart && <p className="alert alert-warning mb-0">Revisa la disponibilidad y las cantidades de tu carrito. El máximo es de 100 productos distintos por pedido.</p>}
                    <p className="small mb-1">
                      Se aplican los precios vigentes de Catálogo sin IVA adicional y la compra requiere stock suficiente.
                      El envío cuesta {formatCLP(3990)} para pedidos físicos o mixtos y {formatCLP(0)} para pedidos digitales.
                      Esta es una compra académica sin cobros ni despachos reales.
                    </p>
                    <label className="form-check-label">
                      <input className="form-check-input me-2" type="checkbox" checked={accepted}
                        disabled={!canConfirm}
                        onChange={event => setAccepted(event.target.checked)} />
                      Acepto las condiciones y el precio vigente hasta {total === null ? 'el total mostrado' : formatCLP(total)}.
                    </label>
                    <button type="button" className="btn btn-success" onClick={confirmOrder}
                      disabled={!accepted || !canConfirm}>Confirmar compra</button>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
        <Link className="btn btn-outline-dark mt-3" to="/carrito">Volver al carrito</Link>
      </div>
    </section>
  )
}
