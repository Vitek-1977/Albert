// Albert – milý pán kolem padesátky. Kreslený avatar se třemi náladami.
export function avatar(mood = 'neutral', size = 72) {
  const mouth = {
    neutral: '<path d="M50 80 Q60 86 70 80" stroke="#6b3a2a" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    happy: '<path d="M48 78 Q60 92 72 78 Z" fill="#7a2e22"/><path d="M51 79 Q60 83 69 79" fill="#fff"/>',
    hmm: '<path d="M52 82 Q60 80 69 83" stroke="#6b3a2a" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
  }[mood];
  const eyes = mood === 'happy'
    ? '<path d="M41 59 Q46 54 51 59" stroke="#2a2522" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M69 59 Q74 54 79 59" stroke="#2a2522" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    : '<circle cx="46" cy="58" r="3"/><circle cx="74" cy="58" r="3"/>';
  const brows = mood === 'hmm'
    ? '<path d="M38 46 Q46 41 53 45" /><path d="M67 48 Q74 46 82 49" />'
    : '<path d="M38 48 Q46 44 53 47" /><path d="M67 47 Q74 44 82 48" />';
  return `<svg class="albert-svg" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="Albert">
  <circle cx="60" cy="60" r="60" fill="var(--avatar-bg)"/>
  <clipPath id="ac"><circle cx="60" cy="60" r="60"/></clipPath>
  <g clip-path="url(#ac)">
    <path d="M14 120 Q18 96 40 92 L60 100 L80 92 Q102 96 106 120 Z" fill="#3e5a45"/>
    <path d="M40 92 L60 112 L80 92 L72 90 L60 100 L48 90 Z" fill="#eef1f4"/>
    <path d="M54 101 L60 106 L66 101 L66 112 L60 108 L54 112 Z" fill="#8c2f39"/>
    <path d="M60 106 L52 120 M60 106 L68 120" stroke="#2f4636" stroke-width="2"/>
    <rect x="51" y="82" width="18" height="14" rx="4" fill="#e5b48f"/>
    <ellipse cx="60" cy="60" rx="26" ry="30" fill="#f1c9a5"/>
    <ellipse cx="33" cy="62" rx="5" ry="8" fill="#e8b892"/>
    <ellipse cx="87" cy="62" rx="5" ry="8" fill="#e8b892"/>
    <path d="M33 58 Q31 38 42 32 Q60 24 78 32 Q89 38 87 58 Q84 46 80 42 Q72 36 66 38 Q58 33 50 38 Q40 40 36 52 Z" fill="#9a9a96"/>
    <path d="M33 58 Q32 50 36 44 L38 60 Z M87 58 Q88 50 84 44 L82 60 Z" fill="#b9b9b4"/>
    <g fill="none" stroke="#2a2522" stroke-width="2.2" stroke-linecap="round">${brows}</g>
    <g fill="#2a2522">${eyes}</g>
    <g fill="none" stroke="#3b3632" stroke-width="2.2">
      <circle cx="46" cy="58" r="9"/><circle cx="74" cy="58" r="9"/>
      <path d="M55 57 Q60 54 65 57"/><path d="M37 56 L33 54 M83 56 L87 54"/>
    </g>
    <path d="M57 64 Q60 70 63 64" stroke="#d29f7b" stroke-width="2" fill="none"/>
    <path d="M47 75 Q54 70 60 73 Q66 70 73 75 Q66 78 60 76 Q54 78 47 75 Z" fill="#a4a29c"/>
    ${mouth}
  </g>
</svg>`;
}
