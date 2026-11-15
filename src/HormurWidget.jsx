import React, { useState, useRef, useEffect } from 'react';
import {
  X, Send, Mic, Square, RotateCcw, ChevronRight, ArrowUpRight,
  Calendar, Music, Home, Ticket, Play, Image as ImageIcon, MessageCircle
} from 'lucide-react';
import styles from './widgetStyles';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Réglages
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CHAT_URL = '/.netlify/functions/chat';
const CACHE_DURATION = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 28000;
// Conversation gardée le temps de la visite : fermer puis rouvrir le widget,
// ou changer de page, ne fait pas perdre les résultats.
const CONVERSATION_KEY = 'hormur_widget_conversation_v2';
const MAX_SAVED_MESSAGES = 40;
// Marge gardée en bas sur téléphone quand le site hôte ne gère pas lui-même
// la hauteur visible (ancienne intégration).
const LEGACY_BOTTOM_MARGIN = 80;

const WELCOME = 'Bonjour ! Que cherchez-vous sur Hormur ?';

// Les trois recherches possibles. La clef « profile » est celle attendue par
// l'agent : qui cherche un artiste est un hôte, qui cherche un lieu est un
// artiste, qui cherche un événement est un spectateur.
const CHOICES = [
  {
    profile: 'spectateur',
    Icon: Ticket,
    label: 'Un événement',
    desc: 'Concert, spectacle ou exposition près de chez vous',
    said: 'Je cherche un événement',
    reply: 'Dans quelle ville, et pour quand ?',
    placeholder: 'Ex. : Lyon, ce week-end'
  },
  {
    profile: 'hote',
    Icon: Music,
    label: 'Un artiste',
    desc: 'Pour une soirée chez vous ou dans votre lieu',
    said: 'Je cherche un artiste',
    reply: "Dans quelle ville, et quel type d'artiste cherchez-vous ? (musique, théâtre…)",
    placeholder: 'Ex. : Nantes, un duo de jazz'
  },
  {
    profile: 'artiste',
    Icon: Home,
    label: 'Un lieu',
    desc: 'Pour présenter votre art',
    said: 'Je cherche un lieu',
    reply: 'Dans quelle ville, et quel type de lieu cherchez-vous pour votre art ? (appartement, jardin…)',
    placeholder: 'Ex. : Bordeaux, un salon ou un jardin'
  }
];

const TYPE_LABELS = {
  artiste: 'Artiste',
  artist: 'Artiste',
  lieu: 'Lieu',
  place: 'Lieu',
  evenement: 'Événement',
  'événement': 'Événement',
  event: 'Événement'
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Outils
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadConversation = () => {
  try {
    const raw = sessionStorage.getItem(CONVERSATION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.messages) || saved.messages.length === 0) return null;
    return saved;
  } catch (e) {
    return null;
  }
};

const saveConversation = (conversation) => {
  try {
    sessionStorage.setItem(CONVERSATION_KEY, JSON.stringify(conversation));
  } catch (e) { /* stockage indisponible : la conversation vit le temps de l'onglet */ }
};

const clearConversation = () => {
  try {
    sessionStorage.removeItem(CONVERSATION_KEY);
  } catch (e) { /* rien à effacer */ }
};

const getCacheKey = (message, profile) => {
  const normalized = message.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .sort()
    .join('_');
  return `hormur_cache_${profile}_${normalized}`;
};

const getCachedResponse = (message, profile) => {
  try {
    const cacheKey = getCacheKey(message, profile);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
};

const setCachedResponse = (message, profile, data) => {
  try {
    localStorage.setItem(getCacheKey(message, profile), JSON.stringify({ data, timestamp: Date.now() }));
    const allKeys = Object.keys(localStorage).filter((k) => k.startsWith('hormur_cache_'));
    if (allKeys.length > 50) {
      allKeys.slice(0, allKeys.length - 50).forEach((k) => localStorage.removeItem(k));
    }
  } catch (e) { /* stockage indisponible : pas de mémoire des réponses */ }
};

const extractYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

// Format d'enregistrement accepté par le navigateur (Safari n'écrit pas de webm).
const pickAudioMime = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch (e) { /* navigateur sans isTypeSupported */ }
  }
  return '';
};

const canRecordAudio = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function' &&
  typeof MediaRecorder !== 'undefined';

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

const readHostManaged = () => {
  try {
    return new URLSearchParams(window.location.search).get('v') === '2';
  } catch (e) {
    return false;
  }
};

