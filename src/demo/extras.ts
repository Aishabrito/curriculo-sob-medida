import type { Application, EnglishResume, EnglishSource } from "../../shared/types";

// Respostas prontas para o exemplo fictício (funcionam sem IA).

export const demoApplication: Application = {
  subject: "Candidatura — Estágio em Desenvolvimento Front-end | Joana Ribeiro da Silva",
  email: `Olá, [nome do recrutador]!

Quero me candidatar à vaga de Estágio em Desenvolvimento Front-end na Nuvem Verde.

Estudo Sistemas de Informação na UFF (5º período) e construí o Feira Livre Online, um app em React.js que usa os dados abertos da prefeitura de Niterói para mostrar as feiras por bairro. Também fui monitora de Algoritmos, explicando programação para cerca de 40 alunos por semestre.

Meu currículo segue em anexo. Fico à disposição para conversar.

Obrigada,
Joana Ribeiro da Silva`,
  coverLetter: `Olá, [nome do recrutador]!

Quero fazer parte do time de produto da Nuvem Verde porque gosto de tecnologia que resolve algo do bairro. Foi assim que nasceu o meu projeto mais importante, e é isso que vejo no app de compostagem de vocês. Também me identifiquei com "aprender em público": já publiquei 6 artigos no dev.to sobre o que aprendo na faculdade.

Na prática, já construo interfaces em React.js e JavaScript. No Feira Livre Online, transformei os dados abertos da prefeitura de Niterói em uma busca por bairro e dia da semana. Também fiz um layout responsivo com HTML5, CSS3, Flexbox e Grid, testado no celular e no computador. Como monitora de Algoritmos na UFF, atendi cerca de 40 alunos por semestre — o que me ensinou a explicar com clareza e a trabalhar com outras pessoas.

Estou no 5º período de Sistemas de Informação e tenho disponibilidade para 6h por dia no modelo híbrido. Vou gostar muito de conversar sobre como posso contribuir.

Obrigada,
Joana Ribeiro da Silva`,
};

const EN: Record<string, string> = {
  "Estudante de Sistemas de Informação": "Information Systems Student",
  "Resumo profissional": "Summary",
  Objetivo: "Summary",
  Formação: "Education",
  Projetos: "Projects",
  Experiência: "Experience",
  Habilidades: "Skills",
  Atividades: "Activities",
  "Sou uma pessoa proativa e apaixonada por tecnologia, em busca de novos desafios na área de desenvolvimento.":
    "Information Systems student looking for a front-end development internship.",
  "Estudante de Sistemas de Informação na UFF buscando estágio em front-end. Construo interfaces em React.js e JavaScript e já publiquei um projeto com dados abertos de Niterói.":
    "Information Systems student at UFF seeking a front-end internship. I build interfaces with React.js and JavaScript and have shipped a project using Niterói's open data.",
  "Bacharelado em Sistemas de Informação - Universidade Federal Fluminense (UFF), 5º período, previsão de conclusão em 2027":
    "Bachelor's in Information Systems - Universidade Federal Fluminense (UFF), 5th semester, expected graduation 2027",
  "Feira Livre Online: site em React que mostra as feiras livres de Niterói por bairro e dia da semana, usando dados da prefeitura em JSON.":
    "Feira Livre Online: React website that lists Niterói's street markets by neighborhood and weekday, using the city's JSON data.",
  "Feira Livre Online (React.js): app que mostra as feiras livres de Niterói por bairro e dia da semana, consumindo os dados abertos da prefeitura em JSON.":
    "Feira Livre Online (React.js): app that lists Niterói's street markets by neighborhood and weekday, consuming the city's open data in JSON.",
  "Portfólio pessoal feito com HTML, CSS e JavaScript, publicado no GitHub Pages.":
    "Personal portfolio built with HTML, CSS and JavaScript, published on GitHub Pages.",
  "Portfólio pessoal em HTML, CSS e JavaScript, versionado com Git e publicado no GitHub Pages.":
    "Personal portfolio in HTML, CSS and JavaScript, version-controlled with Git and published on GitHub Pages.",
  "Clone do layout de um site de receitas para praticar CSS Flexbox e Grid, funcionando em celular e computador.":
    "Recipe website layout clone to practice CSS Flexbox and Grid, working on mobile and desktop.",
  "Layout responsivo de um site de receitas com HTML5, CSS3, Flexbox e Grid, testado em celular e computador.":
    "Responsive recipe website layout with HTML5, CSS3, Flexbox and Grid, tested on mobile and desktop.",
  "Experiência com TypeScript e testes automatizados em projetos pessoais.": "TypeScript and automated testing in personal projects.",
  "Monitora de Algoritmos - UFF (2025): tirei dúvidas de cerca de 40 alunos por semestre e montei listas de exercícios em Python.":
    "Algorithms Teaching Assistant - UFF (2025): answered questions from about 40 students per semester and wrote Python exercise sets.",
  "Monitora de Algoritmos - UFF (2025): atendi cerca de 40 alunos por semestre explicando conceitos de programação e criei listas de exercícios em Python.":
    "Algorithms Teaching Assistant - UFF (2025): supported about 40 students per semester by explaining programming concepts, and created Python exercise sets.",
  "Atendente - Padaria Pão Quente (2022-2023): atendimento ao público e caixa.": "Customer Service Associate - Padaria Pão Quente (2022-2023): customer service and cashier.",
  "React, JavaScript, HTML, CSS, Git, Python, inglês intermediário": "React, JavaScript, HTML, CSS, Git, Python, English: intermediate",
  "React.js, JavaScript (ES6+), HTML5, CSS3, layout responsivo, Git e GitHub, consumo de dados JSON, Python, inglês intermediário":
    "React.js, JavaScript (ES6+), HTML5, CSS3, responsive design, Git and GitHub, JSON data consumption, Python, English: intermediate",
  "Escrevo no blog dev.to sobre o que aprendo na faculdade (6 artigos publicados).": "Write on dev.to about what I learn in college (6 articles published).",
  "Compartilho o que aprendo em artigos no dev.to (6 publicados) — documentar o processo é parte de como eu estudo.":
    "Share what I learn in articles on dev.to (6 published) — documenting the process is part of how I study.",
  "Voluntária no projeto Meninas Digitais UFF, ajudando em oficinas de programação para alunas do ensino médio.":
    "Volunteer at Meninas Digitais UFF, helping run programming workshops for high school girls.",
};

export function demoEnglish(source: EnglishSource): EnglishResume {
  const t = (s: string) => EN[s] ?? s;
  return { headline: t(source.headline), sections: source.sections.map((s) => ({ id: s.id, title: t(s.title), lines: s.lines.map(t) })) };
}
