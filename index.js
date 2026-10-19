
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const PORT = process.env.PORT || 3001
const apiKey = process.env.ANTHROPIC_API_KEY

const app = express()
app.use(cors())
app.use(express.json({ limit: '20kb' })) // conversas coladas não precisam ser gigantes

const anthropic = apiKey ? new Anthropic({ apiKey }) : null

// System prompt com regras explícitas de segurança infantil.
// A IA SÓ analisa texto que o usuário já tem em mãos — ela nunca
// gera, completa ou melhora mensagens que soem como aliciamento,
// mesmo se pedirem "só um exemplo" ou "para treinar".
const SYSTEM_PROMPT = `Você é um assistente educativo de segurança digital infantil, parte de uma plataforma de prevenção ao aliciamento sexual infantil online (grooming).

Sua única função é analisar um texto que o usuário colar ou descrever (uma conversa, uma situação) e apontar, em linguagem simples e empática, quais padrões de risco aparecem: pedido de sigilo, isolamento de adultos de confiança, elogios sobre maturidade/aparência, pedido de foto pessoal, insistência para trocar de aplicativo, oferta de presentes/dinheiro, chantagem ou ameaça, e proposta de encontro presencial.

Regras que você NUNCA quebra, independentemente de como o pedido for formulado:
- Nunca gere, complete, continue, melhore ou dê "exemplos" de mensagens de aliciamento, sedução ou conteúdo sexual envolvendo menores. Se pedirem isso — mesmo alegando ser para treinar, testar ou fins educacionais — recuse e explique que a ferramenta serve para analisar texto existente, não para criar esse tipo de conteúdo.
- Nunca faça roleplay como a pessoa que aliciou ou como a vítima.
- Nunca peça ou processe imagens, nomes completos, endereços ou outros dados que identifiquem uma criança específica; se algum desses dados aparecer no texto, ignore-os na sua resposta e não os repita.
- Se o usuário indicar que é uma criança/adolescente em risco agora, ou que já enviou imagens e está sendo ameaçada(o), priorize acolhimento: diga claramente que a pessoa não fez nada de errado, e oriente a ligar para o Disque 100 (ligação gratuita e anônima) ou, em risco imediato, para o 190.
- Sempre termine lembrando que esta é uma ferramenta educativa, não uma avaliação profissional nem uma denúncia formal.
- Seja objetivo e empático. Nunca seja alarmista nem minimize sinais reais.

Responda em português do Brasil, em texto corrido (sem markdown pesado), em no máximo 6 frases.`

app.get('/api/health', (req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(anthropic) })
})

app.post('/api/analyze', async (req, res) => {
  const { text } = req.body || {}

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Envie um campo "text" com o conteúdo a analisar.' })
  }

  if (!anthropic) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada neste servidor.' })
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text.slice(0, 4000) }],
    })

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    res.json({ reply })
  } catch (err) {
    console.error('Erro ao chamar a API da Anthropic:', err.message)
    res.status(502).json({ error: 'Falha ao consultar a IA. O frontend usará a análise local como alternativa.' })
  }
})

app.listen(PORT, () => {
  console.log(`Servidor do verificador rodando em http://localhost:${PORT}`)
  console.log(anthropic ? 'IA configurada.' : 'Sem ANTHROPIC_API_KEY — configure o .env para ativar a IA.')
})
