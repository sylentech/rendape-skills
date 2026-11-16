import type { CSSProperties, ElementType } from 'react';
import { useReveal } from '../useMotion';

/* TituloAnimado — o título entra palavra por palavra, de baixo para cima,
   por trás de uma máscara.

   Não é letra por letra de propósito. Letra por letra vira efeito de
   apresentação de slides e, pior, quebra a leitura: quem usa leitor de tela
   ouviria cada caractere. Por palavra o texto continua sendo texto, e o
   movimento acompanha o ritmo natural de leitura.

   A máscara (overflow hidden por palavra) é o que dá o gesto: a palavra sobe
   de dentro da própria linha, em vez de aparecer flutuando.

   O texto completo vai num <span> visualmente oculto para o leitor de tela,
   e as palavras animadas ficam aria-hidden. Assim a leitura é de uma frase só,
   não de uma lista de palavras soltas. */

export interface TituloAnimadoProps {
  /** Parte leve do título, em peso 300. */
  leve: string;
  /** Parte em negrito, o gesto tipográfico da marca. */
  forte?: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Intervalo entre palavras em ms. @default 55 */
  stagger?: number;
  /** Atraso antes da primeira palavra. */
  delay?: number;
}

export function TituloAnimado({
  leve, forte, as: Tag = 'h2',
  className = '', style, stagger = 55, delay = 0,
}: TituloAnimadoProps) {
  const ref = useReveal<HTMLHeadingElement>({ threshold: 0.25 });

  const palavrasLeves = leve.split(' ');
  const palavrasFortes = forte ? forte.split(' ') : [];
  const total = palavrasLeves.length + palavrasFortes.length;

  let i = -1;
  const palavra = (texto: string, negrito: boolean) => {
    i += 1;
    return (
      <span key={`${texto}-${i}`} className="rp-palavra">
        <span
          className="rp-palavra-in"
          style={{
            ['--palavra-delay' as string]: `${delay + i * stagger}ms`,
            fontWeight: negrito ? 'var(--fw-bold)' : 'inherit',
          }}
        >
          {texto}
        </span>
      </span>
    );
  };

  return (
    <Tag ref={ref} className={`rp-titulo-animado ${className}`} style={style} data-palavras={total}>
      {/* A frase inteira, para leitor de tela. */}
      <span className="rp-sr">{forte ? `${leve} ${forte}` : leve}</span>

      <span aria-hidden="true">
        {palavrasLeves.map((p) => palavra(p, false))}
        {palavrasFortes.map((p) => palavra(p, true))}
      </span>
    </Tag>
  );
}
