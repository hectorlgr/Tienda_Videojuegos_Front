// Sesión académica: JSON Server no es un sistema de autenticación real.
const SESSION_STORAGE_KEY = 'checkpoint.jwt'
let accessToken = null
const VALID_ROLES = ['cliente', 'vendedor', 'administrador']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OPTIONAL_FIELDS = ['run', 'nombre', 'apellidos', 'direccion', 'region', 'comuna']

// Copia solo los campos permitidos; password (y cualquier otro campo) queda fuera.
export function sanitizeSessionUser(user) {
  if (user === null || typeof user !== 'object' || Array.isArray(user)) return null
  if (!Number.isSafeInteger(user.id) || user.id <= 0) return null
  if (!VALID_ROLES.includes(user.rol)) return null

  const correo = typeof user.correo === 'string' ? user.correo.trim().toLowerCase() : ''
  if (!EMAIL_PATTERN.test(correo)) return null

  const sessionUser = { id: user.id, correo, rol: user.rol }
  for (const field of OPTIONAL_FIELDS) {
    const value = user[field]
    sessionUser[field] = typeof value === 'string' && value.trim() !== '' ? value.trim() : null
  }
  return sessionUser
}

export function userFromToken(token) {
  try {
    if (typeof token !== 'string' || token.split('.').length !== 3) return null
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(payload), character => character.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes))
    if (!Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000) return null
    return sanitizeSessionUser({
      id: claims.userId,
      correo: claims.sub,
      rol: typeof claims.role === 'string' ? claims.role.toLowerCase() : '',
    })
  } catch {
    return null
  }
}

export function readAccessToken() {
  if (accessToken) return accessToken
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    return null
  }
}

export function readSession() {
  return userFromToken(readAccessToken())
}

export function persistSession(token) {
  accessToken = token
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, token)
  } catch {
    // La sesión sigue disponible en memoria.
  }
}

export function clearSession() {
  accessToken = null
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // El almacenamiento puede estar bloqueado.
  }
}
