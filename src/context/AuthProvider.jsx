import { useEffect, useState } from 'react'
import { AuthContext } from './AuthContext'
import { getProfile } from '../services/profileService'
import { clearSession, persistSession, readAccessToken, readSession, sanitizeSessionUser, userFromToken } from '../utils/authSession'

function withProfile(user, profile) {
  if (profile?.id !== user.id || typeof profile.nombre !== 'string' || !profile.nombre.trim()) {
    throw new TypeError('No se pudo verificar el perfil de la sesión.')
  }
  return sanitizeSessionUser({ ...user, nombre: profile.nombre })
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession)

  const restoredUser = user && !user.nombre ? user : null

  useEffect(() => {
    if (!restoredUser) return
    let active = true
    const token = readAccessToken()
    getProfile().then(profile => {
      if (active && readAccessToken() === token) setUser(withProfile(restoredUser, profile))
    }).catch(() => {
      // El perfil sigue disponible para reintentar desde su propia vista.
    })
    return () => { active = false }
  }, [restoredUser])

  async function login(token) {
    const sessionUser = userFromToken(token)
    if (sessionUser === null) {
      throw new TypeError('El usuario recibido no es válido para iniciar sesión.')
    }
    const previousToken = readAccessToken()
    persistSession(token)
    try {
      const authenticatedUser = withProfile(sessionUser, await getProfile())
      if (readAccessToken() !== token) throw new Error('La sesión cambió.')
      setUser(authenticatedUser)
      return authenticatedUser
    } catch (error) {
      if (readAccessToken() === token) {
        if (previousToken) persistSession(previousToken)
        else clearSession()
      }
      throw new Error('No pudimos cargar tu perfil después de iniciar sesión. Inténtalo nuevamente.', { cause: error })
    }
  }

  function logout() {
    clearSession()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