const isCoarsePointer = () => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Morceaux d'affichage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Texte d'une réponse, avec les liens markdown [texte](url) rendus en boutons.
const MessageContent = ({ content }) => {
  if (!content) return null;
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) parts.push({ type: 'text', value: before.trim() });
    parts.push({ type: 'link', label: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }
  const rest = content.slice(lastIndex);
  if (rest.trim()) parts.push({ type: 'text', value: rest.trim() });

  return (
    <>
      {parts.map((part, i) => (part.type === 'text' ? (
        <p key={i}>{part.value}</p>
      ) : (
        <a key={i} className="hw-link" href={part.url} target="_blank" rel="noopener noreferrer">
          {part.label}
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      )))}
    </>
  );
};

const ResultCard = ({ result }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const youtubeId = extractYouTubeId(result.video_url);
  const image = result.image_url || (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null);
  const typeLabel = TYPE_LABELS[String(result.type || '').toLowerCase()];
  const meta = [result.city, result.date].filter(Boolean).join(' · ');
  const title = result.title || 'Sans titre';

  const inner = (
    <>
      <div className="hw-card-media">
        {image && !imageFailed ? (
          <img src={image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <ImageIcon size={26} aria-hidden="true" />
        )}
        {youtubeId && <span className="hw-card-play" aria-hidden="true"><Play size={12} fill="currentColor" /></span>}
      </div>
      <div className="hw-card-body">
        {typeLabel && <span className="hw-card-type">{typeLabel}</span>}
        <h4 className="hw-card-title">{title}</h4>
        {meta && <p className="hw-card-meta">{meta}</p>}
        {result.genre && <p className="hw-card-meta">{result.genre}</p>}
        {result.visualPrice && <p className="hw-card-price">{result.visualPrice}</p>}
      </div>
      {result.url && <ChevronRight className="hw-card-arrow" size={18} aria-hidden="true" />}
    </>
  );

  if (!result.url) return <div className="hw-card">{inner}</div>;

  return (
    <a
      className="hw-card"
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title}, voir la fiche (nouvel onglet)`}
    >
      {inner}
    </a>
  );
};

const CalendlyButton = ({ profile }) => {
  const button = profile === 'artiste'
    ? { label: 'Discuter avec Éléonore', url: 'https://calendly.com/eleonore-hormur/15min' }
    : { label: 'Échanger avec Martin', url: 'https://calendly.com/martin-jeudy/15min' };

  return (
    <a className="hw-secondary" href={button.url} target="_blank" rel="noopener noreferrer">
      <Calendar size={16} aria-hidden="true" />
      {button.label}
    </a>
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Widget
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const HormurWidget = ({ isEmbed = false, bottomOffset = 20 }) => {
  const [initial] = useState(loadConversation);
  const [hostManaged] = useState(() => isEmbed && readHostManaged());
  const [recordingSupported] = useState(canRecordAudio);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => (initial ? initial.messages : []));
  const [inputValue, setInputValue] = useState('');
  const [userProfile, setUserProfile] = useState(() => (initial ? initial.userProfile || null : null));
  const [sessionId, setSessionId] = useState(() => (initial ? initial.sessionId || null : null));
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  }));

  const threadEndRef = useRef(null);
  const lastBotRef = useRef(null);
  const inputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  const activeChoice = CHOICES.find((choice) => choice.profile === userProfile);
  const hasConversation = messages.some((message) => message.type === 'user');
  const busy = isLoading || isTranscribing;
  const canSend = inputValue.trim().length > 0 && !busy;

  // ───── Conversation ─────

  const pushMessages = (...added) => setMessages((prev) => [...prev, ...added]);

  const botReply = (data) => ({
    type: 'bot',
    content: data.message || "Désolé, je n'ai pas de réponse.",
    results: Array.isArray(data.results) ? data.results : [],
    showCalendly: data.showCalendly === true
  });

  const botError = (content) => ({ type: 'bot', content, results: [], showCalendly: true });

  const requestChat = async (body, signal) => {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        userProfile: userProfile || 'indefini',
        sessionId: sessionId || null,
        timestamp: new Date().toISOString(),
        ...body
      }),
      signal
    });
    return response;
  };

  const handleSendMessage = async () => {
    const userMessage = inputValue.trim();
    if (!userMessage || busy) return;

    setInputValue('');
    pushMessages({ type: 'user', content: userMessage });
    setIsLoading(true);

    try {
      const cached = getCachedResponse(userMessage, userProfile || 'indefini');
      if (cached) {
        pushMessages(botReply(cached));
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      let response;
      try {
        response = await requestChat({ message: userMessage, audioData: null }, controller.signal);
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) throw new Error('HTTP ' + response.status);

      const data = await response.json();
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      if (data.results && data.results.length > 0) {
        setCachedResponse(userMessage, userProfile || 'indefini', {
          message: data.message,
          results: data.results,
          showCalendly: data.showCalendly
        });
      }

      pushMessages(botReply(data));
    } catch (error) {
      pushMessages(botError(error.name === 'AbortError'
        ? 'La recherche a pris trop de temps. Pouvez-vous réessayer avec une demande plus courte ?'
        : "La recherche n'a pas abouti. Pouvez-vous réessayer ?"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoice = (choice) => {
    setUserProfile(choice.profile);
    pushMessages(
      { type: 'user', content: choice.said },
      { type: 'bot', content: choice.reply }
    );
    if (!isCoarsePointer() && inputRef.current) inputRef.current.focus();
  };

  const handleReset = () => {
    if (isRecording) cancelRecording();
    clearConversation();
    setMessages([]);
    setUserProfile(null);
    setSessionId(null);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ───── Voix ─────

  const releaseAudio = (recorder) => {
    try {
      if (recorder && recorder.stream) recorder.stream.getTracks().forEach((track) => track.stop());
    } catch (e) { /* flux déjà fermé */ }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { /* déjà fermé */ }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const analyzeAudio = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(Math.min(100, average / 1.28));
    animationFrameRef.current = requestAnimationFrame(analyzeAudio);
  };

  const startRecording = async () => {
    if (busy || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setInputValue('');

      // Niveau sonore pour l'animation ; l'enregistrement fonctionne sans.
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
        analyserRef.current = audioContextRef.current.createAnalyser();
        audioContextRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
        analyserRef.current.fftSize = 256;
        analyzeAudio();
      } catch (e) { /* pas d'animation du niveau sonore */ }

      const mimeType = pickAudioMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => releaseAudio(recorder);
      recorder.start(100);
      setIsRecording(true);
    } catch (error) {
      pushMessages({
        type: 'bot',
        content: "Le micro n'est pas accessible. Autorisez-le dans votre navigateur, ou écrivez votre message."
      });
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => releaseAudio(recorder);
      try { recorder.stop(); } catch (e) { releaseAudio(recorder); }
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setAudioLevel(0);
  };

  // Fin de l'enregistrement. sendAfter=false : le texte reconnu est posé dans
  // le champ pour relecture. sendAfter=true : il est envoyé directement.
  const finishRecording = (sendAfter) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;

    recorder.onstop = async () => {
      const mimeType = recorder.mimeType || pickAudioMime() || 'audio/webm';
      releaseAudio(recorder);
      setIsRecording(false);
      setAudioLevel(0);

      // Laisse arriver les derniers morceaux
      await wait(200);
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      if (chunks.length === 0) return;

      const audioBlob = new Blob(chunks, { type: mimeType });
      if (audioBlob.size < 1000) return;

      setIsTranscribing(true);
      try {
        const audioData = await blobToBase64(audioBlob);
        const response = await requestChat({
          message: '',
          audioData,
          audioMime: mimeType,
          transcribeOnly: !sendAfter
        });
        const data = await response.json();
        const text = (data.transcribedText || '').trim();

        if (!text) {
          pushMessages({
            type: 'bot',
            content: data.message || "Je n'ai pas compris l'enregistrement. Pouvez-vous réessayer, ou écrire votre message ?"
          });
          return;
        }

        if (!sendAfter) {
          setInputValue(text);
          if (inputRef.current) inputRef.current.focus();
          return;
        }

        if (data.sessionId && !sessionId) setSessionId(data.sessionId);
        pushMessages({ type: 'user', content: text, isVocal: true }, botReply(data));
      } catch (error) {
        pushMessages(botError("L'enregistrement n'a pas pu être envoyé. Pouvez-vous réessayer, ou écrire votre message ?"));
      } finally {
        setIsTranscribing(false);
      }
    };

    try {
      recorder.stop();
    } catch (e) {
      cancelRecording();
    }
  };

  // ───── Effets ─────

  // Message d'accueil
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ type: 'bot', content: WELCOME, showProfileButtons: true }]);
    }
  }, [isOpen, messages.length]);

  // Mémoire de la conversation pendant la visite
  useEffect(() => {
    if (!hasConversation) return;
    saveConversation({
      messages: messages.slice(-MAX_SAVED_MESSAGES),
      userProfile,
      sessionId
    });
  }, [messages, userProfile, sessionId, hasConversation]);

  // Défilement : une réponse se lit depuis son début (sa phrase puis ses
  // résultats) ; pour le reste, le dernier message reste visible.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!isLoading && last && last.type === 'bot' && lastBotRef.current && messages.length > 1) {
      lastBotRef.current.scrollIntoView({ block: 'start' });
    } else if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ block: 'end' });
    }
  }, [messages, isLoading, isOpen]);

  // Texte d'attente qui évolue pendant une recherche longue
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      // Le champ, désactivé pendant la recherche, reprend la main au clavier
      if (isOpen && !isCoarsePointer() && inputRef.current) inputRef.current.focus();
      return undefined;
    }
    const first = setTimeout(() => setLoadingStep(1), 4000);
    const second = setTimeout(() => setLoadingStep(2), 13000);
    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [isLoading, isOpen]);

  // Notifier le parent (iframe) de l'état ouvert/fermé
  useEffect(() => {
    if (isEmbed && window.parent !== window) {
      window.parent.postMessage({ type: 'HORMUR_WIDGET_STATE', isOpen }, '*');
    }
  }, [isOpen, isEmbed]);

  // Commandes d'ouverture/fermeture envoyées par le parent (mode embed)
  useEffect(() => {
    if (!isEmbed) return undefined;
    const handleParentCommand = (event) => {
      if (!event.data || !event.data.type) return;
      if (event.data.type === 'HORMUR_WIDGET_OPEN') setIsOpen(true);
      if (event.data.type === 'HORMUR_WIDGET_CLOSE') setIsOpen(false);
    };
    window.addEventListener('message', handleParentCommand);
    return () => window.removeEventListener('message', handleParentCommand);
  }, [isEmbed]);

  // Échap ferme le widget ; à l'ouverture sur ordinateur, le champ est prêt
  useEffect(() => {
    if (!isOpen) return undefined;
    if (!isCoarsePointer() && inputRef.current) inputRef.current.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Taille visible de la fenêtre (barre du navigateur, clavier)
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      setViewport({
        width: window.innerWidth,
        height: Math.round(vv ? vv.height : window.innerHeight)
      });
    };
    update();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', update);
      window.visualViewport.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', update);
        window.visualViewport.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
    };
  }, []);

  // Micro libéré si le widget est retiré en cours d'enregistrement
  useEffect(() => () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try { recorder.stop(); } catch (e) { /* déjà arrêté */ }
    }
    releaseAudio(recorder);
  }, []);

  // ───── Cadre du panneau ─────
  // v=2 (site hôte récent) : le site gère le cadre, le widget remplit l'iframe.
  // Ancienne intégration : même chose sur ordinateur ; sur téléphone, une
  // marge basse garde la saisie au-dessus de la barre du navigateur.
  // Page de démonstration : panneau flottant, plein écran sur téléphone.

  const narrow = viewport.width <= 768;
  let panelClass = 'hw-panel';
  let panelStyle;

  if (isEmbed) {
    if (!hostManaged && narrow && isCoarsePointer()) {
      const height = Math.max(240, viewport.height - LEGACY_BOTTOM_MARGIN);
      panelClass += ' hw-panel--phone';
      panelStyle = { height: `${height}px` };
    } else {
      panelClass += ' hw-panel--fill';
    }
  } else if (narrow) {
    panelClass += ' hw-panel--phone';
    panelStyle = { height: `${viewport.height}px` };
  } else {
    panelClass += ' hw-panel--float';
    panelStyle = { right: '20px', bottom: `${bottomOffset}px` };
  }

  // L'exemple guide la première demande ; ensuite le champ redevient neutre.
  const typedMessages = messages.filter((m) => m.type === 'user').length - (activeChoice ? 1 : 0);
  let placeholder = 'Décrivez ce que vous cherchez';
  if (isLoading) placeholder = 'Recherche en cours';
  else if (typedMessages > 0) placeholder = 'Précisez votre recherche';
  else if (activeChoice) placeholder = activeChoice.placeholder;

  const loadingText = ['', 'Recherche en cours', 'Encore quelques secondes'][loadingStep];

  return (
    <div className="hw-root">
      <style>{styles}</style>

      {/* Bouton flottant : page de démonstration seulement. En mode embed,
          c'est le site hôte qui ouvre le widget. */}
      {!isEmbed && !isOpen && (
        <button
          type="button"
          className="hw-fab"
          style={{ bottom: `${bottomOffset}px` }}
          onClick={() => setIsOpen(true)}
          aria-label="Ouvrir la recherche IA"
        >
          <MessageCircle size={26} aria-hidden="true" />
        </button>
      )}

      {isOpen && (
        <>
          {!isEmbed && <div className="hw-backdrop" onClick={() => setIsOpen(false)} />}

          <div className={panelClass} style={panelStyle} role="dialog" aria-label="Recherche IA Hormur">
            <header className="hw-header">
              <div className="hw-logo">
                <img
                  src="/icone logo hormur.svg"
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div className="hw-titles">
                <h3 className="hw-title">Recherche IA</h3>
                <p className="hw-subtitle">Artistes, lieux et événements</p>
              </div>
              {hasConversation && (
                <button
                  type="button"
                  className="hw-icon-btn"
                  onClick={handleReset}
                  aria-label="Nouvelle recherche"
                  title="Nouvelle recherche"
                >
                  <RotateCcw size={19} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="hw-icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </header>

            <div className="hw-thread" role="log" aria-live="polite">
              {messages.map((message, idx) => (message.type === 'bot' ? (
                <div
                  key={idx}
                  className="hw-row hw-row--bot"
                  ref={idx === messages.length - 1 ? lastBotRef : null}
                >
                  <div className="hw-bubble hw-bubble--bot">
                    <MessageContent content={message.content} />
                  </div>

                  {message.showProfileButtons && !userProfile && (
                    <div className="hw-choices">
                      {CHOICES.map((choice) => (
                        <button
                          key={choice.profile}
                          type="button"
                          className="hw-choice"
                          onClick={() => handleChoice(choice)}
                        >
                          <span className="hw-choice-icon"><choice.Icon size={20} aria-hidden="true" /></span>
                          <span className="hw-choice-text">
                            <span className="hw-choice-label">{choice.label}</span>
                            <span className="hw-choice-desc">{choice.desc}</span>
                          </span>
                          <ChevronRight className="hw-choice-chevron" size={18} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}

                  {message.results && message.results.length > 0 && (
                    <div className="hw-results">
                      {message.results.map((result, ridx) => (
                        <ResultCard key={ridx} result={result} />
                      ))}
                    </div>
                  )}

                  {message.showCalendly && <CalendlyButton profile={userProfile} />}
                </div>
              ) : (
                <div key={idx} className="hw-row hw-row--user">
                  <div className="hw-bubble hw-bubble--user">
                    <p>{message.content}</p>
                  </div>
                </div>
              )))}

              {isLoading && (
                <div className="hw-row hw-row--bot">
                  <div className="hw-bubble hw-bubble--bot hw-typing" role="status" aria-label="Recherche en cours">
                    <span className="hw-dots" aria-hidden="true"><span /><span /><span /></span>
                    {loadingText && <span className="hw-typing-text">{loadingText}</span>}
                  </div>
                </div>
              )}

              <div ref={threadEndRef} />
            </div>

            <div className="hw-composer">
              {isRecording ? (
                <div className="hw-recording">
                  <button
                    type="button"
                    className="hw-rec-stop"
                    onClick={() => finishRecording(false)}
                    aria-label="Arrêter et relire le texte"
                    title="Arrêter et relire le texte"
                  >
                    <Square size={14} fill="currentColor" aria-hidden="true" />
                  </button>
                  <div className="hw-bars" aria-hidden="true">
                    {[...Array(28)].map((_, i) => (
                      <span
                        key={i}
                        style={{ height: `${Math.max(18, Math.min(100, audioLevel + (Math.random() * 30)))}%` }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="hw-rec-send"
                    onClick={() => finishRecording(true)}
                    aria-label="Envoyer l'enregistrement"
                    title="Envoyer"
                  >
                    <Send size={17} aria-hidden="true" />
                  </button>
                </div>
              ) : isTranscribing ? (
                <div className="hw-transcribing" role="status">
                  <span className="hw-dots" aria-hidden="true"><span /><span /><span /></span>
                  <span>Transcription en cours</span>
                </div>
              ) : (
                <div className="hw-composer-row">
                  {recordingSupported && (
                    <button
                      type="button"
                      className="hw-mic"
                      onClick={startRecording}
                      disabled={isLoading}
                      aria-label="Dicter votre message"
                      title="Dicter votre message"
                    >
                      <Mic size={20} aria-hidden="true" />
                    </button>
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    className="hw-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    aria-label="Votre message"
                    enterKeyHint="send"
                    autoComplete="off"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="hw-send"
                    onClick={handleSendMessage}
                    disabled={!canSend}
                    aria-label="Envoyer"
                    title="Envoyer"
                  >
                    <Send size={19} aria-hidden="true" />
                  </button>
                </div>
              )}
              <p className="hw-notice">Réponses générées par une IA. Les fiches font foi.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HormurWidget;
