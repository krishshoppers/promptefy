/* ═══════════════════════════════════════════
   PROMPTEFY — Server + Telegram Bot
   ═══════════════════════════════════════════ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ══════════════════════════════════════
   JSON File Storage
   ══════════════════════════════════════ */
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'prompts.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readPrompts() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writePrompts(prompts) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(prompts, null, 2), 'utf8');
}

function addPrompt(prompt) {
  const prompts = readPrompts();
  prompt.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  prompt.createdAt = new Date().toISOString();
  prompts.push(prompt);
  writePrompts(prompts);
  return prompt;
}

function deletePrompt(id) {
  let prompts = readPrompts();
  const before = prompts.length;
  prompts = prompts.filter(p => p.id !== id);
  writePrompts(prompts);
  return prompts.length < before;
}

function togglePinPrompt(id) {
  const prompts = readPrompts();
  const prompt = prompts.find(p => p.id === id);
  if (!prompt) return null;
  prompt.pinned = !prompt.pinned;
  writePrompts(prompts);
  return prompt;
}

function toggleTrendingPrompt(id) {
  const prompts = readPrompts();
  const prompt = prompts.find(p => p.id === id);
  if (!prompt) return null;
  prompt.trending = !prompt.trending;
  writePrompts(prompts);
  return prompt;
}

/* ══════════════════════════════════════
   API Routes
   ══════════════════════════════════════ */
app.get('/api/prompts', (req, res) => {
  res.json(readPrompts());
});

app.get('/api/tags', (req, res) => {
  const prompts = readPrompts();
  const tags = new Set();
  prompts.forEach(p => {
    if (p.tags) p.tags.forEach(t => tags.add(t));
  });
  res.json(Array.from(tags).sort());
});

app.get('/api/prompts/:id', (req, res) => {
  const prompts = readPrompts();
  const prompt = prompts.find(p => p.id === req.params.id);
  if (!prompt) return res.status(404).json({ error: 'Not found' });
  res.json(prompt);
});

/* ══════════════════════════════════════
   Telegram Bot
   ══════════════════════════════════════ */

const sessions = {};

const SOFTWARE_OPTIONS = [
  'ChatGPT', 'Gemini', 'Midjourney', 'DALL·E', 'Stable Diffusion',
  'Leonardo AI', 'Adobe Firefly', 'Copilot', 'Flux', 'Other'
];

