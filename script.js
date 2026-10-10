// Study tracker: toda a lógica do sistema
const CHAVE = 'studytracker.v4';  // onde os dados ficam salvos no navegador
const GITHUB = 'fergomes76';      // usuário do GitHub, sem o @

// Cada tema tem 5 tons da mesma cor, do mais claro ao mais escuro
const TEMAS = [
  {nome: 'Rosa',    fundo: '#FDF1FA', claro: '#F9DFF3', medio: '#EBADE0', forte: '#DB8ACB', texto: '#6B2D5E'},
  {nome: 'Verde',   fundo: '#F1F9F3', claro: '#DDF0E2', medio: '#A8DBA8', forte: '#7CC49A', texto: '#2D5A40'},
  {nome: 'Índigo',  fundo: '#F2F2FD', claro: '#DCDEF8', medio: '#ADB0EE', forte: '#8F93E0', texto: '#33366B'},
  {nome: 'Roxo',    fundo: '#F6F0FC', claro: '#EBDDF8', medio: '#D4B0EE', forte: '#BC8CE0', texto: '#4A2D6B'},
  {nome: 'Azul',    fundo: '#EFF9FC', claro: '#D8F1F7', medio: '#A8E0EC', forte: '#7CCBDD', texto: '#1F5566'},
  {nome: 'Amarelo', fundo: '#FFFBEA', claro: '#FFF3BF', medio: '#FFE98A', forte: '#FAD95B', texto: '#6B5A12'}
];

const ICONES = {   // ícones desenhados em SVG
  play:    '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause:   '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  lixeira: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg>',
  seta:    '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  check:   '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};


// Funções de apoio
const $ = id => document.getElementById(id);
const novoId = () => Math.random().toString(36).slice(2, 9);

// Data de hoje, ex: 2026-10-09
const hoje = () => new Date().toLocaleDateString('sv-SE');

// Evita que o que a pessoa digita vire código HTML
const esc = texto => String(texto).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');

// 3725 segundos vira 01:02:05
const formatar = seg => [seg / 3600, seg % 3600 / 60, seg % 60]
  .map(n => String(Math.floor(n)).padStart(2, '0'))
  .join(':');

// Variáveis de cor usadas pelo CSS em cada estudo
const cores = i => {
  const t = TEMAS[i];
  return `--k100:${t.claro};--k300:${t.medio};--k500:${t.forte};--k800:${t.texto}`;
};


// Dados: D guarda tudo (tema, meta, estudos, histórico e timer) e fica salvo no localStorage
const estudo = (titulo, cor) => ({
  id: novoId(),
  titulo,
  cor,
  concluido: false,
  aberto: false,
  tarefas: []
});

// st: parado, rodando ou pausado
const timerParado = () => ({st: 'parado', id: null, ms: 0, ultimo: 0});

const salvar = () => {
  try { localStorage.setItem(CHAVE, JSON.stringify(D)); } catch (e) {}
};

let D = null;
try { D = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) {}

D = D || {
  tema: 1,
  corNova: 0,
  meta: 0,
  ativo: null,
  sessoes: [],
  timer: timerParado(),
  estudos: []
};

let T = D.timer;
const achar = id => D.estudos.find(e => e.id === id);
const resetarTimer = () => { D.timer = T = timerParado(); };

// Página fechada com o timer rodando: ele volta pausado, o tempo fechado não conta
if (T.st === 'rodando') T.st = 'pausado';
if (T.id && !achar(T.id)) resetarTimer();

// Concluído vale 100%, senão conta as tarefas feitas
function percentual(e) {
  if (e.concluido) return 100;
  const feitas = e.tarefas.filter(t => t.feita).length;
  return e.tarefas.length ? Math.round(feitas / e.tarefas.length * 100) : 0;
}

// Segundos estudados hoje: sessões salvas + a sessão em andamento
const segundosDe = id => D.sessoes
  .filter(s => s.id === id && s.dia === hoje())
  .reduce((soma, s) => soma + s.seg, 0)
  + (T.id === id ? Math.floor(T.ms / 1000) : 0);

const totalHoje = () => D.estudos.reduce((soma, e) => soma + segundosDe(e.id), 0);

// Mensagem rápida na parte de baixo da tela
let espera;
function aviso(texto) {
  $('toast').textContent = texto;
  $('toast').classList.add('show');
  clearTimeout(espera);
  espera = setTimeout(() => $('toast').classList.remove('show'), 2400);
}


