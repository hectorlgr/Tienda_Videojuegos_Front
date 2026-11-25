import { Link, useParams } from 'react-router-dom'
import { useAdminUserDetail } from '../../hooks/useAdminUserDetail'
import { roleBadgeClass, roleLabel } from '../../utils/adminUsers'
import { formatCLP } from '../../utils/currency'
import { orderStatusClass } from '../../utils/orderStatus'

const profileFields = [
  ['id', 'ID'],
  ['correo', 'Correo'],
]

function displayValue(value) {
  return value == null || value === '' ? '—' : value
}

function BackLink() {
  return (
    <Link className="btn btn-outline-dark" to="/admin/usuarios">
      <i className="fa fa-arrow-left" aria-hidden="true" /> Volver a usuarios
    </Link>
  )
}

function DetailStatus({ title, description, loading = false }) {
  return (
    <section className="section admin-user-detail-page">
      <title>{`${title} — CheckPoint Store`}</title>
      <div className="container">
        <div aria-busy={loading}>
          <div role={loading ? 'status' : 'alert'}>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <BackLink />
        </div>
      </div>
    </section>
  )
}

function UserOrders({ orders, ordersError, incomplete }) {
  if (ordersError) {
    return <p className="alert alert-warning mb-0" role="alert">No fue posible cargar las compras de este usuario.</p>
  }
  if (orders.length === 0) {
    return <p className="text-muted mb-0">{incomplete
      ? 'Faltan identificadores válidos para determinar si este usuario tiene compras.'
      : 'Este usuario no tiene compras asociadas.'}</p>
  }

  return (
    <div className="table-responsive admin-user-orders-table" role="region" aria-label="Compras asociadas" tabIndex={0}>
      {incomplete && <p>Algunos pedidos carecen de un ID de comprador válido. La lista puede estar incompleta.</p>}
      <table className="table table-striped align-middle mb-0">
        <caption className="visually-hidden">Pedidos asociados por ID de comprador</caption>
        <thead className="table-dark">
          <tr>
            <th scope="col">Orden</th>
            <th scope="col">Comuna</th>
            <th scope="col" className="text-end">Monto total</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <th scope="row">{displayValue(order.id)}</th>
              <td>{displayValue(order.comuna)}</td>
              <td className="text-end text-nowrap">
                {Number.isFinite(order.montoTotal) ? formatCLP(order.montoTotal) : '—'}
              </td>
              <td><span className={`badge ${orderStatusClass(order.estado)}`}>{displayValue(order.estado)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const userId = Number(id)
  const { user, orders, loading, error, ordersError, incomplete } = useAdminUserDetail(userId)

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return <DetailStatus title="ID de usuario inválido" description="El enlace no contiene un identificador de usuario válido." />
  }
  if (loading) {
    return <DetailStatus title="Detalle de usuario" description="Cargando usuario…" loading />
  }
  if (error || !user) {
    return <DetailStatus title="Error al cargar el usuario" description={error?.message ?? 'No pudimos cargar la información del usuario.'} />
  }

  const name = user.nombre || user.correo || `Usuario ${user.id}`

  return (
    <section className="section admin-user-detail-page" aria-labelledby="user-title">
      <title>{`${name} — CheckPoint Store`}</title>
      <div className="container">
        <div className="mb-4"><BackLink /></div>

        <div className="card shadow-sm mb-4">
          <div className="card-body p-3 p-md-4">
            <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
              <h1 id="user-title" className="mb-0">{name}</h1>
              <span className={`badge ${roleBadgeClass(user.rol)}`}>{roleLabel(user.rol)}</span>
            </div>
            <dl className="admin-user-facts mb-0">
              {profileFields.map(([field, label]) => (
                <div key={field}>
                  <dt>{label}</dt>
                  <dd>{displayValue(user[field])}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="card shadow-sm">
          <div className="card-body p-3 p-md-4">
            <h2 className="fs-5 mb-1">Compras asociadas</h2>
            <p className="text-muted small">Se muestran los pedidos cuyo ID de comprador coincide con el ID del usuario.</p>
            <UserOrders orders={orders} ordersError={ordersError} incomplete={incomplete} />
          </div>
        </div>
      </div>
    </section>
  )
}