if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_BOT_TOKEN_HERE') {
  const bot = new TelegramBot(BOT_TOKEN, { polling: true });

  console.log('🤖 Telegram bot started');

  function isAdmin(chatId) {
    if (!ADMIN_ID || ADMIN_ID === 'YOUR_TELEGRAM_USER_ID') return true;
    return String(chatId) === String(ADMIN_ID);
  }

  // ── Persistent Reply Keyboard ──
  const MAIN_KEYBOARD = {
    reply_markup: {
      keyboard: [
        ['📝 New Prompt', '🗑 Delete Prompt'],
        ['📌 Pin Prompt', '🔥 Trending'],
        ['📊 Stats', '❓ Help']
      ],
      resize_keyboard: true,
      is_persistent: true
    },
    parse_mode: 'Markdown'
  };

  function stepBar(current, total) {
    const filled = '▓'.repeat(current);
    const empty = '░'.repeat(total - current);
    return `${filled}${empty}  ${current}/${total}`;
  }

  // ── Welcome / Home ──
  function sendHome(chatId) {
    sessions[chatId] = null;
    return bot.sendMessage(chatId,
      `✦ *PROMPTEFY BOT*\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `Welcome! Use the buttons below\nto manage your AI prompt showcase.\n\n` +
      `_Tap any button to get started ↓_`,
      MAIN_KEYBOARD
    );
  }

  // ── /start ──
  bot.onText(/\/start/, (msg) => {
    if (!isAdmin(msg.chat.id)) {
      return bot.sendMessage(msg.chat.id, '⛔ You are not authorized.');
    }
    sendHome(msg.chat.id);
  });

  // ── Callback queries ──
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    await bot.answerCallbackQuery(query.id);

    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '⛔ You are not authorized.');
    }

    // ── Confirm Delete ──
    if (data.startsWith('del_')) {
      const id = data.replace('del_', '');
      const deleted = deletePrompt(id);
      await bot.sendMessage(chatId,
        deleted ? '✅ *Prompt deleted successfully.*' : '❌ Prompt not found.',
        { parse_mode: 'Markdown' }
      );
      return sendHome(chatId);
    }

    // ── Toggle Pin ──
    if (data.startsWith('pin_')) {
      const id = data.replace('pin_', '');
      const prompt = togglePinPrompt(id);
      if (!prompt) {
        await bot.sendMessage(chatId, '❌ Prompt not found.', { parse_mode: 'Markdown' });
      } else {
        const status = prompt.pinned ? '📌 *Pinned!*' : '📌 *Unpinned!*';
        await bot.sendMessage(chatId,
          `${status}\n\n✦ *${prompt.title}* is now ${prompt.pinned ? 'pinned to the top' : 'unpinned'}.`,
          { parse_mode: 'Markdown' }
        );
      }
      return sendHome(chatId);
    }

    // ── Toggle Trending ──
    if (data.startsWith('trend_')) {
      const id = data.replace('trend_', '');
      const prompt = toggleTrendingPrompt(id);
      if (!prompt) {
        await bot.sendMessage(chatId, '❌ Prompt not found.', { parse_mode: 'Markdown' });
      } else {
        const status = prompt.trending ? '🔥 *Marked as Trending!*' : '🔥 *Removed from Trending.*';
        await bot.sendMessage(chatId,
          `${status}\n\n✦ *${prompt.title}* ${prompt.trending ? 'will now glow on the website ✨' : 'is back to normal'}.`,
          { parse_mode: 'Markdown' }
        );
      }
      return sendHome(chatId);
    }

    // ── Software Selection ──
    if (data.startsWith('sw_')) {
      const sw = data.replace('sw_', '');
      if (!sessions[chatId] || sessions[chatId].step !== 'software') return;
      sessions[chatId].data.software = sw;
      sessions[chatId].step = 'prompt';
      return bot.sendMessage(chatId,
        `✅ Software: *${sw}*\n\n` +
        `${stepBar(6, 6)}\n\n` +
        `📝 *Step 6 — Prompt Text*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `Paste the full AI prompt you used:`,
        { parse_mode: 'Markdown' }
      );
    }

    // ── Publish ──
    if (data === 'publish') {
      const session = sessions[chatId];
      if (!session || session.step !== 'preview') return;
      const prompts = readPrompts();
      session.data.serialNumber = prompts.length + 1;
      const saved = addPrompt(session.data);
      sessions[chatId] = null;
      return bot.sendMessage(chatId,
        `🎉 *PUBLISHED!*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `✦ *${saved.title}*\n` +
        `📌 Serial: #${String(saved.serialNumber).padStart(3, '0')}\n\n` +
        `Your prompt is now live on the website!`,
        MAIN_KEYBOARD
      );
    }

    // ── Decline ──
    if (data === 'decline') {
      sessions[chatId] = null;
      await bot.sendMessage(chatId, '❌ Prompt discarded.');
      return sendHome(chatId);
    }
  });

  // ── Message Handler ──
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.text && msg.text.startsWith('/')) return;
    if (!isAdmin(chatId)) return;

    const text = msg.text ? msg.text.trim() : '';

    // ══ Reply Keyboard Button Handlers ══

    if (text === '📝 New Prompt') {
      sessions[chatId] = { step: 'title', data: {} };
      return bot.sendMessage(chatId,
        `📝 *NEW PROMPT*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `${stepBar(1, 6)}\n\n` +
        `*Step 1 — Title*\n` +
        `Enter a title for this prompt:`,
        { parse_mode: 'Markdown' }
      );
    }

    if (text === '🗑 Delete Prompt') {
      const prompts = readPrompts();
      if (!prompts.length) {
        return bot.sendMessage(chatId, '📭 No prompts to delete.', MAIN_KEYBOARD);
      }
      const buttons = prompts.slice(-10).reverse().map(p => ([{
        text: `🗑 ${p.title}`,
        callback_data: `del_${p.id}`
      }]));
      return bot.sendMessage(chatId,
        `🗑 *DELETE PROMPT*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `Select a prompt to remove:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
      );
    }

    // ── Pin Prompt ──
    if (text === '📌 Pin Prompt') {
      const prompts = readPrompts();
      if (!prompts.length) {
        return bot.sendMessage(chatId, '📭 No prompts available.', MAIN_KEYBOARD);
      }
      const buttons = prompts.slice(-10).reverse().map(p => ([{
        text: `${p.pinned ? '📌 ' : '○ '}${p.title}`,
        callback_data: `pin_${p.id}`
      }]));
      return bot.sendMessage(chatId,
        `📌 *PIN / UNPIN PROMPT*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 = currently pinned\n○ = not pinned\n\n` +
        `Tap to toggle:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
      );
    }

    // ── Trending ──
    if (text === '🔥 Trending') {
      const prompts = readPrompts();
      if (!prompts.length) {
        return bot.sendMessage(chatId, '📭 No prompts available.', MAIN_KEYBOARD);
      }
      const buttons = prompts.slice(-10).reverse().map(p => ([{
        text: `${p.trending ? '🔥 ' : '○ '}${p.title}`,
        callback_data: `trend_${p.id}`
      }]));
      return bot.sendMessage(chatId,
        `🔥 *TRENDING PROMPTS*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `🔥 = currently trending\n○ = normal\n\n` +
        `Tap to toggle:`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
      );
    }

    if (text === '📊 Stats') {
      const prompts = readPrompts();
      const tags = new Set();
      const pinned = prompts.filter(p => p.pinned).length;
      const trending = prompts.filter(p => p.trending).length;
      prompts.forEach(p => { if (p.tags) p.tags.forEach(t => tags.add(t)); });
      return bot.sendMessage(chatId,
        `📊 *STATISTICS*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📌 Total Prompts: *${prompts.length}*\n` +
        `🏷 Unique Tags: *${tags.size}*\n` +
        `📌 Pinned: *${pinned}*\n` +
        `🔥 Trending: *${trending}*\n` +
        `📅 Latest: *${prompts.length ? prompts[prompts.length - 1].title : 'None'}*`,
        MAIN_KEYBOARD
      );
    }

    if (text === '❓ Help') {
      return bot.sendMessage(chatId,
        `❓ *HELP*\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 *New Prompt* — Create & publish\n📌 *Pin* — Pin/unpin prompts (top)\n🔥 *Trending* — Mark as trending (glow)\n🗑 *Delete* — Remove prompts\n📊 *Stats* — View collection stats\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `_Prompts are published instantly._`,
        MAIN_KEYBOARD
      );
    }

    // ══ Multi-step flow ══
    if (!sessions[chatId]) return;
    const session = sessions[chatId];

    switch (session.step) {
      case 'title': {
        if (!msg.text) return bot.sendMessage(chatId, '⚠️ Please enter a text title.');
        session.data.title = text;
        session.step = 'original_image';
        return bot.sendMessage(chatId,
          `✅ Title: *${session.data.title}*\n\n` +
          `${stepBar(2, 6)}\n\n` +
          `🖼 *Step 2 — Original Image*\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `Send the original (before) image\nor paste an image URL:`,
          { parse_mode: 'Markdown' }
        );
      }

      case 'original_image': {
        const url = await extractImageUrl(msg, bot);
        if (!url) return bot.sendMessage(chatId, '⚠️ Send an image or paste a URL.');
        session.data.originalImage = url;
        session.step = 'enhanced_image';
        return bot.sendMessage(chatId,
          `✅ Original image saved\n\n` +
          `${stepBar(3, 6)}\n\n` +
          `🎨 *Step 3 — AI Enhanced Image*\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `Send the enhanced image or URL:`,
          { parse_mode: 'Markdown' }
        );
      }

      case 'enhanced_image': {
        const url = await extractImageUrl(msg, bot);
        if (!url) return bot.sendMessage(chatId, '⚠️ Send an image or paste a URL.');
        session.data.enhancedImage = url;
        session.step = 'tags';
        return bot.sendMessage(chatId,
          `✅ Enhanced image saved\n\n` +
          `${stepBar(4, 6)}\n\n` +
          `🏷 *Step 4 — Tags*\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `Enter tags separated by commas:\n_e.g. portrait, cinematic, dark_`,
          { parse_mode: 'Markdown' }
        );
      }

      case 'tags': {
        if (!msg.text) return bot.sendMessage(chatId, '⚠️ Please enter tags as text.');
        session.data.tags = text.split(',').map(t => t.trim()).filter(Boolean);
        session.step = 'software';

        const buttons = [];
        for (let i = 0; i < SOFTWARE_OPTIONS.length; i += 2) {
          const row = [{ text: SOFTWARE_OPTIONS[i], callback_data: `sw_${SOFTWARE_OPTIONS[i]}` }];
          if (SOFTWARE_OPTIONS[i + 1]) {
            row.push({ text: SOFTWARE_OPTIONS[i + 1], callback_data: `sw_${SOFTWARE_OPTIONS[i + 1]}` });
          }
          buttons.push(row);
        }

        return bot.sendMessage(chatId,
          `✅ Tags: *${session.data.tags.join(', ')}*\n\n` +
          `${stepBar(5, 6)}\n\n` +
          `💻 *Step 5 — Software*\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `Select the AI tool used:`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } }
        );
      }

      case 'prompt': {
        if (!msg.text) return bot.sendMessage(chatId, '⚠️ Please enter the prompt text.');
        session.data.prompt = text;
        session.step = 'preview';

        const d = session.data;
        const previewText =
          `📋 *PREVIEW*\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `*Title:* ${d.title}\n` +
          `*Tags:* ${d.tags.join(', ')}\n` +
          `*Software:* ${d.software}\n\n` +
          `*Prompt:*\n${d.prompt.substring(0, 300)}${d.prompt.length > 300 ? '...' : ''}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `_Ready to publish?_`;

        try {
          await bot.sendMediaGroup(chatId, [
            { type: 'photo', media: d.originalImage, caption: '🖼 Original' },
            { type: 'photo', media: d.enhancedImage, caption: '🎨 Enhanced' }
          ]);
        } catch (e) {
          console.log('Preview: image display skipped');
        }

        return bot.sendMessage(chatId, previewText, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Publish', callback_data: 'publish' },
                { text: '❌ Decline', callback_data: 'decline' }
              ]
            ]
          }
        });
      }

      default:
        return;
    }
  });

  /* ── Helper: extract image URL ── */
  async function extractImageUrl(msg, bot) {
    if (msg.text) {
      const urlMatch = msg.text.match(/https?:\/\/\S+/);
      if (urlMatch) return urlMatch[0];
    }
    if (msg.photo && msg.photo.length > 0) {
      try { return await bot.getFileLink(msg.photo[msg.photo.length - 1].file_id); }
      catch (e) { return null; }
    }
    if (msg.document && msg.document.mime_type && msg.document.mime_type.startsWith('image/')) {
      try { return await bot.getFileLink(msg.document.file_id); }
      catch (e) { return null; }
    }
    return null;
  }

} else {
  console.log('⚠️  BOT_TOKEN not set — Telegram bot disabled. Set it in .env');
}

/* ══════════════════════════════════════
   Catch-all → serve index.html
   ══════════════════════════════════════ */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ══════════════════════════════════════
   Start Server
   ══════════════════════════════════════ */
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '─'.repeat(40));
  console.log('✦ PROMPTEFY SERVER IS LIVE');
  console.log('─'.repeat(40));
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://10.186.106.232:${PORT}`);
  console.log('─'.repeat(40) + '\n');
});
