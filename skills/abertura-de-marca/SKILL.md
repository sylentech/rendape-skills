---
name: abertura-de-marca
description: "Abertura animada de logo para a primeira visita de um site: a marca se monta no centro, fica legível, e se abre revelando o nome enquanto uma cortina sobe deixando o gesto da identidade no rastro. CSS puro, zero JS de animação, ~2 kB. Use quando o usuário pedir intro animada, logo abrindo, splash de marca, animação de entrada do site, ou 'igual ao site X que abre com a logo'. Funciona com qualquer marca cujo símbolo tenha duas ou mais partes separáveis; traz variantes para marcas de peça única."
---

# Abertura de marca

Uma intro que **desmonta a própria logo** em vez de aplicar um efeito genérico
por cima dela. Feita para a Rendapê em setembro de 2026 e generalizada aqui.

O que ela faz, em ordem:

1. as partes do símbolo se montam no centro, subindo de baixo;
2. ficam **~0,8s parados e legíveis** como a marca completa;
3. partem para os lados girando em 3D, revelando o nome por baixo;
4. o nome se abre do meio para as beiradas (`clip-path`);
5. a assinatura entra por baixo;
6. a cortina sobe, deixando um arco desenhado no ar.

Custo: **zero JS de animação**. Tudo é `@keyframes`. O componente React só
decide quando montar e desmontar.

## Quando usar

- "faz uma intro animada", "a logo abrindo", "splash de marca"
- "igual ao site X que abre com a logo"
- Qualquer site institucional onde a marca precisa de um momento próprio

## Quando NÃO usar

- Aplicação que o usuário abre dezenas de vezes por dia (painel, CRM, ferramenta
  interna). Intro é para visita, não para uso diário.
- Página de checkout, formulário ou qualquer fluxo onde o visitante chegou com
  pressa e objetivo.
- Landing de campanha paga: cada segundo antes do conteúdo custa conversão.

## Passo 1 — Achar as partes separáveis

Abra o SVG do símbolo e conte os `<path>`. **Duas ou mais partes = a marca se
abre.** É o caso mais bonito, porque a separação é a construção da marca se
desfazendo, não um efeito aplicado.

```bash
grep -o '<path' logo-simbolo.svg | wc -l
```

Se der 1, vá para a seção "Marcas de peça única" no fim.

**Regra que não pode ser quebrada:** as partes precisam compartilhar o **mesmo
`viewBox`** e a **mesma caixa**, sobrepostas em camadas. Só assim, juntas, elas
formam a marca pixel por pixel.

Errado (cada parte vira uma caixa, e o conjunto nunca forma a marca):
```jsx
<div style={{ display: 'flex' }}>
  <svg viewBox="0 0 210 238"><path d={A} /></svg>
  <svg viewBox="0 0 210 238"><path d={B} /></svg>
</div>
```

Certo:
```jsx
<div style={{ position: 'relative', width: 148, aspectRatio: '210/238' }}>
  <svg style={{ position: 'absolute', inset: 0 }} viewBox="0 0 210 238"><path d={A} /></svg>
  <svg style={{ position: 'absolute', inset: 0 }} viewBox="0 0 210 238"><path d={B} /></svg>
</div>
```

## Passo 2 — Copiar os arquivos

`assets/BrandIntro.tsx` e `assets/abertura.css` são o ponto de partida. Troque:

| No arquivo | Por |
|---|---|
| `HOOK_A` / `HOOK_B` | os `d=""` dos paths do símbolo do cliente |
| `viewBox="20 602 210 238"` | o viewBox real do SVG |
| `"Rendapê"` | o nome da marca |
| `"uma empresa do Grupo Referência"` | a assinatura, ou remova o elemento |
| `--preto-950`, `--roxo`, `--purple-300` | as cores da marca |
| `--font-display`, `--font-body` | a tipografia da marca |

## Passo 3 — As quatro decisões

### Ritmo
Padrão: **6,2s de total**, com as partes em 4,7s e o nome em 5,5s. Abaixo de
5s a marca pisca e o olho não a reconhece; acima de 8s vira espera.

A janela de permanência é o que mais importa: as partes precisam ficar
**montadas e paradas por ~0,8s**. No keyframe isso é a distância entre as duas
paradas (`20%, 46%`). Encurtar isso é o erro mais comum.

### Frequência
- **A cada carregamento** — o cliente quer impacto, aceita que quem recarrega
  veja de novo. Exige botão de pular óbvio.
- **Uma vez por sessão** (`sessionStorage`) — mais educado. Quem volta não espera.

Pergunte. Não decida sozinho.

### Pular
O botão é **obrigatório**, sempre visível, e precisa ser o **primeiro elemento
do Tab**. Ponha-o primeiro no DOM.

### Movimento reduzido
`prefers-reduced-motion: reduce` **não vê a abertura** — o componente nem monta.
Não basta acelerar: a pessoa pediu para não haver movimento.

## A armadilha que custa uma sessão de depuração

**"Qualquer tecla pula" quebra o teclado.**

Parece conveniente:
```js
window.addEventListener('keydown', () => finalizar());  // ERRADO
```

Mas o **Tab também é tecla**. Quem navega por teclado aperta Tab para *alcançar*
o botão de pular e, ao fazer isso, dispensa a abertura antes de o botão receber
foco. O botão vira inalcançável.

```js
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') finalizar();   // CERTO
});
```

## Outras armadilhas

**Empilhar o símbolo acima do nome faz a abertura sair na diagonal.** Se o
símbolo estiver numa linha e o nome em outra, cada parte sai do topo em direção
ao canto. Para o movimento ser horizontal, tudo ocupa o **mesmo centro**
(`display: grid` + `grid-area: 1/1` em todos), com as partes por cima do nome
(`z-index` maior). Elas correm pelos lados e revelam o nome por baixo.

**`preserve-3d` + `backface-visibility` deixa artefato no Chromium.** A face de
trás vaza e elementos da mesma camada aparecem repetidos. Se acontecer, gire
cada face separadamente e troque por opacidade no meio do percurso.

**A máscara da palavra corta acentos.** `overflow: hidden` numa palavra corta o
`ê`, o `ç` e descendentes. Compense:
```css
.palavra { padding-bottom: .12em; margin-bottom: -.12em; }
```

## Como verificar

`assets/validar-abertura.mjs` roda com Playwright e checa o que costuma quebrar:

```bash
node validar-abertura.mjs            # local
ALVO="https://..." node validar-abertura.mjs   # publicado
```

Ele reprova se: a abertura não some, a rolagem não é devolvida, o botão de pular
não é o primeiro Tab, o Esc não funciona, movimento reduzido vê a animação, ou o
movimento sai na diagonal (mede o deslocamento horizontal contra o vertical e
exige razão maior que 8).

## Marcas de peça única

Se o símbolo é um bloco só, três alternativas que mantêm a ideia de "a marca se
revela":

1. **Traço que se desenha** — `stroke-dasharray` + `stroke-dashoffset` percorrendo
   o contorno. Funciona bem em marcas lineares.
2. **Máscara que abre** — o símbolo aparece por trás de um `clip-path` que se
   expande a partir do centro.
3. **Giro único** — a peça inteira gira em Y e o nome aparece no verso.

Nenhuma é tão boa quanto a separação, porque nenhuma mostra a construção da
marca. Sempre procure as partes primeiro.

## Aplicado em

- **Rendapê** (`Projetos/siterendape-v2`) — os dois ganchos do símbolo, 6,2s,
  a cada carregamento.
