import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/AuthContext'
import { CartContext } from '../context/CartContext'
import CartProvider from '../context/CartProvider'
import { useCart } from '../hooks/useCart'
import { getMyOrders } from '../services/orderService'
import { clearSession, persistSession } from '../utils/authSession'
import CheckoutPage from './CheckoutPage'
import PurchaseSuccessPage from './PurchaseSuccessPage'

function clientToken(id) {
  const claims = { userId: id, sub: `cliente${id}@example.com`, role: 'CLIENTE', exp: Date.now() / 1000 + 3600 }
  return `header.${btoa(JSON.stringify(claims))}.signature`
}

afterEach(() => {
  cleanup()
  clearSession()
  sessionStorage.removeItem('checkout-attempt-1')
  sessionStorage.removeItem('checkout-attempt-2')
  localStorage.removeItem('checkpoint.carritos.v2')
  vi.unstubAllGlobals()
})

it('reintenta un pedido pendiente con el mismo UUID y vuelve al inicio tras confirmarlo', async () => {
  const token = clientToken(1)
  persistSession(token)
  const items = [{ productoId: 7, cantidad: 2 }]
  const product = { id: 7, nombre: 'Juego', categoria: 'VIDEOJUEGO', formato: 'FISICO', precio: 9990, stock: 3 }
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ _embedded: { productos: [product] } }))
    .mockRejectedValueOnce(new Error('Perfil no disponible'))
    .mockResolvedValueOnce(Response.json({ resultado: 'PENDIENTE' }, { status: 202 }))
    .mockResolvedValueOnce(Response.json({ resultado: 'PEDIDO_CREADO', pedidoId: 23, estadoPedido: 'CREADO' }))
    .mockResolvedValueOnce(Response.json({ estado: 'CREADO', detalles: [], costoDespacho: 3990, totalFinal: 23970 }))
  vi.stubGlobal('fetch', fetchMock)
  const clearPurchasedCart = vi.fn()
  render(
    <AuthContext.Provider value={{ user: { id: 1, nombre: 'Ana', rol: 'cliente' } }}>
      <CartContext.Provider value={{ items, clearPurchasedCart }}>
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
  expect(clearPurchasedCart).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar confirmación' }))
  expect(await screen.findByRole('heading', { name: 'Pedido registrado con éxito' })).toBeInTheDocument()
  expect(await screen.findByText(/Total del pedido/)).toBeInTheDocument()
  expect(clearPurchasedCart).toHaveBeenCalledExactlyOnceWith(1, items)
  const [[url, first], [, retry]] = fetchMock.mock.calls.filter(([url]) => url.pathname === '/api/pedidos')
  expect(url.pathname).toBe('/api/pedidos')
  expect(first.headers.Authorization).toBe(`Bearer ${token}`)
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
  persistSession(clientToken(1))
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
    <AuthContext.Provider value={{ user: { id: 1, nombre: 'Ana', rol: 'cliente' } }}>
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

function CartControls() {
  const { items, removeItem } = useCart()
  return <>
    <output data-testid="cart">{JSON.stringify(items)}</output>
    <button onClick={() => removeItem(2)}>Quitar segundo producto</button>
  </>
}

it.each(['éxito', 'otra cuenta', 'logout', 'carrito editado', 'rechazo'])(
  'aplica la respuesta al comprador original en caso de %s', async scenario => {
    const original = [1, 2].map(productoId => ({ productoId, cantidad: 1 }))
    const guest = scenario === 'logout' ? original : []
    const key = 'checkpoint.carritos.v2'
    localStorage.setItem(key, JSON.stringify({ 'cliente:1': original, 'cliente:2': original, invitado: guest }))
    const products = original.map(({ productoId }) => ({
      id: productoId, nombre: 'Juego', categoria: 'VIDEOJUEGO', formato: 'DIGITAL', precio: 9990, stock: 3,
    }))
    const response = Promise.withResolvers()
    vi.stubGlobal('fetch', vi.fn(url => url.pathname === '/api/pedidos'
      ? response.promise : Promise.resolve(Response.json({ _embedded: { productos: products } }))))

    function page(id) {
      const user = id ? { id, rol: 'cliente', nombre: 'Cliente' } : null
      return <AuthContext.Provider value={{ user }}>
        <CartProvider>
          <CartControls />
          <MemoryRouter initialEntries={['/checkout']}><Routes>
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/compra-exitosa" element={<h1>Pedido confirmado</h1>} />
          </Routes></MemoryRouter>
        </CartProvider>
      </AuthContext.Provider>
    }
    persistSession(clientToken(1))
    const app = render(page(1))
    fireEvent.click(await screen.findByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar compra' }))
    expect(sessionStorage.getItem('checkout-attempt-1')).toBeTruthy()

    if (scenario === 'otra cuenta') {
      persistSession(clientToken(2))
      app.rerender(page(2))
      expect(await screen.findByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
      expect(screen.queryByText('Reintentar confirmación')).toBeNull()
    } else if (scenario === 'logout') {
      clearSession()
      app.rerender(page(null))
    } else if (scenario === 'carrito editado') {
      fireEvent.click(screen.getByText('Quitar segundo producto'))
    }

    const rejected = scenario === 'rechazo'
    await act(async () => response.resolve(rejected ? Response.json({}, { status: 422 }) :
      Response.json({ resultado: 'PEDIDO_CREADO', pedidoId: 23 }, { status: 201 })))
    const expected = rejected ? original : scenario === 'carrito editado' ? original.slice(0, 1) : []
    expect(JSON.parse(localStorage.getItem(key))).toEqual({ 'cliente:1': expected, 'cliente:2': original, invitado: guest })
    const switched = scenario === 'otra cuenta' || scenario === 'logout'
    expect(JSON.parse(screen.getByTestId('cart').textContent)).toEqual(switched ? original : expected)
    expect(Boolean(screen.queryByText('Pedido confirmado'))).toBe(!switched && !rejected)
    if (rejected) expect(screen.getByRole('alert')).toHaveTextContent('No pudimos completar el pedido')
  },
)
