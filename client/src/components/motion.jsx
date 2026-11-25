// Navegação simples, sem cortinas nem rolagem "amanteigada": o movimento do site
// fica reservado para responder ao que o cliente faz (comanda, carimbo, foco).
import { Link, useNavigate } from 'react-router-dom'

export function TransitionProvider({ children }) { return children }
export const useGo = () => useNavigate()
export function TLink({ to, children, ...rest }) {
  return <Link to={to} {...rest}>{children}</Link>
}
