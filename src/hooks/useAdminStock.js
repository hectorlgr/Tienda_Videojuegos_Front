import { useEffect, useState } from 'react'
import { getAdminProducts } from '../services/productService'

export function useAdminStock() {
  const [result, setResult] = useState({ rows: [], loading: true, error: null })

  useEffect(() => {
    let active = true

    async function loadStock() {
      try {
        const products = await getAdminProducts()
        if (!active) return
        const rows = products.map(product => ({
          productoId: product.id,
          inventoryId: product.id,
          product,
          stock: product.stock ?? 0,
          stockCritico: product.stockCritico ?? null,
        }))
        setResult({ rows, loading: false, error: null })
      } catch (error) {
        if (active) setResult({ rows: [], loading: false, error })
      }
    }

    loadStock()
    return () => { active = false }
  }, [])

  function updateRowStock(inventoryId, updatedInventory) {
    setResult(current => ({
      ...current,
      rows: current.rows.map(row => row.inventoryId === inventoryId
        ? { ...row, stock: updatedInventory.stock }
        : row),
    }))
  }

  return { ...result, updateRowStock }
}
