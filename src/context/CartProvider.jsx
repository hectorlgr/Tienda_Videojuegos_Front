import { useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { CartContext } from './CartContext'
import { assertNumericId } from '../utils/ids'
import { createCartStorage, GUEST, matchesPurchase } from '../utils/cartStorage'
import { getInventory, getInventoryByProductId, InventoryNotFoundError } from '../services/inventoryService'
import { reconcileCart } from '../utils/reconcileCart'

function assertQuantity(quantity, allowRemoval = false) {
  if (!Number.isSafeInteger(quantity) || (!allowRemoval && quantity <= 0)) {
    throw new TypeError(allowRemoval
      ? 'La cantidad debe ser un número entero seguro.'
      : 'La cantidad debe ser un número entero positivo seguro.')
  }
}

export default function CartProvider({ children }) {
  const { user } = useAuth()
  const owner = !user ? GUEST : user.rol === 'cliente' ? `cliente:${user.id}` : null
  const [storage] = useState(createCartStorage)
  const knownStock = useRef(new Map())
  const previousOwner = useRef(owner)
  const activeScope = useRef(null)
  const [view, setView] = useState(null)

  useLayoutEffect(() => {
    const mergeGuest = Boolean(owner && owner !== GUEST && previousOwner.current !== owner)
    previousOwner.current = owner
    const items = storage.open(owner, mergeGuest, knownStock.current)
    const scope = { owner, items, active: true, pending: new Map() }
    activeScope.current = scope

    function update(next) {
      if (!scope.active || !owner || next === scope.items) return
      storage.save(owner, next)
      scope.items = next
      setView({ scope, items: next })
    }
    scope.update = update
    setView({ scope, items })

    if (items.length) {
      getInventory().then(inventory => {
        if (!scope.active) return
        // Solo aplicar el inventario a líneas que no cambiaron durante la consulta.
        const unchanged = scope.items.filter(item => items.includes(item))
        const stock = new Map(inventory.map(row => [row.productoId, row.stock]))
        for (const item of unchanged) knownStock.current.set(item.productoId, stock.get(item.productoId) ?? 0)
        const reconciled = reconcileCart(unchanged, inventory)
        if (reconciled === unchanged) return
        const byId = new Map(reconciled.map(item => [item.productoId, item]))
        update(scope.items.flatMap(item => unchanged.includes(item) ? byId.get(item.productoId) ?? [] : item))
      }).catch(() => {
        // Conservar el carrito si falla la consulta de inventario.
      })
    }
    return () => {
      activeScope.current = null
      scope.active = false
      scope.pending.forEach(queue => { queue.active = false })
      scope.pending.clear()
    }
  }, [owner, storage])

  const scope = view?.scope.owner === owner ? view.scope : null
  const items = scope ? view.items : []

  // Cada producto mantiene el orden de sus operaciones; productos distintos no se bloquean.
  async function withCurrentStock(productId, updateItems) {
    if (!scope?.active || !owner) return
    const pending = scope.pending
    let queue = pending.get(productId)
    if (!queue) {
      queue = { active: true, tail: Promise.resolve() }
      pending.set(productId, queue)
    }

    const operation = queue.tail.catch(() => {}).then(async () => {
      if (!queue.active) return
      let stock
      try {
        const inventory = await getInventoryByProductId(productId)
        stock = inventory.stock
        if (!Number.isSafeInteger(stock) || stock < 0) {
          throw new Error(`El inventario del producto ${productId} contiene un stock inválido.`)
        }
      } catch (error) {
        if (!(error instanceof InventoryNotFoundError)) throw error
        stock = 0
      }
      if (!queue.active) return
      knownStock.current.set(productId, stock)
      scope.update(updateItems(scope.items, stock))
    })
    queue.tail = operation
    try {
      await operation
    } finally {
      if (pending.get(productId) === queue && queue.tail === operation) pending.delete(productId)
    }
  }

  // Promise<void>: rechaza validaciones/errores reales; no devuelve una cantidad anticipada.
  async function addItem(productId, quantity) {
    assertNumericId(productId)
    assertQuantity(quantity)
    await withCurrentStock(productId, (current, stock) => {
      const existing = current.find((item) => item.productoId === productId)
      if (stock === 0) return existing ? current.filter(item => item.productoId !== productId) : current
      if (!existing) return [...current, { productoId: productId, cantidad: Math.min(quantity, stock) }]
      // Limitar antes de sumar también evita desbordar el rango de enteros seguros.
      const nextQuantity = existing.cantidad >= stock
        ? stock
        : existing.cantidad + Math.min(quantity, stock - existing.cantidad)
      if (existing.cantidad === nextQuantity) return current
      return current.map((item) => item.productoId === productId
        ? { ...item, cantidad: nextQuantity }
        : item)
    })
  }

  function removeItem(productId) {
    assertNumericId(productId)
    if (!scope?.active || !owner) return
    const queue = scope.pending.get(productId)
    if (queue) queue.active = false
    scope.pending.delete(productId)
    const current = scope.items
    scope.update(current.some((item) => item.productoId === productId)
      ? current.filter((item) => item.productoId !== productId)
      : current)
  }

  // Promise<void>; cantidad <= 0 elimina de inmediato, sin consultar inventario.
  async function setItemQuantity(productId, quantity) {
    assertNumericId(productId)
    assertQuantity(quantity, true)
    if (quantity <= 0) {
      removeItem(productId)
      return
    }
    await withCurrentStock(productId, (current, stock) => {
      const existing = current.find((item) => item.productoId === productId)
      if (!existing) return current
      if (stock === 0) return current.filter(item => item.productoId !== productId)
      const nextQuantity = Math.min(quantity, stock)
      if (existing.cantidad === nextQuantity) return current
      return current.map((item) => item.productoId === productId
        ? { ...item, cantidad: nextQuantity }
        : item)
    })
  }

  function clearCart() {
    if (!scope?.active || !owner) return
    scope.pending.forEach(queue => { queue.active = false })
    scope.pending.clear()
    if (scope.items.length) scope.update([])
  }

  function clearPurchasedCart(buyerId, purchased) {
    if (owner !== `cliente:${buyerId}`) return
    const current = activeScope.current
    const visible = current?.owner === owner
    if (visible && (current.pending.size || !matchesPurchase(current.items, purchased))) return
    if (storage.clearPurchased(buyerId, purchased) && visible) {
      current.items = []
      setView({ scope: current, items: current.items })
    }
  }

  const totalItems = items.reduce((total, item) => total + item.cantidad, 0)

  return (
    <CartContext.Provider value={{ items, addItem, setItemQuantity, removeItem, clearCart, clearPurchasedCart, totalItems }}>
      {children}
    </CartContext.Provider>
  )
}
