(function () {
  'use strict';

  let cmsData = null;
  let mediaFiles = [];
  let inquiriesList = [];
  let currentTab = 'tab-dashboard';
  let activeImageCallback = null;

  function getToken() {
    return localStorage.getItem('avigo_portal_token') || '';
  }

  function setToken(token) {
    if (token) localStorage.setItem('avigo_portal_token', token);
    else localStorage.removeItem('avigo_portal_token');
  }

  function showToast(msg) {
    const el = document.getElementById('cms-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.style.display = 'none';
    }, 3200);
  }

  function markUnsaved(flag = true) {
    const ind = document.getElementById('unsaved-indicator');
    if (ind) ind.style.display = flag ? 'inline-block' : 'none';
    pushLivePreview();
  }

  function pushLivePreview() {
    const iframe = document.getElementById('live-preview-iframe');
    if (iframe && iframe.contentWindow && cmsData) {
      iframe.contentWindow.postMessage({ type: 'AVIGO_LIVE_PREVIEW', payload: cmsData }, '*');
    }
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function apiFetch(url, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, Object.assign({}, options, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  async function loadInquiries() {
    try {
      const res = await apiFetch('/api/inquiries');
      inquiriesList = res.inquiries || [];
      const badge = document.getElementById('nav-inquiry-badge');
      if (badge) badge.textContent = String(inquiriesList.length);
    } catch (e) {
      inquiriesList = [];
    }
  }

  // --- MEDIA VAULT MODAL ---
  async function loadMediaList() {
    const res = await apiFetch('/api/media');
    mediaFiles = res.media || [];
    return mediaFiles;
  }

  function openMediaModal(onSelect) {
    activeImageCallback = onSelect;
    const modal = document.getElementById('media-modal');
    if (modal) modal.style.display = 'flex';
    renderModalMediaGrid();
  }

  function closeMediaModal() {
    const modal = document.getElementById('media-modal');
    if (modal) modal.style.display = 'none';
    activeImageCallback = null;
  }

  async function renderModalMediaGrid() {
    const grid = document.getElementById('modal-media-grid');
    if (!grid) return;
    await loadMediaList();
    const images = mediaFiles.filter((m) => !m.isPdf);
    grid.innerHTML = images.map((m) => `
      <div class="media-card" data-pick-url="${escapeHtml(m.url)}">
        <img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.name)}" class="media-card-thumb" />
        <div class="media-card-info">
          <div class="media-card-name">${escapeHtml(m.name)}</div>
          <button type="button" class="btn-secondary" data-pick-btn="${escapeHtml(m.url)}">Select Asset</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-pick-btn], [data-pick-url] .media-card-thumb').forEach((el) => {
      el.addEventListener('click', (e) => {
        const card = e.target.closest('[data-pick-url]');
        const url = card ? card.getAttribute('data-pick-url') : '';
        if (url && activeImageCallback) {
          activeImageCallback(url);
          closeMediaModal();
        }
      });
    });
  }

  async function uploadFileFromInput(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = await apiFetch('/api/media', {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, dataUrl: reader.result })
          });
          showToast(`Uploaded ${result.item.name} to Avigo Media Vault`);
          resolve(result.item);
        } catch (err) {
          alert(err.message);
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  }

  function renderImageFieldHtml(id, label, currentValue) {
    return `
      <div class="image-field-card">
        <div class="image-field-thumb-wrap">
          <img id="thumb-${escapeHtml(id)}" src="${escapeHtml(currentValue || '/uploads/logo.png')}" alt="Preview" class="image-field-thumb" />
        </div>
        <div class="image-field-content">
          <span class="image-field-label">${escapeHtml(label)}</span>
          <div class="image-field-inputs">
            <input type="text" id="input-${escapeHtml(id)}" value="${escapeHtml(currentValue || '')}" data-img-input="${escapeHtml(id)}" placeholder="/uploads/..." />
            <button type="button" class="btn-secondary" data-browse-media="${escapeHtml(id)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              <span>Media Vault</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function bindImageFields(container, onValueChange) {
    container.querySelectorAll('[data-img-input]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = inp.getAttribute('data-img-input');
        const thumb = document.getElementById(`thumb-${id}`);
        if (thumb) thumb.src = inp.value;
        onValueChange(id, inp.value);
        markUnsaved(true);
      });
    });

    container.querySelectorAll('[data-browse-media]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-browse-media');
        openMediaModal((selectedUrl) => {
          const inp = document.getElementById(`input-${id}`);
          const thumb = document.getElementById(`thumb-${id}`);
          if (inp) inp.value = selectedUrl;
          if (thumb) thumb.src = selectedUrl;
          onValueChange(id, selectedUrl);
          markUnsaved(true);
        });
      });
    });
  }

  // --- TAB RENDERERS ---

  async function renderDashboardTab(pane) {
    await loadInquiries();
    const coreCount = (cmsData.coreServices?.items || []).length;
    const expCount = (cmsData.expansionPortfolio?.items || []).length;
    const orgCount = (cmsData.organizationStructure?.nodes || []).length;

    pane.innerHTML = `
      <div class="editor-header">
        <div class="editor-header-text">
          <h2>Executive Command Center</h2>
          <p>Central management console for Avigo Oil and Gas Integrated Ltd. standalone corporate pages, service divisions, leadership hierarchy, and inquiries.</p>
        </div>
        <a href="/" target="_blank" class="btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          <span>Launch Public Website</span>
        </a>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-num">4</div>
          <div class="stat-label">Unified Standalone Pages (/, /about, /services, /contact)</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${coreCount + expCount}</div>
          <div class="stat-label">Active Service Sectors (${coreCount} Core + ${expCount} Expansion)</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${orgCount}</div>
          <div class="stat-label">Organization Hierarchy Roles</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">${inquiriesList.length}</div>
          <div class="stat-label">Corporate Client Inquiries Received</div>
        </div>
      </div>

      <div class="cms-card">
        <div class="cms-card-header">
          <h3>
            <span>Standalone Corporate Pages Architecture</span>
            <span class="card-title-badge">4 STANDALONE ROUTES</span>
          </h3>
        </div>
        <div class="form-grid-2">
          <div class="repeater-item">
            <div class="repeater-item-top">
              <strong>Home Page (/)</strong>
              <a href="/" target="_blank" class="btn-secondary" style="text-decoration:none;">Open Page</a>
            </div>
            <p class="help-text" style="margin-bottom:10px;">Includes the Modern Cover &amp; Hero Showcase, Executive Summary, and Major Services Snapshot.</p>
            <div class="repeater-actions">
              <button type="button" class="btn-secondary" data-jump-tab="tab-hero">Edit Cover / Hero Showcase</button>
              <button type="button" class="btn-secondary" data-jump-tab="tab-intro">Edit Executive Summary</button>
            </div>
          </div>

          <div class="repeater-item">
            <div class="repeater-item-top">
              <strong>About Us Page (/about)</strong>
              <a href="/about" target="_blank" class="btn-secondary" style="text-decoration:none;">Open Page</a>
            </div>
            <p class="help-text" style="margin-bottom:10px;">Unifies Introduction &amp; Vision/Mission, Organization Structure, Commitments, and Our People.</p>
            <div class="repeater-actions" style="flex-wrap:wrap;">
              <button type="button" class="btn-secondary" data-jump-tab="tab-intro">Intro &amp; Vision</button>
              <button type="button" class="btn-secondary" data-jump-tab="tab-org">Org Chart</button>
              <button type="button" class="btn-secondary" data-jump-tab="tab-commitments">Commitments</button>
              <button type="button" class="btn-secondary" data-jump-tab="tab-people">Our People</button>
            </div>
          </div>

          <div class="repeater-item">
            <div class="repeater-item-top">
              <strong>Services &amp; Portfolio Page (/services)</strong>
              <a href="/services" target="_blank" class="btn-secondary" style="text-decoration:none;">Open Page</a>
            </div>
            <p class="help-text" style="margin-bottom:10px;">Unifies Major Services Overview, Global Expertise Core Divisions, and Expanding Global Portfolio.</p>
            <div class="repeater-actions" style="flex-wrap:wrap;">
              <button type="button" class="btn-secondary" data-jump-tab="tab-major-services">Overview</button>
              <button type="button" class="btn-secondary" data-jump-tab="tab-services">Core Divisions</button>
              <button type="button" class="btn-secondary" data-jump-tab="tab-expansion">Expansion Sectors</button>
            </div>
          </div>

          <div class="repeater-item">
            <div class="repeater-item-top">
              <strong>Contact Us Page (/contact)</strong>
              <a href="/contact" target="_blank" class="btn-secondary" style="text-decoration:none;">Open Page</a>
            </div>
            <p class="help-text" style="margin-bottom:10px;">Unifies Abuja &amp; Port Harcourt Offices, Direct Phones/Emails, and the Corporate Quote &amp; Inquiry Form.</p>
            <div class="repeater-actions">
              <button type="button" class="btn-secondary" data-jump-tab="tab-contact">Edit Offices &amp; Phones</button>
              <button type="button" class="btn-secondary" data-jump-tab="tab-inquiries">View Inquiries (${inquiriesList.length})</button>
            </div>
          </div>
        </div>
      </div>
    `;

    pane.querySelectorAll('[data-jump-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-jump-tab')));
    });
  }

  async function renderInquiriesTab(pane) {
    await loadInquiries();
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Corporate Client Inquiries &amp; Quote Requests</h2>
          <p>Messages submitted by visitors on the standalone Contact Us (/contact) page.</p>
        </div>
      </div>

      <div class="cms-card">
        <h3>Received Inquiries (${inquiriesList.length})</h3>
        ${inquiriesList.length === 0 ? `<p class="help-text">No inquiries received yet.</p>` : inquiriesList.map((inq) => `
          <div class="repeater-item">
            <div class="repeater-item-top">
              <div>
                <strong>${escapeHtml(inq.name)}</strong> ${inq.company ? `— <span>${escapeHtml(inq.company)}</span>` : ''}
                <span class="help-text" style="margin-left:10px;">${new Date(inq.createdAt).toLocaleString()}</span>
              </div>
              <button type="button" class="btn-danger" data-del-inq="${escapeHtml(inq.id)}">Delete</button>
            </div>
            <div class="form-grid-3" style="margin-bottom:10px;font-size:13px;">
              <div><strong>Sector:</strong> ${escapeHtml(inq.sector)}</div>
              <div><strong>Email:</strong> <a href="mailto:${escapeHtml(inq.email)}">${escapeHtml(inq.email)}</a></div>
              <div><strong>Phone:</strong> <a href="tel:${escapeHtml(inq.phone)}">${escapeHtml(inq.phone || 'N/A')}</a></div>
            </div>
            <div style="background:#FFFFFF;padding:12px;border:1px solid #E2E8F0;border-radius:6px;">
              ${escapeHtml(inq.message)}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    pane.querySelectorAll('[data-del-inq]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-inq');
        await apiFetch(`/api/inquiries/${id}`, { method: 'DELETE' });
        showToast('Inquiry deleted');
        renderInquiriesTab(pane);
      });
    });
  }

  function renderSectionsOrderTab(pane) {
    const nav = cmsData.siteSettings.navigation || [];
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Header Navigation Menus &amp; Sub-Menus</h2>
          <p>Customize the 4 top-level standalone page menus (Home, About Us, Services, Contact Us) and their dropdown links.</p>
        </div>
      </div>
      <div class="cms-card">
        <h3>Top-Level Standalone Page Menus</h3>
        ${nav.map((item, idx) => `
          <div class="repeater-item">
            <div class="repeater-item-top">
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="checkbox" data-nav-vis="${idx}" ${item.visible !== false ? 'checked' : ''} />
                <strong>Menu #${idx + 1}: ${escapeHtml(item.label)} (${escapeHtml(item.target)})</strong>
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Menu Label</label>
                <input type="text" data-nav-label="${idx}" value="${escapeHtml(item.label)}" />
              </div>
              <div class="form-group">
                <label>Standalone Route URL</label>
                <input type="text" data-nav-target="${idx}" value="${escapeHtml(item.target)}" />
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    pane.querySelectorAll('[data-nav-vis]').forEach((cb) => {
      cb.addEventListener('change', () => {
        nav[Number(cb.getAttribute('data-nav-vis'))].visible = cb.checked;
        markUnsaved(true);
      });
    });
    pane.querySelectorAll('[data-nav-label]').forEach((inp) => {
      inp.addEventListener('input', () => {
        nav[Number(inp.getAttribute('data-nav-label'))].label = inp.value;
        markUnsaved(true);
      });
    });
    pane.querySelectorAll('[data-nav-target]').forEach((inp) => {
      inp.addEventListener('input', () => {
        nav[Number(inp.getAttribute('data-nav-target'))].target = inp.value;
        markUnsaved(true);
      });
    });
  }

  function renderHeroTab(pane) {
    const h = cmsData.hero;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Cover &amp; Modern Hero Showcase</h2>
          <p>Edit the kinetic headline words, executive subtitle, eyebrow label, and interactive 3-slide visual showcase on the Home page.</p>
        </div>
      </div>
      <div class="cms-card">
        <div class="cms-card-header">
          <h3>
            <span>Cover Headline &amp; Executive Summary</span>
            <span class="card-title-badge">HERO CONTENT</span>
          </h3>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Headline Word 1 (Light Accent)</label>
            <input type="text" id="hero-word1" value="${escapeHtml(h.word1)}" />
          </div>
          <div class="form-group">
            <label>Headline Word 2 (Brand Green)</label>
            <input type="text" id="hero-word2" value="${escapeHtml(h.word2)}" />
          </div>
          <div class="form-group">
            <label>Headline Word 3 (Teal Accent)</label>
            <input type="text" id="hero-word3" value="${escapeHtml(h.word3)}" />
          </div>
          <div class="form-group">
            <label>Headline Word 4 (Light Accent)</label>
            <input type="text" id="hero-word4" value="${escapeHtml(h.word4)}" />
          </div>
        </div>
        <div class="form-group">
          <label>Eyebrow Badge Label</label>
          <input type="text" id="hero-profile-label" value="${escapeHtml(h.profileLabel)}" />
        </div>
        <div class="form-group">
          <label>Hero Executive Summary Subtitle</label>
          <textarea id="hero-subtitle" rows="3">${escapeHtml(h.subtitle || '')}</textarea>
        </div>
      </div>

      <div class="cms-card">
        <div class="cms-card-header">
          <h3>
            <span>Full-Bleed Background Showcase Slides</span>
            <span class="card-title-badge">3 ROTATING SLIDES</span>
          </h3>
        </div>
        <p class="field-help" style="margin-bottom:14px;">High-definition visual assets that cycle smoothly with soft opacity in the Hero section.</p>
        ${renderImageFieldHtml('heroImage', 'Primary Showcase Slide (Refinery Pipeline)', h.heroImage)}
        ${renderImageFieldHtml('secondaryHeroImage', 'Secondary Showcase Slide (Gas Manifold Facility)', h.secondaryHeroImage || '/uploads/page02-gas-manifold.jpg')}
        ${renderImageFieldHtml('tertiaryHeroImage', 'Tertiary Showcase Slide (Petrochemical Complex)', h.tertiaryHeroImage || '/uploads/page08-petrochemical-plant.jpg')}
      </div>

      <div class="cms-card">
        <div class="cms-card-header">
          <h3>
            <span>Hero Base Service Dock (${(h.pillars || []).length} Cards)</span>
            <span class="card-title-badge">KEY DIVISIONS DOCK</span>
          </h3>
        </div>
        <div class="form-grid-2">
          ${(h.pillars || []).map((p, pIdx) => `
            <div class="repeater-item">
              <div class="form-group">
                <label>Card Title</label>
                <input type="text" data-pillar-title="${pIdx}" value="${escapeHtml(p.title || p.label || '')}" />
              </div>
              <div class="form-group">
                <label>Summary / Core Description</label>
                <textarea data-pillar-summary="${pIdx}" rows="2">${escapeHtml(p.summary || p.value || '')}</textarea>
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label>Link Target</label>
                <input type="text" data-pillar-target="${pIdx}" value="${escapeHtml(p.target || '/services#global-expertise')}" />
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    ['word1', 'word2', 'word3', 'word4'].forEach((k) => {
      document.getElementById(`hero-${k}`).addEventListener('input', (e) => {
        h[k] = e.target.value;
        markUnsaved(true);
      });
    });
    document.getElementById('hero-profile-label').addEventListener('input', (e) => {
      h.profileLabel = e.target.value;
      markUnsaved(true);
    });
    document.getElementById('hero-subtitle').addEventListener('input', (e) => {
      h.subtitle = e.target.value;
      markUnsaved(true);
    });
    bindImageFields(pane, (id, val) => { h[id] = val; });

    pane.querySelectorAll('[data-pillar-title]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.getAttribute('data-pillar-title'));
        h.pillars[idx].title = inp.value;
        markUnsaved(true);
      });
    });
    pane.querySelectorAll('[data-pillar-summary]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.getAttribute('data-pillar-summary'));
        h.pillars[idx].summary = inp.value;
        markUnsaved(true);
      });
    });
    pane.querySelectorAll('[data-pillar-target]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const idx = Number(inp.getAttribute('data-pillar-target'));
        h.pillars[idx].target = inp.value;
        markUnsaved(true);
      });
    });
  }

  function renderIntroTab(pane) {
    const intro = cmsData.introduction;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Introduction, Vision &amp; Mission</h2>
          <p>Displayed on the standalone About Us (/about) page and Home overview.</p>
        </div>
      </div>
      <div class="cms-card">
        <h3>Introduction Banner</h3>
        <div class="form-group">
          <label>Section Heading</label>
          <input type="text" id="intro-title" value="${escapeHtml(intro.title)}" />
        </div>
        <div class="form-group">
          <label>Introduction Body Text</label>
          <textarea id="intro-body" rows="6">${escapeHtml(intro.body)}</textarea>
        </div>
        ${renderImageFieldHtml('bannerImage', 'Introduction Banner Background Image', intro.bannerImage)}
      </div>

      <div class="cms-card">
        <h3>Our Vision &amp; Our Mission Cards</h3>
        <div class="form-grid-2">
          <div>
            <div class="form-group">
              <label>Vision Card Title</label>
              <input type="text" id="vision-title" value="${escapeHtml(intro.visionTitle)}" />
            </div>
            <div class="form-group">
              <label>Vision Statement</label>
              <textarea id="vision-body" rows="6">${escapeHtml(intro.visionBody)}</textarea>
            </div>
          </div>
          <div>
            <div class="form-group">
              <label>Mission Card Title</label>
              <input type="text" id="mission-title" value="${escapeHtml(intro.missionTitle)}" />
            </div>
            <div class="form-group">
              <label>Mission Statement</label>
              <textarea id="mission-body" rows="6">${escapeHtml(intro.missionBody)}</textarea>
            </div>
          </div>
        </div>
      </div>
    `;

    const bind = (id, key) => {
      document.getElementById(id).addEventListener('input', (e) => {
        intro[key] = e.target.value;
        markUnsaved(true);
      });
    };
    bind('intro-title', 'title');
    bind('intro-body', 'body');
    bind('vision-title', 'visionTitle');
    bind('vision-body', 'visionBody');
    bind('mission-title', 'missionTitle');
    bind('mission-body', 'missionBody');
    bindImageFields(pane, (id, val) => { intro[id] = val; });
  }

  function renderMajorServicesTab(pane) {
    const ms = cmsData.majorServicesOverview;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Our Major Services Overview</h2>
          <p>Edit the Precision &amp; Quality tagline, Major Services list, and Expansion Portfolio summary.</p>
        </div>
      </div>
      <div class="cms-card">
        <h3>Headings &amp; Visual Backdrop</h3>
        <div class="form-grid-3">
          <div class="form-group">
            <label>Top Tagline Left</label>
            <input type="text" id="ms-tag-left" value="${escapeHtml(ms.taglineLeft)}" />
          </div>
          <div class="form-group">
            <label>Center Symbol</label>
            <input type="text" id="ms-tag-center" value="${escapeHtml(ms.taglineCenter)}" />
          </div>
          <div class="form-group">
            <label>Top Tagline Right</label>
            <input type="text" id="ms-tag-right" value="${escapeHtml(ms.taglineRight)}" />
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Primary Heading</label>
            <input type="text" id="ms-main-heading" value="${escapeHtml(ms.mainHeading)}" />
          </div>
          <div class="form-group">
            <label>Secondary Heading</label>
            <input type="text" id="ms-sub-heading" value="${escapeHtml(ms.subHeading)}" />
          </div>
        </div>
        ${renderImageFieldHtml('backgroundImage', 'Left Construction Cranes Visual', ms.backgroundImage)}
      </div>

      <div class="cms-card">
        <h3>Service Lists (One service per line)</h3>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Major Services List (One per line)</label>
            <textarea id="ms-major-list" rows="6">${escapeHtml((ms.majorServices || []).join('\n'))}</textarea>
          </div>
          <div class="form-group">
            <label>Expansion Services List (One per line)</label>
            <textarea id="ms-exp-list" rows="9">${escapeHtml((ms.expansionServices || []).join('\n'))}</textarea>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ms-tag-left').addEventListener('input', (e) => { ms.taglineLeft = e.target.value; markUnsaved(true); });
    document.getElementById('ms-tag-center').addEventListener('input', (e) => { ms.taglineCenter = e.target.value; markUnsaved(true); });
    document.getElementById('ms-tag-right').addEventListener('input', (e) => { ms.taglineRight = e.target.value; markUnsaved(true); });
    document.getElementById('ms-main-heading').addEventListener('input', (e) => { ms.mainHeading = e.target.value; markUnsaved(true); });
    document.getElementById('ms-sub-heading').addEventListener('input', (e) => { ms.subHeading = e.target.value; markUnsaved(true); });
    document.getElementById('ms-major-list').addEventListener('input', (e) => {
      ms.majorServices = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      markUnsaved(true);
    });
    document.getElementById('ms-exp-list').addEventListener('input', (e) => {
      ms.expansionServices = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      markUnsaved(true);
    });
    bindImageFields(pane, (id, val) => { ms[id] = val; });
  }

  function renderCoreServicesTab(pane) {
    const cs = cmsData.coreServices;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Global Expertise Across Diverse Sectors</h2>
          <p>Edit the Core Divisions on the standalone Services (/services) page, or add new divisions.</p>
        </div>
        <button type="button" id="add-core-service-btn" class="btn-secondary">+ Add Core Division</button>
      </div>

      <div class="cms-card">
        <h3>Section Header</h3>
        <div class="form-group">
          <label>Section Heading</label>
          <input type="text" id="cs-title" value="${escapeHtml(cs.sectionTitle)}" />
        </div>
        <div class="form-group">
          <label>Lead Paragraph</label>
          <textarea id="cs-lead" rows="3">${escapeHtml(cs.leadText)}</textarea>
        </div>
      </div>

      <div id="core-services-list">
        ${(cs.items || []).map((item, idx) => `
          <div class="cms-card">
            <div class="repeater-item-top">
              <strong>Core Division: ${escapeHtml(item.title)}</strong>
              <button type="button" class="btn-danger" data-del-core="${idx}">Delete Division</button>
            </div>
            <div class="form-group">
              <label>Division Title</label>
              <input type="text" data-core-field="title" data-idx="${idx}" value="${escapeHtml(item.title)}" />
            </div>
            <div class="form-group">
              <label>Detailed Description</label>
              <textarea data-core-field="description" data-idx="${idx}" rows="5">${escapeHtml(item.description)}</textarea>
            </div>
            ${renderImageFieldHtml(`corePrimary_${idx}`, 'Primary Photograph', item.primaryImage)}
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('cs-title').addEventListener('input', (e) => { cs.sectionTitle = e.target.value; markUnsaved(true); });
    document.getElementById('cs-lead').addEventListener('input', (e) => { cs.leadText = e.target.value; markUnsaved(true); });

    pane.querySelectorAll('[data-core-field]').forEach((el) => {
      el.addEventListener('input', () => {
        const idx = Number(el.getAttribute('data-idx'));
        const f = el.getAttribute('data-core-field');
        cs.items[idx][f] = el.value;
        markUnsaved(true);
      });
    });

    bindImageFields(pane, (id, val) => {
      if (id.startsWith('corePrimary_')) {
        const idx = Number(id.split('_')[1]);
        cs.items[idx].primaryImage = val;
      }
    });

    pane.querySelectorAll('[data-del-core]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cs.items.splice(Number(btn.getAttribute('data-del-core')), 1);
        markUnsaved(true);
        renderCoreServicesTab(pane);
      });
    });

    document.getElementById('add-core-service-btn').addEventListener('click', () => {
      cs.items.push({
        id: `core-${Date.now()}`,
        title: 'New Core Division:',
        description: 'Enter division description here.',
        primaryImage: '/uploads/page06-logistics-cranes.jpg',
        secondaryImages: []
      });
      markUnsaved(true);
      renderCoreServicesTab(pane);
    });
  }

  function renderExpansionTab(pane) {
    const exp = cmsData.expansionPortfolio;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Expanding Our Global Footprint &amp; Service Portfolio</h2>
          <p>Edit the expansion sectors, card header styles, and petrochemical plant banner on the Services (/services) page.</p>
        </div>
        <button type="button" id="add-exp-btn" class="btn-secondary">+ Add Expansion Sector</button>
      </div>

      <div class="cms-card">
        <h3>Section Intro &amp; Banner</h3>
        <div class="form-group">
          <label>Section Heading</label>
          <input type="text" id="exp-title" value="${escapeHtml(exp.sectionTitle)}" />
        </div>
        <div class="form-group">
          <label>Lead Paragraph</label>
          <textarea id="exp-lead" rows="3">${escapeHtml(exp.leadText)}</textarea>
        </div>
        ${renderImageFieldHtml('page8BannerImage', 'Petrochemical Plant Banner', exp.page8BannerImage)}
      </div>

      <div class="cms-card">
        <h3>Expansion Portfolio Sectors (${(exp.items || []).length})</h3>
        ${(exp.items || []).map((item, idx) => `
          <div class="repeater-item">
            <div class="repeater-item-top">
              <strong>Sector: ${escapeHtml(item.title)}</strong>
              <button type="button" class="btn-danger" data-del-exp="${idx}">Remove</button>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Sector Title</label>
                <input type="text" data-exp-field="title" data-idx="${idx}" value="${escapeHtml(item.title)}" />
              </div>
              <div class="form-group">
                <label>Card Header Color Theme</label>
                <select data-exp-field="headerStyle" data-idx="${idx}">
                  <option value="outline-green" ${item.headerStyle === 'outline-green' ? 'selected' : ''}>Green Border Card</option>
                  <option value="deep-teal" ${item.headerStyle === 'deep-teal' ? 'selected' : ''}>Deep Teal Header</option>
                  <option value="sage-light" ${item.headerStyle === 'sage-light' ? 'selected' : ''}>Soft Sage Header</option>
                  <option value="forest-green" ${item.headerStyle === 'forest-green' ? 'selected' : ''}>Forest Green Header</option>
                  <option value="lime-green" ${item.headerStyle === 'lime-green' ? 'selected' : ''}>Lime Green Header</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Sector Description</label>
              <textarea data-exp-field="description" data-idx="${idx}" rows="3">${escapeHtml(item.description)}</textarea>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('exp-title').addEventListener('input', (e) => { exp.sectionTitle = e.target.value; markUnsaved(true); });
    document.getElementById('exp-lead').addEventListener('input', (e) => { exp.leadText = e.target.value; markUnsaved(true); });
    bindImageFields(pane, (id, val) => { exp[id] = val; });

    pane.querySelectorAll('[data-exp-field]').forEach((el) => {
      el.addEventListener('input', () => {
        const idx = Number(el.getAttribute('data-idx'));
        const f = el.getAttribute('data-exp-field');
        exp.items[idx][f] = el.value;
        markUnsaved(true);
      });
    });

    pane.querySelectorAll('[data-del-exp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        exp.items.splice(Number(btn.getAttribute('data-del-exp')), 1);
        markUnsaved(true);
        renderExpansionTab(pane);
      });
    });

    document.getElementById('add-exp-btn').addEventListener('click', () => {
      exp.items.push({
        id: `exp-${Date.now()}`,
        layout: 'grid-card',
        headerStyle: 'deep-teal',
        title: 'New Expansion Sector:',
        description: 'Describe the new service offering here.'
      });
      markUnsaved(true);
      renderExpansionTab(pane);
    });
  }

  function renderOrgChartTab(pane) {
    const org = cmsData.organizationStructure;
    const nodes = org.nodes || [];

    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Organization Structure Builder</h2>
          <p>Manage all ${nodes.length} organizational hierarchy roles, parent reporting lines, and node styles on the About Us (/about) page.</p>
        </div>
        <button type="button" id="add-org-node-btn" class="btn-secondary">+ Add Role to Org Chart</button>
      </div>

      <div class="cms-card">
        <h3>Banner &amp; Display Mode</h3>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Section Title</label>
            <input type="text" id="org-title" value="${escapeHtml(org.sectionTitle)}" />
          </div>
          <div class="form-group">
            <label>Default Desktop Chart View Mode</label>
            <select id="org-mode">
              <option value="interactive" ${org.displayMode !== 'image' ? 'selected' : ''}>Interactive Hierarchy Chart</option>
              <option value="image" ${org.displayMode === 'image' ? 'selected' : ''}>Original PDF Diagram Image</option>
            </select>
          </div>
        </div>
        ${renderImageFieldHtml('bannerImage', 'Top Corporate Towers Banner', org.bannerImage)}
      </div>

      <div class="cms-card">
        <h3>Organizational Roles (${nodes.length} Nodes)</h3>
        <div id="org-nodes-list">
          ${nodes.map((node, idx) => `
            <div class="repeater-item">
              <div class="form-grid-3" style="align-items:end;">
                <div class="form-group" style="margin-bottom:0;">
                  <label>Role Title</label>
                  <input type="text" data-org-field="title" data-idx="${idx}" value="${escapeHtml(node.title)}" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label>Reports To (Parent Role)</label>
                  <select data-org-field="parentId" data-idx="${idx}">
                    <option value="">-- Top Level (None) --</option>
                    ${nodes.filter((n) => n.id !== node.id).map((n) => `
                      <option value="${escapeHtml(n.id)}" ${node.parentId === n.id ? 'selected' : ''}>${escapeHtml(n.title)}</option>
                    `).join('')}
                  </select>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <div class="form-group" style="margin-bottom:0;flex:1;">
                    <label>Badge Style</label>
                    <select data-org-field="nodeType" data-idx="${idx}">
                      <option value="blue-oval" ${node.nodeType === 'blue-oval' ? 'selected' : ''}>Blue Oval (Board)</option>
                      <option value="blue-circle" ${node.nodeType === 'blue-circle' ? 'selected' : ''}>Blue Circle (CEO)</option>
                      <option value="blue-red-split" ${node.nodeType === 'blue-red-split' ? 'selected' : ''}>Blue/Red Split (Auditor)</option>
                      <option value="red-box" ${node.nodeType === 'red-box' ? 'selected' : ''}>Crimson Red Box (Department/Role)</option>
                    </select>
                  </div>
                  <button type="button" class="btn-danger" data-del-org="${idx}" style="margin-top:20px;">Delete</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('org-title').addEventListener('input', (e) => { org.sectionTitle = e.target.value; markUnsaved(true); });
    document.getElementById('org-mode').addEventListener('change', (e) => { org.displayMode = e.target.value; markUnsaved(true); });
    bindImageFields(pane, (id, val) => { org[id] = val; });

    pane.querySelectorAll('[data-org-field]').forEach((el) => {
      el.addEventListener('input', () => {
        const idx = Number(el.getAttribute('data-idx'));
        const f = el.getAttribute('data-org-field');
        org.nodes[idx][f] = el.value || null;
        markUnsaved(true);
      });
    });

    pane.querySelectorAll('[data-del-org]').forEach((btn) => {
      btn.addEventListener('click', () => {
        org.nodes.splice(Number(btn.getAttribute('data-del-org')), 1);
        markUnsaved(true);
        renderOrgChartTab(pane);
      });
    });

    document.getElementById('add-org-node-btn').addEventListener('click', () => {
      org.nodes.push({
        id: `role-${Date.now()}`,
        title: 'New Department Role',
        parentId: 'ops-manager',
        nodeType: 'red-box'
      });
      markUnsaved(true);
      renderOrgChartTab(pane);
    });
  }

  function renderCommitmentsTab(pane) {
    const comm = cmsData.commitments;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Our Commitment</h2>
          <p>Edit the core commitments and the bottom Sustainability &amp; Legal/Financial pillars on the About Us (/about) page.</p>
        </div>
        <button type="button" id="add-comm-btn" class="btn-secondary">+ Add Commitment</button>
      </div>

      <div class="cms-card">
        <h3>Section Heading &amp; Lead Line</h3>
        <div class="form-group">
          <label>Heading</label>
          <input type="text" id="comm-title" value="${escapeHtml(comm.sectionTitle)}" />
        </div>
        <div class="form-group">
          <label>Lead Line</label>
          <input type="text" id="comm-lead" value="${escapeHtml(comm.leadText)}" />
        </div>
      </div>

      <div class="cms-card">
        <h3>Core Commitments List</h3>
        ${(comm.items || []).map((item, idx) => `
          <div class="repeater-item">
            <div class="repeater-item-top">
              <strong>Commitment: ${escapeHtml(item.title)}</strong>
              <button type="button" class="btn-danger" data-del-comm="${idx}">Remove</button>
            </div>
            <div class="form-group">
              <label>Bold Prefix Title</label>
              <input type="text" data-comm-field="title" data-idx="${idx}" value="${escapeHtml(item.title)}" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea data-comm-field="description" data-idx="${idx}" rows="2">${escapeHtml(item.description)}</textarea>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="cms-card">
        <h3>Bottom Feature Pillars (Sustainability &amp; Legal Framework)</h3>
        <div class="form-grid-2">
          ${(comm.pillars || []).map((p, idx) => `
            <div class="repeater-item">
              <div class="form-group">
                <label>Pillar Title</label>
                <input type="text" data-pillar-field="title" data-idx="${idx}" value="${escapeHtml(p.title)}" />
              </div>
              <div class="form-group">
                <label>Pillar Description</label>
                <textarea data-pillar-field="description" data-idx="${idx}" rows="4">${escapeHtml(p.description)}</textarea>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('comm-title').addEventListener('input', (e) => { comm.sectionTitle = e.target.value; markUnsaved(true); });
    document.getElementById('comm-lead').addEventListener('input', (e) => { comm.leadText = e.target.value; markUnsaved(true); });

    pane.querySelectorAll('[data-comm-field]').forEach((el) => {
      el.addEventListener('input', () => {
        const idx = Number(el.getAttribute('data-idx'));
        comm.items[idx][el.getAttribute('data-comm-field')] = el.value;
        markUnsaved(true);
      });
    });

    pane.querySelectorAll('[data-pillar-field]').forEach((el) => {
      el.addEventListener('input', () => {
        const idx = Number(el.getAttribute('data-idx'));
        comm.pillars[idx][el.getAttribute('data-pillar-field')] = el.value;
        markUnsaved(true);
      });
    });

    pane.querySelectorAll('[data-del-comm]').forEach((btn) => {
      btn.addEventListener('click', () => {
        comm.items.splice(Number(btn.getAttribute('data-del-comm')), 1);
        markUnsaved(true);
        renderCommitmentsTab(pane);
      });
    });

    document.getElementById('add-comm-btn').addEventListener('click', () => {
      comm.items.push({ id: `comm-${Date.now()}`, title: 'New Commitment:', description: 'Details here.' });
      markUnsaved(true);
      renderCommitmentsTab(pane);
    });
  }

  function renderPeopleTab(pane) {
    const p = cmsData.people;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Our People</h2>
          <p>Edit the Our People narrative paragraphs, specialist callout quotes, and photographs on the About Us (/about) page.</p>
        </div>
      </div>

      <div class="cms-card">
        <h3>Top Highlight Quote &amp; Heading</h3>
        <div class="form-grid-3">
          <div class="form-group">
            <label>Quote Prefix</label>
            <input type="text" id="p-pre" value="${escapeHtml(p.topHighlightPrefix)}" />
          </div>
          <div class="form-group">
            <label>Green Highlighted Phrase</label>
            <input type="text" id="p-green" value="${escapeHtml(p.topHighlightGreen)}" />
          </div>
          <div class="form-group">
            <label>Quote Suffix</label>
            <input type="text" id="p-suf" value="${escapeHtml(p.topHighlightSuffix)}" />
          </div>
        </div>
        <div class="form-group">
          <label>Section Heading</label>
          <input type="text" id="p-title" value="${escapeHtml(p.sectionTitle)}" />
        </div>
        <div class="form-group">
          <label>Body Paragraphs (Separate paragraphs with a blank line)</label>
          <textarea id="p-paras" rows="9">${escapeHtml((p.paragraphs || []).join('\n\n'))}</textarea>
        </div>
        <div class="form-group">
          <label>Bottom Callout Box Text</label>
          <textarea id="p-bottom" rows="3">${escapeHtml(p.bottomCallout)}</textarea>
        </div>
        <div class="form-grid-2">
          ${renderImageFieldHtml('leftImage', 'Left Full-Height Specialist Photo', p.leftImage)}
          ${renderImageFieldHtml('rightImage', 'Bottom Right Grating Photo', p.rightImage)}
        </div>
      </div>
    `;

    document.getElementById('p-pre').addEventListener('input', (e) => { p.topHighlightPrefix = e.target.value; markUnsaved(true); });
    document.getElementById('p-green').addEventListener('input', (e) => { p.topHighlightGreen = e.target.value; markUnsaved(true); });
    document.getElementById('p-suf').addEventListener('input', (e) => { p.topHighlightSuffix = e.target.value; markUnsaved(true); });
    document.getElementById('p-title').addEventListener('input', (e) => { p.sectionTitle = e.target.value; markUnsaved(true); });
    document.getElementById('p-paras').addEventListener('input', (e) => {
      p.paragraphs = e.target.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
      markUnsaved(true);
    });
    document.getElementById('p-bottom').addEventListener('input', (e) => { p.bottomCallout = e.target.value; markUnsaved(true); });
    bindImageFields(pane, (id, val) => { p[id] = val; });
  }

  function renderContactTab(pane) {
    const ct = cmsData.contact;
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Corporate Contact &amp; Office Locations</h2>
          <p>Edit Abuja &amp; Port Harcourt addresses, phone numbers, website URL, emails, and storage vessel photo.</p>
        </div>
      </div>

      <div class="cms-card">
        <h3>Office Addresses</h3>
        <div class="form-grid-2">
          <div>
            <div class="form-group">
              <label>Abuja Address Heading</label>
              <input type="text" id="ct-abuja-title" value="${escapeHtml(ct.abujaTitle)}" />
            </div>
            <div class="form-group">
              <label>Abuja Address Lines (One per line)</label>
              <textarea id="ct-abuja-lines" rows="4">${escapeHtml((ct.abujaLines || []).join('\n'))}</textarea>
            </div>
          </div>
          <div>
            <div class="form-group">
              <label>Port Harcourt Address Heading</label>
              <input type="text" id="ct-ph-title" value="${escapeHtml(ct.phTitle)}" />
            </div>
            <div class="form-group">
              <label>Port Harcourt Address Lines (One per line)</label>
              <textarea id="ct-ph-lines" rows="4">${escapeHtml((ct.phLines || []).join('\n'))}</textarea>
            </div>
          </div>
        </div>
      </div>

      <div class="cms-card">
        <h3>Phones, Website &amp; Emails</h3>
        <div class="form-grid-3">
          <div class="form-group">
            <label>Phone Numbers (One per line)</label>
            <textarea id="ct-phones" rows="4">${escapeHtml((ct.phones || []).join('\n'))}</textarea>
          </div>
          <div class="form-group">
            <label>Official Website</label>
            <input type="text" id="ct-web" value="${escapeHtml(ct.website)}" />
          </div>
          <div class="form-group">
            <label>Email Addresses (One per line)</label>
            <textarea id="ct-emails" rows="4">${escapeHtml((ct.emails || []).join('\n'))}</textarea>
          </div>
        </div>
        ${renderImageFieldHtml('bannerImage', 'Top Industrial Storage Vessel (E-8) Photo', ct.bannerImage)}
      </div>
    `;

    document.getElementById('ct-abuja-title').addEventListener('input', (e) => { ct.abujaTitle = e.target.value; markUnsaved(true); });
    document.getElementById('ct-abuja-lines').addEventListener('input', (e) => {
      ct.abujaLines = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      markUnsaved(true);
    });
    document.getElementById('ct-ph-title').addEventListener('input', (e) => { ct.phTitle = e.target.value; markUnsaved(true); });
    document.getElementById('ct-ph-lines').addEventListener('input', (e) => {
      ct.phLines = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      markUnsaved(true);
    });
    document.getElementById('ct-phones').addEventListener('input', (e) => {
      ct.phones = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      markUnsaved(true);
    });
    document.getElementById('ct-web').addEventListener('input', (e) => { ct.website = e.target.value; markUnsaved(true); });
    document.getElementById('ct-emails').addEventListener('input', (e) => {
      ct.emails = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      markUnsaved(true);
    });
    bindImageFields(pane, (id, val) => { ct[id] = val; });
  }

  function renderCustomBlocksTab(pane) {
    if (!Array.isArray(cmsData.customBlocks)) cmsData.customBlocks = [];
    const blocks = cmsData.customBlocks;

    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Custom Corporate Sections Builder</h2>
          <p>Add extra custom sections, project showcases, or certifications to expand the website.</p>
        </div>
        <button type="button" id="add-custom-block-btn" class="btn-secondary">+ Add Custom Section</button>
      </div>

      ${blocks.length === 0 ? `
        <div class="cms-card">
          <p class="help-text">No custom sections added yet. All original corporate profile sections are active. Click "+ Add Custom Section" above if you wish to add extra sections.</p>
        </div>
      ` : blocks.map((b, idx) => `
        <div class="cms-card">
          <div class="repeater-item-top">
            <strong>Custom Section #${idx + 1}: ${escapeHtml(b.title)}</strong>
            <button type="button" class="btn-danger" data-del-custom="${idx}">Delete Section</button>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label>Section Heading</label>
              <input type="text" data-cb-field="title" data-idx="${idx}" value="${escapeHtml(b.title)}" />
            </div>
            <div class="form-group">
              <label>Subtitle / Lead Text</label>
              <input type="text" data-cb-field="subtitle" data-idx="${idx}" value="${escapeHtml(b.subtitle || '')}" />
            </div>
          </div>
          <div class="form-group">
            <label>Body Content</label>
            <textarea data-cb-field="body" data-idx="${idx}" rows="4">${escapeHtml(b.body || '')}</textarea>
          </div>
          ${renderImageFieldHtml(`customImg_${idx}`, 'Optional Featured Image', b.imageUrl || '')}
        </div>
      `).join('')}
    `;

    pane.querySelectorAll('[data-cb-field]').forEach((el) => {
      el.addEventListener('input', () => {
        const idx = Number(el.getAttribute('data-idx'));
        blocks[idx][el.getAttribute('data-cb-field')] = el.value;
        markUnsaved(true);
      });
    });

    bindImageFields(pane, (id, val) => {
      if (id.startsWith('customImg_')) {
        const idx = Number(id.split('_')[1]);
        blocks[idx].imageUrl = val;
      }
    });

    pane.querySelectorAll('[data-del-custom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        blocks.splice(Number(btn.getAttribute('data-del-custom')), 1);
        markUnsaved(true);
        renderCustomBlocksTab(pane);
      });
    });

    document.getElementById('add-custom-block-btn').addEventListener('click', () => {
      blocks.push({
        id: `sec-${Date.now()}`,
        title: 'Our Certifications & Quality Compliance',
        subtitle: 'International Standards & Regulatory Registrations',
        body: 'Avigo Oil and Gas Integrated Ltd. operates in full compliance with Nigerian and international regulatory standards.',
        imageUrl: '',
        visible: true
      });
      markUnsaved(true);
      renderCustomBlocksTab(pane);
    });
  }

  async function renderMediaTab(pane) {
    await loadMediaList();
    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Avigo Media Vault</h2>
          <p>Manage all extracted PDF photographs, corporate logos, and upload new media assets.</p>
        </div>
        <label class="btn-primary" style="cursor:pointer;">
          <span>+ Upload New Image</span>
          <input type="file" id="library-upload-input" accept="image/*" style="display:none;" />
        </label>
      </div>

      <div class="cms-card">
        <h3>Corporate Media Assets (${mediaFiles.length} Files)</h3>
        <div class="media-grid">
          ${mediaFiles.map((m) => `
            <div class="media-card">
              ${m.isPdf ? `
                <div class="media-card-thumb" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:#0B5D69;">PDF PROFILE</div>
              ` : `
                <img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.name)}" class="media-card-thumb" />
              `}
              <div class="media-card-info">
                <div class="media-card-name">${escapeHtml(m.name)}</div>
                <div class="help-text">${(m.size / 1024).toFixed(1)} KB</div>
                <div style="display:flex;gap:6px;">
                  <button type="button" class="btn-secondary" data-copy-url="${escapeHtml(m.url)}">Copy Path</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const fileInput = document.getElementById('library-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files[0]) {
          await uploadFileFromInput(fileInput.files[0]);
          renderMediaTab(pane);
        }
      });
    }

    pane.querySelectorAll('[data-copy-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.getAttribute('data-copy-url'));
        showToast('Copied asset path to clipboard');
      });
    });
  }

  function renderAppearanceTab(pane) {
    const s = cmsData.siteSettings;
    const c = s.colors || {};

    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Avigo Brand Identity &amp; Color System</h2>
          <p>Customize the company legal name, tagline, brand logo, and corporate color variables.</p>
        </div>
      </div>

      <div class="cms-card">
        <h3>Corporate Identity &amp; Logo</h3>
        <div class="form-grid-2">
          <div class="form-group">
            <label>Company Legal Name</label>
            <input type="text" id="site-company" value="${escapeHtml(s.companyName)}" />
          </div>
          <div class="form-group">
            <label>Corporate Tagline</label>
            <input type="text" id="site-tagline" value="${escapeHtml(s.tagline)}" />
          </div>
        </div>
        ${renderImageFieldHtml('logoUrl', 'Primary Corporate Logo (PNG)', s.logoUrl)}
      </div>

      <div class="cms-card">
        <h3>Avigo Brand Color Palette</h3>
        <div class="form-grid-3">
          <div class="form-group">
            <label>Primary Brand Green</label>
            <input type="text" id="col-green" value="${escapeHtml(c.primaryGreen || '#76B843')}" />
          </div>
          <div class="form-group">
            <label>Deep Petroleum Teal</label>
            <input type="text" id="col-teal" value="${escapeHtml(c.deepTeal || '#0B5D69')}" />
          </div>
          <div class="form-group">
            <label>Forest Heading Green</label>
            <input type="text" id="col-forest" value="${escapeHtml(c.forestGreen || '#16794B')}" />
          </div>
        </div>
      </div>
    `;

    document.getElementById('site-company').addEventListener('input', (e) => { s.companyName = e.target.value; markUnsaved(true); });
    document.getElementById('site-tagline').addEventListener('input', (e) => { s.tagline = e.target.value; markUnsaved(true); });
    document.getElementById('col-green').addEventListener('input', (e) => { s.colors.primaryGreen = e.target.value; markUnsaved(true); });
    document.getElementById('col-teal').addEventListener('input', (e) => { s.colors.deepTeal = e.target.value; markUnsaved(true); });
    document.getElementById('col-forest').addEventListener('input', (e) => { s.colors.forestGreen = e.target.value; markUnsaved(true); });
    bindImageFields(pane, (id, val) => { s[id] = val; });
  }

  async function renderRevisionsTab(pane) {
    let revisions = [];
    try {
      const res = await apiFetch('/api/revisions');
      revisions = res.revisions || [];
    } catch (e) {}

    pane.innerHTML = `
      <div class="editor-header">
        <div>
          <h2>Revision Snapshots, Reset to PDF Default &amp; Admin Security</h2>
          <p>Restore previous versions, reset to the exact original 13-page PDF content, or update your Avigo Admin credentials.</p>
        </div>
        <button type="button" id="reset-pdf-btn" class="btn-danger">Reset Website to Original PDF Content</button>
      </div>

      <div class="cms-card">
        <h3>Saved Content Revisions (${revisions.length})</h3>
        ${revisions.length === 0 ? `<p class="help-text">No revision snapshots yet. Revisions are saved automatically each time you publish changes.</p>` : `
          <div>
            ${revisions.map((r) => `
              <div class="repeater-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;">
                <div>
                  <strong>${escapeHtml(r.label)}</strong>
                  <div class="help-text">${new Date(r.timestamp).toLocaleString()} (${escapeHtml(r.id)})</div>
                </div>
                <button type="button" class="btn-secondary" data-restore-rev="${escapeHtml(r.id)}">Restore This Version</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div class="cms-card">
        <h3>Update Avigo Admin Credentials</h3>
        <form id="password-form" class="form-grid-3" style="align-items:end;">
          <div class="form-group" style="margin-bottom:0;">
            <label>New Admin Username</label>
            <input type="text" id="sec-user" value="admin" required />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>Current Password</label>
            <input type="password" id="sec-cur-pass" required />
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>New Password</label>
            <input type="password" id="sec-new-pass" required />
          </div>
          <div style="margin-top:12px;">
            <button type="submit" class="btn-primary">Update Credentials</button>
          </div>
        </form>
      </div>
    `;

    document.getElementById('reset-pdf-btn').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to restore the website to the exact original 13-page PDF seed content?')) return;
      const res = await apiFetch('/api/content/reset', { method: 'POST' });
      cmsData = res.content;
      markUnsaved(false);
      showToast(res.message);
      renderRevisionsTab(pane);
    });

    pane.querySelectorAll('[data-restore-rev]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const revId = btn.getAttribute('data-restore-rev');
        const res = await apiFetch('/api/revisions/restore', {
          method: 'POST',
          body: JSON.stringify({ id: revId })
        });
        cmsData = res.content;
        markUnsaved(false);
        showToast('Revision restored and published');
        renderRevisionsTab(pane);
      });
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await apiFetch('/api/auth/password', {
          method: 'POST',
          body: JSON.stringify({
            newUsername: document.getElementById('sec-user').value,
            currentPassword: document.getElementById('sec-cur-pass').value,
            newPassword: document.getElementById('sec-new-pass').value
          })
        });
        setToken(res.token);
        showToast(res.message);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  let adminProfile = {
    username: 'admin',
    displayName: 'Executive Administrator',
    email: 'admin@theavigo.com',
    role: 'Super Administrator & Portal Lead',
    phone: '+2349069655238',
    avatarUrl: '/uploads/logo.png',
    lastLogin: null
  };

  async function loadAdminProfile() {
    try {
      const res = await apiFetch('/api/auth/profile');
      adminProfile = Object.assign(adminProfile, res);
      updateTopbarProfileUi();
    } catch (e) {
      console.warn('Could not load profile:', e.message);
    }
  }

  function updateTopbarProfileUi() {
    const nameEl = document.getElementById('topbar-user-name');
    const roleEl = document.getElementById('topbar-user-role');
    const avatarEl = document.getElementById('topbar-avatar');
    if (nameEl) nameEl.textContent = adminProfile.displayName || adminProfile.username;
    if (roleEl) roleEl.textContent = adminProfile.role || 'Super Admin';
    if (avatarEl) {
      if (adminProfile.avatarUrl && (adminProfile.avatarUrl.endsWith('.png') || adminProfile.avatarUrl.endsWith('.jpg') || adminProfile.avatarUrl.endsWith('.jpeg'))) {
        avatarEl.innerHTML = `<img src="${escapeHtml(adminProfile.avatarUrl)}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
      } else {
        avatarEl.textContent = (adminProfile.displayName || adminProfile.username || 'A')[0].toUpperCase();
      }
    }
  }

  async function renderProfileTab(pane) {
    await loadAdminProfile();
    pane.innerHTML = `
      <div class="editor-header">
        <div class="editor-header-text">
          <h2>Admin Profile &amp; Security Governance</h2>
          <p>Manage your executive administrator credentials, contact information, profile avatar, and account password.</p>
        </div>
      </div>

      <div class="profile-executive-grid">
        <!-- 1. Profile Overview Card -->
        <div class="cms-card">
          <div class="cms-card-header">
            <h3>
              <span>Executive Profile Information</span>
              <span class="card-title-badge">PORTAL LEAD</span>
            </h3>
          </div>
          <div class="profile-card-top" style="display:flex;align-items:center;gap:20px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #EEF2F6;">
            <div class="profile-avatar-large" style="width:78px;height:78px;border-radius:50%;border:3px solid var(--avigo-green);overflow:hidden;background:#FFFFFF;box-shadow:var(--shadow-md);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <img id="profile-display-avatar" src="${escapeHtml(adminProfile.avatarUrl || '/uploads/logo.png')}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <div>
              <h3 style="margin-bottom:4px;font-size:1.25rem;">${escapeHtml(adminProfile.displayName)}</h3>
              <p style="color:var(--avigo-muted);font-size:13px;margin-bottom:6px;">${escapeHtml(adminProfile.role)} &bull; <code>@${escapeHtml(adminProfile.username)}</code></p>
              <span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;background:rgba(22,121,75,0.12);color:var(--avigo-forest);border-radius:50px;font-size:11px;font-weight:700;">
                <span class="live-dot"></span> Active &bull; Corporate Super Administrator
              </span>
            </div>
          </div>

          <form id="profile-info-form">
            <div class="form-grid-2">
              <div class="form-group">
                <label>Display Full Name</label>
                <input type="text" id="prof-display-name" value="${escapeHtml(adminProfile.displayName)}" required />
              </div>
              <div class="form-group">
                <label>Corporate Role / Title</label>
                <input type="text" id="prof-role" value="${escapeHtml(adminProfile.role)}" required />
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label>Corporate Email</label>
                <input type="email" id="prof-email" value="${escapeHtml(adminProfile.email)}" required />
              </div>
              <div class="form-group">
                <label>Direct Telephone</label>
                <input type="tel" id="prof-phone" value="${escapeHtml(adminProfile.phone)}" />
              </div>
            </div>
            ${renderImageFieldHtml('adminAvatarUrl', 'Admin Profile Avatar / Photograph', adminProfile.avatarUrl || '/uploads/logo.png')}
            <button type="submit" class="btn-primary" style="margin-top:6px;">Save Profile Information</button>
          </form>
        </div>

        <!-- 2. Security & Password Update Card -->
        <div class="cms-card">
          <div class="cms-card-header">
            <h3>
              <span>Security &amp; Password Management</span>
              <span class="card-title-badge">ENCRYPTED PBKDF2</span>
            </h3>
          </div>
          <p class="field-help" style="margin-bottom:18px;">
            Update your admin login password and username. Passwords must be at least 5 characters.
          </p>

          <form id="profile-password-form">
            <div class="form-group">
              <label>Admin Username</label>
              <input type="text" id="prof-username" value="${escapeHtml(adminProfile.username)}" required autocomplete="username" />
              <span class="field-help">Used to log in at ${escapeHtml(adminPortalPath)}</span>
            </div>

            <div class="form-group">
              <label>Current Password</label>
              <div class="input-with-icon" style="position:relative;">
                <input type="password" id="prof-cur-pass" required placeholder="Enter current password" style="padding-right:40px;" />
                <button type="button" class="field-action-btn" data-toggle-pass="prof-cur-pass">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>New Password</label>
                <div class="input-with-icon" style="position:relative;">
                  <input type="password" id="prof-new-pass" required minlength="5" placeholder="Enter new password" style="padding-right:40px;" />
                  <button type="button" class="field-action-btn" data-toggle-pass="prof-new-pass">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label>Confirm New Password</label>
                <div class="input-with-icon" style="position:relative;">
                  <input type="password" id="prof-confirm-pass" required minlength="5" placeholder="Re-enter new password" style="padding-right:40px;" />
                  <button type="button" class="field-action-btn" data-toggle-pass="prof-confirm-pass">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                </div>
              </div>
            </div>

            <div id="password-feedback" class="login-error" style="display:none;margin-bottom:14px;"></div>

            <button type="submit" id="btn-update-credentials" class="btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span>Update Password &amp; Credentials</span>
            </button>
          </form>
        </div>

        <!-- 3. Security Details Card -->
        <div class="cms-card">
          <div class="cms-card-header">
            <h3>
              <span>Session &amp; Security Specs</span>
              <span class="card-title-badge">ACTIVE</span>
            </h3>
          </div>
          <div class="form-grid-3" style="font-size:13px;">
            <div>
              <strong style="color:var(--avigo-slate);display:block;margin-bottom:4px;">Restricted Route:</strong>
              <code>${escapeHtml(adminPortalPath)}</code>
            </div>
            <div>
              <strong style="color:var(--avigo-slate);display:block;margin-bottom:4px;">Cryptographic Standard:</strong>
              <span>PBKDF2 SHA-512 &bull; 12,000 Rounds</span>
            </div>
            <div>
              <strong style="color:var(--avigo-slate);display:block;margin-bottom:4px;">Last Login Registered:</strong>
              <span>${adminProfile.lastLogin ? new Date(adminProfile.lastLogin).toLocaleString() : 'Current Active Session'}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    bindImageFields(pane, (id, val) => {
      adminProfile.avatarUrl = val;
      const disp = document.getElementById('profile-display-avatar');
      if (disp) disp.src = val;
    });

    pane.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-pass');
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
      });
    });

    document.getElementById('profile-info-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const updated = await apiFetch('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({
            displayName: document.getElementById('prof-display-name').value,
            role: document.getElementById('prof-role').value,
            email: document.getElementById('prof-email').value,
            phone: document.getElementById('prof-phone').value,
            avatarUrl: adminProfile.avatarUrl
          })
        });
        adminProfile = Object.assign(adminProfile, updated.profile);
        updateTopbarProfileUi();
        showToast('Admin profile updated successfully');
        renderProfileTab(pane);
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('profile-password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const curPass = document.getElementById('prof-cur-pass').value;
      const newPass = document.getElementById('prof-new-pass').value;
      const confirmPass = document.getElementById('prof-confirm-pass').value;
      const newUsername = document.getElementById('prof-username').value;
      const feedback = document.getElementById('password-feedback');
      feedback.style.display = 'none';

      if (newPass !== confirmPass) {
        feedback.textContent = 'New password and confirmation password do not match.';
        feedback.style.display = 'block';
        return;
      }

      try {
        const res = await apiFetch('/api/auth/password', {
          method: 'POST',
          body: JSON.stringify({
            currentPassword: curPass,
            newPassword: newPass,
            confirmPassword: confirmPass,
            newUsername: newUsername
          })
        });
        setToken(res.token);
        adminProfile.username = res.username;
        updateTopbarProfileUi();
        showToast(res.message || 'Password successfully changed');
        document.getElementById('profile-password-form').reset();
        document.getElementById('prof-username').value = res.username;
      } catch (err) {
        feedback.textContent = err.message;
        feedback.style.display = 'block';
      }
    });
  }

  const TAB_RENDERERS = {
    'tab-profile': renderProfileTab,
    'tab-dashboard': renderDashboardTab,
    'tab-inquiries': renderInquiriesTab,
    'tab-sections': renderSectionsOrderTab,
    'tab-hero': renderHeroTab,
    'tab-intro': renderIntroTab,
    'tab-major-services': renderMajorServicesTab,
    'tab-services': renderCoreServicesTab,
    'tab-expansion': renderExpansionTab,
    'tab-org': renderOrgChartTab,
    'tab-commitments': renderCommitmentsTab,
    'tab-people': renderPeopleTab,
    'tab-contact': renderContactTab,
    'tab-custom': renderCustomBlocksTab,
    'tab-media': renderMediaTab,
    'tab-appearance': renderAppearanceTab,
    'tab-revisions': renderRevisionsTab
  };

  function switchTab(tabId) {
    if (!TAB_RENDERERS[tabId]) tabId = 'tab-dashboard';
    currentTab = tabId;
    document.querySelectorAll('.avigo-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    const sidebar = document.getElementById('avigo-sidebar');
    if (sidebar) sidebar.classList.remove('open');

    const pane = document.getElementById('avigo-editor-pane');
    if (pane && cmsData) {
      TAB_RENDERERS[tabId](pane);
    }
  }

  async function publishAllChanges() {
    if (!cmsData) return;
    try {
      const btn = document.getElementById('publish-all-btn');
      btn.textContent = 'Publishing...';
      await apiFetch('/api/content', {
        method: 'PUT',
        body: JSON.stringify(Object.assign({}, cmsData, { _revisionLabel: `Avigo Admin Edited ${currentTab.replace('tab-', '')}` }))
      });
      btn.textContent = 'Publish to Website';
      markUnsaved(false);
      showToast('Published to live Avigo website!');
    } catch (err) {
      alert(err.message);
    }
  }

  async function bootAdminApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = 'flex';
    cmsData = await apiFetch('/api/content');
    await loadInquiries();
    await loadAdminProfile();

    const initialHash = window.location.hash.replace('#', '');
    switchTab(TAB_RENDERERS[initialHash] ? initialHash : 'tab-dashboard');
  }

  async function init() {
    // Mobile sidebar toggle
    const mobBtn = document.getElementById('admin-mobile-sidebar-btn');
    const sidebar = document.getElementById('avigo-sidebar');
    if (mobBtn && sidebar) {
      mobBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Topbar profile trigger
    const topbarProfileBtn = document.getElementById('topbar-profile-trigger');
    if (topbarProfileBtn) {
      topbarProfileBtn.addEventListener('click', () => {
        window.location.hash = 'tab-profile';
        switchTab('tab-profile');
      });
    }

    // Sidebar tab navigation
    document.querySelectorAll('.avigo-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        window.location.hash = tabId;
        switchTab(tabId);
      });
    });

    // Publish button
    document.getElementById('publish-all-btn').addEventListener('click', publishAllChanges);

    // Toggle Live Studio Preview & Device Width Switcher
    document.getElementById('toggle-preview-btn').addEventListener('click', () => {
      const previewPane = document.getElementById('avigo-preview-pane');
      const isHidden = previewPane.style.display === 'none';
      previewPane.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) {
        setTimeout(pushLivePreview, 300);
      }
    });

    const routeSelect = document.getElementById('preview-route-select');
    const previewIframe = document.getElementById('live-preview-iframe');
    if (routeSelect && previewIframe) {
      routeSelect.addEventListener('change', () => {
        previewIframe.src = routeSelect.value;
        previewIframe.onload = () => pushLivePreview();
      });
    }

    document.querySelectorAll('[data-device-width]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-device-width]').forEach((b) => b.classList.toggle('active', b === btn));
        if (previewIframe) {
          previewIframe.style.width = btn.getAttribute('data-device-width');
        }
      });
    });

    // Sign out
    document.getElementById('logout-btn').addEventListener('click', () => {
      setToken('');
      window.location.reload();
    });

    // Media Vault Modal events
    document.getElementById('close-media-modal').addEventListener('click', closeMediaModal);
    const modalFileInput = document.getElementById('modal-file-input');
    modalFileInput.addEventListener('change', async () => {
      if (modalFileInput.files && modalFileInput.files[0]) {
        const uploaded = await uploadFileFromInput(modalFileInput.files[0]);
        await renderModalMediaGrid();
        if (activeImageCallback && uploaded) {
          activeImageCallback(uploaded.url);
          closeMediaModal();
        }
      }
    });

    // Password visibility toggle on Auth Gate
    const togglePassBtn = document.getElementById('toggle-auth-password');
    const passInput = document.getElementById('login-password');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.innerHTML = isPass ? `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ` : `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        `;
      });
    }

    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit-btn');
        if (errEl) errEl.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Verifying Credentials...</span>`;
        }
        try {
          const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              username: document.getElementById('login-username').value,
              password: document.getElementById('login-password').value
            })
          });
          setToken(res.token);
          await bootAdminApp();
        } catch (err) {
          if (errEl) {
            errEl.textContent = err.message;
            errEl.style.display = 'block';
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
              <span>Authenticate &amp; Enter Portal</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            `;
          }
        }
      });
    }

    if (getToken()) {
      try {
        await apiFetch('/api/auth/verify');
        await bootAdminApp();
      } catch (e) {
        setToken('');
      }
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
