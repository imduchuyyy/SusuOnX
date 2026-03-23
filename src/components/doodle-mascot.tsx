"use client";

/**
 * Friendly 2D hand-drawn doodle mascot for Long.AI
 * A cute blob-like character with a clover/leaf motif
 */

interface MascotProps {
  size?: number;
  className?: string;
  mood?: "happy" | "thinking" | "waving" | "sleeping";
}

export function DoodleMascot({ size = 48, className = "", mood = "happy" }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Body: rounded blob shape with hand-drawn feel */}
      <ellipse
        cx="60"
        cy="65"
        rx="38"
        ry="35"
        fill="#D1FAE5"
        stroke="#1F2937"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={mood === "sleeping" ? "0" : "0"}
      />

      {/* Leaf/sprout on head */}
      <path
        d="M58 30C58 30 52 18 42 16C42 16 52 12 58 22"
        fill="#6EE7B7"
        stroke="#1F2937"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M60 30C60 30 66 18 76 16C76 16 66 12 60 22"
        fill="#6EE7B7"
        stroke="#1F2937"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="59"
        y1="30"
        x2="59"
        y2="20"
        stroke="#1F2937"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Eyes */}
      {mood === "sleeping" ? (
        <>
          {/* Closed eyes - sleeping */}
          <path d="M42 58C42 58 47 55 52 58" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M68 58C68 58 73 55 78 58" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
          {/* Zzz */}
          <text x="82" y="42" fill="#6366F1" fontSize="12" fontWeight="bold" fontFamily="sans-serif">z</text>
          <text x="90" y="34" fill="#6366F1" fontSize="10" fontWeight="bold" fontFamily="sans-serif">z</text>
          <text x="96" y="28" fill="#6366F1" fontSize="8" fontWeight="bold" fontFamily="sans-serif">z</text>
        </>
      ) : (
        <>
          {/* Open eyes */}
          <ellipse cx="47" cy="58" rx="5.5" ry="6" fill="#1F2937" />
          <ellipse cx="73" cy="58" rx="5.5" ry="6" fill="#1F2937" />
          {/* Eye highlights */}
          <circle cx="49" cy="56" r="2" fill="white" />
          <circle cx="75" cy="56" r="2" fill="white" />
        </>
      )}

      {/* Mouth */}
      {mood === "happy" && (
        <path
          d="M52 72C52 72 57 78 68 72"
          stroke="#1F2937"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {mood === "thinking" && (
        <>
          <circle cx="62" cy="74" r="3" fill="#1F2937" />
          {/* Thought bubble dots */}
          <circle cx="88" cy="44" r="2.5" fill="#E0E7FF" stroke="#1F2937" strokeWidth="1.5" />
          <circle cx="94" cy="36" r="4" fill="#E0E7FF" stroke="#1F2937" strokeWidth="1.5" />
          <circle cx="102" cy="26" r="6" fill="#E0E7FF" stroke="#1F2937" strokeWidth="1.5" />
        </>
      )}
      {mood === "waving" && (
        <>
          <path
            d="M52 72C52 72 57 78 68 72"
            stroke="#1F2937"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Waving arm */}
          <path
            d="M95 55C100 48 108 44 112 48C116 52 108 56 104 58"
            stroke="#1F2937"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="#D1FAE5"
          />
        </>
      )}
      {mood === "sleeping" && (
        <path
          d="M54 73C54 73 58 76 66 73"
          stroke="#1F2937"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Cheek blush */}
      <ellipse cx="38" cy="68" rx="5" ry="3" fill="#FECDD3" opacity="0.6" />
      <ellipse cx="82" cy="68" rx="5" ry="3" fill="#FECDD3" opacity="0.6" />

      {/* Little feet */}
      <ellipse cx="48" cy="96" rx="8" ry="4" fill="#D1FAE5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="72" cy="96" rx="8" ry="4" fill="#D1FAE5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Small inline mascot icon for headers etc */
export function MascotIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Simple round body */}
      <circle cx="16" cy="18" r="11" fill="#D1FAE5" stroke="#1F2937" strokeWidth="1.5" />
      {/* Sprout */}
      <path d="M15 7C15 7 12 2 8 1C8 1 12 0 15 5" fill="#6EE7B7" stroke="#1F2937" strokeWidth="1" strokeLinecap="round" />
      <path d="M16 7C16 7 19 2 23 1C23 1 19 0 16 5" fill="#6EE7B7" stroke="#1F2937" strokeWidth="1" strokeLinecap="round" />
      {/* Eyes */}
      <circle cx="12.5" cy="16.5" r="2" fill="#1F2937" />
      <circle cx="19.5" cy="16.5" r="2" fill="#1F2937" />
      <circle cx="13.2" cy="15.8" r="0.7" fill="white" />
      <circle cx="20.2" cy="15.8" r="0.7" fill="white" />
      {/* Smile */}
      <path d="M13 21C13 21 15 23.5 19 21" stroke="#1F2937" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Blush */}
      <ellipse cx="10" cy="19.5" rx="2" ry="1" fill="#FECDD3" opacity="0.5" />
      <ellipse cx="22" cy="19.5" rx="2" ry="1" fill="#FECDD3" opacity="0.5" />
    </svg>
  );
}
