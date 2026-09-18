export function getInitialsAvatar(name: string): string {
  const clean = (name || "U").trim().toUpperCase();
  const initials = clean.slice(0, 2);
  
  // Deterministic subtle dark/neutral background color
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bgColors = ["#18181b", "#27272a", "#1e293b", "#0f172a", "#292524", "#172554"];
  const bg = bgColors[Math.abs(hash) % bgColors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect width="64" height="64" rx="32" fill="${bg}" />
    <text x="32" y="38" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="600" fill="#f4f4f5" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
