import type { AnalysisResult, AnalyzeInput } from "../../shared/types";

// Exemplo 100% fictício, usado no botão "Ver exemplo". Funciona sem IA.

export const demoInput: AnalyzeInput = {
  job: `Estágio em Desenvolvimento Front-end — Nuvem Verde (híbrido, Rio de Janeiro)

Sobre a vaga
Buscamos estudante de Ciência da Computação, Sistemas de Informação ou áreas afins para atuar no time de produto, construindo interfaces do nosso app de compostagem urbana.

Requisitos
- Conhecimento em React.js e JavaScript (ES6+)
- HTML5 e CSS3, com atenção a layout responsivo
- Git e GitHub
- Consumo de APIs REST
- Boa comunicação e trabalho em equipe

Diferenciais
- TypeScript
- Testes automatizados (Jest ou Vitest)
- Noções de acessibilidade (WCAG)
- Figma

Bolsa-auxílio de R$ 1.800 + VT + VR. 6h por dia.`,
  company: `A Nuvem Verde é uma startup carioca que conecta condomínios a pontos de compostagem. Nossos valores: impacto real no território, aprender em público (documentamos e compartilhamos o que aprendemos) e diversidade como estratégia — 60% do time é formado por pessoas negras e mulheres.`,
  resume: `Joana Ribeiro da Silva
Estudante de Sistemas de Informação
joana.exemplo@email.com | (21) 90000-0000 | Niterói - RJ | github.com/joana-exemplo

Objetivo
Sou uma pessoa proativa e apaixonada por tecnologia, em busca de novos desafios na área de desenvolvimento.

Formação
Bacharelado em Sistemas de Informação - Universidade Federal Fluminense (UFF), 5º período, previsão de conclusão em 2027

Projetos
Feira Livre Online: site em React que mostra as feiras livres de Niterói por bairro e dia da semana, usando dados da prefeitura em JSON.
Portfólio pessoal feito com HTML, CSS e JavaScript, publicado no GitHub Pages.
Clone do layout de um site de receitas para praticar CSS Flexbox e Grid, funcionando em celular e computador.

Experiência
Monitora de Algoritmos - UFF (2025): tirei dúvidas de cerca de 40 alunos por semestre e montei listas de exercícios em Python.
Atendente - Padaria Pão Quente (2022-2023): atendimento ao público e caixa.

Habilidades
React, JavaScript, HTML, CSS, Git, Python, inglês intermediário

Atividades
Escrevo no blog dev.to sobre o que aprendo na faculdade (6 artigos publicados).
Voluntária no projeto Meninas Digitais UFF, ajudando em oficinas de programação para alunas do ensino médio.`,
};