// Timer: só soma o tempo enquanto estiver rodando, então as pausas não contam
function somarTempo() {
  if (T.st !== 'rodando') return;
  T.ms += Date.now() - T.ultimo;
  T.ultimo = Date.now();
}

setInterval(() => {
  if (T.st === 'rodando') {
    somarTempo();
    salvar();
    atualizar();
  }
}, 1000);

// Botão play: inicia, pausa ou retoma
function alternarTimer() {
  if (T.st === 'rodando') {
    somarTempo();
    T.st = 'pausado';
    aviso('Pausado. O tempo parado não conta.');
  } else if (T.st === 'pausado') {
    T.ultimo = Date.now();
    T.st = 'rodando';
  } else {
    // usa o estudo selecionado ou o primeiro pendente
    const e = achar(D.ativo) || D.estudos.find(x => !x.concluido);
    if (!e || e.concluido) return aviso('Escolha um estudo pendente para começar.');
    D.ativo = e.id;
    D.timer = T = {st: 'rodando', id: e.id, ms: 0, ultimo: Date.now()};
  }
  tudo();
}

// Botão quadrado: encerra a sessão e grava no histórico
function finalizar(silencioso) {
  if (T.st === 'parado') return;
  somarTempo();
  const seg = Math.floor(T.ms / 1000);
  const e = achar(T.id);

  if (seg >= 1 && e) {
    D.sessoes.push({id: e.id, nome: e.titulo, cor: e.cor, dia: hoje(), fim: Date.now(), seg});
  }
  if (!silencioso) {
    aviso(seg >= 1 ? 'Sessão salva: ' + formatar(seg) : 'Sessão muito curta, não foi salva.');
  }
  resetarTimer();
  tudo();
}


// Desenho da tela

// Barra arredondada: a parte colorida é a porcentagem
const pilula = (e, classe, tag) => `
  <${tag} class="pill${classe}" style="${cores(e.cor)};--w:${percentual(e)}%">
    <i class="dot"></i>
    <span>${esc(e.titulo)}</span>
    <em>${percentual(e)}%</em>
  </${tag}>`;

function desenharCards() {
  $('subs').innerHTML = D.estudos.map(e => {
    const btn = (acao, classe, rotulo, conteudo) =>
      `<button class="${classe}" data-a="${acao}" data-i="${e.id}" aria-label="${rotulo}">${conteudo}</button>`;

    const tarefas = e.tarefas.map(t => `
      <li>
        <button class="task${t.feita ? ' on' : ''}" data-a="task" data-i="${e.id}" data-j="${t.id}"><i class="box"></i>${esc(t.texto)}</button>
      </li>`).join('') || '<li class="none">Nenhuma tarefa ainda</li>';

    const classes = 'sub'
      + (e.aberto ? ' open' : '')
      + (e.concluido ? ' done' : '')
      + (e.id === D.ativo ? ' active' : '');

    return `
      <li class="${classes}" style="${cores(e.cor)}">
        <header>
          ${btn('done', 'chk', 'Concluir', ICONES.check)}
          ${btn('pick', 'nm', 'Estudar ' + esc(e.titulo), esc(e.titulo))}
          ${btn('del', 'ico', 'Excluir', ICONES.lixeira)}
          ${btn('open', 'ico chev', 'Mostrar tarefas', ICONES.seta)}
        </header>
        <ul>${tarefas}</ul>
        <form data-i="${e.id}">
          <input placeholder="Adicionar tarefa" aria-label="Nova tarefa" maxlength="40">
          <button aria-label="Adicionar tarefa">+</button>
        </form>
      </li>`;
  }).join('') || '<li class="empty">Nenhum estudo cadastrado. Digite um título e toque em +.</li>';
}

// Estudando agora, concluído e histórico
function desenharListas() {
  const fazendo = D.estudos.filter(e => !e.concluido);
  const feitos = D.estudos.filter(e => e.concluido);

  $('doing').innerHTML = fazendo.map(e => pilula(e, '', 'li')).join('')
    || '<li class="empty">Nada em andamento</li>';

  $('done').innerHTML = feitos.map(e => pilula(e, ' dn', 'li')).join('')
    || '<li class="empty">Marque um estudo como concluído</li>';

  $('hist').innerHTML = D.sessoes.slice(-6).reverse().map(s => {
    const data = new Date(s.fim).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    return `
      <li class="hi" style="${cores(s.cor)}">
        <i class="dot"></i>
        <b>${esc(s.nome)}</b>
        <span>${data}</span>
        <time>${formatar(s.seg)}</time>
      </li>`;
  }).join('') || '<li class="empty">As sessões finalizadas aparecem aqui.</li>';
}

