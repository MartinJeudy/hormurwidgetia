# Widget Hormur 🎭

Assistant conversationnel pour la plateforme Hormur - L'art où on ne l'attend pas.

## 🚀 Installation locale

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run dev

# Builder pour production
npm run build
```

## 📦 Déploiement

Le projet est configuré pour être déployé automatiquement sur Netlify via GitHub.

## 🎨 Caractéristiques

- Widget flottant responsive (mobile-first)
- Chat conversationnel avec Agent Builder OpenAI
- Intégration Calendly pour les rendez-vous humains
- Respect strict de la charte graphique Hormur
- Animations douces et accessibilité

## 🔧 Configuration

Pour connecter votre Agent Builder :

1. Modifiez la fonction `handleSendMessage` dans `HormurWidget.jsx`
2. Ajoutez votre endpoint API (Brevo → n8n → Agent Builder)
3. Adaptez le format des résultats selon vos besoins

## 📞 Contact

- Artistes : [Éléonore](https://calendly.com/eleonore-hormur/15min)
- Hôtes/Spectateurs : [Martin](https://calendly.com/martin-jeudy/15min)

## 📁 Structure du projet

```
hormur-widget/
├── package.json
├── vite.config.js
├── index.html
├── netlify.toml
├── README.md
└── src/
    ├── main.jsx
    ├── App.jsx
    └── HormurWidget.jsx
```

## 🌐 Déploiement sur Netlify

### Via l'interface web

1. Connectez-vous sur [netlify.com](https://netlify.com)
2. Cliquez sur "Add new site" → "Import an existing project"
3. Choisissez "Deploy with GitHub"
4. Sélectionnez votre dépôt `hormur-widget`
5. Les paramètres de build sont automatiquement détectés via `netlify.toml`
6. Cliquez sur "Deploy site"

### Via Netlify CLI

```bash
# Installez Netlify CLI
npm install -g netlify-cli

# Connectez-vous
netlify login

# Déployez
netlify init
netlify deploy --prod
```

## 🛠️ Technologies utilisées

- React 18.2
- Vite 4.3
- Lucide React (icônes)
- Tailwind-like utility classes

## 📝 Licence

© 2025 Hormur - Tous droits réservés
