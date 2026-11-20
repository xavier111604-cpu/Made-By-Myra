// Original placeholder illustration shown until the owner uploads a real hero photo
// (Dashboard → Homepage). Folded tees, a tote and a pink gift box.
export function HeroIllustration() {
  return (
    <svg viewBox="0 0 520 440" role="img" aria-label="Illustration of folded custom shirts, a tote bag and a pink gift box" className="h-full w-full">
      <defs>
        <linearGradient id="hbg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#FFF9F8" />
          <stop offset="1" stopColor="#F6DCE0" />
        </linearGradient>
      </defs>
      <rect width="520" height="440" rx="36" fill="url(#hbg)" />
      {/* tote */}
      <g transform="translate(300 70)">
        <path d="M40 40 C40 0 120 0 120 40" stroke="#BB9255" strokeWidth="6" fill="none" strokeLinecap="round" />
        <rect x="10" y="40" width="140" height="160" rx="10" fill="#FFFDF8" stroke="#EFE5E3" strokeWidth="2" />
        <path d="M80 135c-14-10-26-19-25-31 1-8 8-13 15-11 4 1 7 4 9 8 2-4 6-8 11-8 8 0 13 7 11 14-2 11-12 18-21 28" stroke="#E8B5C0" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      {/* folded tee stack */}
      <g transform="translate(60 210)">
        <rect x="0" y="120" width="220" height="56" rx="10" fill="#FFFFFF" stroke="#EFE5E3" strokeWidth="2" />
        <rect x="8" y="70" width="210" height="56" rx="10" fill="#EBC2CA" />
        <rect x="4" y="20" width="214" height="56" rx="10" fill="#302A29" />
        <path d="M86 20 C96 36 126 36 136 20" stroke="#FFF9F8" strokeWidth="3" fill="none" />
        <text x="111" y="58" textAnchor="middle" fontFamily="cursive" fontSize="18" fill="#FFF9F8">you ♡</text>
        <path d="M90 70 C100 84 120 84 130 70" stroke="#FFFFFF" strokeWidth="3" fill="none" />
      </g>
      {/* gift box */}
      <g transform="translate(330 290)">
        <rect x="0" y="30" width="130" height="90" rx="8" fill="#F6DCE0" stroke="#EBC2CA" strokeWidth="2" />
        <rect x="-6" y="16" width="142" height="26" rx="6" fill="#EBC2CA" />
        <rect x="56" y="16" width="18" height="104" fill="#BB9255" opacity="0.85" />
        <path d="M65 16 C40 -10 20 6 40 16 M65 16 C90 -10 110 6 90 16" stroke="#BB9255" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
      {/* little hearts */}
      <path d="M95 95c-8-6-15-11-14-18 0-5 5-8 9-6 2 1 4 2 5 5 1-3 4-5 7-5 5 0 8 4 7 9-1 6-7 10-14 15" stroke="#E8B5C0" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M250 60c-5-4-10-7-9-12 0-3 3-5 6-4l3 3c1-2 3-3 5-3 3 0 5 3 4 6-1 4-5 7-9 10" stroke="#BB9255" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
