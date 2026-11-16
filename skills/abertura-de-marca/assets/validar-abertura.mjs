/* Validação da abertura de marca.
   Roda contra o site servido localmente ou contra a URL publicada:

     node validar-abertura.mjs
     ALVO="https://exemplo.com/" node validar-abertura.mjs

   Checa o que costuma quebrar: a abertura não sumir, a rolagem não voltar, o
   botão de pular não ser o primeiro Tab, o Esc não funcionar, movimento
   reduzido ver a animação, e o movimento sair na diagonal. */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.ALVO || 'http://localhost:4174/';
mkdirSync('capturas/intro', { recursive: true });

const out = [];
const falhas = [];
const ok = (n, d = '') => out.push(`  PASSOU  ${n}${d ? ` — ${d}` : ''}`);
const fail = (n, d = '') => { const l = `  FALHOU  ${n}${d ? ` — ${d}` : ''}`; out.push(l); falhas.push(l); };

/** Pula a abertura se ela estiver no ar; segue em frente se já passou. */
async function pularSePreciso(page) {
  const b = page.locator('.rp-intro-pular');
  try {
    await b.waitFor({ state: 'visible', timeout: 2500 });
    await b.click();
  } catch { /* abertura já não estava presente */ }
}

const browser = await chromium.launch();

/* ---------- Quadros da abertura ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  out.push('\n=== ABERTURA DA MARCA ===');

  const existe = await page.locator('.rp-intro').count();
  existe === 1 ? ok('abertura monta na primeira visita') : fail('abertura monta na primeira visita', `${existe}`);

  // Um quadro por momento-chave da coreografia
  for (const [ms, nome] of [[350, 'a-simbolo'], [900, 'b-assentado'], [1600, 'c-nome'], [2300, 'd-separando'], [3100, 'e-saindo'], [3900, 'f-cortina']]) {
    await page.waitForTimeout(ms - (Number(nome.match(/^\w/)) || 0));
    await page.screenshot({ path: `capturas/intro/${nome}.png` });
  }

  // A cortina some e o conteúdo aparece
  await page.waitForTimeout(1200);
  const sumiu = (await page.locator('.rp-intro').count()) === 0;
  sumiu ? ok('abertura se remove ao terminar') : fail('abertura se remove ao terminar');

  const rolaDeNovo = await page.evaluate(() => document.documentElement.classList.contains('rp-intro-ativa'));
  !rolaDeNovo ? ok('rolagem devolvida') : fail('rolagem devolvida', 'classe rp-intro-ativa ficou');

  const h1 = await page.locator('h1').isVisible();
  h1 ? ok('hero visível depois da abertura') : fail('hero visível depois da abertura');

  erros.length ? fail('sem erro de página', erros[0]) : ok('sem erro de página');
  await ctx.close();
}

/* ---------- Reaparece a cada recarga ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const contagens = [];
  for (let i = 0; i < 3; i++) {
    if (i === 0) await page.goto(URL, { waitUntil: 'domcontentloaded' });
    else await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    contagens.push(await page.locator('.rp-intro').count());
  }
  out.push('\n=== REAPARECE A CADA F5 ===');
  contagens.every((c) => c === 1)
    ? ok('roda em todo carregamento', `${contagens.length} de ${contagens.length}`)
    : fail('roda em todo carregamento', contagens.join('/'));
  await ctx.close();
}

/* ---------- Ritmo ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.rp-intro').waitFor({ state: 'detached', timeout: 14000 });
  const dur = Date.now() - t0;
  out.push('\n=== RITMO ===');
  dur > 5200 && dur < 9000
    ? ok('duracao da abertura', `${(dur / 1000).toFixed(1)}s`)
    : fail('duracao da abertura', `${(dur / 1000).toFixed(1)}s fora de 5,2-9s`);
  await ctx.close();
}

/* ---------- Pular ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  out.push('\n=== PULAR ===');

  // O botão é o primeiro Tab
  await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => document.activeElement?.className || '');
  foco.includes('rp-intro-pular') ? ok('botão de pular é o primeiro Tab') : fail('botão de pular é o primeiro Tab', foco);

  await page.locator('.rp-intro-pular').click();
  await page.waitForTimeout(300);
  const sumiu = (await page.locator('.rp-intro').count()) === 0;
  sumiu ? ok('clique pula a abertura') : fail('clique pula a abertura');

  const rola = await page.evaluate(() => !document.documentElement.classList.contains('rp-intro-ativa'));
  rola ? ok('rolagem liberada ao pular') : fail('rolagem liberada ao pular');
  await ctx.close();
}

/* ---------- Esc pula ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.rp-intro-pular').waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  out.push('\n=== TECLADO ===');
  (await page.locator('.rp-intro').count()) === 0 ? ok('Esc pula') : fail('Esc pula');
  await ctx.close();
}

/* ---------- prefers-reduced-motion ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  out.push('\n=== MOVIMENTO REDUZIDO ===');
  (await page.locator('.rp-intro').count()) === 0 ? ok('abertura não roda') : fail('abertura não roda');
  (await page.locator('h1').isVisible()) ? ok('hero direto') : fail('hero direto');
  await ctx.close();
}


/* ---------- Eixo: horizontal, nunca diagonal ----------
   Se o símbolo estiver empilhado ACIMA do nome, cada parte sai do topo em
   direção ao canto e o movimento vira diagonal. Este teste congela a animação
   no meio do percurso e exige que o deslocamento lateral domine o vertical. */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.locator('.rp-intro').waitFor({ state: 'attached', timeout: 6000 }).catch(() => {});

  // Congela no meio do percurso com animation-delay negativo.
  await page.evaluate(() => {
    document.querySelectorAll('.rp-intro-gancho, .rp-intro-nome, .rp-intro').forEach((el) => {
      el.style.animationPlayState = 'paused';
      el.style.animationDelay = '-3250ms';
    });
  });
  await page.waitForTimeout(220);

  const m = await page.evaluate(() => {
    const c = (sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    };
    return { a: c('.rp-intro-gancho-a'), b: c('.rp-intro-gancho-b'), nome: c('.rp-intro-nome') };
  });

  out.push('\n=== EIXO DO MOVIMENTO ===');
  if (!m.a || !m.b || !m.nome) {
    fail('mediu as posicoes', 'seletor nao encontrado');
  } else {
    const razao = (p) => Math.abs(p.x - m.nome.x) / Math.max(Math.abs(p.y - m.nome.y), 1);
    const opostos = Math.sign(m.a.x - m.nome.x) !== Math.sign(m.b.x - m.nome.x);
    const ra = razao(m.a), rb = razao(m.b);
    ra > 8 && rb > 8 && opostos
      ? ok('abertura horizontal', `${ra.toFixed(0)}x / ${rb.toFixed(0)}x`)
      : fail('abertura horizontal', `razao ${ra.toFixed(1)}x/${rb.toFixed(1)}x, opostos=${opostos}`);
  }
  await ctx.close();
}

await browser.close();
console.log(out.join('\n'));
console.log(`\n${'='.repeat(52)}`);
if (falhas.length) { console.log(`${falhas.length} FALHA(S):`); console.log(falhas.join('\n')); process.exitCode = 1; }
else console.log('TODAS AS VERIFICAÇÕES PASSARAM');
