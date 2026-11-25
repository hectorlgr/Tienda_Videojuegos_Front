import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ImageWithFallback from '../common/ImageWithFallback'
import { publicAsset } from '../../utils/assets'
import { getDiscountPercent, hasValidOffer } from '../../utils/pricing'
import { gsap, motionAllowed, useGSAP } from '../../utils/storeAnimations'
import ProductPrice from './ProductPrice'
import ProductDescription from '../common/ProductDescription'

const AUTOPLAY_DELAY = 5000

// Carrusel simple en React: flechas, indicadores y avance automático.
export default function ProductCarousel({ products }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const { contextSafe } = useGSAP()
  const total = products.length

  useEffect(() => {
    // No avanza si está en pausa, si hay un solo producto o si el usuario prefiere menos movimiento.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (paused || total < 2 || reduceMotion) return

    const timer = setTimeout(() => setCurrent(index => (index + 1) % total), AUTOPLAY_DELAY)
    return () => clearTimeout(timer)
  }, [current, paused, total])

  if (total === 0) return null

  // Si el listado cambia de tamaño, evita quedar en un índice que ya no existe.
  const activeIndex = current % total

  const goTo = contextSafe((event, index) => {
    setCurrent((index + total) % total)

    if (window.matchMedia?.(motionAllowed).matches) {
      gsap.fromTo(event.currentTarget, { scale: 0.9 }, {
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
        overwrite: 'auto',
        clearProps: 'scale',
      })
    }
  })

  return (
    <div
      className="product-carousel"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Productos en venta"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="product-carousel-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {products.map((product, index) => {
          const productUrl = `/productos/${product.id}`
          const isActive = index === activeIndex

          return (
            <article
              className="product-carousel-slide"
              key={product.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${index + 1} de ${total}: ${product.nombre}`}
              aria-hidden={!isActive}
              inert={!isActive}
            >
              <div className="product-carousel-image">
                <ImageWithFallback
                  src={product.imagen ? publicAsset(product.imagen) : undefined}
                  alt={product.nombre}
                  loading={index === 0 ? undefined : 'lazy'}
                />
                {hasValidOffer(product) && (
                  <span className="product-carousel-badge">-{getDiscountPercent(product)}%</span>
                )}
              </div>
              <div className="product-carousel-content">
                <h3>{product.nombre}</h3>
                <ProductDescription value={product.descripcionCorta} fromRawg={product.rawgId != null} />
                <ProductPrice product={product} />
                <Link className="primary-btn" to={productUrl}>Ver producto</Link>
              </div>
            </article>
          )
        })}
      </div>

      {total > 1 && (
        <>
          <button
            className="product-carousel-arrow is-prev"
            type="button"
            aria-label="Producto anterior"
            onClick={event => goTo(event, activeIndex - 1)}
          >
            <i className="fa fa-chevron-left" aria-hidden="true" />
          </button>
          <button
            className="product-carousel-arrow is-next"
            type="button"
            aria-label="Producto siguiente"
            onClick={event => goTo(event, activeIndex + 1)}
          >
            <i className="fa fa-chevron-right" aria-hidden="true" />
          </button>
          <div className="product-carousel-dots">
            {products.map((product, index) => (
              <button
                key={product.id}
                type="button"
                className={index === activeIndex ? 'is-active' : undefined}
                aria-label={`Ir a ${product.nombre}`}
                aria-current={index === activeIndex}
                onClick={event => goTo(event, index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
