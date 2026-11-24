import { useEffect, useState } from 'react'
import { getProductById } from '../services/productService.js'
import { assertNumericId } from '../utils/ids.js'

function initialDetail(productId) {
  try {
    assertNumericId(productId)
    return { productId, product: null, loading: true, error: null }
  } catch (error) {
    return { productId, product: null, loading: false, error }
  }
}

export function useProductDetail(productId) {
  const [detail, setDetail] = useState(() => initialDetail(productId))

  // Al cambiar de ID, no se muestra el producto ni el error de la consulta anterior.
  if (!Object.is(detail.productId, productId)) {
    setDetail(initialDetail(productId))
  }

  useEffect(() => {
    try {
      assertNumericId(productId)
    } catch {
      return
    }

    let active = true

    async function loadDetail() {
      try {
        const product = await getProductById(productId)
        if (!active) return
        setDetail({
          productId,
          product,
          loading: false,
          error: null,
        })
      } catch (error) {
        if (!active) return

        setDetail({ productId, product: null, loading: false, error })
      }
    }

    loadDetail()

    return () => {
      active = false
    }
  }, [productId])

  return { product: detail.product, loading: detail.loading, error: detail.error }
}
