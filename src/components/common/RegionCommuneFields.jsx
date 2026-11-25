import { SHIPPING_REGIONS } from '../../config/shippingRegions'

export default function RegionCommuneFields({ controlProps, feedback, preserveUnknown = false }) {
  const regionProps = controlProps('region', 'form-select')
  const communeProps = controlProps('comuna', 'form-select')
  const region = SHIPPING_REGIONS.find(option => option.id === regionProps.value)

  return (
    <>
      <div className="col-12 col-md-6">
        <label htmlFor={regionProps.id} className="form-label fw-semibold">Región</label>
        <select {...regionProps} autoComplete="address-level1">
          <option value="">Selecciona una región</option>
          {preserveUnknown && regionProps.value && !region && <option>{regionProps.value}</option>}
          {SHIPPING_REGIONS.map(option => <option key={option.id} value={option.id}>{option.nombre}</option>)}
        </select>
        {feedback?.('region')}
      </div>
      <div className="col-12 col-md-6">
        <label htmlFor={communeProps.id} className="form-label fw-semibold">Comuna</label>
        <select {...communeProps} autoComplete="address-level2" disabled={communeProps.disabled || !region}>
          <option value="">Selecciona una comuna</option>
          {preserveUnknown && communeProps.value && !region?.comunas.includes(communeProps.value) && <option>{communeProps.value}</option>}
          {region?.comunas.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        {feedback?.('comuna')}
      </div>
    </>
  )
}
