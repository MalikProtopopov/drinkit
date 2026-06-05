"use client";
import { useId } from "react";

export type GlassType =
  | "tall"
  | "cup"
  | "mug"
  | "paper"
  | "tumbler"
  | "bottle"
  | "smoothie"
  | "croissant"
  | "sandwich";

export type GarnishType =
  | "orange-slice"
  | "lemon-slice"
  | "mint"
  | "berry"
  | "cocoa"
  | "cinnamon"
  | "flower"
  | "leaf"
  | "whipped"
  | "nuts"
  | "pineapple-leaf"
  | null;

export type DrinkArtProps = {
  glass: GlassType;
  liquid: string;
  foam?: string;
  garnish?: GarnishType;
  straw?: boolean;
  size?: number;
  className?: string;
  showShadow?: boolean;
};

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

export function DrinkArt({
  glass,
  liquid,
  foam,
  garnish,
  straw,
  size = 200,
  className,
  showShadow = true,
}: DrinkArtProps) {
  const w = size;
  const h = Math.round(size * 1.15);
  // Unique id per instance to avoid <defs> clashes when multiple drinks of same glass type render
  const uid = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 200 230"
      width={w}
      height={h}
      className={className}
      style={{ display: "block" }}
    >
      {showShadow && (
        <ellipse cx="100" cy="222" rx="58" ry="6" fill="rgba(0,0,0,0.10)" />
      )}
      {glass === "tall" && <TallGlass uid={uid} liquid={liquid} foam={foam} straw={straw} />}
      {glass === "cup" && <EspressoCup liquid={liquid} foam={foam} />}
      {glass === "mug" && <Mug liquid={liquid} foam={foam} />}
      {glass === "paper" && <PaperCup liquid={liquid} foam={foam} />}
      {glass === "tumbler" && <Tumbler uid={uid} liquid={liquid} />}
      {glass === "bottle" && <Bottle liquid={liquid} />}
      {glass === "smoothie" && (
        <SmoothieCup uid={uid} liquid={liquid} foam={foam} straw={straw} />
      )}
      {glass === "croissant" && <Croissant uid={uid} />}
      {glass === "sandwich" && <Sandwich />}
      {garnish && <Garnish type={garnish} glass={glass} />}
    </svg>
  );
}

/* ===== Glass primitives ===== */

function TallGlass({
  uid,
  liquid,
  foam,
  straw,
}: {
  uid: string;
  liquid: string;
  foam?: string;
  straw?: boolean;
}) {
  const liquidDark = shade(liquid, -30);
  const liquidLight = shade(liquid, 25);
  const liqId = `tg-liq-${uid}`;
  const clipId = `tg-clip-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={liqId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={liquidDark} />
          <stop offset="55%" stopColor={liquid} />
          <stop offset="100%" stopColor={liquidLight} />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M 60 55 L 60 200 Q 60 215 76 215 L 124 215 Q 140 215 140 200 L 140 55 Z" />
        </clipPath>
      </defs>

      {/* Liquid body */}
      <path
        d="M 60 55 L 60 200 Q 60 215 76 215 L 124 215 Q 140 215 140 200 L 140 55 Z"
        fill={`url(#${liqId})`}
      />

      {/* Inner highlight strip (glass-like sheen) */}
      <rect
        x="65"
        y="68"
        width="6"
        height="135"
        rx="3"
        fill="rgba(255,255,255,0.18)"
        clipPath={`url(#${clipId})`}
      />

      {/* Top rim ellipse showing thickness of glass */}
      <ellipse cx="100" cy="55" rx="40" ry="6" fill={liquidDark} />
      <ellipse cx="100" cy="54" rx="40" ry="4" fill={shade(liquid, -10)} />

      {/* Foam */}
      {foam && (
        <>
          <ellipse cx="100" cy="50" rx="42" ry="10" fill={foam} />
          <ellipse cx="94" cy="47" rx="28" ry="5" fill={shade(foam, 18)} />
        </>
      )}

      {/* Straw */}
      {straw && (
        <g>
          <rect
            x="106"
            y="20"
            width="8"
            height="48"
            rx="3"
            fill="#E45F5F"
            transform="rotate(-8 110 44)"
          />
          <rect
            x="107"
            y="20"
            width="3"
            height="48"
            rx="1.5"
            fill="rgba(255,255,255,0.4)"
            transform="rotate(-8 110 44)"
          />
        </g>
      )}
    </g>
  );
}

