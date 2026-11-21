import { staffToken, clearStaffToken } from './local.js'

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export async function api(path, { body, method, staff = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (staff) headers.Authorization = `Bearer ${staffToken() || ''}`
  let res
  try {
    res = await fetch(`/api${path}`, { method: method || (body ? 'POST' : 'GET'), headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError(0, 'Sem conexão com a internet. Confira o sinal e tente de novo.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && staff) clearStaffToken()
    throw new ApiError(res.status, data.error || 'Algo deu errado. Tente de novo.')
  }
  return data
}
