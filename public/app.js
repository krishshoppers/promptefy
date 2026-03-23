(function() {
  'use strict';

  /* ── CONFIG ── */
  // When deployed, change this to your Railway URL (e.g., https://your-app.up.railway.app)
  const API_BASE = window.location.hostname === 'localhost' ? '' : 'https://promptefy-production.up.railway.app';
  const API_URL = `${API_BASE}/api/prompts`;
  const TAGS_URL = `${API_BASE}/api/tags`;
  const grid = document.getElementById('prompts-grid');
  const skeletonGrid = document.getElementById('skeleton-grid');
  const empty = document.getElementById('empty');
  const menuTrigger = document.getElementById('menu-trigger');
  const sideDrawer = document.getElementById('side-drawer');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const tagList = document.getElementById('tag-list');
  const heroVideo = document.querySelector('.hero-video');
  const searchInput = document.getElementById('search-input');
  const categoryTrack = document.getElementById('category-track');

  let allPrompts = [];
  let currentTag = 'all';
  let currentModel = 'all';
  let searchQuery = '';
  let searchTimeout = null;

  if (heroVideo) heroVideo.playbackRate = 1.6;

  /* ── MENU LOGIC ── */
  function toggleDrawer(open) {
    sideDrawer.classList.toggle('active', open);
    document.body.classList.toggle('menu-open', open);
  }

  menuTrigger.addEventListener('click', () => toggleDrawer(true));
  drawerOverlay.addEventListener('click', () => toggleDrawer(false));

  /* ── MODEL CATEGORY FILTER ── */
  if (categoryTrack) {
    categoryTrack.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;
      currentModel = chip.dataset.model;
      categoryTrack.querySelectorAll('.category-chip').forEach(c =>
        c.classList.toggle('active', c.dataset.model === currentModel)
      );
      renderGrid();
      grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ── DATA ── */
  async function init() {
    try {
      const [promptsRes, tagsRes] = await Promise.all([
        fetch(API_URL),
        fetch(TAGS_URL)
      ]);

      allPrompts = await promptsRes.json();
      const tags = await tagsRes.json();

      renderTags(tags);
      showGrid();
    } catch (err) {
      console.error('Init failed:', err);
      skeletonGrid.style.display = 'none';
      empty.style.display = 'block';
    }
  }

  function showGrid() {
    skeletonGrid.style.display = 'none';
    grid.style.display = '';
    renderGrid();
  }

  /* ── TAGS ── */
  function renderTags(tags) {
    tags.forEach(tag => {
      const li = document.createElement('li');
      li.className = 'tag-link';
      li.textContent = tag;
      li.dataset.tag = tag;
      li.addEventListener('click', () => {
        filterBy(tag);
        toggleDrawer(false);
      });
      tagList.appendChild(li);
    });
  }

  function filterBy(tag) {
    currentTag = tag;
    document.querySelectorAll('.tag-link').forEach(el => {
      el.classList.toggle('active', el.dataset.tag === tag);
    });
    renderGrid();
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── SEARCH ── */
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderGrid();
    }, 150);
  });

  function highlightText(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="highlight">$1</mark>');
  }

  function scoreMatch(prompt, query) {
    if (!query) return 0;
    const q = query.toLowerCase();
    let score = 0;
    if (prompt.title && prompt.title.toLowerCase().includes(q)) score += 100;
    if (prompt.tags && prompt.tags.some(t => t.toLowerCase().includes(q))) score += 80;
    if (prompt.software && prompt.software.toLowerCase().includes(q)) score += 60;
    if (prompt.prompt && prompt.prompt.toLowerCase().includes(q)) score += 40;
    return score;
  }

  /* ── RENDER ── */
  function renderGrid() {
    let filtered = currentTag === 'all'
      ? [...allPrompts]
      : allPrompts.filter(p => p.tags && p.tags.includes(currentTag));

    // Model/software filter OR trending filter
    if (currentModel === 'trending') {
      filtered = filtered.filter(p => p.trending);
    } else if (currentModel !== 'all') {
      filtered = filtered.filter(p =>
        p.software && p.software.toLowerCase() === currentModel.toLowerCase()
      );
    }

    // Search filtering + scoring
    if (searchQuery) {
      filtered = filtered
        .map(p => ({ ...p, _score: scoreMatch(p, searchQuery) }))
        .filter(p => p._score > 0)
        .sort((a, b) => b._score - a._score);
    } else {
      filtered = [...filtered].reverse();
      // Pinned prompts always go first
      filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    }

    grid.innerHTML = '';

    if (!filtered.length) {
      empty.style.display = 'block';
    } else {
      empty.style.display = 'none';
      const frag = document.createDocumentFragment();
      filtered.forEach(p => frag.appendChild(createCard(p)));
      grid.appendChild(frag);
      initSliders();
      initObserver();
    }
  }

  /* ── CARD ── */
  function createCard(p) {
    const el = document.createElement('div');
    let cls = 'card';
    if (p._score) cls += ' search-match';
    if (p.trending) cls += ' trending';
    if (p.pinned) cls += ' pinned';
    el.className = cls;

    const tagsHtml = (p.tags || []).map(t =>
      `<span class="tag-badge">${highlightText(t, searchQuery)}</span>`
    ).join('');

    const titleHtml = highlightText(p.title || '', searchQuery);
    const promptText = p.prompt || '';
    const promptHtml = highlightText(promptText, searchQuery);

    // Serial number formatting: #001, #002, etc.
    const serialNum = p.serialNumber
      ? `#${String(p.serialNumber).padStart(3, '0')}`
      : '';

    el.innerHTML = `
      <div class="card-media">
        ${serialNum ? `<span class="serial-badge">${serialNum}</span>` : ''}
        <img src="${p.originalImage}" class="card-img img-before" alt="Before" loading="lazy" decoding="async" fetchpriority="low">
        <img src="${p.enhancedImage}" class="card-img img-overlay" alt="After" loading="lazy" decoding="async" fetchpriority="low">
        <div class="card-divider"></div>
      </div>
      <div class="card-body">
        <div class="card-tags">${tagsHtml}</div>
        <h2 class="card-name">${titleHtml}</h2>
        <span class="card-meta">${highlightText(p.software || 'AI', searchQuery)}</span>
        <p class="card-txt collapsed">${promptHtml}</p>
        <div class="card-foot">
          <button class="btn btn-copy" data-prompt="${promptText.replace(/"/g, '&quot;')}">COPY PROMPT</button>
          <button class="btn btn-text btn-expand">SEE MORE</button>
          ${p.pinned ? `<button class="btn-pin" title="Copy prompt link" data-id="${p.id}">📌</button>` : ''}
        </div>
      </div>
    `;

    // See More
    const txt = el.querySelector('.card-txt');
    const btnEx = el.querySelector('.btn-expand');
    if (btnEx) {
      btnEx.onclick = () => {
        const collapsed = txt.classList.toggle('collapsed');
        btnEx.textContent = collapsed ? 'SEE MORE' : 'SEE LESS';
      };
    }

    // Copy — with "COPIED" feedback
    const btnCp = el.querySelector('.btn-copy');
    if (btnCp) {
      btnCp.onclick = () => {
        const text = btnCp.dataset.prompt;
        copyToClipboard(text).then(() => {
          btnCp.textContent = 'COPIED';
          btnCp.classList.add('copied');
          setTimeout(() => {
            btnCp.textContent = 'COPY PROMPT';
            btnCp.classList.remove('copied');
          }, 2000);
        });
      };
    }

    // Pin — copy link to clipboard
    const btnPin = el.querySelector('.btn-pin');
    if (btnPin) {
      btnPin.onclick = () => {
        const link = `${window.location.origin}/prompt/${btnPin.dataset.id}`;
        copyToClipboard(link).then(() => {
          btnPin.textContent = '✅';
          showToast('Link copied!');
          setTimeout(() => { btnPin.textContent = '📌'; }, 2000);
        });
      };
    }

    return el;
  }

  /* ── SLIDERS ── */
  function initSliders() {
    document.querySelectorAll('.card-media').forEach(slider => {
      const handle = slider.querySelector('.card-divider');
      const afterImg = slider.querySelector('.img-overlay');

      const move = (e) => {
        const box = slider.getBoundingClientRect();
        const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let pos = ((x - box.left) / box.width) * 100;
        pos = Math.max(0, Math.min(100, pos));
        handle.style.left = `${pos}%`;
        afterImg.style.clipPath = `inset(0 0 0 ${pos}%)`;
      };

      slider.addEventListener('mousemove', move);
      slider.addEventListener('touchmove', move, { passive: true });
    });
  }

  /* ── OBSERVER ── */
  function initObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 50px 0px' });

    document.querySelectorAll('.card').forEach(card => observer.observe(card));
  }

  /* ── SCROLL TO TOP ── */
  const btnTop = document.getElementById('btn-top');
  if (btnTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        btnTop.classList.add('visible');
      } else {
        btnTop.classList.remove('visible');
      }
    });
    btnTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── CLIPBOARD HELPER (works on HTTP too) ── */
  function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback for HTTP
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return Promise.resolve();
  }

  /* ── TOAST NOTIFICATION ── */
  function showToast(message) {
    let toast = document.getElementById('toast-notify');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast-notify';
      toast.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(20px);
        background: rgba(255,255,255,0.12); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 24px;
        font-family: var(--font); font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase;
        z-index: 999; opacity: 0; transition: opacity 0.3s, transform 0.3s;
        pointer-events: none; border-radius: 4px;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2500);
  }

  /* ── INIT ── */
  document.querySelector('[data-tag="all"]').onclick = () => {
    filterBy('all');
    toggleDrawer(false);
  };

  init();

})();
