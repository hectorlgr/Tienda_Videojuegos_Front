import { StrictMode } from 'react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from './AuthContext'
import CartProvider from './CartProvider'
import { useCart } from '../hooks/useCart'
import { getInventory, getInventoryByProductId } from '../services/inventoryService'

vi.mock('../services/inventoryService', () => ({
  getInventory: vi.fn(),
  getInventoryByProductId: vi.fn(),
  InventoryNotFoundError: class extends Error {},
}))

const ana = { id: 1, rol: 'cliente' }
const luis = { id: 2, rol: 'cliente' }
const line = (productoId, cantidad) => ({ productoId, cantidad })

function mountCart(initialUser = null) {
  let user = initialUser
  const hook = renderHook(useCart, {
    wrapper: ({ children }) => (
      <StrictMode>
        <AuthContext.Provider value={{ user }}>
          <CartProvider>{children}</CartProvider>
        </AuthContext.Provider>
      </StrictMode>
    ),
  })
  return {
    get cart() { return hook.result.current },
    session(next) { user = next; hook.rerender() },
    add(id, quantity) { return act(() => hook.result.current.addItem(id, quantity)) },
    unmount: hook.unmount,
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  getInventory.mockResolvedValue([{ productoId: 1, stock: 5 }, { productoId: 2, stock: 8 }])
  getInventoryByProductId.mockImplementation(async id => ({ stock: id === 1 ? 5 : 8 }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('fusiona una sola vez en una escritura, limita por stock y aísla dos cuentas y el logout', async () => {
  const app = mountCart(ana)
  await app.add(1, 4)
  app.session(null)
  expect(app.cart.items).toEqual([])
  await app.add(1, 3)
  await app.add(2, 1)
  const writes = vi.spyOn(Storage.prototype, 'setItem')
  app.session(ana)
  expect(app.cart.items).toEqual([line(1, 5), line(2, 1)])
  expect(writes).toHaveBeenCalledTimes(1)
  expect(Object.values(JSON.parse(writes.mock.calls[0][1]))).toEqual(
    expect.arrayContaining([[], app.cart.items]),
  )
  app.session({ ...ana, nombre: 'Ana' })
  expect(writes).toHaveBeenCalledTimes(1)
  app.session(luis)
  expect(app.cart.items).toEqual([])
  await app.add(2, 2)
  app.session(ana)
  expect(app.cart.items).toEqual([line(1, 5), line(2, 1)])
  app.session(null)
  expect(app.cart.items).toEqual([])
  app.unmount()
  expect(mountCart(luis).cart.items).toEqual([line(2, 2)])
})

it('restaura sin consumir el invitado al montar o completar el perfil e ignora el carrito antiguo', async () => {
  localStorage.setItem('carritoTiendaJuegos', JSON.stringify([line(1, 5)]))
  const guest = mountCart()
  expect(guest.cart.items).toEqual([])
  await guest.add(2, 2)
  guest.unmount()
  const app = mountCart(ana)
  expect(app.cart.items).toEqual([])
  app.session({ ...ana, nombre: 'Ana' })
  expect(app.cart.items).toEqual([])
  app.session(null)
  expect(app.cart.items).toEqual([line(2, 2)])
})

it.each(['administrador', 'vendedor'])('impide leer, modificar o consumir el carrito como %s', async rol => {
  const app = mountCart()
  await app.add(1, 2)
  app.session({ id: 3, rol })
  await app.add(2, 2)
  await act(() => app.cart.setItemQuantity(1, 5))
  act(() => { app.cart.removeItem(1); app.cart.clearCart() })
  expect(app.cart.items).toEqual([])
  expect(getInventoryByProductId).toHaveBeenCalledTimes(1)
  app.session(null)
  expect(app.cart.items).toEqual([line(1, 2)])
})

it('descarta una respuesta de stock que llega después de cambiar de cuenta', async () => {
  const app = mountCart(ana)
  let resolve
  getInventoryByProductId.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const pending = app.cart.addItem(1, 2)
  await waitFor(() => expect(resolve).toBeTypeOf('function'))
  app.session(luis)
  await app.add(2, 1)
  await act(async () => { resolve({ stock: 5 }); await pending })
  expect(app.cart.items).toEqual([line(2, 1)])
  app.session(ana)
  expect(app.cart.items).toEqual([])
})
