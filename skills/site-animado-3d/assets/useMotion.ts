import { useCallback, useEffect, useRef, useState } from 'react';

/* Camada de movimento do site. Três decisões atravessam todos os hooks daqui:

   1. prefers-reduced-motion não é um retoque no fim — é consultado na origem.
      Com ele ligado, os hooks devolvem o estado final imediatamente e nunca
      registram listener de movimento.
   2. Ponteiro grosseiro (celular, tablet) também não registra listener de
      cursor. O efeito não existe onde não há cursor, em vez de existir e falhar.
   3. Nada de leitura de layout dentro do handler de evento. As medidas são
      cacheadas e recalculadas em resize, para o movimento não forçar reflow. */

/** Verdadeiro quando o sistema pede movimento reduzido. Reage à troca ao vivo. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** Verdadeiro quando o dispositivo tem ponteiro fino (mouse, trackpad). */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onChange = () => setFine(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return fine;
}

/* ---------------------------------------------------------------------------
   useReveal — entrada coordenada na rolagem.
   Marca [data-revealed] quando o elemento entra em tela. A animação em si é do
   CSS (motion-expressive.css); aqui só se decide quando. Desconecta depois de
   revelar, para não manter observer vivo pela página toda.
--------------------------------------------------------------------------- */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  threshold?: number;
  rootMargin?: string;
  /** Revela uma vez e para de observar. @default true */
  once?: boolean;
}) {
  const { threshold = 0.16, rootMargin = '0px 0px -8% 0px', once = true } = options ?? {};
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sem movimento: já nasce revelado, sem observer.
    if (reduced) {
      el.setAttribute('data-revealed', '');
      el.setAttribute('data-settled', '');
      return;
    }

    // Navegador antigo sem IntersectionObserver: mostra tudo em vez de esconder.
    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-revealed', '');
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute('data-revealed', '');
            // Solta o will-change quando a transição termina.
            const settle = () => el.setAttribute('data-settled', '');
            el.addEventListener('transitionend', settle, { once: true });
            if (once) io.disconnect();
          } else if (!once) {
            el.removeAttribute('data-revealed');
            el.removeAttribute('data-settled');
          }
        }
      },
      { threshold, rootMargin },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once, reduced]);

  return ref;
}

/* ---------------------------------------------------------------------------
   useCursorParallax — profundidade em resposta ao cursor.
   Escreve duas variáveis CSS (--px, --py) de -1 a 1 no elemento. Quem consome
   decide a amplitude, sempre limitada pelos tokens --cursor-depth-*.

   Por que variável CSS e não estado do React: o movimento do mouse dispara
   dezenas de vezes por segundo, e re-renderizar a árvore nesse ritmo derruba o
   quadro. Escrever no style do nó pula o React inteiro.
--------------------------------------------------------------------------- */
export function useCursorParallax<T extends HTMLElement = HTMLDivElement>(options?: {
  /** Suavização de 0 a 1 — quanto menor, mais lento o acompanhamento. @default 0.08 */
  ease?: number;
}) {
  const { ease = 0.08 } = options ?? {};
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !fine) return;

    let targetX = 0, targetY = 0;
    let currentX = 0, currentY = 0;
    let frame = 0;
    let rect = el.getBoundingClientRect();

    // Medida cacheada: o handler de mousemove nunca lê layout.
    const measure = () => { rect = el.getBoundingClientRect(); };

    const onMove = (e: MouseEvent) => {
      if (!rect.width || !rect.height) return;
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      // Fora da caixa o alvo satura em vez de disparar.
      targetX = Math.max(-1, Math.min(1, targetX));
      targetY = Math.max(-1, Math.min(1, targetY));
    };

    const onLeave = () => { targetX = 0; targetY = 0; };

    const tick = () => {
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      el.style.setProperty('--px', currentX.toFixed(4));
      el.style.setProperty('--py', currentY.toFixed(4));
      frame = requestAnimationFrame(tick);
    };

    measure();
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');

    window.addEventListener('mousemove', onMove, { passive: true });
    el.addEventListener('mouseleave', onLeave);
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true });
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      el.style.removeProperty('--px');
      el.style.removeProperty('--py');
    };
  }, [ease, reduced, fine]);

  return ref;
}

/* ---------------------------------------------------------------------------
   useRespond — o estado "ativo" de um elemento gráfico, alimentado por três
   entradas equivalentes: cursor, foco de teclado e toque.

   É isto que cumpre a exigência de comportamento equivalente por toque e
   teclado. Os três caminhos escrevem o MESMO booleano, então nada que o hover
   revele fica inacessível a quem navega por Tab ou toca na tela.
--------------------------------------------------------------------------- */
export function useRespond() {
  const [active, setActive] = useState(false);
  const reduced = usePrefersReducedMotion();

  const on = useCallback(() => setActive(true), []);
  const off = useCallback(() => setActive(false), []);

  // No toque, o estado alterna: um toque acende, outro apaga. Sem isso o
  // elemento tocado ficaria aceso para sempre.
  const onTouch = useCallback(() => setActive((v) => !v), []);

  return {
    active,
    /** Espalhe no elemento interativo. */
    bind: {
      onMouseEnter: on,
      onMouseLeave: off,
      onFocus: on,
      onBlur: off,
      onTouchStart: onTouch,
      'data-active': active ? ('true' as const) : ('false' as const),
    },
    setActive,
    reduced,
  };
}

/* ---------------------------------------------------------------------------
   useScrollProgress — quanto de um elemento já passou pela viewport, de 0 a 1.
   Usado para acender as janelas do PropertyMark conforme a seção entra.
   Amostrado em rAF a partir de evento de scroll passivo, nunca por observer de
   alta frequência.
--------------------------------------------------------------------------- */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reduced) { setProgress(1); return; }

    let frame = 0;
    let queued = false;

    const compute = () => {
      queued = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // 0 quando o topo do elemento toca a base da tela;
      // 1 quando o elemento já subiu 70% da própria altura acima dela.
      const span = rect.height * 0.7 + vh;
      const travelled = vh - rect.top;
      const p = Math.max(0, Math.min(1, travelled / span));
      setProgress(p);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      frame = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced]);

  return { ref, progress };
}

/* ---------------------------------------------------------------------------
   usePointerSpot — posição do cursor DENTRO de um elemento, em porcentagem.
   Alimenta o brilho radial de .rp-brilho, escrevendo --mx e --my.

   Como no useCursorParallax, a escrita é direta no style do nó: o mousemove
   dispara dezenas de vezes por segundo e re-renderizar a árvore nesse ritmo
   derruba o quadro. Em ponteiro grosseiro o listener nem é registrado, então
   o brilho simplesmente não existe no celular — que é o certo, já que ele não
   carrega informação nenhuma.
--------------------------------------------------------------------------- */
export function usePointerSpot<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || !fine) return;

    let frame = 0;
    let pendente: { x: number; y: number } | null = null;

    const aplicar = () => {
      frame = 0;
      if (!pendente) return;
      el.style.setProperty('--mx', `${pendente.x}%`);
      el.style.setProperty('--my', `${pendente.y}%`);
      pendente = null;
    };

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pendente = {
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      };
      if (!frame) frame = requestAnimationFrame(aplicar);
    };

    el.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('mousemove', onMove);
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
  }, [reduced, fine]);

  return ref;
}
