// Styles du widget. Une seule feuille, injectée par le composant : le widget
// vit dans une iframe et ne dépend d'aucune feuille de style du site.
// Couleurs de Hormur : bleu nuit #323242, corail #EE6553 (réservé à l'action
// principale), fonds clairs neutres.

const styles = `
@font-face {
  font-family: 'Noto Sans';
  src: url('/fonts/notosans-regular-webfont.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Noto Sans';
  src: url('/fonts/notosans-semibold-webfont.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Noto Sans';
  src: url('/fonts/notosans-bold-webfont.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
.hw-root {
  --hw-ink: #323242;
  --hw-muted: #5F5F73;
  --hw-line: #E7E5E1;
  --hw-soft: #F6F4F1;
  --hw-brand: #EE6553;
  --hw-brand-dark: #E2543F;
  font-family: 'Noto Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--hw-ink);
  -webkit-text-size-adjust: 100%;
}
.hw-root *, .hw-root *::before, .hw-root *::after { box-sizing: border-box; }
.hw-root button { font-family: inherit; }

/* ───── Panneau ───── */
.hw-panel {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  overflow: hidden;
  z-index: 9999;
}
.hw-panel--fill { top: 0; right: 0; bottom: 0; left: 0; width: 100%; height: 100%; }
.hw-panel--float {
  width: min(420px, 90vw);
  height: min(640px, 85vh);
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(50, 50, 66, 0.22), 0 2px 8px rgba(50, 50, 66, 0.08);
  animation: hw-rise 0.22s ease-out;
}
.hw-panel--phone { top: 0; right: 0; left: 0; width: 100%; }

/* ───── En-tête ───── */
.hw-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 16px;
  min-height: 60px;
  border-bottom: 1px solid var(--hw-line);
  background: #FFFFFF;
}
.hw-logo {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--hw-soft);
}
.hw-logo img { display: block; width: 100%; height: 100%; object-fit: cover; }
.hw-titles { flex: 1 1 auto; min-width: 0; }
.hw-title { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.25; }
.hw-subtitle { margin: 1px 0 0; font-size: 12.5px; line-height: 1.3; color: var(--hw-muted); }
.hw-icon-btn {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--hw-ink);
  cursor: pointer;
  transition: background-color 0.15s;
}
.hw-icon-btn:hover { background: var(--hw-soft); }

/* ───── Fil de la conversation ───── */
.hw-thread {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px;
  background: #FFFFFF;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #D5D2CC transparent;
}
.hw-thread::-webkit-scrollbar { width: 6px; }
.hw-thread::-webkit-scrollbar-thumb { background: #D5D2CC; border-radius: 10px; }
.hw-thread::-webkit-scrollbar-track { background: transparent; }

.hw-row { display: flex; margin-bottom: 12px; scroll-margin-top: 12px; }
.hw-row--user { justify-content: flex-end; }
.hw-row--bot { flex-direction: column; align-items: flex-start; }
.hw-bubble {
  max-width: 92%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.hw-bubble p { margin: 0; white-space: pre-line; text-wrap: pretty; }
.hw-bubble p + p { margin-top: 6px; }
.hw-bubble--bot { background: var(--hw-soft); border-bottom-left-radius: 6px; }
.hw-bubble--user {
  max-width: 82%;
  background: var(--hw-ink);
  color: #FFFFFF;
  border-bottom-right-radius: 6px;
}

/* Lien proposé dans une réponse */
.hw-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  min-height: 40px;
  padding: 8px 16px;
  border: 1.5px solid var(--hw-ink);
  border-radius: 9999px;
  background: #FFFFFF;
  color: var(--hw-ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}
.hw-link:hover { background: var(--hw-ink); color: #FFFFFF; }

/* ───── Choix de départ ───── */
.hw-choices { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 10px; }
.hw-choice {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  border: 1px solid var(--hw-line);
  border-radius: 14px;
  background: #FFFFFF;
  color: var(--hw-ink);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.hw-choice:hover { border-color: var(--hw-ink); background: var(--hw-soft); }
.hw-choice-icon {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--hw-soft);
}
.hw-choice:hover .hw-choice-icon { background: #FFFFFF; }
.hw-choice-text { flex: 1 1 auto; min-width: 0; }
.hw-choice-label { display: block; font-size: 15px; font-weight: 600; line-height: 1.3; }
.hw-choice-desc { display: block; margin-top: 1px; font-size: 13px; line-height: 1.35; color: var(--hw-muted); text-wrap: balance; }
.hw-choice-chevron { flex: 0 0 auto; color: #9A9AA8; }

/* ───── Résultats ───── */
.hw-results { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 10px; }
.hw-card {
  display: flex;
  align-items: stretch;
  gap: 12px;
  width: 100%;
  padding: 8px;
  border: 1px solid var(--hw-line);
  border-radius: 16px;
  background: #FFFFFF;
  color: var(--hw-ink);
  text-decoration: none;
  transition: box-shadow 0.18s, border-color 0.18s, background-color 0.18s;
}
a.hw-card:hover {
  border-color: #CFCBC4;
  box-shadow: 0 6px 20px rgba(50, 50, 66, 0.10);
}
.hw-card-media {
  position: relative;
  flex: 0 0 104px;
  width: 104px;
  height: 104px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--hw-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9A9AA8;
}
.hw-card-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.hw-card-play {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(50, 50, 66, 0.78);
  color: #FFFFFF;
}
.hw-card-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 2px 4px 2px 0;
}
.hw-card-type {
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--hw-muted);
}
.hw-card-title {
  margin: 1px 0 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hw-card-meta { margin: 3px 0 0; font-size: 13px; line-height: 1.4; color: var(--hw-muted); }
.hw-card-price { margin: 3px 0 0; font-size: 13.5px; font-weight: 600; line-height: 1.4; }
.hw-card-arrow { flex: 0 0 auto; align-self: center; margin-right: 4px; color: #9A9AA8; }
a.hw-card:hover .hw-card-arrow { color: var(--hw-ink); }

/* Bouton secondaire (prise de rendez-vous) */
.hw-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  min-height: 44px;
  padding: 8px 18px;
  border: 1.5px solid var(--hw-ink);
  border-radius: 9999px;
  background: #FFFFFF;
  color: var(--hw-ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}
.hw-secondary:hover { background: var(--hw-ink); color: #FFFFFF; }

/* ───── Attente ───── */
.hw-typing { display: flex; align-items: center; gap: 10px; }
.hw-dots { display: inline-flex; gap: 5px; }
.hw-dots span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9A9AA8;
  animation: hw-bounce 1s infinite;
}
.hw-dots span:nth-child(2) { animation-delay: 0.15s; }
.hw-dots span:nth-child(3) { animation-delay: 0.3s; }
.hw-typing-text { font-size: 14px; color: var(--hw-muted); }

/* ───── Saisie ───── */
.hw-composer {
  flex: 0 0 auto;
  padding: 10px 12px 8px;
  border-top: 1px solid var(--hw-line);
  background: #FFFFFF;
}
.hw-composer-row { display: flex; align-items: center; gap: 8px; }
.hw-mic {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--hw-line);
  border-radius: 50%;
  background: #FFFFFF;
  color: var(--hw-ink);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.hw-mic:hover:not(:disabled) { border-color: var(--hw-ink); }
.hw-mic:disabled { opacity: 0.5; cursor: not-allowed; }
.hw-input {
  flex: 1 1 auto;
  min-width: 0;
  height: 44px;
  padding: 0 16px;
  border: 1.5px solid var(--hw-line);
  border-radius: 9999px;
  background: #FFFFFF;
  color: var(--hw-ink);
  font-family: inherit;
  font-size: 16px;
  outline: none;
  transition: border-color 0.15s;
  -webkit-appearance: none;
  appearance: none;
}
.hw-input::placeholder { color: #8A8A9A; opacity: 1; }
.hw-input:focus { border-color: var(--hw-ink); }
.hw-input:disabled { background: var(--hw-soft); }
.hw-send {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--hw-brand);
  color: #FFFFFF;
  cursor: pointer;
  transition: background-color 0.15s;
}
.hw-send:hover:not(:disabled) { background: var(--hw-brand-dark); }
.hw-send:disabled { background: var(--hw-line); color: #9A9AA8; cursor: not-allowed; }
.hw-notice {
  margin: 7px 4px 0;
  font-size: 11.5px;
  line-height: 1.4;
  text-align: center;
  text-wrap: balance;
  color: var(--hw-muted);
}

/* Enregistrement de la voix */
.hw-recording {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 4px;
  border: 1.5px solid var(--hw-ink);
  border-radius: 9999px;
  background: #FFFFFF;
}
.hw-rec-stop {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--hw-ink);
  color: #FFFFFF;
  cursor: pointer;
}
.hw-rec-send {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--hw-brand);
  color: #FFFFFF;
  cursor: pointer;
}
.hw-rec-send:hover { background: var(--hw-brand-dark); }
.hw-bars { flex: 1 1 auto; min-width: 0; height: 24px; display: flex; align-items: center; justify-content: center; gap: 3px; overflow: hidden; }
.hw-bars span { flex: 0 0 3px; width: 3px; border-radius: 2px; background: var(--hw-ink); transition: height 0.1s; }
.hw-transcribing {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 16px;
  border: 1.5px solid var(--hw-line);
  border-radius: 9999px;
  font-size: 14px;
  color: var(--hw-muted);
}

/* ───── Bouton flottant et voile (page de démonstration seulement) ───── */
.hw-fab {
  position: fixed;
  right: 20px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--hw-brand);
  color: #FFFFFF;
  box-shadow: 0 10px 25px rgba(50, 50, 66, 0.25);
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;
  z-index: 9999;
}
.hw-backdrop { position: fixed; inset: 0; background: rgba(50, 50, 66, 0.35); z-index: 9998; }

/* ───── Clavier ───── */
.hw-root button:focus-visible,
.hw-root a:focus-visible {
  outline: 2px solid var(--hw-ink);
  outline-offset: 2px;
}

@keyframes hw-rise {
  from { opacity: 0; transform: translate3d(0, 16px, 0); }
  to { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes hw-bounce {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -4px, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .hw-panel--float { animation: none; }
  .hw-dots span { animation: none; }
  .hw-card, .hw-choice, .hw-link, .hw-secondary { transition: none; }
}
`;

export default styles;
