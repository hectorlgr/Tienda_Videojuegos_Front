const STORAGE_KEY = 'checkpoint.carritos.v2'
export const GUEST = 'invitado'

export function matchesPurchase(items, purchased) {
  if (!Array.isArray(items) || !items.length || items.length !== purchased.length) return false
  const quantities = new Map(purchased.map(item => [item.productoId, item.cantidad]))
  for (const item of items) {
    if (!item || !quantities.has(item.productoId) || quantities.get(item.productoId) !== item.cantidad) return false
    quantities.delete(item.productoId)
  }
  return quantities.size === 0
}

function combine(items, knownStock = new Map()) {
  const quantities = new Map()
  for (const { productoId, cantidad } of items.filter(item => item != null)) {
    if (!Number.isSafeInteger(productoId) || productoId <= 0 ||
        !Number.isSafeInteger(cantidad) || cantidad <= 0) continue
    const limit = knownStock.get(productoId) ?? Number.MAX_SAFE_INTEGER
    const quantity = Math.min(limit, (quantities.get(productoId) ?? 0) + cantidad)
    if (quantity > 0) quantities.set(productoId, quantity)
  }
  return Array.from(quantities, ([productoId, cantidad]) => ({ productoId, cantidad }))
}

export function createCartStorage() {
  let memory = {}
  let memoryOnly = false

  function read() {
    if (!memoryOnly) {
      try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY))
        memory = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
      } catch {
        // Conservar la última copia disponible.
      }
    }
    return memory
  }

  function write(carts) {
    memory = carts
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(carts))
      memoryOnly = false
    } catch {
      memoryOnly = true
    }
  }

  return {
    open(owner, mergeGuest, knownStock) {
      if (!owner) return []
      const carts = read()
      const personal = Array.isArray(carts[owner]) ? carts[owner] : []
      if (mergeGuest && Array.isArray(carts[GUEST]) && carts[GUEST].length) {
        const items = combine([...personal, ...carts[GUEST]], knownStock)
        write({ ...carts, [owner]: items, [GUEST]: [] })
        return items
      }
      return combine(personal)
    },
    save(owner, items) {
      write({ ...read(), [owner]: items })
    },
    clearPurchased(buyerId, purchased) {
      const owner = `cliente:${buyerId}`
      const carts = read()
      if (!matchesPurchase(carts[owner], purchased)) return false
      write({ ...carts, [owner]: [] })
      return true
    },
  }
}