export const demoResult: AnalysisResult = {
  jobTitle: "Estágio em Desenvolvimento Front-end",
  companyName: "Nuvem Verde",
  candidate: {
    name: "Joana Ribeiro da Silva",
    headline: "Estudante de Sistemas de Informação",
    contact: ["joana.exemplo@email.com", "(21) 90000-0000", "Niterói - RJ", "github.com/joana-exemplo"],
  },
  sections: [
    {
      id: "s1",
      title: "Objetivo",
      lines: [{ id: "s1l1", text: "Sou uma pessoa proativa e apaixonada por tecnologia, em busca de novos desafios na área de desenvolvimento." }],
    },
    {
      id: "s2",
      title: "Formação",
      lines: [{ id: "s2l1", text: "Bacharelado em Sistemas de Informação - Universidade Federal Fluminense (UFF), 5º período, previsão de conclusão em 2027" }],
    },
    {
      id: "s3",
      title: "Projetos",
      lines: [
        { id: "s3l1", text: "Feira Livre Online: site em React que mostra as feiras livres de Niterói por bairro e dia da semana, usando dados da prefeitura em JSON." },
        { id: "s3l2", text: "Portfólio pessoal feito com HTML, CSS e JavaScript, publicado no GitHub Pages." },
        { id: "s3l3", text: "Clone do layout de um site de receitas para praticar CSS Flexbox e Grid, funcionando em celular e computador." },
      ],
    },
    {
      id: "s4",
      title: "Experiência",
      lines: [
        { id: "s4l1", text: "Monitora de Algoritmos - UFF (2025): tirei dúvidas de cerca de 40 alunos por semestre e montei listas de exercícios em Python." },
        { id: "s4l2", text: "Atendente - Padaria Pão Quente (2022-2023): atendimento ao público e caixa." },
      ],
    },
    {
      id: "s5",
      title: "Habilidades",
      lines: [{ id: "s5l1", text: "React, JavaScript, HTML, CSS, Git, Python, inglês intermediário" }],
    },
    {
      id: "s6",
      title: "Atividades",
      lines: [
        { id: "s6l1", text: "Escrevo no blog dev.to sobre o que aprendo na faculdade (6 artigos publicados)." },
        { id: "s6l2", text: "Voluntária no projeto Meninas Digitais UFF, ajudando em oficinas de programação para alunas do ensino médio." },
      ],
    },
  ],
  suggestions: [
    {
      id: "m1",
      sectionId: "s1",
      lineId: "s1l1",
      original: "Sou uma pessoa proativa e apaixonada por tecnologia, em busca de novos desafios na área de desenvolvimento.",
      suggested:
        "Estudante de Sistemas de Informação na UFF buscando estágio em front-end. Construo interfaces em React.js e JavaScript e já publiquei um projeto com dados abertos de Niterói.",
      reason: "Troca adjetivos genéricos por fatos e já coloca os dois requisitos principais da vaga na primeira linha.",
      evidence: "Feira Livre Online: site em React que mostra as feiras livres de Niterói",
      requirement: "React.js e JavaScript (ES6+)",
    },
    {
      id: "m2",
      sectionId: "s3",
      lineId: "s3l1",
      original: "Feira Livre Online: site em React que mostra as feiras livres de Niterói por bairro e dia da semana, usando dados da prefeitura em JSON.",
      suggested:
        "Feira Livre Online (React.js): app que mostra as feiras livres de Niterói por bairro e dia da semana, consumindo os dados abertos da prefeitura em JSON.",
      reason: "Usa o termo exato da vaga (React.js) e deixa claro que você consome dados externos — perto de 'APIs REST'.",
      evidence: "usando dados da prefeitura em JSON",
      requirement: "Consumo de APIs REST",
    },
    {
      id: "m3",
      sectionId: "s3",
      lineId: "s3l3",
      original: "Clone do layout de um site de receitas para praticar CSS Flexbox e Grid, funcionando em celular e computador.",
      suggested: "Layout responsivo de um site de receitas com HTML5, CSS3, Flexbox e Grid, testado em celular e computador.",
      reason: "'Funcionando em celular e computador' é exatamente 'layout responsivo' — o termo que o filtro ATS procura.",
      evidence: "praticar CSS Flexbox e Grid, funcionando em celular e computador",
      requirement: "HTML5 e CSS3, com atenção a layout responsivo",
    },
    {
      id: "m4",
      sectionId: "s3",
      lineId: "s3l2",
      original: "Portfólio pessoal feito com HTML, CSS e JavaScript, publicado no GitHub Pages.",
      suggested: "Portfólio pessoal em HTML, CSS e JavaScript, versionado com Git e publicado no GitHub Pages.",
      reason: "Mostra Git e GitHub em uso real, não só na lista de habilidades.",
      evidence: "publicado no GitHub Pages",
      requirement: "Git e GitHub",
    },
    {
      id: "m5",
      sectionId: "s4",
      lineId: "s4l1",
      original: "Monitora de Algoritmos - UFF (2025): tirei dúvidas de cerca de 40 alunos por semestre e montei listas de exercícios em Python.",
      suggested:
        "Monitora de Algoritmos - UFF (2025): atendi cerca de 40 alunos por semestre explicando conceitos de programação e criei listas de exercícios em Python.",
      reason: "Monitoria é prova de comunicação — a vaga pede isso. Explicar para 40 pessoas vale mais que escrever 'boa comunicação'.",
      evidence: "tirei dúvidas de cerca de 40 alunos por semestre",
      requirement: "Boa comunicação e trabalho em equipe",
    },
    {
      id: "m6",
      sectionId: "s5",
      lineId: "s5l1",
      original: "React, JavaScript, HTML, CSS, Git, Python, inglês intermediário",
      suggested: "React.js, JavaScript (ES6+), HTML5, CSS3, layout responsivo, Git e GitHub, consumo de dados JSON, Python, inglês intermediário",
      reason: "Mesmas habilidades, escritas com os termos que a vaga usa.",
      evidence: "React, JavaScript, HTML, CSS, Git, Python",
      requirement: "Requisitos técnicos da vaga",
    },
    {
      id: "m7",
      sectionId: "s6",
      lineId: "s6l1",
      original: "Escrevo no blog dev.to sobre o que aprendo na faculdade (6 artigos publicados).",
      suggested: "Compartilho o que aprendo em artigos no dev.to (6 publicados) — documentar o processo é parte de como eu estudo.",
      reason: "Conecta com o valor 'aprender em público' da empresa, usando um fato que já está no currículo.",
      evidence: "Escrevo no blog dev.to sobre o que aprendo na faculdade (6 artigos publicados).",
      requirement: "Valor da empresa: aprender em público",
    },
    {
      id: "m8",
      sectionId: "s3",
      lineId: null,
      original: "",
      suggested: "Experiência com TypeScript e testes automatizados em projetos pessoais.",
      reason: "A vaga lista TypeScript e testes como diferencial.",
      evidence: "projetos com TypeScript",
      requirement: "TypeScript (diferencial)",
    },
  ],
  keywords: [
    { term: "React.js", importance: "essencial", synonyms: ["React", "ReactJS"] },
    { term: "JavaScript", importance: "essencial", synonyms: ["JS", "ES6"] },
    { term: "HTML5", importance: "essencial", synonyms: ["HTML"] },
    { term: "CSS3", importance: "essencial", synonyms: ["CSS"] },
    { term: "layout responsivo", importance: "essencial", synonyms: ["responsivo", "responsividade"] },
    { term: "Git", importance: "essencial", synonyms: [] },
    { term: "GitHub", importance: "essencial", synonyms: [] },
    { term: "APIs REST", importance: "essencial", synonyms: ["API REST", "REST"] },
    { term: "comunicação", importance: "desejavel", synonyms: [] },
    { term: "trabalho em equipe", importance: "desejavel", synonyms: [] },
    { term: "TypeScript", importance: "desejavel", synonyms: ["TS"] },
    { term: "testes automatizados", importance: "desejavel", synonyms: ["Jest", "Vitest"] },
    { term: "acessibilidade", importance: "desejavel", synonyms: ["WCAG", "a11y"] },
    { term: "Figma", importance: "desejavel", synonyms: [] },
  ],
  gaps: [
    {
      requirement: "TypeScript",
      why: "É diferencial na vaga e aparece em quase toda vaga de front-end júnior.",
      action: "Converta o Feira Livre Online para TypeScript (comece tipando os dados das feiras) e escreva no README o que mudou.",
      timeframe: "1 fim de semana",
    },
    {
      requirement: "Testes automatizados (Jest ou Vitest)",
      why: "Mostra cuidado com qualidade, algo raro em portfólio de estágio.",
      action: "Adicione Vitest + Testing Library ao Feira Livre e teste o filtro por bairro e dia. 5 testes bastam.",
      timeframe: "2 a 3 noites",
    },
    {
      requirement: "Acessibilidade (WCAG)",
      why: "A empresa fala em impacto no território — acessibilidade é parte disso.",
      action: "Rode o Lighthouse no Feira Livre, corrija contraste e textos alternativos e coloque a nota antes/depois no README.",
      timeframe: "1 tarde",
    },
    {
      requirement: "APIs REST",
      why: "Você lê um JSON estático; a vaga quer ver consumo de API.",
      action: "Troque o JSON local por uma chamada fetch a uma API pública (ex.: BrasilAPI) e trate carregamento e erro na tela.",
      timeframe: "1 dia",
    },
  ],
  companyBridge: {
    sentence:
      "Meus 6 artigos no dev.to e as oficinas no Meninas Digitais mostram que eu já aprendo em público e trabalho para colocar mais mulheres na tecnologia — dois valores da Nuvem Verde.",
    valuesMatched: ["aprender em público", "diversidade como estratégia", "impacto no território"],
  },
  recruiterMessage:
    "Oi, [nome]! Vi a vaga de estágio front-end na Nuvem Verde e me identifiquei: estudo SI na UFF e criei o Feira Livre Online, um app em React que usa dados abertos de Niterói para mostrar as feiras por bairro. Gosto muito de produto com impacto local, então o app de compostagem chamou minha atenção. Já me candidatei — se fizer sentido, adoraria conversar. Obrigada!",
  knockouts: [
    {
      requirement: "Estudante de Ciência da Computação, SI ou áreas afins",
      status: "tem",
      evidence: "Bacharelado em Sistemas de Informação - Universidade Federal Fluminense (UFF), 5º período",
      fix: "",
    },
    {
      requirement: "Híbrido no Rio de Janeiro",
      status: "tem",
      evidence: "Niterói - RJ",
      fix: "Niterói fica perto do Rio, mas deixe explícito: \"Disponível para trabalho híbrido no Rio de Janeiro\".",
    },
    {
      requirement: "Disponibilidade de 6h por dia",
      status: "nao-claro",
      evidence: "",
      fix: "O currículo não diz seu horário. Acrescente no topo: \"Disponibilidade: 6h/dia (manhã ou tarde)\" — sem isso, alguns filtros descartam.",
    },
  ],
  interviewQuestions: [
    {
      question: "Me conta sobre um projeto do qual você se orgulha.",
      tip: "Fale do Feira Livre Online: o problema (achar feira perto de casa), de onde vieram os dados e uma decisão técnica que você tomou.",
    },
    {
      question: "Como você faz um layout funcionar no celular?",
      tip: "Use o site de receitas: mobile-first, Flexbox para listas, Grid para a página, e como você testou.",
    },
    {
      question: "Como você lida quando não sabe algo?",
      tip: "Monitoria e dev.to: você pesquisa, testa, e depois explica para os outros.",
    },
    {
      question: "Por que a Nuvem Verde?",
      tip: "Ligue o Feira Livre (dados abertos de Niterói) ao app de compostagem: os dois resolvem algo do bairro.",
    },
  ],
};
