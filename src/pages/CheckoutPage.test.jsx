import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/AuthContext'
import { CartContext } from '../context/CartContext'
import { getMyOrders } from '../services/orderService'
import { clearSession, persistSession } from '../utils/authSession'
import CheckoutPage from './CheckoutPage'
import PurchaseSuccessPage from './PurchaseSuccessPage'

afterEach(() => {
  cleanup()
  clearSession()
  sessionStorage.removeItem('checkout-attempt-1')
  vi.unstubAllGlobals()
})

it('reintenta un pedido pendiente con el mismo UUID y vuelve al inicio tras confirmarlo', async () => {
  persistSession('checkout-test-token')
  const items = [{ productoId: 7, cantidad: 2 }]
  const product = { id: 7, nombre: 'Juego', categoria: 'VIDEOJUEGO', formato: 'FISICO', precio: 9990, stock: 3 }
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ _embedded: { productos: [product] } }))
    .mockRejectedValueOnce(new Error('Perfil no disponible'))
    .mockResolvedValueOnce(Response.json({ resultado: 'PENDIENTE' }, { status: 202 }))
    .mockResolvedValueOnce(Response.json({ resultado: 'PEDIDO_CREADO', pedidoId: 23, estadoPedido: 'CREADO' }))
    .mockResolvedValueOnce(Response.json({ estado: 'CREADO', detalles: [], costoDespacho: 3990, totalFinal: 23970 }))
  vi.stubGlobal('fetch', fetchMock)
  const clearCart = vi.fn()
  render(
    <AuthContext.Provider value={{ user: { id: 1, nombre: 'Ana' } }}>
      <CartContext.Provider value={{ items, clearCart }}>
        <MemoryRouter initialEntries={['/checkout']}>
          <Routes>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/compra-exitosa" element={<PurchaseSuccessPage />} />
            <Route path="/" element={<h1>Inicio de prueba</h1>} />
          </Routes>
        </MemoryRouter>
      </CartContext.Provider>
    </AuthContext.Provider>,
  )
  const confirm = await screen.findByRole('button', { name: 'Confirmar compra' })
  expect(confirm).toBeDisabled()
  for (const [label, value] of [
    ['Teléfono', '+56912345678'], ['Dirección', 'Calle 123'], ['Región', 'metropolitana'], ['Comuna', 'Santiago'],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(confirm)

  expect(await screen.findByRole('alert')).toHaveTextContent('aún no está confirmado')
  expect(clearCart).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar confirmación' }))
  expect(await screen.findByRole('heading', { name: 'Pedido registrado con éxito' })).toBeInTheDocument()
  expect(await screen.findByText(/Total del pedido/)).toBeInTheDocument()
  expect(clearCart).toHaveBeenCalledTimes(1)
  const [[url, first], [, retry]] = fetchMock.mock.calls.filter(([url]) => url.pathname === '/api/pedidos')
  expect(url.pathname).toBe('/api/pedidos')
  expect(first.headers.Authorization).toBe('Bearer checkout-test-token')
  expect(first.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/)
  expect(retry).toEqual(first)
  expect(JSON.parse(first.body)).toEqual({
    items,
    entrega: { destinatario: 'Ana', telefono: '+56912345678', direccion: 'Calle 123', region: 'metropolitana', comuna: 'Santiago', referencia: null },
    limiteTotalClp: 23970,
    aceptacion: { versionCondiciones: 'CHECKPOINT_COMPRA_V1', aceptaPrecioVigenteHastaLimite: true },
  })
  expect(sessionStorage.getItem('checkout-attempt-1')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }))
  expect(screen.getByRole('heading', { name: 'Inicio de prueba' })).toBeInTheDocument()
})

it.each(['física', 'mixta', 'digital'])('usa los datos de entrega correspondientes a una compra %s', async tipo => {
  const formatos = tipo === 'mixta' ? ['DIGITAL', 'FISICO'] : [tipo === 'digital' ? 'DIGITAL' : 'FISICO']
  const productos = formatos.map((formato, i) => ({
    id: i + 1, nombre: 'Juego', categoria: 'VIDEOJUEGO', formato, precio: 9990, stock: 2,
  }))
  const items = productos.map(({ id }) => ({ productoId: id, cantidad: 1 }))
  const profile = Promise.withResolvers()
  const fetchMock = vi.fn(url => {
    if (url.pathname === '/api/v1/usuarios/me') return profile.promise
    if (url.pathname === '/api/pedidos') return Promise.resolve(Response.json({ resultado: 'PENDIENTE' }, { status: 202 }))
    return Promise.resolve(Response.json({ _embedded: { productos } }))
  })
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthContext.Provider value={{ user: { id: 1, nombre: 'Ana' } }}>
      <CartContext.Provider value={{ items }}>
        <MemoryRouter><CheckoutPage /></MemoryRouter>
      </CartContext.Provider>
    </AuthContext.Provider>,
  )
  const confirm = await screen.findByRole('button', { name: 'Confirmar compra' })
  if (tipo === 'digital') {
    expect(screen.queryByLabelText('Destinatario')).toBeNull()
    expect(fetchMock.mock.calls.some(([url]) => url.pathname === '/api/v1/usuarios/me')).toBe(false)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(confirm)
    const [, request] = fetchMock.mock.calls.find(([url]) => url.pathname === '/api/pedidos')
    expect(JSON.parse(request.body).entrega).toBeNull()
    await screen.findByRole('button', { name: 'Reintentar confirmación' })
    return
  }
  if (tipo === 'mixta') {
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('Región'), { target: { value: 'metropolitana' } })
  }
  await act(async () => profile.resolve(Response.json({
    nombre: 'Ana María', telefono: '987654321', direccion: 'Calle 123', region: ' Región de Valparaíso ', comuna: 'QUILPUE',
  })))
  expect(screen.getByLabelText('Destinatario')).toHaveValue('Ana María')
  expect(screen.getByLabelText('Dirección')).toHaveValue('Calle 123')
  expect(screen.getByLabelText('Teléfono')).toHaveValue(tipo === 'mixta' ? '123456' : '987654321')
  expect(screen.getByLabelText('Región')).toHaveValue(tipo === 'mixta' ? 'metropolitana' : 'valparaiso')
  expect(screen.getByLabelText('Comuna')).toHaveValue(tipo === 'mixta' ? '' : 'Quilpué')
})

it.each([[{ content: [{ id: 23 }] }], [[{ id: 23 }]]])('lee la colección de pedidos propios en formatos alternativos', async (data) => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(data))
  vi.stubGlobal('fetch', fetchMock)
  expect(await getMyOrders()).toEqual([{ id: 23 }])
  expect(fetchMock.mock.calls[0][0].pathname).toBe('/api/pedidos/mis-pedidos')
})