// Caixinhas de cor: tema do app e cor do próximo estudo
function desenharCores() {
  for (const qual of ['app', 'new']) {
    const escolhida = qual === 'app' ? D.tema : D.corNova;

    $('pop-' + qual).innerHTML = TEMAS.map((t, i) => `
      <li>
        <button class="sw" style="background:${t.medio}" aria-label="${t.nome}"
          aria-pressed="${i === escolhida}" data-th="${i}" data-for="${qual}"></button>
      </li>`).join('');
  }

  // o botão "cor" mostra a cor escolhida
  const botao = $('pop-new').previousElementSibling;
  botao.style.background = TEMAS[D.corNova].medio;
  botao.style.color = TEMAS[D.corNova].texto;
}

// Troca os tons --t da página inteira
function aplicarTema() {
  const t = TEMAS[D.tema];
  const css = document.documentElement.style;

  css.setProperty('--t50', t.fundo);
  css.setProperty('--t100', t.claro);
  css.setProperty('--t300', t.medio);
  css.setProperty('--t500', t.forte);
  css.setProperty('--t800', t.texto);
}


// Gráfico: cada estudo ganha uma fatia preenchida com um zigue-zague, como um rabisco de lápis

// Número "aleatório" que é sempre igual para o mesmo n
const sorteio = n => {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
};

// Ponto do círculo (raio e ângulo) no formato "x y" do SVG
const ponto = (raio, ang) => {
  const x = (100 + raio * Math.cos(ang)).toFixed(1);
  const y = (100 + raio * Math.sin(ang)).toFixed(1);
  return `${x} ${y}`;
};

function desenharGrafico() {
  const total = totalHoje();
  const dentro = 50;
  const fora = 90;
  let inicio = -Math.PI / 2;

  // efeito de lápis (filtro) e o anel cinza do fundo
  let svg = `
    <defs>
      <filter id="lapis">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" result="r"/>
        <feDisplacementMap in="SourceGraphic" in2="r" scale="2.4"/>
      </filter>
    </defs>
    <circle cx="100" cy="100" r="70" fill="none" stroke="var(--base)" stroke-width="40"/>`;

  D.estudos.forEach((e, i) => {
    const seg = segundosDe(e.id);
    if (seg <= 0) return;

    const fim = inicio + seg / total * 2 * Math.PI;
    const passos = Math.max(6, Math.round(70 * (fim - inicio) / 3.4));
    let linha = '';

    // vai e volta entre a borda de dentro e a de fora, tremendo um pouco
    for (let k = 0; k <= passos; k++) {
      const angulo = inicio + (fim - inicio) * k / passos + (sorteio(i * 5000 + k) - .5) * .035;
      const raio = (k % 2 ? fora - 3 : dentro + 3) + (sorteio(i * 5000 + k + .5) - .5) * 6;
      linha += (k ? 'L' : 'M') + ponto(raio, angulo);
    }

    svg += `
      <g filter="url(#lapis)" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="${linha}" stroke="${TEMAS[e.cor].medio}" stroke-width="7" opacity=".7"/>
        <path d="${linha}" stroke="${TEMAS[e.cor].forte}" stroke-width="2.6"/>
      </g>
      <path d="M${ponto(dentro, inicio)}L${ponto(fora, inicio)}" fill="none" stroke="#555" stroke-width=".8"/>`;

    inicio = fim;
  });

  $('donut').innerHTML = `
    <svg viewBox="0 0 200 200" role="img" aria-label="Tempo por matéria hoje">${svg}</svg>
    <figcaption><b>${formatar(total)}</b>total hoje</figcaption>`;
}

// Relógio, anel, métricas, relatório e gráfico (roda a cada segundo)
function atualizar() {
  const n = D.estudos.length;
  const e = achar(T.st === 'parado' ? D.ativo : T.id) || D.estudos.find(x => !x.concluido);

  // porcentagem = média das tarefas concluídas de todos os estudos
  const media = n
    ? Math.round(D.estudos.reduce((soma, x) => soma + percentual(x), 0) / n)
    : 0;

  // anel = tempo estudado hoje / meta do dia
  const anel = D.meta ? Math.round(totalHoje() / D.meta * 100) : 0;

  $('clock').textContent = formatar(T.ms / 1000);
  $('cur').textContent = e ? e.titulo : '';
  $('timer').style.setProperty('--p', Math.min(100, anel));
  $('pct').textContent = media + '%';
  $('cnt').textContent = n;

  $('rows').innerHTML = D.estudos.map(x => `
    <li class="row">
      ${pilula(x, x.concluido ? ' dn' : '', 'p')}
      <time>${formatar(segundosDe(x.id))}</time>
    </li>`).join('') || '<li class="empty">Sem estudos ainda</li>';

  desenharGrafico();
}

