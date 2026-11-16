---
name: site-animado-3d
description: "Padrão completo de site institucional animado com cenas 3D em vídeo, entradas coordenadas na rolagem, paralaxe de cursor e títulos que entram palavra por palavra. Inclui o pipeline ffmpeg para recolorir renders 3D para a paleta da marca e recortar o fundo claro. Use quando o usuário pedir site bonito/animado/premium, mencionar Motion Sites, Awwwards, ou mandar um prompt de referência com URLs de vídeo. Mantém o peso baixo: cenas entram depois da primeira pintura."
---

# Site animado com cenas 3D

O padrão que a Gabriela adotou para os sites a partir de setembro de 2026.
Construído na reformulação da Rendapê.

A ideia central: **cenas 3D em vídeo curto**, recoloridas para a paleta da
marca, sobre um fundo escuro, com movimento discreto em tudo o mais. Fica muito
acima de ilustração vetorial plana, e custa menos que WebGL.

## A regra que evita o erro mais caro

**Se o usuário mandar um prompt de referência com URLs, ABRA AS URLs.**

Na Rendapê eu descartei três links como "CDN de terceiro" sem olhar, e refiz o
hero três vezes com pictogramas achatados. As moedas e a casa que ela queria
estavam exatamente ali dentro.

```bash
curl -s -o /tmp/ref.mp4 "URL" --max-time 120
ffmpeg -y -i /tmp/ref.mp4 -vf "select='eq(n\,50)'" -fps_mode passthrough -q:v 2 /tmp/q.jpg
# depois: Read /tmp/q.jpg
```

Descartar a *hospedagem* de terceiro é certo. Descartar o *conteúdo* sem ver é
que não.

## Pipeline das cenas

### 1. Baixar e hospedar localmente

Nunca aponte o site para o CDN de outra pessoa. Se aquele bucket sair do ar, o
site quebra, e ninguém aqui controla o domínio.

### 2. Recolorir para a marca

Os renders costumam vir numa cor que não é a do cliente. Ajuste matiz,
saturação e balanço:

```bash
ffmpeg -y -i origem.mp4 -vf "\
hue=h=8:s=1.35,\
eq=brightness=-0.15:contrast=1.2:saturation=1.15,\
colorbalance=rs=0.06:bs=0.10:rm=0.02:bm=0.06:rh=-0.04:bh=0.04" \
-an saida.mp4
```

`h=` é o giro de matiz em graus. Ache o valor comparando um quadro com a cor
alvo; para lavanda → roxo `#765DD1`, `h=8` funcionou.

### 3. Recortar o fundo claro ← **o passo que muda tudo**

Um render com fundo claro colado num site escuro vira uma **caixa luminosa**.
Máscara radial em CSS ajuda, mas não resolve: o miolo continua claro.

A solução é recortar no ffmpeg e embutir o fundo escuro no próprio vídeo:

```bash
# Fundo CHAPADO (limiar simples resolve)
ffmpeg -y -i origem.mp4 -filter_complex "\
[0:v]scale=900:-2,fps=24,split[a][b];\
[a]hue=h=8:s=1.35,eq=brightness=-0.14:contrast=1.2,format=yuva420p[cor];\
[b]format=gray,lut=y='if(gt(val,205),0,255)',boxblur=2:1,format=gray[mask];\
color=c=0x14121F:s=900x1200:d=8,fps=24,format=yuv420p[bg];\
[cor][mask]alphamerge[fg];\
[bg][fg]overlay=0:0:format=yuv420[out]" \
-map "[out]" -an -c:v libx264 -crf 32 -preset veryslow -pix_fmt yuv420p saida.mp4

# Fundo em GRADIENTE (limiar serrilha; use rampa de alfa)
# troque a linha do [b] por:
# [b]format=gray,curves=all='0/1 0.62/1 0.74/0.35 0.84/0 1/0',boxblur=3:1,format=gray[mask];
```

Trocar `0x14121F` pela cor de fundo do site.

**Armadilhas:**
- `curves` usa escala **0–1**, não 0–255. Passar 255 aborta o comando.
- `alphamerge` sem `format=yuva420p` antes descarta a cor e o resultado sai
  em tons de cinza.
- `colorkey` isolado não funciona em fundo com gradiente.

### 4. Comprimir

```bash
-c:v libx264 -crf 33 -preset veryslow -pix_fmt yuv420p -movflags +faststart -an
# mais: scale=1280:-2, fps=24
```

Na Rendapê: 5 MB → 290 kB sem perda visível. Sempre `-an`: cena de fundo não
tem áudio.

