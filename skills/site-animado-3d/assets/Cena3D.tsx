import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { usePrefersReducedMotion } from '@/ds/useMotion';

/* ===========================================================================
   CENA 3D

   As três mídias vêm do prompt de referência que a Gabriela passou. Na
   primeira leitura eu as descartei como "CDN de terceiro" sem abrir — erro
   meu: era exatamente ali que estavam as moedas e a casa que ela pedia. São
   renders 3D, não pictogramas achatados.

     moedas.mp4  moedas cinzeladas caindo sobre um campo de flores
     casa.mp4    edifício neoclássico com colunas, frontão e escadaria
     broto.webp  moeda apoiada num broto, para a seção da empresa

   BAIXADAS E HOSPEDADAS LOCALMENTE. Não sobrou nenhuma chamada ao CloudFront
   de terceiro: se aquele bucket sair do ar, o site continua igual. Também
   evita depender de um domínio que ninguém aqui controla.

   RECOLORIDAS do lavanda original para o roxo #765DD1 da marca, com ffmpeg
   (matiz, saturação e balanço de cor). O comando está no README.

   PESO: os vídeos foram recomprimidos de 5 MB para ~1 MB e ~600 kB, sem
   faixa de áudio. Carregam com preload="none" e só entram quando a seção
   chega perto da tela, então não pesam na primeira pintura.
=========================================================================== */

interface Cena3DProps {
  /** Arquivo de vídeo já importado. */
  src: string;
  /** Adia a busca do vídeo até a página terminar de carregar. Use nas cenas
      que já estão visíveis na primeira tela: o pôster aparece de imediato e o
      vídeo entra depois, sem disputar banda com a fonte e o CSS. */
  adiar?: boolean;
  /** Imagem de primeiro quadro, exibida enquanto o vídeo não carrega. */
  poster?: string;
  /** Texto alternativo. Vazio marca a cena como decorativa. */
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** object-position do vídeo. */
  posicao?: string;
}

export function Cena3D({
  src, poster, alt = '', className = '', style, posicao = 'center', adiar = false,
}: Cena3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();
  const [perto, setPerto] = useState(false);
  const [pronto, setPronto] = useState(false);

  // Só busca o vídeo quando a cena se aproxima da tela. rootMargin generoso
  // para o arquivo chegar antes de o visitante ver o espaço vazio.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Cenas do hero já estão em tela no primeiro quadro, então o observer
    // dispararia na hora e o vídeo disputaria banda com fonte, CSS e JS.
    // Esperar o 'load' deixa a primeira pintura leve: o visitante vê o pôster
    // e o vídeo assume alguns instantes depois, sem que ele perceba o troco.
    const armar = () => {
      if (typeof IntersectionObserver === 'undefined') { setPerto(true); return; }
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) { setPerto(true); io.disconnect(); }
        },
        { rootMargin: '600px 0px' },
      );
      io.observe(el);
      return io;
    };

    if (!adiar) {
      const io = armar();
      return () => io?.disconnect();
    }

    let io: IntersectionObserver | undefined;
    const depois = () => { io = armar(); };
    if (document.readyState === 'complete') {
      const t = setTimeout(depois, 400);
      return () => { clearTimeout(t); io?.disconnect(); };
    }
    window.addEventListener('load', depois, { once: true });
    return () => { window.removeEventListener('load', depois); io?.disconnect(); };
  }, [adiar]);

  // Com movimento reduzido o vídeo não roda: fica no primeiro quadro, parado.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (reduced) { v.pause(); return; }
    if (perto && pronto) v.play().catch(() => { /* autoplay barrado, tudo bem */ });
  }, [perto, pronto, reduced]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : 'true'}
    >
      {/* O pôster segura o lugar enquanto o vídeo não chega, e é o que fica
          visível para quem pede movimento reduzido. */}
      {poster ? (
        <img
          src={poster} alt="" aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: posicao,
            opacity: pronto && !reduced ? 0 : 1,
            transition: 'opacity var(--dur-slow) var(--ease-out)',
          }}
        />
      ) : null}

      {perto ? (
        <video
          ref={videoRef}
          src={src}
          muted loop playsInline autoPlay
          // preload="metadata" + autoPlay: sem isso o navegador não busca o
          // arquivo (preload="none" espera um play() que só viria depois do
          // onLoadedData, que nunca dispara — deadlock silencioso).
          // O IntersectionObserver acima já garante que só montamos o <video>
          // quando a cena se aproxima, então o "auto" não custa carga inicial.
          preload="metadata"
          onLoadedData={() => setPronto(true)}
          onCanPlay={() => setPronto(true)}
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: posicao,
            opacity: pronto ? 1 : 0,
            transition: 'opacity var(--dur-slow) var(--ease-out)',
          }}
        />
      ) : null}
    </div>
  );
}