function EspressoCup({ liquid, foam }: { liquid: string; foam?: string }) {
  const liquidDark = shade(liquid, -25);
  return (
    <g>
      {/* Saucer */}
      <ellipse cx="100" cy="205" rx="65" ry="9" fill="#F4EAE0" />
      <ellipse cx="100" cy="201" rx="60" ry="7" fill="#FFFFFF" />
      <ellipse cx="100" cy="201" rx="48" ry="4" fill="#EFE3D5" />

      {/* Handle */}
      <path
        d="M 148 135 Q 175 138 175 158 Q 175 178 148 180"
        stroke="#FFFFFF"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 148 142 Q 168 145 168 158 Q 168 172 148 174"
        stroke="#F0E2CD"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Cup body */}
      <path
        d="M 55 125 L 60 195 Q 62 202 70 202 L 130 202 Q 138 202 140 195 L 145 125 Z"
        fill="#FFFFFF"
      />
      {/* Cup right shadow */}
      <path
        d="M 130 130 L 138 195 Q 137 200 132 200 L 124 200 Z"
        fill="#F0E4D2"
      />

      {/* Coffee liquid (top view) */}
      <ellipse cx="100" cy="125" rx="45" ry="8" fill={liquidDark} />
      <ellipse cx="100" cy="123" rx="44" ry="7" fill={liquid} />

      {/* Foam ring on top */}
      {foam && (
        <>
          <ellipse cx="100" cy="121" rx="38" ry="6" fill={foam} />
          <ellipse cx="100" cy="121" rx="28" ry="4" fill={shade(foam, 15)} />
        </>
      )}
    </g>
  );
}

function Mug({ liquid, foam }: { liquid: string; foam?: string }) {
  const liquidDark = shade(liquid, -25);
  return (
    <g>
      {/* Handle */}
      <path
        d="M 153 115 Q 180 118 180 145 Q 180 175 153 178"
        stroke={shade(liquid, -45)}
        strokeWidth="11"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 153 122 Q 172 125 172 145 Q 172 168 153 171"
        stroke={liquid}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Body */}
      <path
        d="M 52 110 L 56 200 Q 58 212 72 212 L 128 212 Q 142 212 144 200 L 148 110 Z"
        fill={liquid}
      />
      {/* Subtle shadow on right */}
      <path
        d="M 132 115 L 144 198 Q 143 207 136 207 L 124 207 Z"
        fill={shade(liquid, -22)}
      />

      {/* Top rim */}
      <ellipse cx="100" cy="110" rx="48" ry="7" fill={shade(liquid, -35)} />
      <ellipse cx="100" cy="109" rx="48" ry="5" fill={liquidDark} />

      {/* Foam dome */}
      {foam && (
        <>
          <ellipse cx="100" cy="103" rx="46" ry="11" fill={foam} />
          <ellipse cx="100" cy="100" rx="40" ry="7" fill={shade(foam, 22)} />
          <ellipse cx="90" cy="98" rx="20" ry="3" fill="rgba(255,255,255,0.5)" />
        </>
      )}
    </g>
  );
}

function PaperCup({ liquid, foam }: { liquid: string; foam?: string }) {
  return (
    <g>
      {/* Cup body (trapezoid) */}
      <path
        d="M 60 70 L 70 210 Q 72 215 78 215 L 122 215 Q 128 215 130 210 L 140 70 Z"
        fill="#F1E7D8"
      />
      {/* shadow */}
      <path
        d="M 122 73 L 130 210 Q 129 213 124 213 L 116 213 Z"
        fill="#E5D6BF"
      />
      {/* sleeve */}
      <rect x="62" y="120" width="78" height="34" fill="#C29870" />
      <rect x="62" y="120" width="78" height="3" fill="#A87B52" />
      <rect x="62" y="151" width="78" height="3" fill="#A87B52" />
      <text
        x="100"
        y="143"
        textAnchor="middle"
        fill="#FFF"
        fontSize="10"
        fontWeight="700"
        fontFamily="ui-sans-serif"
      >
        juicy
      </text>

      {/* Lid */}
      <ellipse cx="100" cy="70" rx="42" ry="8" fill="#FFFFFF" />
      <path
        d="M 58 70 Q 58 55 100 55 Q 142 55 142 70"
        fill="#FFFFFF"
        stroke="#E8DCC8"
        strokeWidth="0.8"
      />
      {/* sip hole */}
      <ellipse cx="100" cy="58" rx="9" ry="3" fill={liquid} opacity="0.8" />

      {/* small liquid hint at sip */}
      {foam && <ellipse cx="100" cy="57" rx="6" ry="1.5" fill={foam} />}
    </g>
  );
}

