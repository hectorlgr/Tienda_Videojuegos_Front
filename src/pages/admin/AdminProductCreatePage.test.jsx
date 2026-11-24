import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findProductByCode } from '../../services/productService'
import { createProductWithInventory } from '../../services/productCreationService'
import { publicAsset } from '../../utils/assets'
import AdminProductCreatePage from './AdminProductCreatePage'

vi.mock('../../services/productService', () => ({ findProductByCode: vi.fn() }))
vi.mock('../../services/productCreationService', () => ({
  createProductWithInventory: vi.fn(),
  ProductInventoryCreationError: class extends Error {},
}))

function change(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function renderForm() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<AdminProductCreatePage />} />
        <Route path="/admin/stock" element={<h1>Inventario de prueba</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  findProductByCode.mockResolvedValue(null)
  createProductWithInventory.mockResolvedValue({})
})
afterEach(cleanup)

describe('Nuevo producto', () => {
  it('importa RAWG sin perder datos comerciales y guarda la oferta con una portada local', async () => {
    const { container } = renderForm()
    change('Categoría', 'juego')
    change('Código comercial', 'demo-01')
    change('Precio (CLP)', '19991')
    change('Stock inicial', '3')
    change('Formato', 'digital')
    change('Ecosistema', 'otros')
    change('Buscar en catálogo RAWG', 'elden')
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
    fireEvent.click(await screen.findByRole('button', { name: /Elden Ring/ }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Elden Ring')
    expect(screen.getByLabelText('Plataforma').value).toContain('PC')
    expect(screen.getByAltText('Imagen principal').src).toMatch(/^https?:/)

    const file = new File(['test'], 'cover.png', { type: 'image/png' })
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByAltText('Imagen principal').src).toMatch(/^data:image\/png;base64,/))
    const cover = screen.getByAltText('Imagen principal').src
    expect(publicAsset(cover)).toBe(cover)
    expect(publicAsset('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg')

    const galleryInput = container.querySelector('input[type="file"][multiple]')
    fireEvent.change(galleryInput, { target: { files: Array(5).fill(file) } })
    expect(screen.getByText(/Puedes agregar hasta 4 imágenes/)).toBeInTheDocument()
    fireEvent.change(galleryInput, { target: { files: Array(4).fill(file) } })
    expect(await screen.findAllByAltText(/de la galería/)).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Agregar imágenes a la galería' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar imagen 4 de la galería' }))

    fireEvent.click(screen.getByLabelText('Producto en oferta'))
    change('Descuento', '15')
    expect(screen.getByText(/Precio final/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y agregar otro' }))
    expect(await screen.findByText(/Se creó Elden Ring/)).toBeInTheDocument()
    expect(createProductWithInventory).toHaveBeenCalledWith(expect.objectContaining({
      codigo: 'DEMO-01',
      formato: 'digital',
      precio: 19991,
      precioOferta: 16992,
      imagen: cover,
      imagenes: [cover, cover, cover],
    }), { stock: 3, stockCritico: null })
    expect(createProductWithInventory.mock.calls[0][0]).not.toHaveProperty('porcentajeOferta')
    expect(screen.getByLabelText('Categoría')).toHaveValue('juego')
    expect(screen.getByLabelText('Nombre')).toHaveValue('')
    expect(screen.getByLabelText('Buscar en catálogo RAWG')).toHaveValue('')
    expect(screen.queryByAltText('Imagen principal')).not.toBeInTheDocument()
  })

  it('limpia los campos ocultos y asigna el ecosistema por defecto a figuras', async () => {
    renderForm()
    change('Categoría', 'accesorio')
    change('Compatibilidad', 'PC')
    change(/Ecosistema/, 'xbox')
    change('Categoría', 'figura')
    expect(screen.queryByLabelText(/Ecosistema|Compatibilidad/)).not.toBeInTheDocument()
    change('Categoría', 'accesorio')
    expect(screen.getByLabelText('Compatibilidad')).toHaveValue('')
    change('Categoría', 'figura')
    change('Código comercial', 'fig-01')
    change('Nombre', 'Figura de Mario')
    change('Precio (CLP)', '1')
    change('Stock inicial', '0')
    change('Franquicia', 'Super Mario')
    fireEvent.click(screen.getByLabelText('Producto en oferta'))
    change('Descuento', '5')
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }))
    expect(screen.getByText(/El precio final redondeado/)).toBeInTheDocument()
    expect(findProductByCode).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Producto en oferta'))
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }))
    expect(await screen.findByRole('heading', { name: 'Inventario de prueba' })).toBeInTheDocument()
    const [product] = createProductWithInventory.mock.calls[0]
    expect(product).toMatchObject({ categoria: 'figura', ecosistema: 'otros', franquicia: 'Super Mario', precioOferta: null })
    expect(product).not.toHaveProperty('compatibilidad')
  })
})
