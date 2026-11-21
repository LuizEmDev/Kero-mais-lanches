# Kero+ lanches

Site e sistema da lanchonete Kero+: vitrine animada, cardápio, pedidos na mesa sem garçom, entrega, conta dividida, Pix, painel da cozinha e dashboard.

## Como rodar

Requer Node.js 22.13 ou mais novo (usa o SQLite embutido do Node).

```bash
npm install
npm run dev          # desenvolvimento em http://localhost:3000
```

Produção:

```bash
npm run build
STAFF_PIN=seu-pin DEMO_MODE=false PIX_KEY=sua-chave npm start
```

Testes do servidor (divisão de conta, BR Code do Pix e fluxos de pedido): `npm test`.

Configuração completa em `.env.example`. O PIN padrão da equipe é `1234`; troque com `STAFF_PIN`.

## O que tem

| Endereço | Para quem | O que faz |
|---|---|---|
| `/` | Clientes | Página inicial animada: o lanche se monta na abertura e se abre em camadas na rolagem |
| `/cardapio` | Clientes | Cardápio com busca, categorias, favoritos e sacola |
| `/checkout` | Clientes | Entrega ou retirada, só eu ou em grupo, CEP automático |
| `/pedido/CODIGO` | Clientes | Pedido em grupo, pagamento Pix e acompanhamento em tempo real |
| `/mesa/N?t=TOKEN` | Clientes na mesa | Comanda compartilhada, envio direto para a cozinha, chamar atendente, conta dividida |
| `/conta` | Clientes | Conta local: dados, endereços, favoritos, histórico e "pedir de novo" |
| `/cozinha` | Equipe | Painel da cozinha com fila, preparo, prontos, tempo e alerta sonoro |
| `/admin` | Equipe | Dashboard de faturamento, pedidos, salão e chamados, cardápio e ajustes |

### Mesa sem garçom
Cada mesa tem um QR code (imprima em Admin, Salão, "QR codes das mesas"). Quem lê entra na comanda da mesa com o próprio nome. Os pedidos vão direto para a cozinha em rodadas, e todo mundo acompanha o status. O QR leva um token: quem não está na loja não consegue pedir. Se uma foto do QR vazar, gere um QR novo.

### Chamar atendente
Botão no topo da mesa com motivo (atendimento, ajuda com a conta, talheres, limpeza). O painel mostra o chamado na hora, com som, e o cliente vê quando foi atendido.

### Conta dividida e compra em família
- Na mesa ou num pedido de entrega em grupo, cada item pertence a quem pediu e pode ser dividido entre várias pessoas.
- Dois modos: pelo que cada um pediu ou igual para todos. A taxa de serviço e a de entrega são repartidas e a soma das partes sempre bate com o total, centavo por centavo.
- Cada pessoa paga a sua parte no próprio Pix, e qualquer um pode pagar a parte de outra pessoa.
- Na entrega em grupo, quem criou manda o link, cada um escolhe o seu, e o pedido só vai para a chapa quando o total estiver pago.

### Pix
- **Chave Pix (padrão):** gera o BR Code "copia e cola" com valor e identificador, no padrão do Banco Central. Funciona com qualquer banco sem contrato, mas o banco não avisa a loja. A equipe confirma em Admin, Pedidos, "Confirmar Pix recebido".
- **Mercado Pago (automático):** com `MP_ACCESS_TOKEN`, cada cobrança vira um Pix dinâmico e o webhook `/api/webhooks/mercadopago` confirma o pagamento sozinho (assinatura validada com `MP_WEBHOOK_SECRET`). Essa integração foi escrita conforme a API pública do Mercado Pago, mas não foi testada com uma conta real.
- **Modo demonstração** (`DEMO_MODE=true`, padrão): mostra "Simular pagamento" e cria 3 semanas de vendas fictícias para o dashboard. Desligue em produção.

### Conta local
Sem cadastro e sem senha: nome, telefone, endereços, favoritos, sacola e histórico ficam no `localStorage` do aparelho. O servidor guarda só os pedidos.

## Tecnologia
- **Front-end:** React 19, Vite, React Router, GSAP com ScrollTrigger, Lenis (rolagem suave) e Socket.IO. Respeita "reduzir movimento" do sistema.
- **Back-end:** Express 5, Socket.IO para tempo real e SQLite embutido do Node (`node:sqlite`). Os valores são guardados em centavos.
- **Design:** amarelo Kero+ `#FFCE1F`, vermelho `#E8361F`, branco e marrom de chapa `#2B1A0E`. Fontes Bagel Fat One (títulos) e Schibsted Grotesk (texto). O "+" da marca é sempre o símbolo desenhado. Ilustrações em SVG feitas à mão para o projeto.

## Estrutura
```
server/   API, regras de pedido, Pix, estatísticas, banco
shared/   cálculo da divisão de conta e status (usado no servidor e no site)
client/   site React (páginas, componentes, estilos)
tests/    testes do servidor
```
