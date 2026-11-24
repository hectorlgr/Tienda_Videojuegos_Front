import { useState } from 'react'
import { AuthContext } from './AuthContext'
import { clearSession, persistSession, readSession, userFromToken } from '../utils/authSession'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession)

  function login(token) {
    const sessionUser = userFromToken(token)
    if (sessionUser === null) {
      throw new TypeError('El usuario recibido no es válido para iniciar sesión.')
    }
    persistSession(token)
    setUser(sessionUser)
    return sessionUser
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
