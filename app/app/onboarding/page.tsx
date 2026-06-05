"use client";
import { useState, useRef, TouchEvent } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { DrinkArt } from "@/components/DrinkArt";

const slides = [
  {
    bg: "#EFE0E8",
    art: () => (
      <DrinkArt
        glass="tall"
        liquid="#C9A8D8"
        foam="#E6CCDD"
        garnish="flower"
        size={220}
      />
    ),
    title: "Закажи заранее",
    subtitle: "и забери по пути — без очередей",
  },
  {
    bg: "#F4EEE4",
    art: () => <CarScene />,
    title: "Укажи номер машины",
    subtitle: "и вынесем заказ прямо к авто",
  },
  {
    bg: "#DDE9DC",
    art: () => (
      <DrinkArt
        glass="smoothie"
        liquid="#7DAE7F"
        foam="#C6DEC8"
        garnish="mint"
        straw
        size={220}
      />
    ),
    title: "Калории — на тебе",
    subtitle: "собирай напиток как хочешь, КБЖУ пересчитаем",
  },
];

function CarScene() {
  return (
    <svg viewBox="0 0 240 200" width="240" height="200">
      {/* Sun */}
      <circle cx="200" cy="50" r="22" fill="#F5C079" />
      {/* Car body */}
      <g transform="translate(40,100)">
        <path
          d="M 0 40 L 0 28 Q 0 20 14 18 L 36 12 L 70 4 L 110 4 L 138 12 L 156 22 Q 168 24 168 32 L 168 52 Q 168 60 158 60 L 12 60 Q 0 60 0 52 Z"
          fill="#4A56E2"
        />
        <path
          d="M 36 14 L 70 6 L 100 6 L 100 22 L 32 22 Z"
          fill="rgba(255,255,255,0.5)"
        />
        <path
          d="M 100 6 L 134 14 L 152 22 L 102 22 Z"
          fill="rgba(255,255,255,0.4)"
        />
        <rect x="50" y="56" width="30" height="6" fill="#0E0E10" opacity="0.5" />
        <rect x="98" y="56" width="32" height="6" fill="#0E0E10" opacity="0.5" />
        <circle cx="40" cy="62" r="14" fill="#1F1F26" />
        <circle cx="40" cy="62" r="6" fill="#5B5C64" />
        <circle cx="130" cy="62" r="14" fill="#1F1F26" />
        <circle cx="130" cy="62" r="6" fill="#5B5C64" />
      </g>
      {/* Drink being delivered */}
      <g transform="translate(180,52)">
        <DrinkArt
          glass="paper"
          liquid="#C2A07A"
          foam="#F5E8D0"
          size={75}
          showShadow={false}
        />
      </g>
      {/* Road */}
      <rect y="178" width="240" height="22" fill="#3F4A55" />
      <g stroke="#FFF" strokeWidth="3" strokeDasharray="14 12">
        <line x1="0" y1="189" x2="240" y2="189" />
      </g>
    </svg>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const setOnboardingSeen = useStore((s) => s.setOnboardingSeen);
  const [index, setIndex] = useState(0);

  const finish = () => {
    setOnboardingSeen();
    router.replace("/outlets");
  };

  const next = () => {
    if (index < slides.length - 1) setIndex(index + 1);
    else finish();
  };

  const startX = useRef<number | null>(null);
  const onTouchStart = (e: TouchEvent) => (startX.current = e.touches[0].clientX);
  const onTouchEnd = (e: TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -40 && index < slides.length - 1) setIndex(index + 1);
    if (dx > 40 && index > 0) setIndex(index - 1);
    startX.current = null;
  };

  const slide = slides[index];

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ background: slide.bg, transition: "background 0.4s ease" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex justify-between items-center px-4 pt-safe py-2">
        <div className="text-h3 font-bold">juicy</div>
        <button onClick={finish} className="text-caption font-medium muted px-3 py-2">
          Пропустить
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div key={index} className="mb-8 animate-fadeUp">
          {slide.art()}
        </div>
        <h1 className="hero-title text-[30px] leading-tight mb-3" key={`t-${index}`}>
          {slide.title}
        </h1>
        <p className="text-body muted max-w-[300px]" key={`s-${index}`}>
          {slide.subtitle}
        </p>
      </div>

      <div className="px-6 pb-safe pt-2">
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 22 : 6,
                background:
                  i === index ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.18)",
              }}
            />
          ))}
        </div>
        <button onClick={next} className="btn-pill btn-primary w-full">
          {index === slides.length - 1 ? "Начать" : "Дальше"}
        </button>
      </div>
    </div>
  );
}
