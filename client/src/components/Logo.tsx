import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-11 w-11', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 400 400" className={className} style={style} role="img" aria-label="PizzaCut logo">
      <defs>
        <path id="pc-top-arc" d="M 79 200 A 121 121 0 0 1 321 200" />
        <path id="pc-bottom-arc" d="M 38 200 A 162 162 0 0 0 362 200" />
      </defs>
      <circle cx="200" cy="200" r="198" fill="#29252A" />
      <circle cx="200" cy="200" r="176" fill="#FFFFFF" />
      <text fontFamily="Lilita One, Arial Black, sans-serif" fontSize="56" fill="#29252A" letterSpacing="7">
        <textPath href="#pc-top-arc" startOffset="50%" textAnchor="middle">PIZZA CUT</textPath>
      </text>
      <text fontFamily="Lilita One, Arial Black, sans-serif" fontSize="47" fill="#FF0018" letterSpacing="3">
        <textPath href="#pc-bottom-arc" startOffset="50%" textAnchor="middle">TASTE MAKER</textPath>
      </text>
      <circle cx="200" cy="204" r="74" fill="#FFFFFF" stroke="#FF0018" strokeWidth="11" />
      <circle cx="176" cy="188" r="19" fill="#29252A" />
      <circle cx="187" cy="181" r="7.5" fill="#FFFFFF" />
      <path d="M 224 190 C 229 173 249 171 256 186 C 247 179 233 181 224 190 Z" fill="#29252A" />
      <path d="M 158 212 C 165 252 241 256 251 209" fill="none" stroke="#FF0018" strokeWidth="14" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ size = 44, withWordmark = true, className = '' }: { size?: number; withWordmark?: boolean; className?: string }) {
  return (
    <Link to="/" className={`group flex items-center gap-2.5 ${className}`} aria-label="PizzaCut — go to home">
      <LogoMark className="transition-transform duration-300 group-hover:rotate-12" style={{ width: size, height: size }} />
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[22px] text-charcoal">PizzaCut</span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand">Taste Maker</span>
        </span>
      )}
    </Link>
  );
}
