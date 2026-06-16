/**
 * Брендовая бесконечная полоска-разделитель GRABZI (как на grabzi.ae):
 * мелкие фирменные иконки — рука-стакан / V60-дриппер / тающий лёд — в чередующихся
 * цветах (терракота / lime / blue), едут вправо→влево бесшовно. Лента дублирована 2× (-50%).
 * Пауза на ховер, уважает prefers-reduced-motion (CSS в globals.css). Чисто декоративная.
 */
// сбалансировано по мотивам (рука/дриппер/лёд ×3) и цветам (red/lime/blue ×3),
// без двух одинаковых подряд; dripper-blue ассета нет, поэтому blue — на руке/льде
const STRIP = [
  "hand-red", "ice-blue", "dripper-lime",
  "ice-red", "hand-blue", "dripper-red",
  "ice-lime", "hand-blue", "dripper-lime",
];

export function IconStrip() {
  const row = [...STRIP, ...STRIP]; // дубль для бесшовной петли
  return (
    <div className="gz-strip" aria-hidden="true">
      <div className="gz-strip-track">
        {row.map((name, i) => (
          <span className="gz-strip-item" key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/brand/strip/${name}.png`} alt="" loading="lazy" draggable={false} />
          </span>
        ))}
      </div>
    </div>
  );
}
