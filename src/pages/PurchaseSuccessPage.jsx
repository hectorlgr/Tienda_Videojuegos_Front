import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getMyOrder } from '../services/orderService'
import { formatCLP } from '../utils/currency'

export default function PurchaseSuccessPage() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const pedidoId = state?.pedidoId
  const hasOrder = Number.isSafeInteger(pedidoId) && pedidoId > 0
  const [receipt, setReceipt] = useState(null)

  useEffect(() => {
    if (!hasOrder) return
    let active = true
    getMyOrder(pedidoId).then(
      order => { if (active) setReceipt({ pedidoId, order }) },
      () => { if (active) setReceipt({ pedidoId }) },
    )
    return () => { active = false }
  }, [hasOrder, pedidoId])

  const currentReceipt = receipt?.pedidoId === pedidoId ? receipt : null
  const order = currentReceipt?.order

  return (
    <section className="section" aria-labelledby="purchase-success-title">
      <title>Confirmación de compra — CheckPoint Store</title>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8">
            <div className="card shadow-sm p-3 p-md-5 text-center">
              {hasOrder ? (
                <>
                  <i className="fa fa-check-circle text-success fs-1 mb-3" aria-hidden="true" />
                  <h1 id="purchase-success-title" className="fs-3">Pedido registrado con éxito</h1>
                  <p>Pedido #{pedidoId} · {order?.estado ?? state.estadoPedido}</p>
                  {order ? (
                    <section className="text-start" aria-label="Resumen de productos">
                      <ul className="list-group list-group-flush">
                        {order.detalles.map(item => (
                          <li className="list-group-item d-flex flex-wrap justify-content-between gap-2" key={item.productoId}>
                            <span>{item.nombre} × {item.cantidad}</span><span>{formatCLP(item.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-end mt-3 mb-1">Envío {formatCLP(order.costoDespacho)}</p>
                      <p className="text-end fw-semibold">Total del pedido {formatCLP(order.totalFinal)}</p>
                    </section>
                  ) : (
                    <p role="status">{currentReceipt ? 'Puedes consultar el detalle en Mi Perfil.' : 'Cargando el detalle del pedido…'}</p>
                  )}
                </>
              ) : (
                <h1 id="purchase-success-title" className="fs-3">Resumen de compra no disponible</h1>
              )}
              <div className="d-grid gap-3 d-sm-flex justify-content-sm-center mt-3">
                <Link className="btn btn-success" to="/perfil">Ir a Mi Perfil</Link>
                <button type="button" className="btn btn-outline-dark" onClick={() => navigate('/', { replace: true })}>Volver al inicio</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
