import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePrefersReducedMotion } from '../useMotion';

/* Contador — um número que conta até o valor quando entra em tela.

   Cuidados que a implementação ingênua não tem:

   · O valor final é escrito no DOM desde o primeiro quadro, num <span>
     visualmente oculto, e a contagem fica aria-hidden. Quem usa leitor de tela
     ouve "12" e não "1, 2, 3, ... 12".
   · Com prefers-reduced-motion o número nasce no valor final. Contagem é
     movimento, e movimento não solicitado é exatamente o que a preferência
     pede para não acontecer.
   · A animação roda em requestAnimationFrame com easing de saída, não em
     setInterval: o passo acompanha o relógio do navegador, então não acelera
     nem engasga quando a aba perde foco.
   · font-variant-numeric: tabular-nums no CSS evita o número "pular" de
     largura enquanto os dígitos mudam. */

export interface ContadorProps {
  /** Valor final. */
  ate: number;
  /** Texto antes do número (ex.: 'R$'). */
  prefixo?: string;
  /** Texto depois do número (ex.: '%', '+'). */
  sufixo?: string;
  /** Casas decimais. @default 0 */
  casas?: number;
  /** Duração da contagem em ms. @default 1400 */
  duracao?: number;
  className?: string;
  style?: CSSProperties;
  /** Rótulo completo para leitor de tela. Sem ele, usa prefixo+valor+sufixo. */
  label?: string;
}

export function Contador({
  ate, prefixo = '', sufixo = '', casas = 0, duracao = 1400,
  className = '', style, label,
}: ContadorProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const [valor, setValor] = useState(reduced ? ate : 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) { setValor(ate); return; }
    if (typeof IntersectionObserver === 'undefined') { setValor(ate); return; }

    let frame = 0;
    let inicio = 0;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();

        const passo = (agora: number) => {
          if (!inicio) inicio = agora;
          const t = Math.min(1, (agora - inicio) / duracao);
          // Saída cúbica: rápido no começo, assenta no fim.
          const eased = 1 - Math.pow(1 - t, 3);
          setValor(ate * eased);
          if (t < 1) frame = requestAnimationFrame(passo);
        };
        frame = requestAnimationFrame(passo);
      },
      { threshold: 0.4 },
    );

    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(frame); };
  }, [ate, duracao, reduced]);

  const formatado = valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  const finalFormatado = ate.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {/* O valor final, para leitor de tela: nunca a contagem. */}
      <span className="rp-sr">{label ?? `${prefixo}${finalFormatado}${sufixo}`}</span>
      <span aria-hidden="true">{prefixo}{formatado}{sufixo}</span>
    </span>
  );
}
