import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Calendar, Sparkles, Music, Home, Ticket } from 'lucide-react';

const HormurWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Message d'accueil initial
      setTimeout(() => {
        setMessages([{
          type: 'bot',
          content: "Bonjour 👋 Je suis l'assistant Hormur. Vous voulez découvrir un événement, trouver un artiste ou repérer un lieu ?",
          showProfileButtons: true
        }]);
      }, 300);
    }
  }, [isOpen]);

  const handleProfileSelect = (profile) => {
    setUserProfile(profile);
    const profileMessages = {
      spectateur: "Super ! Je vais vous aider à trouver un événement. Plutôt concert, expo ou atelier ? Et dans quelle ville ? ✨",
      hote: "Parfait ! Quel type d'artiste cherchez-vous pour votre événement ? (musique, théâtre, arts visuels…)",
      artiste: "Génial ! Quel type de lieu recherchez-vous pour votre art ? (appartement, jardin, galerie, commerce…)"
    };
    
    setMessages(prev => [...prev, {
      type: 'bot',
      content: profileMessages[profile],
      profile: profile
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue;
    setInputValue('');
    
    setMessages(prev => [...prev, {
      type: 'user',
      content: userMessage
    }]);

    setIsLoading(true);

    // Simulation de réponse (à remplacer par l'appel à Agent Builder)
    setTimeout(() => {
      // Exemple de résultats
      const mockResults = [
        {
          type: 'événement',
          title: 'Concert Jazz au Jardin Secret',
          city: 'Paris',
          date: '15 Nov 2025',
          genre: 'Jazz',
          image: '🎵'
        },
        {
          type: 'événement',
          title: 'Exposition Photo Intimiste',
          city: 'Paris',
          date: '20 Nov 2025',
          genre: 'Photo',
          image: '📸'
        },
        {
          type: 'artiste',
          title: 'Marie Dubois - Pianiste',
          city: 'Paris',
          genre: 'Musique classique',
          image: '🎹'
        }
      ];

      setMessages(prev => [...prev, {
        type: 'bot',
        content: "Voilà ce que j'ai trouvé pour vous ! 🎉",
        results: mockResults,
        showCalendly: true
      }]);
      
      setIsLoading(false);
    }, 1500);
  };

  const ResultCard = ({ result }) => {
    const typeColors = {
      'événement': '#EEB653',
      'artiste': '#EE7951',
      'lieu': '#F18475'
    };

    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300 mb-3">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center text-3xl bg-gradient-to-br from-pink-100 to-orange-50">
            {result.image}
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white mb-2"
                 style={{ backgroundColor: typeColors[result.type] }}>
              {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
            </div>
            <h4 className="font-bold text-sm text-gray-800 mb-1 line-clamp-1" style={{ fontFamily: 'Georgia, serif' }}>
              {result.title}
            </h4>
            <p className="text-xs text-gray-600">
              {result.city} {result.date && `• ${result.date}`}
            </p>
            {result.genre && (
              <p className="text-xs text-gray-500 mt-1">{result.genre}</p>
            )}
          </div>
        </div>
        <button className="w-full mt-3 bg-gradient-to-r from-red-500 to-orange-500 text-white py-2 px-4 rounded-full text-sm font-medium hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                style={{ backgroundColor: '#EE6553' }}>
          Voir les détails
        </button>
      </div>
    );
  };

  const CalendlyButtons = ({ profile }) => {
    const buttons = profile === 'artiste' ? [
      { label: '💬 Discuter avec Éléonore (15 min)', url: 'https://calendly.com/eleonore-hormur/15min' }
    ] : [
      { label: '💬 Échanger avec Martin (15 min)', url: 'https://calendly.com/martin-jeudy/15min' },
      { label: '🤝 Rendez-vous stratégique (30 min)', url: 'https://calendly.com/martin-jeudy/30min', secondary: true }
    ];

    return (
      <div className="mt-3 space-y-2">
        {buttons.map((btn, idx) => (
          
            key={idx}
            href={btn.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block text-center py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-300 ${
              btn.secondary 
                ? 'border-2 text-gray-700 hover:bg-gray-50' 
                : 'border-2 hover:bg-red-50'
            }`}
            style={btn.secondary ? { borderColor: '#EE6553', color: '#EE6553' } : { borderColor: '#EE6553', color: '#EE6553' }}
          >
            {btn.label}
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed z-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Bouton flottant (état discret) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-5 right-5 w-14 h-14 md:w-16 md:h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        style={{
          background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)',
          animation: 'pulse 2s ease-in-out infinite'
        }}
        aria-label="Ouvrir l'assistant Hormur"
      >
        <MessageCircle className="text-white" size={24} />
      </button>

      {/* Modale (état ouvert) */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Widget modal */}
          <div 
            className="fixed bottom-5 right-5 w-[90vw] md:w-[420px] h-[85vh] md:h-[600px] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
            style={{ 
              animation: 'slideUp 0.3s ease-out',
              maxHeight: '80vh'
            }}
          >
            {/* En-tête */}
            <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between border-b"
                 style={{ backgroundColor: '#FEF6F4', borderColor: '#DFDFE9' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                     style={{ background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)' }}>
                  H
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ fontFamily: 'Georgia, serif', color: '#323242' }}>
                    Hormur
                  </h3>
                  <p className="text-xs opacity-70" style={{ color: '#323242' }}>
                    L'art où on ne l'attend pas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Fermer"
              >
                <X size={20} style={{ color: '#323242' }} />
              </button>
            </div>

            {/* Zone de messages scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4" style={{ backgroundColor: '#FFFFFF' }}>
              {messages.map((message, idx) => (
                <div key={idx}>
                  {message.type === 'bot' ? (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0"
                           style={{ background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)' }}>
                        <Sparkles size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl rounded-tl-none p-4 shadow-sm">
                          <p className="text-sm leading-relaxed" style={{ color: '#323242' }}>
                            {message.content}
                          </p>
                        </div>
                        
                        {/* Boutons de profil */}
                        {message.showProfileButtons && !userProfile && (
                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <button
                              onClick={() => handleProfileSelect('spectateur')}
                              className="bg-white border-2 rounded-xl p-3 hover:shadow-md transition-all duration-300 hover:scale-105"
                              style={{ borderColor: '#EEB653' }}
                            >
                              <div className="text-2xl mb-1">🎟️</div>
                              <div className="text-xs font-medium" style={{ color: '#323242' }}>Événements</div>
                            </button>
                            <button
                              onClick={() => handleProfileSelect('artiste')}
                              className="bg-white border-2 rounded-xl p-3 hover:shadow-md transition-all duration-300 hover:scale-105"
                              style={{ borderColor: '#EE7951' }}
                            >
                              <div className="text-2xl mb-1">🎨</div>
                              <div className="text-xs font-medium" style={{ color: '#323242' }}>Artistes</div>
                            </button>
                            <button
                              onClick={() => handleProfileSelect('hote')}
                              className="bg-white border-2 rounded-xl p-3 hover:shadow-md transition-all duration-300 hover:scale-105"
                              style={{ borderColor: '#F18475' }}
                            >
                              <div className="text-2xl mb-1">🏡</div>
                              <div className="text-xs font-medium" style={{ color: '#323242' }}>Lieux</div>
                            </button>
                          </div>
                        )}

                        {/* Résultats */}
                        {message.results && (
                          <div className="mt-4">
                            {message.results.map((result, ridx) => (
                              <ResultCard key={ridx} result={result} />
                            ))}
                          </div>
                        )}

                        {/* Boutons Calendly */}
                        {message.showCalendly && (
                          <CalendlyButtons profile={userProfile} />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl rounded-tr-none p-4 max-w-[75%] shadow-sm"
                           style={{ backgroundColor: '#EE6553' }}>
                        <p className="text-sm leading-relaxed">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                       style={{ background: 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)' }}>
                    <Sparkles size={16} />
                  </div>
                  <div className="bg-gradient-to-br from-pink-50 to-orange-50 rounded-2xl rounded-tl-none p-4 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie */}
            <div className="flex-shrink-0 p-4 border-t" style={{ backgroundColor: '#FCE5DD', borderColor: '#DFDFE9' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Écrivez votre message..."
                  className="flex-1 px-4 py-3 rounded-full border-2 focus:outline-none focus:ring-2 transition-all text-sm"
                  style={{ 
                    borderColor: '#DFDFE9',
                    focusRingColor: '#EE6553'
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim()}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    background: inputValue.trim() ? 'linear-gradient(135deg, #EE6553 0%, #EE7951 100%)' : '#DFDFE9'
                  }}
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-center text-xs mt-2 opacity-60" style={{ color: '#323242' }}>
                Hormur — L'art où on ne l'attend pas
              </p>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Scrollbar personnalisée */
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }

        .overflow-y-auto::-webkit-scrollbar-track {
          background: #FCE5DD;
          border-radius: 10px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: #EE6553;
          border-radius: 10px;
        }

        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: #EE7951;
        }
      `}</style>
    </div>
  );
};

export default HormurWidget;
