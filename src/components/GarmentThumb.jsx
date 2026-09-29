const PATHS = {
  tee: 'M40,50 L40,35 L55,35 Q60,45 65,35 L80,35 L80,50 L95,60 L85,75 L80,68 L80,120 L40,120 L40,68 L35,75 L25,60 Z',
  coat: 'M35,38 L35,24 L52,24 L60,34 L68,24 L85,24 L85,38 L102,55 L90,70 L85,60 L85,136 L35,136 L35,60 L30,70 L18,55 Z',
  dress: 'M45,24 L58,24 Q60,30 62,24 L75,24 L82,46 L102,132 L18,132 L38,46 Z',
  skirt: 'M40,30 L80,30 L96,112 L24,112 Z',
};

export default function GarmentThumb({ piece, color, size = 96 }) {
  return (
    <svg viewBox="0 0 120 140" width={size} height={Math.round((size * 140) / 120)} role="img" aria-label={piece}>
      {piece === 'trousers' ? (
        <g stroke="rgba(0,0,0,0.16)" strokeWidth="1.5">
          <rect x="34" y="20" width="52" height="12" rx="2" fill={color} />
          <polygon points="38,32 58,32 55,124 41,124" fill={color} />
          <polygon points="62,32 82,32 79,124 65,124" fill={color} />
        </g>
      ) : (
        <path d={PATHS[piece] ?? PATHS.tee} fill={color} stroke="rgba(0,0,0,0.16)" strokeWidth="1.5" strokeLinejoin="round" />
      )}
    </svg>
  );
}
