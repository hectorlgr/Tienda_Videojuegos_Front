import { assertNumericId } from '../utils/ids.js'
import { postJson } from './httpClient.js'
import { getProductById, getProducts, ProductNotFoundError } from './productService.js'

export class InventoryNotFoundError extends Error {
  constructor(id) {
    super('No existe inventario para el producto con ID ' + id + '.')
    this.name = 'InventoryNotFoundError'
  }
}

function asInventory(product) {
  return { id: product.id, productoId: product.id, stock: product.stock, stockCritico: product.stockCritico }
}

export async function getInventory() {
  return (await getProducts()).map(asInventory)
}

export async function getInventoryByProductId(productId) {
  try {
    return asInventory(await getProductById(productId))
  } catch (error) {
    if (error instanceof ProductNotFoundError) throw new InventoryNotFoundError(productId)
    throw error
  }
}

export function updateInventoryStock(productId, stock, currentStock) {
  assertNumericId(productId)
  const delta = stock - currentStock
  const movement = delta > 0 ? 'entradas' : 'salidas'
  return postJson('/api/productos/' + productId + '/stock/' + movement, { cantidad: Math.abs(delta) })
}
