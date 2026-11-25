import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppRouter from './AppRouter.jsx'
import AuthProvider from '../context/AuthProvider.jsx'
import CartProvider from '../context/CartProvider.jsx'
import { clearSession, persistSession } from '../utils/authSession'

afterEach(() => {
  cleanup()
  clearSession()
  vi.unstubAllGlobals()
})

function renderizarRuta(ruta) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AuthProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('AppRouter', () => {
  it('redirige /perfil a login sin sesión', () => {
    renderizarRuta('/perfil')
    expect(screen.getByRole('heading', { name: 'Inicio de sesión' })).toBeInTheDocument()
  })

  it('consulta el perfil y los pedidos propios, y conserva las ediciones si PATCH falla', async () => {
    const claims = btoa(JSON.stringify({
      userId: 1, sub: 'cliente@example.com', role: 'CLIENTE', exp: Date.now() / 1000 + 3600,
    }))
    const token = `header.${claims}.signature`
    persistSession(token)
    const fetchMock = vi.fn(async (url, { method }) => {
      if (method === 'PATCH') return new Response(null, { status: 405 })
      const data = url.pathname === '/api/v1/usuarios/me'
        ? { id: 1, nombre: 'Ana', email: 'cliente@example.com', telefono: '123' }
        : { _embedded: { pedidos: [{
          id: 23, fechaCreacion: '2026-11-24T12:00:00Z', estado: 'PAGADO', totalFinal: 19990,
          detalles: [{ productoId: 1, nombre: 'Juego de prueba', cantidad: 1, subtotal: 19990 }],
        }] } }
      return Response.json(data)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderizarRuta('/perfil')
    expect(await screen.findByDisplayValue('Ana')).toHaveAttribute('readonly')
    expect(await screen.findByRole('link', { name: 'Hola, Ana' })).toHaveAttribute('href', '/perfil')
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tus datos siguen en el formulario')
    expect(screen.getByLabelText('Teléfono')).toHaveValue('456')
    fireEvent.click(screen.getByRole('button', { name: 'Mis Pedidos' }))
    expect(await screen.findByRole('heading', { name: 'Pedido #23' })).toBeInTheDocument()
    expect(screen.getByText('Juego de prueba × 1')).toBeInTheDocument()
    const calls = fetchMock.mock.calls
    const [profileUrl, profile] = calls.find(([url, request]) => url.pathname === '/api/v1/usuarios/me' && request.method === 'GET')
    const [, patch] = calls.find(([, request]) => request.method === 'PATCH')
    const [ordersUrl, orders] = calls.find(([url]) => url.pathname === '/api/pedidos/mis-pedidos')
    expect(profileUrl.pathname).toBe('/api/v1/usuarios/me')
    expect(ordersUrl.pathname).toBe('/api/pedidos/mis-pedidos')
    expect(JSON.parse(patch.body)).toEqual({ telefono: '456', direccion: '', region: '', comuna: '' })
    for (const request of [profile, patch, orders]) expect(request.headers.Authorization).toBe(`Bearer ${token}`)
  })

  it('registra con un único POST público y muestra el mensaje de correo duplicado', async () => {
    persistSession('token-vencido')
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: 'El usuario con este email ya existe' }, { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    renderizarRuta('/registro')
    for (const [label, value] of [
      ['Nombre', 'Ana'], ['Apellidos (opcional)', 'Pérez'], ['Correo electrónico', 'ANA@example.com'],
      ['Contraseña', 'Clave123!'], ['Confirmar contraseña', 'Clave123!'],
    ]) {
      fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } })
    }
    fireEvent.click(screen.getByRole('button', { name: 'Registrarse' }))
    expect(await screen.findByText('El usuario con este email ya existe')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [[url, request]] = fetchMock.mock.calls
    expect(url.pathname).toBe('/auth/register/cliente')
    expect(request.method).toBe('POST')
    expect(request.headers.Authorization).toBeUndefined()
    expect(JSON.parse(request.body)).toEqual({ nombre: 'Ana Pérez', email: 'ana@example.com', password: 'Clave123!' })
  })

  it('/contacto muestra la vista Contacto', () => {
    renderizarRuta('/contacto')

    expect(screen.getByRole('heading', { name: 'Ponte en contacto con nosotros' })).toBeInTheDocument()
  })

  it('/criticas muestra su vista y no la de Contacto', () => {
    renderizarRuta('/criticas')

    expect(screen.getByRole('heading', { level: 1, name: 'Críticas y noticias' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Ponte en contacto con nosotros' })).not.toBeInTheDocument()
  })

  it('una ruta inexistente muestra el 404', () => {
    renderizarRuta('/esta-ruta-no-existe')

    expect(screen.getByRole('heading', { name: '404 — Página no encontrada' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toBeInTheDocument()
  })
})
