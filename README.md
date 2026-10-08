# Currículo Sob Medida

Adapta o seu currículo para cada vaga com IA, **sem inventar nada**. Você cola a vaga, conta (se quiser) sobre a empresa, anexa o currículo, e o site:

- reescreve as linhas que importam para essa vaga, usando os termos que o filtro automático (ATS) procura;
- mostra, para **cada** mudança, a prova no seu currículo original e o requisito da vaga que ela atende;
- deixa você **aceitar, recusar ou editar** frase por frase;
- gera o PDF final só com o que você aprovou.

![Tela inicial](docs/tela-inicial.png)
![Resultado](docs/resultado.png)

> Clique em **"Ver um exemplo pronto"** para testar com um currículo fictício, sem precisar de nada.

## O que tem de diferente

A maioria dos "otimizadores de currículo" devolve um texto novo, cheio de palavra-chave e com cara de robô. Aqui a ideia é outra:

| | Como funciona |
|---|---|
| **Mapa de evidências** | A IA precisa citar um trecho literal do seu currículo como prova de cada mudança. O navegador confere se o trecho existe mesmo. Se não existir, a mudança aparece em vermelho: "Não encontramos isso no seu currículo". |
| **Você aprova cada frase** | Antes e depois lado a lado, com aceitar, recusar e editar. Nada entra no PDF sem você aprovar. |
| **Raio-X do ATS** | Mostra quais termos da vaga você já tinha, quais foram adicionados e quais faltam, com a porcentagem antes e depois. A conta é feita no navegador, palavra por palavra, sem "chute" da IA. |
| **Detector de texto robótico** | Destaca clichês ("proativa", "apaixonada por", "sinergia"…) e dá uma nota de "soa humano", com dica do que colocar no lugar. |
| **Plano para as lacunas** | O que a vaga pede e você ainda não mostra vira uma ação concreta e gratuita ("adicione testes com Vitest no projeto X — 2 noites"). A palavra-chave não é enfiada no currículo. |
| **Requisitos eliminatórios** | Separa da vaga o que corta na triagem (período, idioma, horário, presencial, cidade) e mostra se você atende, não atende ou se o currículo não deixa claro, com a correção. O "você atende" só vale se a prova existir no currículo. |
| **Olhar de recrutador em 6 segundos** | Checagem sem IA do que faz um currículo de estágio ser descartado no Brasil: mais de 1 página, CPF/RG/endereço/idade/estado civil, foto, e-mail pouco profissional, falta de LinkedIn/GitHub, datas invertidas, frases longas. |
| **Ponte com a empresa** | Se você contar os valores da empresa, recebe uma frase verdadeira ligando a sua história a eles. |
| **Candidatura pronta** | Mensagem curta para o LinkedIn e, num clique, e-mail de candidatura e carta de apresentação feitos do currículo já aprovado. |
| **Versão em inglês** | Tradução natural do currículo final (com os termos da vaga), no mesmo Word ou no mesmo estilo de PDF. Para vagas remotas e internacionais. |
| **Treino de entrevista** | Perguntas prováveis para a vaga: você responde, recebe nota, pontos fortes, o que melhorar e uma versão mais forte — só com fatos seus. |
| **O que não está no currículo** | Campo opcional para contar projetos, cursos e conquistas que ficaram de fora. A IA encaixa na seção certa e cada mudança mostra "veio do que você contou". |
| **Mantém a sua formatação** | Word (.docx): o site edita o próprio arquivo, então fonte, cor, marcadores e espaçamento ficam idênticos e só o texto aprovado muda. PDF: o site lê o estilo do original (fontes, tamanhos, negrito, cores, margens, marcadores, alinhamento) e gera o novo PDF no mesmo estilo, ajustando o tamanho quando a fonte original não está disponível. |
| **PDF que o ATS lê** | Texto selecionável, uma coluna. Também dá para baixar um PDF simples. |

## Como funciona por dentro

```
navegador                                   função na Vercel (/api/analyze)
─────────                                   ──────────────────────────────
PDF/DOCX → texto (pdf.js / mammoth) + estilo do PDF ou o próprio .docx
vaga + empresa + texto ───────────────────► valida tamanho e limite por IP
                                            Gemini (grátis) ─► se falhar ─► Groq (grátis)
                                            confere e limpa o JSON da IA
◄─────────────────────────────────── seções, sugestões, palavras-chave, lacunas…
confere as provas no texto original
calcula o ATS antes/depois e a nota "soa humano"
você aprova → Word: edita o .docx original (JSZip) · PDF: novo PDF no estilo do original (jsPDF)
```

- **React + Vite + TypeScript**, sem biblioteca de UI.
- **A chave da IA fica no servidor** (função serverless na Vercel). Quem usa o site não precisa de chave nenhuma.
- **IA gratuita:** Google Gemini, com Groq de reserva se o Gemini falhar ou estourar a cota. A análise é uma chamada só; e-mail/carta, inglês e treino de entrevista só chamam a IA quando a pessoa clica.
- **A resposta da IA é tratada como dado não confiável:** é validada campo a campo (`shared/parseAnalysis.ts`), e o texto do usuário vai entre tags com instrução para ignorar comandos escondidos nele.
- **Privacidade:** o arquivo é lido no navegador e só o texto é enviado. Nada é salvo em servidor; o resultado fica só na aba (`sessionStorage`).

## Rodar no seu computador

```bash
npm install
cp .env.example .env.local   # coloque sua GEMINI_API_KEY (grátis em https://aistudio.google.com/apikey)
npm run dev                  # http://localhost:5173
npm test                     # testes da lógica (provas, ATS, clichês, montagem do currículo)
```

Sem chave, o site funciona normalmente com o exemplo pronto.

## Publicar de graça na Vercel

1. Entre em [vercel.com](https://vercel.com) com o GitHub e importe este repositório (o Vite é detectado sozinho).
2. Em **Settings → Environment Variables**, adicione `GEMINI_API_KEY` (e, se quiser, `GROQ_API_KEY`, de [console.groq.com/keys](https://console.groq.com/keys)).
3. Faça o deploy. Pronto.

Variáveis opcionais: `GEMINI_MODEL` (padrão `gemini-flash-latest`), `GROQ_MODEL` (padrão `llama-3.3-70b-versatile`) `RATE_LIMIT_PER_HOUR` (padrão 8 análises por pessoa por hora) e `RATE_LIMIT_EXTRAS_PER_HOUR` (padrão 30 extras por hora).

> No plano gratuito do Gemini, o Google pode usar os textos enviados para melhorar os modelos. O site avisa isso na tela inicial.

## Estrutura

```
api/analyze.ts          função serverless da análise (Vercel)
api/extra.ts            função dos extras: e-mail e carta, inglês, treino de entrevista
server/                 chamada às IAs (ai.ts), prompts, validação de entrada, limite por IP
shared/                 tipos e validação da resposta da IA (usados nos dois lados)
src/pages/              tela do formulário e tela de resultado
src/lib/                provas, ATS, clichês, checagem de recrutador, montagem do currículo, leitura de arquivos,
                        layout.ts (estilo do PDF), pdf.ts (gera o PDF), docx.ts (edita o Word)
src/demo/example.ts     exemplo fictício usado no "Ver um exemplo pronto"
```

---

Feito por [Aísha Brito](https://github.com/aishabrito).
