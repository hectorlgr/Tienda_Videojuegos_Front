import { useRef, useState } from 'react'
import ImageWithFallback from '../common/ImageWithFallback'
import { publicAsset } from '../../utils/assets'
import { gsap, motionAllowed, useGSAP } from '../../utils/storeAnimations'

function isImagePath(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export default function ProductGallery({ product }) {
  const images = Array.isArray(product.imagenes)
    ? product.imagenes.filter(isImagePath).map(path => path.trim())
    : []
  const initialImage = isImagePath(product.imagen) ? product.imagen.trim() : images[0]
  const galleryImages = initialImage && !images.includes(initialImage)
    ? [initialImage, ...images]
    : images
  const [selectedIndex, setSelectedIndex] = useState(() => (
    Math.max(0, galleryImages.indexOf(initialImage))
  ))
  const selectedImage = galleryImages[selectedIndex]
  const mainImageRef = useRef(null)
  const animateNextImage = useRef(false)
  const { contextSafe } = useGSAP({ scope: mainImageRef })

  function selectImage(index) {
    if (index === selectedIndex) return
    if (galleryImages[index] !== selectedImage) animateNextImage.current = true
    setSelectedIndex(index)
  }

  const fadeImage = contextSafe(image => {
    gsap.fromTo(image, { opacity: 0.45 }, {
      opacity: 1,
      duration: 0.25,
      ease: 'power2.out',
      overwrite: 'auto',
      clearProps: 'opacity',
    })
  })

  function revealImage(event) {
    if (!animateNextImage.current) return
    animateNextImage.current = false
    if (window.matchMedia?.(motionAllowed).matches) fadeImage(event.currentTarget)
  }

  return (
    <div className="product-gallery" role="group" aria-label={`Imágenes de ${product.nombre}`}>
      <div className="detail-main-image" ref={mainImageRef}>
        <ImageWithFallback
          src={selectedImage ? publicAsset(selectedImage) : undefined}
          alt={galleryImages.length > 1 ? `${product.nombre} — vista ${selectedIndex + 1}` : product.nombre}
          onLoad={revealImage}
        />
      </div>
      {galleryImages.length > 0 && (
        <ul className="detail-thumbnails" aria-label="Miniaturas">
          {galleryImages.map((path, index) => (
            <li key={`${index}-${path}`}>
              <button
                type="button"
                className={`detail-thumbnail${selectedIndex === index ? ' is-selected' : ''}`}
                aria-label={`Ver imagen ${index + 1} de ${product.nombre}`}
                aria-pressed={selectedIndex === index}
                onClick={() => selectImage(index)}
              >
                <ImageWithFallback
                  src={publicAsset(path)}
                  alt={`${product.nombre} — miniatura ${index + 1}`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
