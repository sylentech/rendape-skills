import type { CSSProperties, ElementType, ReactNode } from 'react';
import { useReveal } from '../useMotion';

/* Reveal — embrulha um bloco numa entrada coordenada na rolagem.
   O estado inicial e a transição vivem no CSS ([data-reveal] em
   motion-expressive.css); este componente só decide o momento e o atraso.

   `delay` é o que produz a coordenação: título, imagem e elementos de uma mesma
   seção entram na mesma direção, separados por um escalonamento curto, em vez
   de cada um aparecer por conta própria. */

export interface RevealProps {
  children: ReactNode;
  /** Direção da entrada. 'arch' revela por baixo de uma máscara de arco. */
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade' | 'arch';
  /** Atraso em ms. Use múltiplos de --stagger-base para irmãos. */
  delay?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  id?: string;
}

export function Reveal({
  children, direction = 'up', delay = 0,
  as: Tag = 'div', className = '', style, id, ...rest
}: RevealProps) {
  const ref = useReveal<HTMLDivElement>();

  return (
    <Tag
      ref={ref}
      id={id}
      data-reveal={direction}
      className={className}
      style={{ ['--reveal-delay' as string]: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* RevealGroup — escalona os filhos automaticamente. Evita ter de escrever
   delay={0}, delay={90}, delay={180} à mão e errar a ordem depois. */
export interface RevealGroupProps {
  children: ReactNode[];
  direction?: RevealProps['direction'];
  /** Intervalo entre irmãos em ms. @default 90 (--stagger-base) */
  stagger?: number;
  /** Atraso antes do primeiro filho. */
  delay?: number;
  as?: ElementType;
  childAs?: ElementType;
  className?: string;
  childClassName?: string;
  style?: CSSProperties;
}

export function RevealGroup({
  children, direction = 'up', stagger = 90, delay = 0,
  as: Tag = 'div', childAs = 'div', className = '', childClassName = '', style,
}: RevealGroupProps) {
  return (
    <Tag className={className} style={style}>
      {children.map((child, i) => (
        <Reveal
          key={i}
          as={childAs}
          direction={direction}
          delay={delay + i * stagger}
          className={childClassName}
        >
          {child}
        </Reveal>
      ))}
    </Tag>
  );
}
