import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

if (process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = await import('dotenv')
    dotenv.config()
  } catch { }
}

const PORT = process.env.PORT || 3001
const apiKey = process.env.OPENAI_API_KEY

const app = express()
app.use(cors())
app.use(express.json({ limit: '20kb' }))

const openai = apiKey ? new OpenAI({ apiKey }) : null

const SYSTEM_PROMPT = `Você é um assistente educativo de prevenção ao aliciamento infantil online. Analise o texto do usuário e aponte padrões de risco em linguagem simples e empática (sigilo, isolamento, elogios inadequados, pedido de foto, troca de app, dinheiro/presentes, ameaças, encontros). 
Regras: Nunca crie/simule mensagens de aliciamento ou roleplay. Se for risco iminente ou ameaça de exposição de imagens, oriente acolhimento e ligar Disque 100 ou 190. Termine lembrando que é ferramenta educativa, não laudo. Máximo 6 frases, em texto corrido.`

app.get('/api/health', (req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(openai) })
})

app.post('/api/analyze', async (req, res) => {
  const { text } = req.body || {}

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Envie um campo "text" com o conteúdo a analisar.' })
  }

  if (!openai) {
    return res.status(503).json({ error: 'OPENAI_API_KEY não configurada neste servidor.' })
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 250, // Economiza tokens de saída
      temperature: 0.3, // Deixa a resposta mais direta e barata
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 2000) }, // Corta textos gigantes para economizar tokens de entrada
      ],
    })

    const reply = response.choices[0].message.content
    res.json({ reply })
  } catch (err) {
    console.error('Erro ao chamar a API da OpenAI:', err.message)
    res.status(502).json({ error: 'Falha ao consultar a IA. O frontend usará a análise local como alternativa.' })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`)
  console.log(openai ? 'IA configurada.' : 'Sem OPENAI_API_KEY — configure o painel do Render.')
})