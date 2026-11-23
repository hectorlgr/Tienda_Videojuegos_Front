import { useEffect, useRef, useState } from 'react'
import { useCart } from '../../hooks/useCart'
import { gsap, motionAllowed, useGSAP } from '../../utils/storeAnimations'

export default function DetailAddToCartButton({ productId, quantity, available }) {
  const { addItem } = useCart()
  const [status, setStatus] = useState('idle')
  const pending = useRef(false)
  const mounted = useRef(false)
  const buttonRef = useRef(null)

  useGSAP(() => {
    if (status !== 'success' || !window.matchMedia?.(motionAllowed).matches) return

    gsap.to(buttonRef.current, {
      scale: 1.04,
      duration: 0.15,
      ease: 'power2.inOut',
      repeat: 1,
      yoyo: true,
    })
  }, { dependencies: [status], revertOnUpdate: true })

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (status !== 'success') return
    const timeout = setTimeout(() => setStatus('idle'), 3000)
    return () => clearTimeout(timeout)
  }, [status])

  async function handleAdd() {
    if (!available || pending.current) return
    pending.current = true
    setStatus('adding')
    try {
      await addItem(productId, quantity)
      if (mounted.current) setStatus('success')
    } catch {
      if (mounted.current) setStatus('error')
    } finally {
      pending.current = false
    }
  }

  const adding = status === 'adding'

  return (
    <div className="mt-3">
      <button
        ref={buttonRef}
        type="button"
        className="primary-btn detail-add-to-cart"
        disabled={!available || adding}
        aria-busy={adding}
        onClick={handleAdd}
      >
        <i className="fa fa-shopping-cart" aria-hidden="true" />{' '}
        {adding ? 'Agregando…' : 'Agregar al carrito'}
      </button>
      <p className="mt-2 mb-0" role="status">
        {adding ? 'Agregando al carrito…' : status === 'success' ? 'Carrito actualizado.' : ''}
      </p>
      {status === 'error' && (
        <p className="text-danger mt-2 mb-0" role="alert">
          No fue posible agregar el producto. Inténtalo nuevamente.
        </p>
      )}
    </div>
  )
}
