// Regla del proyecto original, aplicada al correo completo y sin distinguir mayúsculas.
const EMAIL_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i
const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{8,}$/

export function validateRegistration(values) {
  const errors = {}

  const nombre = values.nombre.trim()
  if (!nombre) errors.nombre = 'El nombre es obligatorio.'
  else if (nombre.length > 50) errors.nombre = 'Máximo 50 caracteres permitidos.'
  if (values.apellidos.trim().length > 100) errors.apellidos = 'Máximo 100 caracteres permitidos.'

  const email = values.correo.trim()
  if (!email) errors.correo = 'El correo es obligatorio.'
  else if (email.length > 100) errors.correo = 'Máximo 100 caracteres permitidos.'
  else if (!EMAIL_PATTERN.test(email)) errors.correo = 'Formato de correo no válido.'

  // Recupera la regla antigua sin alterar la contraseña almacenada en el formulario.
  const password = values.password.trim()
  if (!password) errors.password = 'La contraseña es obligatoria.'
  else if (password.length < 8) errors.password = 'Debe tener al menos 8 caracteres.'
  else if (!PASSWORD_PATTERN.test(password)) {
    errors.password = 'Debe contener al menos una mayúscula, una minúscula, un número y un carácter especial.'
  }

  if (!values.confirmPassword) errors.confirmPassword = 'Confirma la contraseña.'
  else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Las contraseñas no coinciden.'

  return errors
}
