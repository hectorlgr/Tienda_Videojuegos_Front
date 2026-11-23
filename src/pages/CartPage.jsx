import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ImageWithFallback from '../components/common/ImageWithFallback'
import CartQuantityControl from '../components/store/CartQuantityControl'
import { useCartDetails } from '../hooks/useCartDetails'
import { useCart } from '../hooks/useCart'
import { publicAsset } from '../utils/assets'
import { formatCLP } from '../utils/currency'
import { getEffectivePrice } from '../utils/pricing'
import { calculateLineSubtotal, calculateProductsSubtotal, isValidPrice } from '../utils/cartCalculations'
import { gsap, motionAllowed, useGSAP } from '../utils/storeAnimations'

function CartLine({ line, returnFocusRef }) {
  const { removeItem } = useCart()
  const lineRef = useRef(null)
  const [removing, setRemoving] = useState(false)
  const { productoId, cantidad, product, stock } = line
  const subtotal = calculateLineSubtotal(line)

  const { contextSafe } = useGSAP(() => {
    if (!window.matchMedia?.(motionAllowed).matches) return

    gsap.from(lineRef.current, {
      opacity: 0.6,
      y: 8,
      duration: 0.22,
      ease: 'power2.out',
      clearProps: 'opacity,transform',
    })
  }, { scope: lineRef })

  const animateRemoval = contextSafe((element, finish) => {
    gsap.to(element, {
      opacity: 0,
      y: -8,
      duration: 0.18,
      ease: 'power2.in',
      overwrite: 'auto',
      onComplete: finish,
      onInterrupt: finish,
    })
  })

  function handleRemove() {
    if (removing) return
    const element = lineRef.current

    function finish() {
      if (element.contains(document.activeElement)) {
        returnFocusRef.current?.focus({ preventScroll: true })
      }
      removeItem(productoId)
    }

    if (!window.matchMedia?.(motionAllowed).matches) {
      finish()
      return
    }

    setRemoving(true)
    animateRemoval(element, finish)
  }

  const image = (
    <ImageWithFallback
      src={product?.imagen ? publicAsset(product.imagen) : undefined}
      alt={product ? product.nombre : 'Imagen no disponible'}
      className="cart-line-image"
    />
  )

  return (
    <li className="cart-line card shadow-sm" ref={lineRef}>
      {product ? <Link to={`/productos/${productoId}`}>{image}</Link> : image}
      <h2 className="cart-line-name">
        {product ? <Link to={`/productos/${productoId}`}>{product.nombre}</Link> : 'Producto no disponible'}
      </h2>
      <dl className="cart-line-facts">
        <div>
          <dt>Precio unitario</dt>
          <dd>{isValidPrice(getEffectivePrice(product)) ? formatCLP(getEffectivePrice(product)) : 'No disponible'}</dd>
        </div>
        <div className="cart-line-quantity">
          <dt className={product && stock > 0 ? 'visually-hidden' : undefined}>Cantidad</dt>
          <dd>
            {product && stock > 0 ? (
              <CartQuantityControl
                productoId={productoId}
                cantidad={cantidad}
                stock={stock}
                productName={product.nombre}
              />
            ) : cantidad}
          </dd>
        </div>
        <div>
          <dt>Disponibilidad</dt>
          <dd className={stock > 0 ? 'cart-stock-available' : 'cart-stock-empty'}>
            {stock > 0 ? `Disponible · ${stock} unidades` : 'Agotado'}
          </dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{subtotal !== null ? formatCLP(subtotal) : 'No disponible'}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="btn btn-outline-danger cart-line-remove"
        aria-label={`Eliminar ${product ? product.nombre : 'producto no disponible'} del carrito`}
        aria-disabled={removing}
        onClick={handleRemove}
      >
        <i className="fa fa-trash" aria-hidden="true" /> Eliminar
      </button>
    </li>
  )
}

export default function CartPage() {
  const titleRef = useRef(null)
  const { clearCart } = useCart()
  const { lines, loading, error } = useCartDetails()
  const productsSubtotal = !loading && !error ? calculateProductsSubtotal(lines) : null

  return (
    <>
      <title>Mi carrito de compras — CheckPoint Store</title>
      <nav id="breadcrumb" className="section" aria-label="Ruta de navegación">
        <div className="container">
          <ol className="breadcrumb-tree">
            <li><Link to="/">Inicio</Link></li>
            <li className="active" aria-current="page">Carrito</li>
          </ol>
        </div>
      </nav>
      <section className="section cart-page" aria-labelledby="cart-title">
        <div className="container">
          <h1 id="cart-title" className="mb-4" ref={titleRef} tabIndex={-1}>Mi carrito de compras</h1>
          <div aria-busy={loading}>
            {loading ? (
              <p className="catalog-state" role="status">Cargando tu carrito…</p>
            ) : error ? (
              <p className="catalog-state" role="alert">
                No pudimos cargar los productos de tu carrito. Inténtalo más tarde.
              </p>
            ) : lines.length === 0 ? (
              <p className="catalog-state" role="status">Tu carrito está vacío.</p>
            ) : (
              <>
                <ul className="cart-lines" aria-label="Productos del carrito">
                  {lines.map(line => <CartLine key={line.productoId} line={line} returnFocusRef={titleRef} />)}
                </ul>
                <dl className="cart-products-subtotal">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{productsSubtotal !== null ? formatCLP(productsSubtotal) : 'No disponible'}</dd>
                  </div>
                </dl>
                <Link to="/checkout" className="btn btn-success w-100 fw-bold py-2 mt-3 cart-continue">Continuar compra</Link>
                <button type="button" className="btn btn-outline-danger cart-clear mt-3" onClick={clearCart}>
                  Vaciar carrito
                </button>
              </>
            )}
          </div>
          <Link className="btn btn-outline-dark mt-3" to="/productos">Ver productos</Link>
        </div>
      </section>
    </>
  )
}