// Salva e redesenha a página inteira (usado depois de qualquer ação)
function tudo() {
  salvar();
  aplicarTema();
  desenharCards();
  desenharListas();
  desenharCores();
  atualizar();

  $('play').innerHTML = T.st === 'rodando' ? ICONES.pause : ICONES.play;
  $('play').setAttribute('aria-label', T.st === 'rodando' ? 'Pausar' : T.st === 'pausado' ? 'Retomar' : 'Iniciar');
  $('stop').disabled = T.st === 'parado';
  $('goal').value = formatar(D.meta);
}


// Ações do usuário

// Cadastrar estudo: precisa de título e nasce pendente
$('add').onsubmit = ev => {
  ev.preventDefault();
  const campo = $('newname');
  const titulo = campo.value.trim();

  if (!titulo) {
    // faz o campo tremer
    campo.classList.remove('bad');
    void campo.offsetWidth;
    campo.classList.add('bad');
    return aviso('Todo estudo precisa de um título.');
  }

  D.estudos.push(estudo(titulo, D.corNova));
  D.corNova = (D.corNova + 1) % TEMAS.length;
  campo.value = '';
  tudo();
  aviso('Estudo adicionado.');
};

$('newname').oninput = ev => ev.target.classList.remove('bad');

// Botões dos cards: abrir, tarefa, concluir, escolher e excluir
$('subs').addEventListener('click', ev => {
  const botao = ev.target.closest('button[data-a]');
  const e = botao && achar(botao.dataset.i);
  if (!e) return;

  const acao = botao.dataset.a;

  if (acao === 'open') {
    e.aberto = !e.aberto;

  } else if (acao === 'task') {
    const t = e.tarefas.find(x => x.id === botao.dataset.j);
    t.feita = !t.feita;

  } else if (acao === 'done') {
    e.concluido = !e.concluido;
    if (e.concluido && T.id === e.id) finalizar(true);

  } else if (acao === 'pick') {
    if (T.st !== 'parado' && T.id !== e.id) {
      return aviso('Finalize a sessão atual antes de trocar de matéria.');
    }
    if (e.concluido) return aviso('Esse estudo já está concluído.');
    D.ativo = e.id;

  } else if (acao === 'del') {
    if (T.id === e.id) resetarTimer();
    D.estudos = D.estudos.filter(x => x !== e);
    if (D.ativo === e.id) D.ativo = null;
    aviso('Estudo excluído.');
  }

  tudo();
});

// Adicionar tarefa dentro do card
$('subs').addEventListener('submit', ev => {
  ev.preventDefault();
  const e = achar(ev.target.dataset.i);
  const texto = ev.target.elements[0].value.trim();
  if (!e || !texto) return;

  e.tarefas.push({id: novoId(), texto, feita: false});
  e.aberto = true;
  tudo();
});

$('play').onclick = alternarTimer;
$('stop').onclick = () => finalizar(false);

$('clr').onclick = () => {
  D.sessoes = [];
  tudo();
  aviso('Histórico limpo.');
};

// Meta do dia: aceita "2:00", "1:30:00" ou só os minutos
$('goal').onchange = ev => {
  const [a, b = 0, c = 0] = ev.target.value.trim().split(':').map(Number);
  const seg = ev.target.value.includes(':') ? a * 3600 + b * 60 + c : a * 60;

  if (seg > 0) {
    D.meta = seg;
    aviso('Meta atualizada.');
  } else {
    aviso('Use o formato h:mm, por exemplo 2:00.');
  }
  tudo();
};

$('goal').onkeydown = ev => {
  if (ev.key === 'Enter') ev.target.blur();
};

// Escolher cor e fechar as caixinhas de cor
document.addEventListener('click', ev => {
  const cor = ev.target.closest('.sw');

  if (cor) {
    if (cor.dataset.for === 'app') D.tema = +cor.dataset.th;
    else D.corNova = +cor.dataset.th;
    tudo();
  }

  document.querySelectorAll('details.pop').forEach(d => {
    if (cor || !d.contains(ev.target)) d.open = false;
  });
});


// Rodapé e início
$('gh').href = 'https://github.com/' + GITHUB;
$('gh').textContent = 'sistema desenvolvido por @' + GITHUB;
tudo();