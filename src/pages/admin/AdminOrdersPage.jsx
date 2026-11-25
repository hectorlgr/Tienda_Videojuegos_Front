import { useEffect, useRef, useState } from 'react'
import { getOrders } from '../../services/orderService'
import { getUsers } from '../../services/userService'
import { isRecordCollection } from '../../utils/adminMetrics'
import { normalizeId } from '../../utils/adminUsers'
import { formatCLP } from '../../utils/currency'
import { orderStatusClass } from '../../utils/orderStatus'

function displayValue(value) {
  return value == null || value === '' ? '—' : value
}

function deliveryValue(order, field) {
  return order.requiereDespacho === false ? 'No aplica' : displayValue(order.entrega?.[field])
}

async function loadOrders() {
  const [orders, users] = await Promise.allSettled([getOrders(), getUsers()])
  if (orders.status === 'rejected' || !isRecordCollection(orders.value)) {
    return { error: true }
  }

  const usersUnavailable = users.status === 'rejected' || !isRecordCollection(users.value)
  const buyers = new Map()
  if (!usersUnavailable) {
    for (const user of users.value) {
      const id = normalizeId(user.id)
      if (id !== null) buyers.set(id, buyers.has(id) ? null : user)
    }
  }

  return {
    usersUnavailable,
    orders: orders.value.map(order => ({
      ...order,
      buyer: buyers.get(normalizeId(order.usuarioId)),
    })),
  }
}

export default function AdminOrdersPage() {
  const [result, setResult] = useState({ loading: true })
  const request = useRef(null)

  useEffect(() => {
    let active = true
    request.current ??= loadOrders()
    request.current.then(data => {
      if (active) setResult(data)
    })
    return () => { active = false }
  }, [])

  const { orders, loading, error, usersUnavailable } = result

  return (
    <section className="section admin-orders-page" aria-labelledby="orders-title">
      <title>Órdenes de usuarios — CheckPoint Store</title>
      <div className="container">
        <h1 id="orders-title" className="text-center mb-4">Órdenes de usuarios</h1>
        {loading ? (
          <p className="catalog-state" role="status">Cargando órdenes...</p>
        ) : error ? (
          <p className="alert alert-danger" role="alert">No fue posible cargar las órdenes.</p>
        ) : orders.length === 0 ? (
          <p className="catalog-state" role="status">No hay órdenes disponibles.</p>
        ) : (
          <>
            {usersUnavailable && (
              <p className="alert alert-warning" role="status">La información del comprador no está disponible.</p>
            )}
            <p id="orders-scroll-help" className="text-muted small">
              Si la tabla no cabe en pantalla, desplázala horizontalmente para ver todos los campos.
            </p>
            <div
              className="table-responsive admin-orders-table"
              role="region"
              aria-labelledby="orders-title"
              aria-describedby="orders-scroll-help"
              tabIndex={0}
            >
              <table className="table table-striped table-hover align-middle mb-0">
                <caption className="visually-hidden">Listado de órdenes de usuarios</caption>
                <thead className="table-dark">
                  <tr>
                    <th scope="col">Orden</th>
                    <th scope="col">Comprador</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Región</th>
                    <th scope="col">Comuna</th>
                    <th scope="col">Dirección</th>
                    <th scope="col">Monto total</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id}>
                      <th scope="row">{displayValue(order.id)}</th>
                      <td>{order.buyer?.nombre || 'No disponible'}</td>
                      <td>{order.buyer?.email || 'No disponible'}</td>
                      <td>{deliveryValue(order, 'region')}</td>
                      <td>{deliveryValue(order, 'comuna')}</td>
                      <td>{deliveryValue(order, 'direccion')}</td>
                      <td className="text-nowrap">
                        {order.montoTotal == null || order.montoTotal === '' ? '—' : formatCLP(order.montoTotal)}
                      </td>
                      <td><span className={`badge ${orderStatusClass(order.estado)}`}>{displayValue(order.estado)}</span></td>
                      <td>
                        <details>
                          <summary className="text-nowrap">Ver detalle</summary>
                          <dl className="mb-0">
                            <dt>Comprador</dt><dd>{order.buyer?.nombre || 'No disponible'}</dd>
                            <dt>Correo</dt><dd>{order.buyer?.email || 'No disponible'}</dd>
                            <dt>Destinatario</dt><dd>{deliveryValue(order, 'destinatario')}</dd>
                            <dt>Teléfono de entrega</dt><dd>{deliveryValue(order, 'telefono')}</dd>
                            <dt>Región</dt><dd>{deliveryValue(order, 'region')}</dd>
                            <dt>Comuna</dt><dd>{deliveryValue(order, 'comuna')}</dd>
                            <dt>Dirección</dt><dd>{deliveryValue(order, 'direccion')}</dd>
                            <dt>Referencia</dt><dd>{deliveryValue(order, 'referencia')}</dd>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