Gere também um pôster do primeiro quadro:
```bash
ffmpeg -y -i saida.mp4 -vf "select='eq(n\,0)',scale=960:-2" -frames:v 1 -quality 80 poster.webp
```

## Peso: a cena NÃO pode entrar na primeira pintura

Um vídeo de 300 kB no hero atrasa o texto. O componente `Cena3D.tsx` resolve
com duas travas:

1. `IntersectionObserver` com `rootMargin: 600px` — só busca quando aproxima;
2. prop **`adiar`** — para cenas já visíveis no primeiro quadro, espera o
   evento `load` da página. O pôster aparece de imediato, o vídeo assume
   depois, e o visitante não percebe a troca.

Meça com `waitUntil: 'load'`, **não** `networkidle`: networkidle espera o vídeo
adiado e a conta fica errada.

Na Rendapê: **359 kB até a primeira pintura, zero de vídeo**.

## Armadilha de `<video>` que trava sem erro

```jsx
<video preload="none" onLoadedData={...} />   {/* nunca carrega */}
```

Sem `autoPlay`, `preload="none"` espera um `play()` que só viria depois do
`onLoadedData` — que nunca dispara porque nada foi buscado. Deadlock silencioso,
`readyState` fica em 0.

```jsx
<video preload="metadata" autoPlay muted loop playsInline
       onLoadedData={ok} onCanPlay={ok} />   {/* certo */}
```

## As outras camadas de movimento

Todas em `assets/`, todas CSS:

| Arquivo | O quê |
|---|---|
| `movimento.css` | entradas na rolagem, paralaxe de cursor, hover de blocos, brilho que segue o cursor |
| `useMotion.ts` | os hooks: reveal, paralaxe, progresso de rolagem, resposta a cursor/teclado/toque |
| `Reveal.tsx` | embrulha um bloco numa entrada coordenada |
| `TituloAnimado.tsx` | título palavra por palavra |
| `Contador.tsx` | número que conta ao entrar em tela |
| `Cena3D.tsx` | a cena em vídeo, com as travas de peso |

## Quatro regras que não se negociam

**1. Equivalência por teclado e toque.** Todo estado de hover precisa ser
alcançável por Tab e por toque. O `useRespond` junta os três no mesmo booleano.
No celular, nada que o cursor revelaria pode carregar informação.

**2. `prefers-reduced-motion` desliga tudo.** Não é acelerar: é não haver
movimento. E o conteúdo tem de estar visível no estado final — nada pode
depender de uma animação para aparecer.

**3. Texto animado entrega a frase inteira a leitor de tela.** Palavra por
palavra, nunca letra por letra (soletraria). A frase completa vai num `<span>`
oculto e as palavras animadas ficam `aria-hidden`. Mesma coisa no contador: o
valor final desde o primeiro quadro, senão ouve-se "1, 2, 3…".

**4. Escrita de movimento fora do React.** Cursor dispara dezenas de vezes por
segundo; re-renderizar nesse ritmo derruba o quadro. Escreva variáveis CSS
(`--px`, `--py`, `--mx`, `--my`) direto no `style` do nó, dentro de
`requestAnimationFrame`.

## Armadilhas de SVG que somem sem erro

**`linearGradient` numa linha horizontal precisa de
`gradientUnits="userSpaceOnUse"`.** A bounding box tem altura zero, o padrão
`objectBoundingBox` degenera, e a linha não é pintada. Console limpo.

**`LightField variant="halo"` usa `closest-side`** e, numa caixa alta e
estreita, desenha um anel visível em vez de luz difusa. Use `glow` com máscara
radial.

**Cabeçalho semitransparente deixa o conteúdo vazar.** A 92% de opacidade, os
botões do hero apareciam por trás e liam-se como elemento duplicado. Se o
design proíbe backdrop blur, use cor cheia.

## Como verificar

`assets/validar-site.mjs` roda ~25 verificações com Playwright: console limpo,
âncoras, teclado, foco, mobile sem hover, rolagem horizontal,
`prefers-reduced-motion`, formulário, e o peso até a primeira pintura.

```bash
npm run build && npx vite preview --port 4174
node validar-site.mjs
ALVO="https://..." node validar-site.mjs
```

## Combina com

- **`abertura-de-marca`** — a intro da logo. Os dois foram feitos juntos.

## Aplicado em

- **Rendapê** (`Projetos/siterendape-v2`) — casa neoclássica e moedas,
  recoloridas de lavanda para `#765DD1`, publicado em Worker Cloudflare.
