import { useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { local } from '../lib/local.js'

// Endereço antigo: o cardápio agora é a página inicial.
export default function Cardapio() {
  const [params] = useSearchParams()
  const group = params.get('grupo') === '1'
  useEffect(() => { if (group) local.update(() => ({ groupIntent: true })) }, [group])
  return <Navigate to="/" replace />
}
