// Integração Pix.
//
// Dois provedores:
//  - "estatico": gera o BR Code (Pix copia e cola) direto da chave Pix da loja, seguindo o
//    padrão EMV do Banco Central. Funciona com qualquer banco, sem contrato com PSP, mas o
//    banco não avisa a loja: o pagamento é confirmado por alguém da equipe no painel.
//  - "mercadopago": cria uma cobrança Pix dinâmica na API do Mercado Pago. O webhook e a
//    consulta de status confirmam o pagamento sozinhos. Ativado com MP_ACCESS_TOKEN.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value

const ascii = (s, max) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max)

export function crc16(payload) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Monta o payload "Pix copia e cola" com valor fixo. */
export function buildBrCode({ key, name, city, amount, txid, description }) {
  if (!key) throw new Error('Chave Pix não configurada')
  let account = tlv('00', 'br.gov.bcb.pix') + tlv('01', key.trim())
  if (description) account += tlv('02', ascii(description, 40))
  const cleanTxid = String(txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const payload =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('26', account) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', (amount / 100).toFixed(2)) +
    tlv('58', 'BR') +
    tlv('59', ascii(name, 25) || 'KERO MAIS') +
    tlv('60', ascii(city, 15) || 'SAO PAULO') +
    tlv('62', tlv('05', cleanTxid)) +
    '6304'
  return payload + crc16(payload)
}

// ---------- Mercado Pago ----------
const MP_API = 'https://api.mercadopago.com'

export const mercadoPagoEnabled = () => Boolean(process.env.MP_ACCESS_TOKEN)

export async function mpCreatePix({ amount, description, externalReference, payerEmail, expiresAt, notificationUrl }) {
  const body = {
    transaction_amount: Number((amount / 100).toFixed(2)),
    description,
    payment_method_id: 'pix',
    external_reference: externalReference,
    date_of_expiration: new Date(expiresAt).toISOString().replace('Z', '-00:00'),
    payer: { email: payerEmail || process.env.MP_PAYER_EMAIL },
  }
  if (notificationUrl) body.notification_url = notificationUrl
  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Mercado Pago recusou a cobrança: ${data.message || res.status}`)
  const td = data.point_of_interaction?.transaction_data || {}
  return { providerId: String(data.id), brcode: td.qr_code, qrBase64: td.qr_code_base64 || null, status: data.status }
}

export async function mpGetStatus(providerId) {
  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(providerId)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Mercado Pago: status ${res.status}`)
  const data = await res.json()
  return { status: data.status, externalReference: data.external_reference }
}

/**
 * Valida o cabeçalho x-signature do webhook (quando MP_WEBHOOK_SECRET está definido).
 * Manifesto: id:{data.id};request-id:{x-request-id};ts:{ts};
 */
export function mpVerifySignature({ signature, requestId, dataId }) {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return true
  if (!signature) return false
  const parts = Object.fromEntries(signature.split(',').map((kv) => kv.trim().split('=')))
  if (!parts.ts || !parts.v1) return false
  let manifest = ''
  if (dataId) manifest += `id:${String(dataId).toLowerCase()};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${parts.ts};`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v1)
  return a.length === b.length && timingSafeEqual(a, b)
}