function Tumbler({ uid, liquid }: { uid: string; liquid: string }) {
  const liqId = `tum-liq-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={liqId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor={shade(liquid, -22)} />
          <stop offset="55%" stopColor={liquid} />
          <stop offset="100%" stopColor={shade(liquid, 18)} />
        </linearGradient>
      </defs>
      {/* Body */}
      <path
        d="M 75 130 L 78 205 Q 80 215 92 215 L 108 215 Q 120 215 122 205 L 125 130 Z"
        fill={`url(#${liqId})`}
      />
      <ellipse cx="100" cy="130" rx="25" ry="4" fill={shade(liquid, -30)} />
      <ellipse cx="100" cy="129" rx="25" ry="3" fill={liquid} />
      {/* highlight */}
      <rect x="80" y="138" width="4" height="65" rx="2" fill="rgba(255,255,255,0.25)" />
    </g>
  );
}

function Bottle({ liquid }: { liquid: string }) {
  const liquidDark = shade(liquid, -25);
  return (
    <g>
      {/* Cap */}
      <rect x="86" y="28" width="28" height="22" rx="2" fill="#444A55" />
      <rect x="86" y="42" width="28" height="2" fill="#2A2F38" />
      {/* Neck */}
      <rect x="88" y="50" width="24" height="18" fill="#D9E4DE" opacity="0.6" />
      {/* Shoulder + body */}
      <path
        d="M 88 68 Q 70 80 64 105 L 64 200 Q 64 215 80 215 L 120 215 Q 136 215 136 200 L 136 105 Q 130 80 112 68 Z"
        fill={liquid}
      />
      {/* highlight */}
      <path
        d="M 72 110 Q 70 150 73 200"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Label */}
      <rect x="74" y="130" width="52" height="50" rx="4" fill="#FFFFFF" opacity="0.9" />
      <rect x="80" y="138" width="40" height="3" rx="1.5" fill={liquidDark} opacity="0.4" />
      <rect x="80" y="146" width="32" height="2.5" rx="1.5" fill={liquidDark} opacity="0.3" />
      <rect x="80" y="160" width="40" height="8" rx="2" fill={liquidDark} />
    </g>
  );
}

function SmoothieCup({
  uid,
  liquid,
  foam,
  straw,
}: {
  uid: string;
  liquid: string;
  foam?: string;
  straw?: boolean;
}) {
  const liquidDark = shade(liquid, -25);
  const liquidLight = shade(liquid, 20);
  const liqId = `sm-liq-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={liqId} x1="0" x2="1">
          <stop offset="0%" stopColor={liquidDark} />
          <stop offset="55%" stopColor={liquid} />
          <stop offset="100%" stopColor={liquidLight} />
        </linearGradient>
      </defs>

      {/* Cup body (wider rounded) */}
      <path
        d="M 58 78 L 64 200 Q 66 215 82 215 L 118 215 Q 134 215 136 200 L 142 78 Z"
        fill={`url(#${liqId})`}
      />
      {/* Highlight strip */}
      <rect x="64" y="92" width="6" height="115" rx="3" fill="rgba(255,255,255,0.22)" />

      {/* Top rim */}
      <ellipse cx="100" cy="78" rx="42" ry="7" fill={liquidDark} />
      <ellipse cx="100" cy="77" rx="42" ry="5" fill={liquid} />

      {/* Dome lid */}
      <path
        d="M 58 78 Q 100 30 142 78 Z"
        fill="rgba(220,228,232,0.55)"
        stroke="rgba(120,130,140,0.25)"
        strokeWidth="1"
      />
      <ellipse cx="100" cy="50" rx="24" ry="6" fill="rgba(255,255,255,0.35)" />

      {/* Foam blob visible through lid */}
      {foam && <ellipse cx="100" cy="72" rx="36" ry="7" fill={foam} opacity="0.85" />}

      {/* Straw */}
      {straw !== false && (
        <g>
          <rect
            x="106"
            y="14"
            width="8"
            height="55"
            rx="3"
            fill="#1F1F26"
            transform="rotate(-10 110 42)"
          />
          <rect
            x="107"
            y="14"
            width="3"
            height="55"
            rx="1.5"
            fill="rgba(255,255,255,0.3)"
            transform="rotate(-10 110 42)"
          />
        </g>
      )}
    </g>
  );
}

