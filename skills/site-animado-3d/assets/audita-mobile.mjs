import { chromium, devices } from 'playwright';
const URL = process.env.ALVO || 'http://localhost:4174/';
const browser = await chromium.launch();
const achados = [];

for (const nome of ['iPhone SE', 'iPhone 13', 'Pixel 5']) {
  const ctx = await browser.newContext({ ...devices[nome] });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  const b = page.locator('.rp-intro-pular');
  try { await b.waitFor({ state: 'visible', timeout: 2500 }); await b.click(); } catch {}
  await page.waitForTimeout(900);

  const vp = page.viewportSize();
  const r = await page.evaluate(() => {
    const out = { pequenos: [], estouram: [], sobrepoe: [], fonteMin: 99 };

    // Alvos de toque abaixo de 44px
    document.querySelectorAll('a, button, input, select, label.rp-opcao, [tabindex="0"]').forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return;
      if (b.height < 44 || b.width < 44) {
        out.pequenos.push({
          o: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 28),
          w: Math.round(b.width), h: Math.round(b.height),
        });
      }
    });

    // Texto que transborda o container
    document.querySelectorAll('h1,h2,h3,p,span,a,li').forEach((el) => {
      if (el.children.length) return;
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        out.estouram.push((el.textContent || '').trim().slice(0, 34));
      }
    });

    // Corpo de texto pequeno demais para ler no celular
    document.querySelectorAll('p, li, td').forEach((el) => {
      if (el.children.length) return;
      const t = (el.textContent || '').trim();
      if (t.length < 25) return;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < out.fonteMin) out.fonteMin = fs;
    });

    return out;
  });

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);

  // Altura do hero: precisa caber sem obrigar a rolar pra ver o CTA
  const ctaVisivel = await page.evaluate(() => {
    const cta = document.querySelector('section a[href="#contato"]');
    if (!cta) return null;
    const b = cta.getBoundingClientRect();
    return b.top < window.innerHeight;
  });

  achados.push({ nome, vp: `${vp.width}x${vp.height}`, overflow, ctaVisivel, ...r });
  await ctx.close();
}

for (const a of achados) {
  console.log(`\n=== ${a.nome} (${a.vp}) ===`);
  console.log(`  rolagem horizontal: ${a.overflow <= 1 ? 'nenhuma' : a.overflow + 'px'}`);
  console.log(`  CTA do hero visível sem rolar: ${a.ctaVisivel === null ? '?' : a.ctaVisivel ? 'sim' : 'NAO'}`);
  console.log(`  menor fonte de corpo: ${a.fonteMin.toFixed(1)}px`);
  if (a.pequenos.length) {
    console.log(`  alvos < 44px: ${a.pequenos.length}`);
    a.pequenos.slice(0, 6).forEach((p) => console.log(`     ${p.w}x${p.h}  "${p.o}"`));
  } else console.log('  alvos < 44px: nenhum');
  if (a.estouram.length) {
    console.log(`  texto transbordando: ${a.estouram.length}`);
    a.estouram.slice(0, 4).forEach((t) => console.log(`     "${t}"`));
  } else console.log('  texto transbordando: nenhum');
}
await browser.close();
