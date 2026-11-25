import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ProductDescription from './ProductDescription'
import { validateProductForm } from '../../utils/productValidation'

afterEach(cleanup)

describe('Descripciones de producto', () => {
  it('muestra los formatos permitidos y elimina etiquetas y atributos ajenos al editor', () => {
    const { container } = render(
      <ProductDescription value='<p><strong style="color:red">Incluye</strong> <a href="/productos">un mapa</a>.</p><img src="/img/cover.jpg">' />,
    )
    expect(screen.getByText('Incluye').tagName).toBe('STRONG')
    expect(screen.getByText('Incluye')).not.toHaveAttribute('style')
    expect(screen.getByText('un mapa', { exact: false })).toBeInTheDocument()
    expect(container.querySelector('img, a')).toBeNull()
  })

  it('mantiene el texto literal de productos antiguos y de RAWG', () => {
    const { rerender } = render(<ProductDescription value="Edición física <3" />)
    expect(screen.getByText('Edición física <3')).toBeInTheDocument()
    rerender(<ProductDescription value="<p>Descripción importada</p>" fromRawg />)
    expect(screen.getByText('<p>Descripción importada</p>')).toBeInTheDocument()
  })

  it('valida el texto visible y el tamaño del HTML corto solo en modo manual', () => {
    const product = {
      codigo: 'FIG-001',
      nombre: 'Figura',
      precio: '1000',
      categoria: 'figura',
      franquicia: 'Demo',
      descripcionCorta: `<p><strong>${'a'.repeat(120)}</strong></p>`,
      descripcionLarga: `<p>${'b'.repeat(501)}</p>`,
    }
    const inventory = { stock: '1', stockCritico: '' }
    const values = { product, inventory }
    expect(validateProductForm(values)).not.toHaveProperty('descripcionCorta')
    expect(validateProductForm(values)).toHaveProperty('descripcionLarga')
    const largeMarkup = { ...values, product: { ...product, descripcionCorta: '<p>&amp;</p>'.repeat(50) } }
    expect(validateProductForm(largeMarkup)).toHaveProperty('descripcionCorta')
    expect(validateProductForm(largeMarkup, { rawgId: 1 })).not.toHaveProperty('descripcionCorta')
  })
})
