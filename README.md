# getmi.ai

Plataforma de link-in-bio minimalista. Cada usuário cria uma página pública acessível via `getmi.ai/@usuario`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Markup | HTML5 |
| Estilo | CSS3 puro |
| Lógica | JavaScript ES6+ (vanilla) |
| DOM / Ajax | jQuery 3.4.1 |
| UI Components | Bootstrap 4.3.1 |
| Backend / Auth / DB | Firebase (Hosting + Auth + Firestore) |

Todas as libs ficam em `public/lib/` — sem bundler, sem npm no cliente.

---

## Estrutura de pastas

```
getmi/
├── public/
│   ├── lib/          # jQuery, Bootstrap JS/CSS (vendor)
│   ├── css/          # estilos da aplicação
│   ├── js/           # scripts da aplicação
│   ├── img/          # imagens e ícones
│   ├── index.html    # home / onboarding
│   └── p.html        # página de perfil público (@usuario)
├── .github/
│   └── workflows/
│       └── deploy.yml
├── firebase.json
├── .firebaserc
├── firestore.rules
├── firestore.indexes.json
└── .gitignore
```

---

## Rodando localmente

Pré-requisito: Firebase CLI instalado globalmente.

```bash
npm install -g firebase-tools
firebase login
firebase serve --only hosting
```

Acesse `http://localhost:5000`.

---

## Deploy

```bash
firebase deploy
```

Ou via GitHub Actions: qualquer push na branch `main` dispara o deploy automático.

---

## Decisões que NÃO foram tomadas

- **Sem bundler** — Nenhum Webpack, Vite ou Parcel. As libs são carregadas via `<script>` tags diretas.
- **Sem SPA framework** — Nenhum React, Vue ou Angular. Navegação é feita por páginas HTML estáticas + rewrite do Firebase Hosting.
- **Sem backend Node** — Nenhum Express ou servidor customizado. Toda a lógica de servidor fica no Firestore Rules e Firebase Auth.
- **Sem `package.json` na raiz** — O projeto não é um pacote npm. `firebase-tools` é instalado globalmente no CI, não como dependência local.

---

## PWA

O projeto é instalável como app via manifest.json. Para completar o suporte PWA:

1. Adicione os ícones em `public/img/`:
   - `icon-192.png` — 192×192px
   - `icon-512.png` — 512×512px (maskable)
   - `logo-qr.png` — logo para centro do QR Code (ex.: 80×80px)
   - `favicon.ico`
   - `avatar-placeholder.png`

2. O Service Worker (`public/sw.js`) fará cache automático dos assets no primeiro acesso.

## Sitemap

O sitemap deve ser gerado dinamicamente a partir dos usernames cadastrados no Firestore.
Script Python futuro (`scripts/generate-sitemap.py`) deverá:
- Ler a coleção `usernames` via Firebase Admin SDK
- Gerar `public/sitemap.xml` com `<loc>https://getmi.ai/@{username}</loc>`
- Rodar no CI antes do `firebase deploy`

Enquanto isso, o `robots.txt` aponta para `https://getmi.ai/sitemap.xml` (comentado).

## Variáveis de ambiente

| Variável | Onde configurar | Uso |
|---|---|---|
| `FIREBASE_TOKEN` | GitHub → Settings → Secrets → Actions | Autenticação do Firebase CLI no CI/CD |

Para gerar o token:

```bash
firebase login:ci
```

Cole o token gerado como secret `FIREBASE_TOKEN` no repositório do GitHub.
