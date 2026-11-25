import { useEffect, useRef, useState } from 'react'
import RegionCommuneFields from '../components/common/RegionCommuneFields'
import { getProfile, updateProfile } from '../services/profileService'
import { getMyOrders } from '../services/orderService'
import { formatCLP } from '../utils/currency'

const personalFields = [
  { name: 'nombre', label: 'Nombre', readOnly: true, autoComplete: 'name' },
  { name: 'email', label: 'Correo electrónico', readOnly: true, type: 'email', autoComplete: 'email' },
  { name: 'telefono', label: 'Teléfono', type: 'tel', maxLength: 30, autoComplete: 'tel' },
  { name: 'direccion', label: 'Dirección', maxLength: 255, autoComplete: 'street-address' },
]

function PersonalInformation() {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const pending = useRef(false)

  useEffect(() => {
    let active = true
    getProfile().then(
      data => { if (active) setProfile(data) },
      () => { if (active) setError('No pudimos cargar tus datos. Recarga la página para volver a intentarlo.') },
    )
    return () => { active = false }
  }, [])

  function handleChange({ target: { name, value } }) {
    setProfile(current => ({ ...current, [name]: value, ...(name === 'region' ? { comuna: '' } : {}) }))
    setError('')
    setSaved(false)
  }

  function controlProps(name, className = 'form-control') {
    return { id: `profile-${name}`, name, className, value: profile[name] ?? '', disabled: saving, onChange: handleChange }
  }

  async function save(event) {
    event.preventDefault()
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError('')
    setSaved(false)
    const changes = Object.fromEntries(
      ['telefono', 'direccion', 'region', 'comuna'].map(field => [field, profile[field]?.trim() ?? '']),
    )
    try {
      const updated = await updateProfile(changes)
      setProfile(updated ?? { ...profile, ...changes })
      setSaved(true)
    } catch (failure) {
      if (failure.status === 401) {
        setError('Tu sesión expiró. Cierra sesión y vuelve a ingresar para guardar los cambios.')
      } else if (failure.status == null || [403, 405, 501].includes(failure.status)) {
        setError('El servidor no permitió guardar tus cambios o no está disponible. Tus datos siguen en el formulario. Inténtalo más tarde.')
      } else {
        setError(failure.message || 'No pudimos guardar tus cambios. Inténtalo nuevamente.')
      }
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  if (!profile && !error) return <p role="status">Cargando tus datos…</p>

  return (
    <>
      {error && <p className="alert alert-danger py-2" role="alert">{error}</p>}
      {saved && <p className="alert alert-success py-2" role="status">Guardamos tus cambios.</p>}
      {profile && (
        <form onSubmit={save} aria-busy={saving}>
          <div className="row g-3">
            {personalFields.map(({ name, label, ...props }) => (
              <div key={name} className="col-12">
                <label htmlFor={`profile-${name}`} className="form-label fw-semibold">{label}</label>
                <input {...controlProps(name)} {...props} />
              </div>
            ))}
            <RegionCommuneFields controlProps={controlProps} preserveUnknown />
          </div>
          <div className="d-grid mt-4">
            <button type="submit" className="btn btn-dark py-2" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}

const dateFormatter = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' })

function MyOrders() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getMyOrders().then(
      data => { if (active) setOrders(data) },
      () => { if (active) setError('No pudimos cargar tus pedidos. Vuelve a abrir esta sección para intentarlo de nuevo.') },
    )
    return () => { active = false }
  }, [])

  if (error) return <p className="alert alert-danger py-2" role="alert">{error}</p>
  if (!orders) return <p role="status">Cargando tus pedidos…</p>
  if (!orders.length) return <p className="text-muted mb-0">Todavía no tienes pedidos.</p>

  return orders.map(order => (
    <article key={order.id} className="border rounded p-3 mb-3">
      <h3 className="fs-6 mb-2">Pedido #{order.codigo ?? order.id}</h3>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        {order.fechaCreacion && Number.isFinite(Date.parse(order.fechaCreacion)) && (
          <time dateTime={order.fechaCreacion}>{dateFormatter.format(new Date(order.fechaCreacion))}</time>
        )}
        <span className="badge text-bg-secondary">{order.estado?.replaceAll('_', ' ') ?? 'Sin estado'}</span>
      </div>
      <ul className="list-group list-group-flush">
        {order.detalles?.map(item => (
          <li key={item.productoId} className="list-group-item px-0 d-flex flex-wrap justify-content-between gap-2">
            <span>{item.nombre} × {item.cantidad}</span>
            <span>{formatCLP(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="text-end fw-semibold mb-0 mt-2">Total {formatCLP(order.totalFinal)}</p>
    </article>
  ))
}

export default function ProfilePage() {
  const [section, setSection] = useState('datos')

  return (
    <section className="section register-page" aria-labelledby="profile-title">
      <title>Mi perfil — CheckPoint Store</title>
      <div className="container">
        <div className="contenedor-formulario registro">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-secondary text-white text-center py-2">
              <h1 id="profile-title" className="mb-0 fs-6 text-uppercase fw-semibold">Mi perfil</h1>
            </div>
            <div className="card-body p-4">
              <div className="nav nav-tabs mb-3" role="group" aria-label="Secciones de mi perfil">
                <button type="button" className={`nav-link${section === 'datos' ? ' active' : ''}`}
                  aria-pressed={section === 'datos'} onClick={() => setSection('datos')}>Mis Datos</button>
                <button type="button" className={`nav-link${section === 'pedidos' ? ' active' : ''}`}
                  aria-pressed={section === 'pedidos'} onClick={() => setSection('pedidos')}>Mis Pedidos</button>
              </div>
              <section hidden={section !== 'datos'} aria-label="Mis Datos">
                <PersonalInformation />
              </section>
              {section === 'pedidos' && (
                <section aria-label="Mis Pedidos"><MyOrders /></section>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
