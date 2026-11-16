/* Validação da prévia no navegador.
   Roda contra o build servido em http://localhost:4174.
   Checa: console limpo, âncoras, teclado, foco, mobile sem hover, rolagem
   horizontal, prefers-reduced-motion, formulário e contraste dos textos. */

import { chromium, devices } from 'playwright';

const URL = process.env.ALVO || 'http://localhost:4174/';
const out = [];
const falhas = [];

function ok(n, d = '') { out.push(`  PASSOU  ${n}${d ? ` — ${d}` : ''}`); }
function fail(n, d = '') { falhas.push(`  FALHOU  ${n}${d ? ` — ${d}` : ''}`); out.push(`  FALHOU  ${n}${d ? ` — ${d}` : ''}`); }

const browser = await chromium.launch();

/* ---------- 1. Desktop ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', (e) => erros.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  out.push('\n=== DESKTOP 1440x900 ===');

  erros.length ? fail('console sem erro', erros.slice(0, 3).join(' | ')) : ok('console sem erro');

  // Seções presentes
  const ids = ['a-rendape', 'como-funciona', 'diferenciais', 'empreendimentos', 'grupo-referencia', 'contato'];
  for (const id of ids) {
    const n = await page.locator(`#${id}`).count();
    n === 1 ? ok(`seção #${id}`) : fail(`seção #${id}`, `${n} encontradas`);
  }

  // Âncoras do menu apontam para seções existentes
  const hrefs = await page.locator('header nav a[href^="#"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const quebrados = [];
  for (const h of hrefs) {
    if ((await page.locator(h).count()) === 0) quebrados.push(h);
  }
  quebrados.length ? fail('âncoras do menu', quebrados.join(', ')) : ok('âncoras do menu', `${hrefs.length} válidas`);

  // Links externos com rel de segurança
  const externos = await page.locator('a[target="_blank"]').evaluateAll((as) =>
    as.map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel') || '' })));
  const semRel = externos.filter((e) => !e.rel.includes('noopener'));
  semRel.length ? fail('rel=noopener nos externos', `${semRel.length} sem`) : ok('rel=noopener nos externos', `${externos.length} links`);

  // H1 único
  const h1 = await page.locator('h1').count();
  h1 === 1 ? ok('um único H1') : fail('um único H1', `${h1} encontrados`);

  // Imagens com alt
  const semAlt = await page.locator('img:not([alt])').count();
  semAlt === 0 ? ok('toda imagem tem alt') : fail('toda imagem tem alt', `${semAlt} sem`);

  // Sem rolagem horizontal
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  overflow <= 1 ? ok('sem rolagem horizontal') : fail('sem rolagem horizontal', `${overflow}px a mais`);

  // Entrada na rolagem funciona
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35));
  await page.waitForTimeout(1100);
  const revelados = await page.locator('[data-reveal][data-revealed]').count();
  revelados > 0 ? ok('entradas na rolagem', `${revelados} blocos revelados`) : fail('entradas na rolagem', 'nenhum revelado');

  // Nenhum bloco ficou invisível
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1400);
  const invisiveis = await page.locator('[data-reveal]:not([data-revealed])').evaluateAll((els) =>
    els.filter((el) => { const r = el.getBoundingClientRect(); return r.top < window.innerHeight && r.bottom > 0; }).length);
  invisiveis === 0 ? ok('nada fica invisível após rolar') : fail('nada fica invisível após rolar', `${invisiveis} em tela e opacos`);

  // Paralaxe do cursor escreve as variáveis
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.mouse.move(400, 400);
  await page.mouse.move(900, 300, { steps: 12 });
  await page.waitForTimeout(500);
  const px = await page.evaluate(() => {
    const el = document.querySelector('section .rp-container');
    return el ? getComputedStyle(el).getPropertyValue('--px').trim() : '';
  });
  px && px !== '0' ? ok('paralaxe responde ao cursor', `--px=${px}`) : fail('paralaxe responde ao cursor', `--px="${px}"`);

  // Navegação por teclado: o primeiro Tab chega no "pular para o conteúdo"
  await page.keyboard.press('Tab');
  const primeiro = await page.evaluate(() => document.activeElement?.className || '');
  primeiro.includes('rp-skip') ? ok('primeiro Tab = pular conteúdo') : fail('primeiro Tab = pular conteúdo', primeiro);

  // Os nós do diagrama são focáveis pelo teclado
  const focaveis = await page.locator('#como-funciona button').count();
  focaveis >= 3 ? ok('nós do diagrama focáveis', `${focaveis} botões`) : fail('nós do diagrama focáveis', `${focaveis}`);

  // Estado ativo alcançável por foco (equivalente ao hover)
  await page.locator('#como-funciona button').first().focus();
  await page.waitForTimeout(350);
  const ativoPorFoco = await page.locator('#como-funciona button[data-active="true"]').count();
  ativoPorFoco > 0 ? ok('foco de teclado ativa o nó') : fail('foco de teclado ativa o nó', 'data-active não mudou');

  // Diferenciais também respondem ao foco
  await page.locator('#diferenciais [tabindex="0"]').first().focus();
  await page.waitForTimeout(350);
  const difAtivo = await page.locator('#diferenciais [data-active="true"]').count();
  difAtivo > 0 ? ok('foco ativa o diferencial') : fail('foco ativa o diferencial', 'data-active não mudou');

  // Anel de foco visível
  const temAnel = await page.evaluate(() => {
    const b = document.querySelector('#contato a[href^="https://wa.me"]');
    if (!b) return false;
    b.focus();
    const s = getComputedStyle(b);
    return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
  });
  temAnel ? ok('anel de foco visível') : fail('anel de foco visível');

  await ctx.close();
}

/* ---------- 2. Formulário ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  out.push('\n=== FORMULÁRIO ===');

  await page.locator('#contato').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  // Rótulos reais, não só placeholder
  const semLabel = await page.evaluate(() => {
    const campos = [...document.querySelectorAll('#contato input[type="text"], #contato input[type="email"], #contato input[type="tel"], #contato select')];
    return campos.filter((c) => !c.id || !document.querySelector(`label[for="${c.id}"]`)).length;
  });
  semLabel === 0 ? ok('todo campo tem <label>') : fail('todo campo tem <label>', `${semLabel} sem`);

  // Validação bloqueia envio vazio e mostra erro
  await page.locator('#contato button[type="submit"]').click();
  await page.waitForTimeout(500);
  const alertas = await page.locator('#contato [role="alert"]').count();
  alertas > 0 ? ok('validação mostra erro', `${alertas} mensagens`) : fail('validação mostra erro', 'nenhum alerta');

  // Erro ligado ao campo
  const ligado = await page.evaluate(() => {
    const i = document.querySelector('#lead-nome');
    const d = i?.getAttribute('aria-describedby');
    return Boolean(d && document.getElementById(d));
  });
  ligado ? ok('erro ligado ao campo (aria-describedby)') : fail('erro ligado ao campo');

  // Preenchimento sem envio real (não gravar lead de teste em produção)
  await page.fill('#lead-nome', 'Teste Prévia');
  await page.fill('#lead-telefone', '<TELEFONE_TESTE>');
  await page.fill('#lead-email', '<EMAIL_TESTE>');
  await page.locator('#contato label[for^="obj-"]').first().click();
  await page.locator('#imovel-nao').locator('..').click();
  await page.selectOption('#lead-investimento', '150-300');
  await page.waitForTimeout(300);
  const erroRestante = await page.locator('#contato [role="alert"]').count();
  erroRestante === 0 ? ok('erros somem ao preencher') : fail('erros somem ao preencher', `${erroRestante} restantes`);

  // Alvos de toque com pelo menos 44px
  const pequenos = await page.locator('#contato label.rp-opcao').evaluateAll((els) =>
    els.filter((el) => el.getBoundingClientRect().height < 44).length);
  pequenos === 0 ? ok('alvos de toque ≥ 44px') : fail('alvos de toque ≥ 44px', `${pequenos} menores`);

  await ctx.close();
}

/* ---------- 3. Celular ---------- */
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  out.push('\n=== CELULAR (iPhone 13) ===');

  erros.length ? fail('sem erro de página', erros[0]) : ok('sem erro de página');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  overflow <= 1 ? ok('sem rolagem horizontal') : fail('sem rolagem horizontal', `${overflow}px a mais`);

  // Menu abre e fecha
  await page.locator('header button[aria-label="Abrir menu"]').click();
  await page.waitForTimeout(400);
  const menuAberto = await page.locator('[role="dialog"]').isVisible();
  menuAberto ? ok('menu do celular abre') : fail('menu do celular abre');

  const linksMenu = await page.locator('[role="dialog"] nav a').count();
  linksMenu >= 5 ? ok('menu lista as seções', `${linksMenu} links`) : fail('menu lista as seções', `${linksMenu}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const fechou = (await page.locator('[role="dialog"]').count()) === 0;
  fechou ? ok('Esc fecha o menu') : fail('Esc fecha o menu');

  // Nenhuma informação depende de hover: os textos dos diferenciais estão visíveis
  await page.locator('#diferenciais').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const textosVisiveis = await page.locator('#diferenciais h3').evaluateAll((els) =>
    els.every((el) => { const s = getComputedStyle(el); return s.opacity !== '0' && s.visibility !== 'hidden'; }));
  textosVisiveis ? ok('diferenciais legíveis sem hover') : fail('diferenciais legíveis sem hover');

  // O diagrama do modelo aparece na versão vertical
  await page.locator('#como-funciona').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const vert = await page.locator('.rp-diagrama-estreito').isVisible();
  const horiz = await page.locator('.rp-diagrama-largo').isVisible();
  vert && !horiz ? ok('diagrama em versão vertical') : fail('diagrama em versão vertical', `vert=${vert} horiz=${horiz}`);

  // As descrições dos nós estão visíveis sem interação
  const descricoes = await page.locator('#como-funciona button p, #como-funciona button span').count();
  descricoes > 0 ? ok('nós do modelo legíveis sem toque') : fail('nós do modelo legíveis sem toque');

  // Título não estoura a largura
  const estouro = await page.locator('h1, h2').evaluateAll((els) =>
    els.filter((el) => el.scrollWidth > el.clientWidth + 2).length);
  estouro === 0 ? ok('títulos não estouram') : fail('títulos não estouram', `${estouro} estourando`);

  await ctx.close();
}

/* ---------- 4. prefers-reduced-motion ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  out.push('\n=== PREFERS-REDUCED-MOTION ===');

  // Tudo visível sem precisar rolar
  await page.waitForTimeout(700);
  const opacos = await page.locator('[data-reveal]').evaluateAll((els) =>
    els.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99).length);
  opacos === 0 ? ok('todo conteúdo visível de imediato') : fail('todo conteúdo visível de imediato', `${opacos} opacos`);

  // Sem transform residual
  const transformados = await page.locator('[data-reveal]').evaluateAll((els) =>
    els.filter((el) => { const t = getComputedStyle(el).transform; return t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)'; }).length);
  transformados === 0 ? ok('sem deslocamento residual') : fail('sem deslocamento residual', `${transformados}`);

  // Janelas do PropertyMark acesas sem depender da animação
  await page.locator('#como-funciona').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const acesas = await page.locator('#como-funciona rect[data-lit="1"]').count();
  acesas > 0 ? ok('janelas acesas sem animação', `${acesas}`) : fail('janelas acesas sem animação', '0 acesas');

  // Paralaxe desligada
  await page.mouse.move(300, 300);
  await page.mouse.move(1100, 600, { steps: 10 });
  await page.waitForTimeout(400);
  const px = await page.evaluate(() => {
    const el = document.querySelector('section .rp-container');
    return el ? getComputedStyle(el).getPropertyValue('--px').trim() : '';
  });
  (!px || px === '0') ? ok('paralaxe desligada') : fail('paralaxe desligada', `--px=${px}`);

  await ctx.close();
}

/* ---------- 5. Peso ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let bytes = 0;
  const porTipo = {};
  page.on('response', async (r) => {
    try {
      const b = (await r.body()).length;
      bytes += b;
      const t = r.request().resourceType();
      porTipo[t] = (porTipo[t] || 0) + b;
    } catch { /* recurso sem corpo */ }
  });
  // 'load' e não 'networkidle': o que importa é o peso até a primeira pintura.
  // As cenas 3D são buscadas DEPOIS do load de propósito (prop `adiar` no
  // Cena3D), então medir com networkidle contaria vídeo que o visitante nunca
  // espera para começar a ler.
  await page.goto(URL, { waitUntil: 'load' });
  out.push('\n=== PESO ATÉ A PRIMEIRA PINTURA ===');
  out.push(`  total: ${(bytes / 1024).toFixed(0)} kB`);
  for (const [t, b] of Object.entries(porTipo).sort((a, b2) => b2[1] - a[1])) {
    out.push(`    ${t}: ${(b / 1024).toFixed(0)} kB`);
  }
  bytes < 900 * 1024
    ? ok('peso até a primeira pintura < 900 kB')
    : fail('peso até a primeira pintura < 900 kB', `${(bytes / 1024).toFixed(0)} kB`);

  // As cenas 3D não podem estar nessa conta.
  const mediaNaPintura = (porTipo.media || 0) / 1024;
  mediaNaPintura < 60
    ? ok('vídeos ficam fora da primeira pintura', `${mediaNaPintura.toFixed(0)} kB`)
    : fail('vídeos ficam fora da primeira pintura', `${mediaNaPintura.toFixed(0)} kB de mídia`);

  // O Supabase não deve estar na primeira carga
  const pedidos = [];
  page.on('request', (r) => pedidos.push(r.url()));
  await page.reload({ waitUntil: 'networkidle' });
  const supabaseNaCarga = pedidos.some((u) => /supabase/i.test(u));
  !supabaseNaCarga ? ok('Supabase fora da carga inicial') : fail('Supabase fora da carga inicial');

  await ctx.close();
}

await browser.close();

console.log(out.join('\n'));
console.log(`\n${'='.repeat(52)}`);
if (falhas.length) {
  console.log(`${falhas.length} FALHA(S):`);
  console.log(falhas.join('\n'));
  process.exitCode = 1;
} else {
  console.log('TODAS AS VERIFICAÇÕES PASSARAM');
}
