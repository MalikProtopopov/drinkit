"use client";

export type OutletScene =
  | "business-bay"
  | "downtown"
  | "marina"
  | "mall"
  | "creek";

export function OutletArt({
  scene,
  size = 400,
  className,
}: {
  scene: OutletScene;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 200"
      width={size}
      height={size / 2}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {scene === "business-bay" && <BusinessBay />}
      {scene === "downtown" && <Downtown />}
      {scene === "marina" && <Marina />}
      {scene === "mall" && <Mall />}
      {scene === "creek" && <Creek />}
    </svg>
  );
}

function Sky({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id})`} />
    </>
  );
}

function BusinessBay() {
  return (
    <>
      <Sky id="sky-bb" from="#F5D9C0" to="#EFC9A8" />
      {/* Sun */}
      <circle cx="320" cy="60" r="22" fill="#FFE3B8" />
      <circle cx="320" cy="60" r="14" fill="#FFD193" />
      {/* Skyline back */}
      <g fill="#C29671" opacity="0.85">
        <rect x="20" y="100" width="38" height="80" />
        <rect x="60" y="80" width="42" height="100" />
        <rect x="105" y="110" width="32" height="70" />
        <rect x="140" y="70" width="48" height="110" />
        <rect x="190" y="95" width="36" height="85" />
        <rect x="230" y="120" width="28" height="60" />
        <rect x="262" y="85" width="44" height="95" />
        <rect x="310" y="105" width="36" height="75" />
        <rect x="350" y="115" width="40" height="65" />
      </g>
      {/* Skyline front */}
      <g fill="#8E5C42">
        <rect x="0" y="135" width="50" height="65" />
        <rect x="55" y="120" width="30" height="80" />
        <rect x="90" y="140" width="60" height="60" />
        <rect x="155" y="115" width="46" height="85" />
        <rect x="205" y="135" width="40" height="65" />
        <rect x="250" y="125" width="52" height="75" />
        <rect x="307" y="140" width="38" height="60" />
        <rect x="350" y="130" width="50" height="70" />
      </g>
      {/* Lit windows */}
      <g fill="#F5D193" opacity="0.9">
        {Array.from({ length: 28 }).map((_, i) => {
          const x = 8 + (i % 14) * 28;
          const y = 145 + Math.floor(i / 14) * 14;
          return <rect key={i} x={x} y={y} width="3" height="6" />;
        })}
      </g>
      {/* Ground */}
      <rect y="185" width="400" height="15" fill="#5E3D2C" />
    </>
  );
}

function Downtown() {
  return (
    <>
      <Sky id="sky-dt" from="#E8DCF0" to="#D8C8E0" />
      {/* Central tall building (Burj-style) */}
      <path
        d="M 200 25 L 192 200 L 208 200 Z"
        fill="#A98DC0"
      />
      <path d="M 200 25 L 195 100 L 205 100 Z" fill="#8770A0" />
      {/* Side towers */}
      <g fill="#8C6FA8" opacity="0.85">
        <rect x="120" y="80" width="40" height="120" />
        <rect x="165" y="60" width="28" height="140" />
        <rect x="215" y="65" width="32" height="135" />
        <rect x="255" y="90" width="38" height="110" />
      </g>
      <g fill="#6E5290">
        <rect x="60" y="120" width="50" height="80" />
        <rect x="295" y="105" width="55" height="95" />
        <rect x="355" y="135" width="45" height="65" />
        <rect x="0" y="140" width="55" height="60" />
      </g>
      {/* Windows */}
      <g fill="#F5E4D0" opacity="0.85">
        {Array.from({ length: 22 }).map((_, i) => {
          const x = 6 + (i % 11) * 36;
          const y = 150 + Math.floor(i / 11) * 16;
          return <rect key={i} x={x} y={y} width="4" height="7" />;
        })}
      </g>
      <rect y="185" width="400" height="15" fill="#3F2E55" />
    </>
  );
}

function Marina() {
  return (
    <>
      <Sky id="sky-mr" from="#BFE0EA" to="#7CB6CA" />
      {/* Distant towers */}
      <g fill="#3D6E80" opacity="0.85">
        <rect x="30" y="60" width="34" height="120" />
        <rect x="70" y="40" width="28" height="140" />
        <rect x="105" y="70" width="44" height="110" />
        <rect x="155" y="55" width="30" height="125" />
        <rect x="190" y="80" width="38" height="100" />
        <rect x="235" y="50" width="32" height="130" />
        <rect x="275" y="65" width="46" height="115" />
        <rect x="325" y="80" width="32" height="100" />
        <rect x="360" y="60" width="38" height="120" />
      </g>
      {/* Water */}
      <rect y="155" width="400" height="35" fill="#3F8AA3" />
      <g stroke="#76B5C8" strokeWidth="1.5" fill="none" opacity="0.7">
        <path d="M 0 168 Q 50 165 100 168 T 200 168 T 300 168 T 400 168" />
        <path d="M 0 178 Q 50 175 100 178 T 200 178 T 300 178 T 400 178" />
      </g>
      {/* Sailboat */}
      <g transform="translate(85, 140)">
        <path d="M -16 18 L 16 18 L 12 25 L -12 25 Z" fill="#FFFFFF" />
        <line x1="0" y1="18" x2="0" y2="-8" stroke="#8B6E4F" strokeWidth="1.5" />
        <path d="M 0 -8 L 0 16 L 14 16 Z" fill="#FFFFFF" />
        <path d="M 0 -8 L 0 16 L -12 16 Z" fill="#F5E4D0" />
      </g>
      <rect y="190" width="400" height="10" fill="#1F4E5A" />
    </>
  );
}

function Mall() {
  return (
    <>
      <Sky id="sky-ml" from="#FCE3CB" to="#F2C089" />
      {/* Distant towers */}
      <g fill="#C49869" opacity="0.7">
        <rect x="20" y="100" width="32" height="80" />
        <rect x="350" y="110" width="36" height="70" />
      </g>
      {/* Mall building - long wide */}
      <rect x="50" y="80" width="300" height="105" fill="#F5EFE7" />
      <rect x="50" y="80" width="300" height="14" fill="#D8C7A9" />
      {/* Glass facade */}
      <g fill="#7BAFC6" opacity="0.75">
        <rect x="62" y="98" width="48" height="62" rx="2" />
        <rect x="116" y="98" width="48" height="62" rx="2" />
        <rect x="170" y="98" width="48" height="62" rx="2" />
        <rect x="224" y="98" width="48" height="62" rx="2" />
        <rect x="278" y="98" width="60" height="62" rx="2" />
      </g>
      {/* Entrance */}
      <rect x="184" y="140" width="32" height="45" fill="#3D5466" />
      <rect x="184" y="140" width="32" height="6" fill="#1F2D3A" />
      {/* Roof signage */}
      <rect x="170" y="65" width="60" height="20" rx="3" fill="#4A56E2" />
      <text x="200" y="80" textAnchor="middle" fill="#FFF" fontSize="11" fontWeight="700">
        mall
      </text>
      <rect y="185" width="400" height="15" fill="#7B5E3A" />
    </>
  );
}

function Creek() {
  return (
    <>
      <Sky id="sky-ck" from="#CFE8F0" to="#F5D6B3" />
      {/* Sun */}
      <circle cx="100" cy="55" r="20" fill="#FFD58A" />
      {/* Mosque silhouette */}
      <g fill="#7A6098">
        <circle cx="170" cy="120" r="22" />
        <rect x="148" y="120" width="44" height="65" />
        <rect x="155" y="80" width="3" height="40" />
        <circle cx="156.5" cy="76" r="4" />
        <rect x="186" y="80" width="3" height="40" />
        <circle cx="187.5" cy="76" r="4" />
      </g>
      <g fill="#5A4070" opacity="0.7">
        <rect x="220" y="110" width="40" height="75" />
        <rect x="265" y="95" width="34" height="90" />
        <rect x="305" y="130" width="50" height="55" />
      </g>
      {/* Water */}
      <rect y="170" width="400" height="20" fill="#5C7FA0" />
      <g stroke="#A8C2D5" strokeWidth="1.5" fill="none" opacity="0.7">
        <path d="M 0 178 Q 60 175 120 178 T 240 178 T 360 178 T 400 178" />
      </g>
      <rect y="190" width="400" height="10" fill="#3B5269" />
    </>
  );
}
