// Vocabulário único de status, usado pelo servidor e pelas telas.
export const ORDER_STATUS = {
  aberto: 'Montando o pedido',
  aguardando_pagamento: 'Aguardando pagamento',
  recebido: 'Pedido recebido',
  preparando: 'Na chapa',
  pronto: 'Pronto',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

export const DELIVERY_FLOW = ['aguardando_pagamento', 'recebido', 'preparando', 'pronto', 'saiu_entrega', 'entregue']
export const PICKUP_FLOW = ['aguardando_pagamento', 'recebido', 'preparando', 'pronto', 'entregue']

export const TICKET_STATUS = { novo: 'Na fila', preparando: 'Preparando', pronto: 'Pronto', entregue: 'Entregue' }

export const CALL_REASONS = {
  atendimento: 'Falar com atendente',
  conta: 'Ajuda com a conta',
  talheres: 'Talheres ou guardanapos',
  limpeza: 'Limpar a mesa',
}

export const CHANNEL_LABEL = { mesa: 'Mesa', entrega: 'Entrega', retirada: 'Retirada' }