function Croissant({ uid }: { uid: string }) {
  const grId = `croi-${uid}`;
  return (
    <g>
      <defs>
        <linearGradient id={grId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#E8B567" />
          <stop offset="60%" stopColor="#C48B3B" />
          <stop offset="100%" stopColor="#8E5C20" />
        </linearGradient>
      </defs>
      {/* Crescent body */}
      <path
        d="M 40 130 Q 30 100 70 90 Q 100 86 130 90 Q 170 100 160 130 Q 155 160 130 165 Q 100 168 70 165 Q 45 160 40 130 Z"
        fill={`url(#${grId})`}
      />
      {/* Ridges */}
      <path d="M 70 100 Q 75 130 75 158" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M 90 95 Q 95 130 92 162" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M 110 95 Q 108 130 108 162" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      <path d="M 130 100 Q 128 130 128 160" stroke="#8E5C20" strokeWidth="2" fill="none" opacity="0.55" />
      {/* Highlights */}
      <path d="M 60 110 Q 80 100 100 100" stroke="#F2C681" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
    </g>
  );
}

function Sandwich() {
  return (
    <g>
      {/* Top bread */}
      <path
        d="M 35 100 Q 35 80 100 75 Q 165 80 165 100 L 165 115 L 35 115 Z"
        fill="#E5C18A"
      />
      <path d="M 35 100 Q 100 90 165 100" stroke="#C9A370" strokeWidth="1.5" fill="none" />
      {/* Lettuce */}
      <path
        d="M 30 115 Q 50 130 80 120 Q 110 130 140 120 Q 165 130 170 122 L 170 130 L 30 130 Z"
        fill="#7FB970"
      />
      {/* Cheese */}
      <rect x="30" y="130" width="140" height="14" fill="#F5D060" />
      {/* Meat */}
      <path
        d="M 30 144 L 170 144 L 170 158 Q 100 165 30 158 Z"
        fill="#C8615A"
      />
      {/* Bottom bread */}
      <path
        d="M 35 158 L 165 158 L 165 178 Q 165 195 100 198 Q 35 195 35 178 Z"
        fill="#D9B373"
      />
    </g>
  );
}

/* ===== Garnish ===== */

function Garnish({
  type,
  glass,
}: {
  type: GarnishType;
  glass: GlassType;
}) {
  // Position garnish based on glass type
  const onRim = ["tall", "smoothie", "mug", "tumbler"].includes(glass);
  const cx = 100;
  const cy = glass === "mug" ? 100 : glass === "tumbler" ? 130 : 55;

  if (type === "orange-slice") {
    return (
      <g transform={`translate(${cx + 18}, ${cy - 4}) rotate(15)`}>
        <circle cx="0" cy="0" r="15" fill="#FF9742" />
        <circle cx="0" cy="0" r="12" fill="#FFC373" />
        <g stroke="#FF9742" strokeWidth="1.5">
          <line x1="-12" y1="0" x2="12" y2="0" />
          <line x1="0" y1="-12" x2="0" y2="12" />
          <line x1="-9" y1="-9" x2="9" y2="9" />
          <line x1="-9" y1="9" x2="9" y2="-9" />
        </g>
        <circle cx="0" cy="0" r="2" fill="#FF9742" />
      </g>
    );
  }
  if (type === "lemon-slice") {
    return (
      <g transform={`translate(${cx + 16}, ${cy - 2}) rotate(20)`}>
        <circle cx="0" cy="0" r="14" fill="#F0CE3A" />
        <circle cx="0" cy="0" r="11" fill="#F8E48A" />
        <g stroke="#F0CE3A" strokeWidth="1.4">
          <line x1="-11" y1="0" x2="11" y2="0" />
          <line x1="0" y1="-11" x2="0" y2="11" />
          <line x1="-8" y1="-8" x2="8" y2="8" />
          <line x1="-8" y1="8" x2="8" y2="-8" />
        </g>
        <circle cx="0" cy="0" r="2" fill="#F0CE3A" />
      </g>
    );
  }
  if (type === "mint") {
    return (
      <g transform={`translate(${cx + 4}, ${onRim ? cy - 12 : 30})`}>
        <path d="M 0 0 Q -10 -14 -2 -22 Q 8 -14 0 0 Z" fill="#3A8C4B" />
        <path d="M 0 0 Q -10 -14 -2 -22" stroke="#256B30" strokeWidth="1" fill="none" />
        <path d="M 5 -3 Q 18 -8 18 -20 Q 5 -16 5 -3 Z" fill="#4DA463" />
        <path d="M 5 -3 Q 18 -8 18 -20" stroke="#2D7B3C" strokeWidth="1" fill="none" />
      </g>
    );
  }
  if (type === "leaf") {
    return (
      <g transform={`translate(${cx + 8}, ${onRim ? cy - 6 : 38}) rotate(-20)`}>
        <path d="M 0 0 Q -8 -12 0 -22 Q 8 -12 0 0 Z" fill="#5DA86B" />
        <line x1="0" y1="0" x2="0" y2="-22" stroke="#2F6E3C" strokeWidth="1.4" />
      </g>
    );
  }
  if (type === "pineapple-leaf") {
    return (
      <g transform={`translate(${cx - 6}, ${cy - 4})`}>
        <path d="M -10 0 Q -12 -22 -2 -28" stroke="#3A8C4B" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 0 0 Q 0 -28 6 -34" stroke="#4DA463" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 10 0 Q 14 -22 22 -28" stroke="#3A8C4B" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (type === "berry") {
    return (
      <g transform={`translate(${cx + 14}, ${onRim ? cy - 10 : 38})`}>
        <circle cx="0" cy="0" r="6" fill="#C13453" />
        <circle cx="-2" cy="-2" r="2" fill="rgba(255,255,255,0.4)" />
        <circle cx="9" cy="3" r="5" fill="#8E2541" />
        <path d="M 0 -6 L -2 -10 M 0 -6 L 2 -10" stroke="#2F6E3C" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
  }
  if (type === "cocoa") {
    return (
      <g transform={`translate(${cx - 28}, ${cy - 8})`}>
        <circle cx="0" cy="0" r="1.4" fill="#5B3E2A" />
        <circle cx="6" cy="3" r="1.2" fill="#5B3E2A" />
        <circle cx="14" cy="-2" r="1.6" fill="#5B3E2A" />
        <circle cx="22" cy="5" r="1.2" fill="#5B3E2A" />
        <circle cx="30" cy="0" r="1.6" fill="#5B3E2A" />
        <circle cx="42" cy="3" r="1.3" fill="#5B3E2A" />
        <circle cx="50" cy="-2" r="1.5" fill="#5B3E2A" />
      </g>
    );
  }
  if (type === "cinnamon") {
    return (
      <g transform={`translate(${cx + 12}, ${cy - 8}) rotate(-12)`}>
        <rect x="-3" y="-22" width="6" height="34" rx="2" fill="#8B5A2B" />
        <rect x="-3" y="-22" width="2" height="34" fill="#6B3E16" />
        <path d="M -3 -22 Q 0 -25 3 -22" stroke="#6B3E16" strokeWidth="1" fill="none" />
      </g>
    );
  }
  if (type === "flower") {
    return (
      <g transform={`translate(${cx - 10}, ${cy - 8})`}>
        <circle cx="0" cy="-4" r="4" fill="#B679C8" />
        <circle cx="6" cy="0" r="4" fill="#A664BA" />
        <circle cx="-6" cy="0" r="4" fill="#A664BA" />
        <circle cx="3" cy="-8" r="3.5" fill="#C58CD2" />
        <circle cx="-3" cy="-8" r="3.5" fill="#C58CD2" />
        <circle cx="0" cy="-3" r="2" fill="#FFE15E" />
      </g>
    );
  }
  if (type === "whipped") {
    return (
      <g>
        <ellipse cx={cx} cy={cy - 6} rx="38" ry="14" fill="#FFFFFF" />
        <ellipse cx={cx - 6} cy={cy - 14} rx="14" ry="10" fill="#FFFFFF" />
        <ellipse cx={cx + 8} cy={cy - 16} rx="10" ry="8" fill="#FFFFFF" />
        <ellipse cx={cx + 12} cy={cy - 22} rx="6" ry="5" fill="#FFFFFF" />
        <circle cx={cx + 12} cy={cy - 28} r="3" fill="#C13453" />
      </g>
    );
  }
  if (type === "nuts") {
    return (
      <g transform={`translate(${cx - 24}, ${cy - 6})`}>
        <ellipse cx="0" cy="0" rx="4" ry="3" fill="#A87142" transform="rotate(15)" />
        <ellipse cx="12" cy="3" rx="4" ry="3" fill="#B98453" transform="rotate(-20)" />
        <ellipse cx="22" cy="-2" rx="4" ry="3" fill="#955F2E" transform="rotate(35)" />
        <ellipse cx="36" cy="2" rx="4" ry="3" fill="#A87142" transform="rotate(-10)" />
        <ellipse cx="48" cy="-1" rx="4" ry="3" fill="#B98453" transform="rotate(20)" />
      </g>
    );
  }
  return null;
}
