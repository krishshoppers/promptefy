# ✦ PROMPTEFY

**Image Prompt Gallery & Management Bot**

Promptefy is a minimalist, ultra-modern showcase for AI-generated images and their corresponding prompts. It features a "Before/After" comparison slider, advanced search, and a dedicated Telegram bot for seamless content management.

![Promptefy Preview](https://raw.githubusercontent.com/krishshoppers/promptefy/main/public/assets/logo.png)

## 🚀 Key Features

### 💻 Website (High-Performance)
- **Fluid Comparison Slider**: Instantly see the difference between original and AI-enhanced images.
- **Smart Filter & Search**: Filter by AI model (ChatGPT, Midjourney, Flux, etc.) or search by keywords/tags.
- **Dynamic Categories**: "🔥 Trending" and "📌 Pinned" sections to highlight top content.
- **Lightweight & Optimized**: Built for speed with lazy-loading, async decoding, and paint skipping.
- **Mobile First**: Fully responsive design with a sleek side-menu architecture.

### 🤖 Telegram Bot (Management Powerhouse)
- **Persistent Keyboard**: One-tap access to New Prompt, Delete, and Stats.
- **Multi-step Creation**: Smooth flow for uploading titles, images, tags, and software.
- **Content Controls**: Mark prompts as Trending or Pin them to the top of the site.
- **Live Stats**: Real-time tracking of total prompts, unique tags, and active status.

## 🛠 Tech Stack
- **Frontend**: Vanilla HTML5, Modern CSS3 (Grid/Flexbox), ES6+ JavaScript.
- **Backend**: Node.js, Express.js.
- **Bot**: `node-telegram-bot-api`.
- **Database**: JSON-based local storage (for persistence on low-overhead servers).

## 📦 Deployment

### Hybrid Hosting (Recommended)
1. **Frontend (Netlify)**: Deploy the `/public` directory for lightning-fast static delivery.
2. **Backend (Railway)**: Deploy the Node.js environment to handle the API and Telegram Bot.

### Environment Variables
Setup a `.env` file with the following:
```env
BOT_TOKEN=your_telegram_bot_token
ADMIN_ID=your_telegram_user_id
PORT=3000
```

## 🎨 Design Philosophy
Promptefy follows a **Boxy & Geometric** aesthetic. It uses a high-contrast monochrome palette with subtle accent colors (Orange for Trending, Green for Success). 

- **Typography**: Space Grotesk (geometric sans-serif).
- **Interactions**: Custom cubic-bezier easings for a premium, heavy-weight feel.

## 🏗 Project Structure
```text
├── data/           # Persistent prompt storage
├── public/         # Frontend assets (HTML, CSS, JS)
│   ├── assets/     # Media and images
│   ├── app.js      # Core frontend logic
│   └── style.css   # Premium design system
├── server.js       # Node server + Telegram bot
└── package.json    # Dependencies
```

---
*Created by [Krish](https://github.com/krishshoppers)*  
*v0.1 Beta — Stop Guessing. Start Generating.*
