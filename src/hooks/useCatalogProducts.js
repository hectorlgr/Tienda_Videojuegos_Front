import { useEffect, useState } from 'react'
import { getProducts } from '../services/productService.js'

export function useCatalogProducts() {
  const [catalog, setCatalog] = useState({
    products: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true

    async function loadCatalog() {
      try {
        const products = await getProducts()
        if (!active) return
        setCatalog({ products, loading: false, error: null })
      } catch (error) {
        if (!active) return

        setCatalog({ products: [], loading: false, error })
      }
    }

    loadCatalog()

    return () => {
      active = false
    }
  }, [])

  return catalog
}
