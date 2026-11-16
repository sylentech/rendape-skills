import { useEffect, useState } from 'react';

/* ===========================================================================
   ABERTURA DA MARCA

   A logo se monta e depois se abre: os dois ganchos do símbolo separam para os
   lados enquanto o nome "Rendapê" se revela do centro para fora, e a cortina
   sobe deixando o arco no rastro.

   Por que funciona com ESTA marca: o símbolo da Rendapê é literalmente dois
   ganchos entrelaçados — os dois <path> do SVG oficial. Separá-los não é um
   efeito aplicado por cima, é a própria construção da marca se desfazendo. Os
   caminhos abaixo são copiados de assets/logo/rendape-symbol-*.svg, os mesmos
   que o componente Pattern já usa para o ladrilho.

   O wordmark se revela por clip-path inset(0 50%) → inset(0 -5%): abre do meio
   para as beiradas, o que casa com os ganchos indo para fora.

   A cortina sai com border-radius 0 0 12vw 12vw — ela deixa o gesto do arco
   desenhado no ar ao subir. O arco é o design system inteiro num movimento só.

   Regras que a abertura respeita:
   · Roda em TODO carregamento, inclusive a cada F5.
   · Botão de pular sempre visível, focável, e é o primeiro elemento do Tab.
   · prefers-reduced-motion nunca vê a abertura — o componente não monta.
   · Esc pula. Só Esc: o Tab precisa servir para chegar ao botão.
   · Trava a rolagem enquanto roda; devolve ao terminar.
   · aria-hidden no desenho: quem usa leitor de tela ouve o botão de pular e
     segue para o conteúdo, sem narração de animação.
=========================================================================== */

const HOOK_A = 'M26.32,779.95c-.69-19.2-1.04-48.11-1.04-86.74s.35-67.54,1.04-86.74h54.82l3.12,31.57h1.04c5.09-20.58,18.62-31.11,40.59-31.57,41.17-.69,74.13-.69,98.88,0v42.67c-14.8,1.16-35.39,1.73-61.76,1.73h-47.18c-9.95,0-17.58,1.97-22.9,5.9-5.32,3.94-7.98,10.99-7.98,21.16v102H26.32Z';
const HOOK_B = 'M222.69,660.71c.69,19.2,1.04,48.11,1.04,86.74s-.35,67.54-1.04,86.74h-54.82l-3.12-31.57h-1.04c-5.09,20.58-18.62,31.11-40.59,31.57-41.17.69-74.13.69-98.88,0v-42.67c14.8,1.16,35.39,1.73,61.76,1.73h47.18c9.95,0,17.58-1.97,22.9-5.9,5.32-3.94,7.98-10.99,7.98-21.16v-102h58.63Z';

const DURACAO = 6200; // deve bater com --intro-dur no CSS

/** Decide se a abertura deve rodar. Fora do componente para o Hero poder
    perguntar sem montar nada.

    Roda em TODO carregamento, inclusive a cada F5 — decisão da Gabriela. Por
    isso o botão de pular importa ainda mais: quem recarrega várias vezes
    (durante uma revisão, por exemplo) precisa de uma saída rápida e sempre
    visível. */
export function deveAbrir(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function BrandIntro({ onFim }: { onFim: () => void }) {
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('rp-intro-ativa');
    const fim = window.setTimeout(() => finalizar(), DURACAO);

    // Só Esc pula pelo teclado. "Qualquer tecla" parece conveniente, mas o
    // Tab também é tecla: quem navega por teclado dispensaria a abertura ao
    // tentar ALCANÇAR o botão de pular, que nunca chegaria a receber foco.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finalizar(); };
    window.addEventListener('keydown', onKey);

    function finalizar() {
      window.clearTimeout(fim);
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('rp-intro-ativa');
      setSaindo(true);
      onFim();
    }

    return () => {
      window.clearTimeout(fim);
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('rp-intro-ativa');
    };
  }, [onFim]);

  if (saindo) return null;

  return (
    <div className="rp-intro" role="presentation">
      {/* Botão de pular: primeiro no DOM, então é o primeiro Tab. */}
      <button
        type="button"
        className="rp-intro-pular"
        onClick={() => {
          document.documentElement.classList.remove('rp-intro-ativa');
          setSaindo(true);
          onFim();
        }}
      >
        Pular abertura
      </button>

      {/* Palco: TUDO ocupa o mesmo centro, sobreposto.
          É isto que faz a abertura ser horizontal em vez de diagonal — os
          ganchos partem de cima do nome e correm para os lados, revelando-o
          por baixo. Empilhar o símbolo ACIMA do nome faria cada gancho sair
          na diagonal (do topo para o canto), que é outro movimento. */}
      <div className="rp-intro-palco" aria-hidden="true">
        {/* Os dois ganchos. Cada um numa camada própria para poder se mover
            sozinho, mas ambos com o MESMO viewBox e a MESMA caixa: sobrepostos
            formam o símbolo oficial pixel por pixel. */}
        <svg className="rp-intro-gancho rp-intro-gancho-a" viewBox="20 602 210 238" fill="currentColor">
          <path d={HOOK_A} />
        </svg>
        <svg className="rp-intro-gancho rp-intro-gancho-b" viewBox="20 602 210 238" fill="currentColor">
          <path d={HOOK_B} />
        </svg>

        {/* O nome fica ATRÁS dos ganchos (z-index menor), no mesmo centro, e
            se revela do meio para fora conforme eles saem de cima dele. */}
        <p className="rp-intro-nome">Rendapê</p>

        {/* A assinatura endossada, fixa no manual de marca. Único elemento
            deslocado do centro — entra por baixo, depois do nome. */}
        <p className="rp-intro-assinatura">uma empresa do Grupo Referência</p>
      </div>
    </div>
  );
}
