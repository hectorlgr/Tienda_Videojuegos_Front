import { describe, it, expect } from 'vitest'
import { validateRegistration } from './registerValidation.js'

const validValues = {
  nombre: 'Juan',
  apellidos: 'Pérez González',
  correo: 'juan.perez@duoc.cl',
  password: 'Clave123!',
  confirmPassword: 'Clave123!',
}

describe('Validación del formulario de registro', () => {
  it('acepta un registro con todos los datos correctos', () => {
    const errors = validateRegistration(validValues)

    expect(errors).toEqual({})
    expect(Object.keys(errors).length).toBe(0)
  })

  it('produce un error cuando un campo obligatorio está vacío', () => {
    const errors = validateRegistration({ ...validValues, nombre: '   ' })

    expect(errors.nombre).toBe('El nombre es obligatorio.')
    expect(Object.keys(errors)).toEqual(['nombre'])
  })

  it('admite un registro sin apellidos', () => {
    expect(validateRegistration({ ...validValues, apellidos: '' })).toEqual({})
  })
})
