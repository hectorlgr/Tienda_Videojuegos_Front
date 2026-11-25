export const ROLE_LABELS = {
  cliente: 'Cliente',
  vendedor: 'Vendedor',
  administrador: 'Administrador',
}

const ROLE_BADGES = {
  cliente: 'text-bg-light',
  vendedor: 'text-bg-info',
  administrador: 'text-bg-dark',
}

export function toPublicUser({ id, nombre, email, role }) {
  return { id, nombre, correo: email, rol: normalizedText(role, true) }
}

export function roleLabel(rol) {
  return Object.hasOwn(ROLE_LABELS, rol) ? ROLE_LABELS[rol] : 'Rol desconocido'
}

export function roleBadgeClass(rol) {
  return Object.hasOwn(ROLE_BADGES, rol) ? ROLE_BADGES[rol] : 'text-bg-warning'
}

function normalizedText(value, lowercase = false) {
  if (typeof value !== 'string' || value.trim() === '') return null
  return lowercase ? value.trim().toLowerCase() : value.trim()
}

export function normalizeId(value) {
  const id = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function findUserOrders(user, orders) {
  const userId = normalizeId(user.id)
  if (userId === null) return { matches: [], incomplete: true }

  const matches = []
  let incomplete = false
  for (const order of orders) {
    const buyerId = normalizeId(order.usuarioId)
    if (buyerId === null) incomplete = true
    else if (buyerId === userId) matches.push(order)
  }
  return { matches, incomplete }
}
