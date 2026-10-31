(function () {
  'use strict';

  let siteData = null;
  let adminPortalPath = '/avigo-portal';
  let currentServiceFilter = 'all';
  let heroSlideTimer = null;

  const SVG_ICONS = {
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    arrowSmall: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>',
    chevronDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"></polyline></svg>',
    pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
    phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>',
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>',
    mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>',
    leaf: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6"></path></svg>',
    document: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
  };

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stripColon(str) {
    return String(str || '').replace(/:\s*$/, '');
  }

  function getActivePageKey() {
    const p = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    if (p === '/about' || p === '/about.html') return 'about';
    if (p === '/services' || p === '/services.html') return 'services';
    if (p === '/contact' || p === '/contact.html') return 'contact';
    return 'home';
  }

  function renderEditButton(tabHash, label) {
    return `
      <a href="${escapeHtml(adminPortalPath)}#${escapeHtml(tabHash)}" class="section-admin-edit-pill" title="Edit this section in Avigo Admin Portal">
        ${SVG_ICONS.edit}<span>Edit: ${escapeHtml(label)}</span>
      </a>
    `;
  }

  function sectionHeader(eyebrow, title, lead, centered) {
    return `
      <div class="section-header ${centered ? 'centered' : ''}">
        ${eyebrow ? `<span class="section-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}
        <h2 class="section-title">${escapeHtml(title)}</h2>
        <div class="section-accent-line"></div>
        ${lead ? `<p class="section-lead">${escapeHtml(lead)}</p>` : ''}
      </div>
    `;
  }

  // =====================================================
  // HERO
  // =====================================================
  function renderHeroSection(data) {
    const h = data.hero || {};
    const greenShades = ['#A7F400', '#8BE300', '#6FD100', '#58BF00', '#41AD00', '#2E9E00', '#1B8D00'];
    const slides = [
      { image: h.heroImage || '/uploads/page01-hero-pipeline.jpg', label: 'Downstream & Midstream Refinery Infrastructure' },
      { image: h.secondaryHeroImage || '/uploads/page02-gas-manifold.jpg', label: 'Precision Gas Manifold & Pipeline Engineering' },
      { image: h.tertiaryHeroImage || '/uploads/page08-petrochemical-plant.jpg', label: 'Integrated Petrochemical & Processing Complex' }
    ];
    const pillars = (h.pillars && h.pillars.length) ? h.pillars : [];

    return `
      <section id="hero" class="cms-section modern-hero-section no-pad hero-bg-slider">
        ${renderEditButton('tab-hero', 'Hero Showcase')}
        <div class="hero-slides-stack" aria-hidden="true">
          ${slides.map((s, idx) => `
            <div class="hero-bg-slide ${idx === 0 ? 'active' : ''}" data-hero-bg="${idx}" style="background-image: url('${escapeHtml(s.image)}');"></div>
          `).join('')}
        </div>
        <div class="hero-bg-overlay"></div>
        <div class="hero-grid-pattern"></div>

        <div class="hero-stage-container hero-stage-full">
          <div class="hero-full-layout">
            <div class="hero-copy-col">
              <div class="hero-eyebrow-badge">
                <span class="hero-live-dot"></span>
                <span>${escapeHtml(h.profileLabel || 'CORPORATE PROFILE')}</span>
              </div>
              <h1 class="hero-display-headline">
                <span class="word-white">${escapeHtml(h.word1 || 'Powering')}</span>
                <span class="word-green">${escapeHtml(h.word2 || 'Progress,')}</span><br />
                <span class="word-amber">${escapeHtml(h.word3 || 'Globally')}</span>
                <span class="word-white">${escapeHtml(h.word4 || 'Integrated.')}</span>
              </h1>
              <div class="hero-tricolor-bar">
                <div class="tricolor-amber"></div>
                <div class="tricolor-green"></div>
                <div class="tricolor-navy"></div>
              </div>
              <p class="hero-subtitle-text">${escapeHtml(h.subtitle || '')}</p>
              <div class="hero-actions-row">
                <a href="/services" data-route-link="/services" class="btn-hero-primary"><span>Explore Our Services</span>${SVG_ICONS.arrowSmall}</a>
                <a href="/about" data-route-link="/about" class="btn-hero-secondary"><span>About Us</span></a>
                <a href="/contact" data-route-link="/contact" class="btn-hero-secondary"><span>Contact Us</span></a>
              </div>
            </div>

            <div class="hero-slider-controls">
              <div class="hero-slide-info">
                <span class="hero-facility-tag"><span class="dot"></span><span>Avigo Integrated Operations</span></span>
                <span id="hero-active-slide-caption" class="hero-slide-caption">${escapeHtml(slides[0].label)}</span>
              </div>
              <div class="hero-slide-nav">
                <button type="button" class="hero-arrow-btn" data-hero-prev aria-label="Previous slide">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div class="hero-slide-dots">
                  ${slides.map((s, idx) => `
                    <button type="button" class="hero-slide-dot ${idx === 0 ? 'active' : ''}" data-hero-slide="${idx}" data-slide-label="${escapeHtml(s.label)}" aria-label="Show slide: ${escapeHtml(s.label)}"></button>
                  `).join('')}
                </div>
                <button type="button" class="hero-arrow-btn" data-hero-next aria-label="Next slide">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        ${pillars.length ? `
          <div class="hero-pillars-container">
            <div class="hero-pillars-grid">
              ${pillars.map((p) => {
      const target = p.target || '/services#global-expertise';
      return `
                  <a href="${escapeHtml(target)}" data-route-link="${escapeHtml(target)}" class="hero-pillar-card">
                    <div class="hero-pillar-title">${escapeHtml(p.title || p.label)}</div>
                    <div class="hero-pillar-desc">${escapeHtml(p.summary || p.value)}</div>
                  </a>
                `;
    }).join('')}
            </div>
          </div>
        ` : ''}

        <div class="hero-bottom-ribbon">
          ${greenShades.map((c) => `<div style="background:${c}"></div>`).join('')}
        </div>
      </section>
    `;
  }

  // =====================================================
  // INTRODUCTION, VISION & MISSION
  // =====================================================
  function renderIntroductionSection(data, includeExploreBtn) {
    const intro = data.introduction || {};
    return `
      <section id="introduction" class="cms-section section-bg-white">
        ${renderEditButton('tab-intro', 'Introduction')}
        <div class="section-container">
          <div class="intro-exec-grid">
            <div>
              ${sectionHeader('Corporate Overview', intro.title || 'Introduction')}
              <p class="intro-body-copy">${escapeHtml(intro.body)}</p>
              ${includeExploreBtn ? `
                <a href="/about" data-route-link="/about" class="btn-section-explore"><span>Learn More About Us</span>${SVG_ICONS.arrowSmall}</a>
              ` : ''}
            </div>
            <div class="intro-media-card">
              <img src="${escapeHtml(intro.bannerImage)}" alt="${escapeHtml(data.siteSettings.companyName)}" loading="lazy" />
              <div class="intro-media-caption">
                <span>${escapeHtml(data.siteSettings.companyName)}</span>
                <span>Abuja &amp; Port Harcourt</span>
              </div>
            </div>
          </div>

          <div id="vision-mission" class="vm-cards-grid">
            <div class="vm-card vm-vision">
              <span class="vm-card-badge">${SVG_ICONS.globe} Vision</span>
              <h3 class="vm-card-title">${escapeHtml(intro.visionTitle)}</h3>
              <p class="vm-card-text">${escapeHtml(intro.visionBody)}</p>
            </div>
            <div class="vm-card vm-mission">
              <span class="vm-card-badge">${SVG_ICONS.shield} Mission</span>
              <h3 class="vm-card-title">${escapeHtml(intro.missionTitle)}</h3>
              <p class="vm-card-text">${escapeHtml(intro.missionBody)}</p>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // =====================================================
  // MAJOR SERVICES OVERVIEW
  // =====================================================
  function renderMajorServicesSection(data, includeExploreBtn) {
    const ms = data.majorServicesOverview || {};
    const eyebrow = `${ms.taglineLeft || 'PRECISION'} ${ms.taglineCenter || '&'} ${ms.taglineRight || 'QUALITY'}`;
    return `
      <section id="major-services" class="cms-section section-bg-slate">
        ${renderEditButton('tab-major-services', 'Major Services')}
        <div class="section-container">
          ${sectionHeader(eyebrow, ms.mainHeading || 'OUR MAJOR SERVICES', '', true)}
          <div class="major-overview-grid">
            <div class="overview-panel">
              <img src="${escapeHtml(ms.backgroundImage)}" alt="Avigo logistics and construction operations" class="overview-panel-img" loading="lazy" />
              <div class="overview-panel-body">
                <h3 class="overview-panel-heading">Core Service Divisions</h3>
                <ul class="service-check-list">
                  ${(ms.majorServices || []).map((s) => `
                    <li><span class="service-check-icon">${SVG_ICONS.check}</span><span>${escapeHtml(s)}</span></li>
                  `).join('')}
                </ul>
              </div>
            </div>
            <div class="overview-panel">
              <div class="overview-panel-body">
                <div>
                  <h3 class="overview-panel-heading">${escapeHtml(ms.subHeading)}</h3>
                  <ul class="expansion-pill-grid">
                    ${(ms.expansionServices || []).map((s) => `
                      <li><span class="expansion-dot"></span><span>${escapeHtml(s)}</span></li>
                    `).join('')}
                  </ul>
                </div>
                ${includeExploreBtn ? `
                  <div><a href="/services" data-route-link="/services" class="btn-section-explore"><span>View All Services</span>${SVG_ICONS.arrowSmall}</a></div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // =====================================================
  // GLOBAL EXPERTISE (CORE DIVISIONS)
  // =====================================================
  function renderGlobalExpertiseSection(data) {
    const cs = data.coreServices || {};
    const items = cs.items || [];
    return `
      <section id="global-expertise" class="cms-section section-bg-white">
        ${renderEditButton('tab-services', 'Global Expertise')}
        <div class="section-container">
          ${sectionHeader('Core Divisions', cs.sectionTitle, cs.leadText)}
          <div class="core-divisions-stack">
            ${items.map((item, idx) => {
      const gallery = (item.secondaryImages || []).filter(Boolean);
      return `
                <article class="core-division-card ${idx % 2 === 1 ? 'reverse' : ''}">
                  <div class="core-division-media">
                    ${item.primaryImage ? `<img src="${escapeHtml(item.primaryImage)}" alt="${escapeHtml(stripColon(item.title))}" class="core-primary-photo" loading="lazy" />` : ''}
                    ${gallery.length ? `
                      <div class="core-sub-gallery">
                        ${gallery.map((g) => `<img src="${escapeHtml(g)}" alt="${escapeHtml(stripColon(item.title))}" loading="lazy" />`).join('')}
                      </div>
                    ` : ''}
                  </div>
                  <div class="core-division-content">
                    <span class="core-division-tag">Core Capability</span>
                    <h3 class="core-division-title">${escapeHtml(stripColon(item.title))}</h3>
                    <p class="core-division-desc">${escapeHtml(item.description)}</p>
                  </div>
                </article>
              `;
    }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  // =====================================================
  // EXPANDING GLOBAL FOOTPRINT (8 SECTORS)
  // =====================================================
  function renderExpansionPortfolioSection(data) {
    const exp = data.expansionPortfolio || {};
    const items = exp.items || [];
    return `
      <section id="expanding-footprint" class="cms-section section-bg-slate">
        ${renderEditButton('tab-expansion', 'Expanding Global Footprint')}
        <div class="section-container">
          ${sectionHeader('Growth Sectors', exp.sectionTitle, exp.leadText)}
          ${exp.page8BannerImage ? `
            <div class="petro-banner-card">
              <img src="${escapeHtml(exp.page8BannerImage)}" alt="Petrochemical processing facility" class="petro-banner-img" loading="lazy" />
              <div class="petro-banner-overlay">${escapeHtml(data.siteSettings.tagline || '')}</div>
            </div>
          ` : ''}
          <div class="sectors-uniform-grid">
            ${items.map((item) => `
              <div class="sector-exec-card theme-${escapeHtml(item.headerStyle || 'deep-teal')}">
                <div class="sector-card-head">
                  <span class="sector-icon-badge">${SVG_ICONS.check}</span>
                  <h3 class="sector-card-title">${escapeHtml(stripColon(item.title))}</h3>
                </div>
                <p class="sector-card-desc">${escapeHtml(item.description)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  // =====================================================
  // ORGANIZATION STRUCTURE
  // =====================================================
  function renderOrganizationSection(data) {
    const org = data.organizationStructure || {};
    const nodes = org.nodes || [];
    const byId = {};
    nodes.forEach((n) => { byId[n.id] = n; });
    const childrenOf = (pid) => nodes.filter((n) => n.parentId === pid);

    const bod = byId['bod'] || nodes.find((n) => !n.parentId) || { id: 'bod', title: 'Board of Directors' };
    const auditor = byId['auditor'] || { title: 'Auditor' };
    const ceo = byId['ceo'] || { id: 'ceo', title: 'CEO' };
    const qhse = byId['qhse'] || { title: 'QHSE/Compliance Coordinator' };
    const deptHeads = childrenOf(ceo.id).filter((n) => n.id !== 'qhse');

    const renderSubtree = (parentNode) => {
      const kids = childrenOf(parentNode.id);
      if (!kids.length) return '';
      return `
        <div class="org-vline"></div>
        <div class="org-sub-grid">
          ${kids.map((k) => `
            <div class="org-dept-col">
              <div class="org-node ${escapeHtml(k.nodeType || 'red-box')}">${escapeHtml(k.title)}</div>
              ${renderSubtree(k)}
            </div>
          `).join('')}
        </div>
      `;
    };

    const collectAllDescendants = (parentNode, depth = 1) => {
      let list = [];
      childrenOf(parentNode.id).forEach((k) => {
        list.push({ node: k, depth, parentTitle: parentNode.title });
        list = list.concat(collectAllDescendants(k, depth + 1));
      });
      return list;
    };

    const isMobileScreen = window.innerWidth <= 768;
    const defaultMode = isMobileScreen ? 'mobile-explorer' : (org.displayMode || 'interactive');

    return `
      <section id="organization-structure" class="cms-section section-bg-white">
        ${renderEditButton('tab-org', 'Organization Structure')}
        <div class="section-container">
          <div class="org-header-banner">
            <img src="${escapeHtml(org.bannerImage)}" alt="Corporate headquarters" loading="lazy" />
            <div class="org-header-overlay">
              <span class="section-eyebrow" style="background:rgba(255,255,255,0.14);color:#D9F99D;align-self:flex-start;">Leadership &amp; Governance</span>
              <h2>${escapeHtml(org.sectionTitle)}</h2>
            </div>
          </div>

          <div class="org-viewer-card">
            <div class="org-chart-toolbar">
              <span class="org-chart-hint">Explore our corporate governance and operational hierarchy:</span>
              <div class="org-mode-btns">
                <button type="button" class="org-mode-btn ${defaultMode === 'interactive' ? 'active' : ''}" data-org-view="interactive">Hierarchy Diagram</button>
                <button type="button" class="org-mode-btn ${defaultMode === 'mobile-explorer' ? 'active' : ''}" data-org-view="mobile-explorer">Department Explorer</button>
                ${org.originalChartImage ? `<button type="button" class="org-mode-btn ${defaultMode === 'image' ? 'active' : ''}" data-org-view="image">Chart Image</button>` : ''}
              </div>
            </div>

            <div id="org-interactive-view" class="org-scroll-wrapper" style="display: ${defaultMode === 'interactive' ? 'block' : 'none'};">
              <div class="org-tree-canvas">
                <div class="org-node blue-oval">${escapeHtml(bod.title)}</div>
                <div class="org-vline"></div>
                <div class="org-side-branch-row">
                  <div class="org-node blue-red-split">${escapeHtml(auditor.title)}</div>
                  <div class="org-side-connector"></div>
                </div>
                <div class="org-vline"></div>
                <div class="org-node blue-circle">${escapeHtml(ceo.title)}</div>
                <div class="org-vline"></div>
                <div class="org-side-branch-row">
                  <div class="org-node red-box">${escapeHtml(qhse.title)}</div>
                  <div class="org-side-connector"></div>
                </div>
                <div class="org-vline"></div>
                <div class="org-dept-bar"></div>
                <div class="org-departments-row">
                  ${deptHeads.map((dept) => `
                    <div class="org-dept-col">
                      <div class="org-vline" style="height:18px;"></div>
                      <div class="org-node ${escapeHtml(dept.nodeType || 'red-box')}">${escapeHtml(dept.title)}</div>
                      ${renderSubtree(dept)}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div id="org-explorer-view" style="display: ${defaultMode === 'mobile-explorer' ? 'block' : 'none'};">
              <div class="org-mobile-accordion">
                <div class="org-acc-card">
                  <button type="button" class="org-acc-header governance" data-org-acc-toggle="gov">
                    <span>Executive Governance</span>${SVG_ICONS.chevronDown}
                  </button>
                  <div class="org-acc-body open" id="org-acc-gov">
                    <div class="org-acc-role-chip"><span>${escapeHtml(bod.title)}</span><small>Apex Governing Body</small></div>
                    <div class="org-acc-role-chip"><span>${escapeHtml(auditor.title)}</span><small>Reports to ${escapeHtml(bod.title)}</small></div>
                    <div class="org-acc-role-chip"><span>${escapeHtml(ceo.title)}</span><small>Chief Executive Officer</small></div>
                    <div class="org-acc-role-chip"><span>${escapeHtml(qhse.title)}</span><small>Reports to ${escapeHtml(ceo.title)}</small></div>
                  </div>
                </div>
                ${deptHeads.map((dept, idx) => {
      const descendants = collectAllDescendants(dept);
      return `
                    <div class="org-acc-card">
                      <button type="button" class="org-acc-header" data-org-acc-toggle="dept-${idx}">
                        <span>${escapeHtml(dept.title)}</span>${SVG_ICONS.chevronDown}
                      </button>
                      <div class="org-acc-body" id="org-acc-dept-${idx}">
                        ${descendants.length === 0 ? `
                          <div class="org-acc-role-chip"><span>Direct Executive Function</span><small>Reports to ${escapeHtml(ceo.title)}</small></div>
                        ` : descendants.map((d) => `
                          <div class="org-acc-role-chip" style="margin-left:${(d.depth - 1) * 16}px;">
                            <span>${escapeHtml(d.node.title)}</span><small>Reports to ${escapeHtml(d.parentTitle)}</small>
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  `;
    }).join('')}
              </div>
            </div>

            ${org.originalChartImage ? `
              <div id="org-image-view" class="org-original-img-wrap" style="display: ${defaultMode === 'image' ? 'block' : 'none'};">
                <img src="${escapeHtml(org.originalChartImage)}" alt="Organization structure chart" loading="lazy" />
              </div>
            ` : ''}
          </div>
        </div>
      </section>
    `;
  }

  // =====================================================
  // COMMITMENTS
  // =====================================================
  function renderCommitmentsSection(data) {
    const comm = data.commitments || {};
    const items = comm.items || [];
    const pillars = comm.pillars || [];
    const pillarIcons = [SVG_ICONS.leaf, SVG_ICONS.document];
    return `
      <section id="our-commitment" class="cms-section section-bg-slate">
        ${renderEditButton('tab-commitments', 'Our Commitment')}
        <div class="section-container">
          ${sectionHeader('Our Values', comm.sectionTitle, comm.leadText)}
          <div class="commitments-cards-grid">
            ${items.map((item) => `
              <div class="commitment-exec-card">
                <span class="commitment-card-icon">${SVG_ICONS.shield}</span>
                <div>
                  <h3 class="commitment-card-title">${escapeHtml(stripColon(item.title))}</h3>
                  <p class="commitment-card-desc">${escapeHtml(item.description)}</p>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="pillars-dual-grid">
            ${pillars.map((p, idx) => `
              <div class="pillar-exec-card">
                <div class="pillar-exec-head">
                  <span class="pillar-exec-icon">${pillarIcons[idx % pillarIcons.length]}</span>
                  <h3 class="pillar-exec-title">${escapeHtml(p.title)}</h3>
                </div>
                <p class="pillar-exec-desc">${escapeHtml(String(p.description || '').replace(/^:\s*/, ''))}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  // =====================================================
  // OUR PEOPLE
  // =====================================================
  function renderPeopleSection(data) {
    const p = data.people || {};
    return `
      <section id="our-people" class="cms-section section-bg-white">
        ${renderEditButton('tab-people', 'Our People')}
        <div class="section-container">
          <div class="people-exec-grid">
            <div class="people-photos-col">
              <img src="${escapeHtml(p.leftImage)}" alt="Avigo construction specialist" class="people-photo-tall" loading="lazy" />
              <div class="people-photo-secondary-wrap">
                <img src="${escapeHtml(p.rightImage)}" alt="Avigo field technicians" class="people-photo-wide" loading="lazy" />
                <div class="people-stat-box">
                  <strong>30+</strong>
                  <span>Specialized Contractors &amp; Professionals</span>
                </div>
              </div>
            </div>
            <div class="people-copy-col">
              ${sectionHeader('Our Workforce', p.sectionTitle || 'Our People')}
              <p class="people-highlight-banner">
                ${escapeHtml(p.topHighlightPrefix)}<span class="highlight-green">${escapeHtml(p.topHighlightGreen)}</span>${escapeHtml(p.topHighlightSuffix)}
              </p>
              <div class="people-paragraphs">
                ${(p.paragraphs || []).map((para) => `<p>${escapeHtml(para)}</p>`).join('')}
              </div>
              <div class="people-callout-box">${escapeHtml(p.bottomCallout)}</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  // =====================================================
  // CONTACT
  // =====================================================
  function renderContactInquirySection(data) {
    const ct = data.contact || {};
    const ms = data.majorServicesOverview || {};
    const allServices = [...(ms.majorServices || []), ...(ms.expansionServices || [])];
    return `
      <section id="inquiry-section" class="cms-section section-bg-slate">
        <div class="section-container">
          <div class="inquiry-hub-grid">
            <div class="inquiry-form-card">
              <h3>Request a Consultation or Project Quote</h3>
              <p>Connect directly with our engineering, logistics, and procurement teams in Abuja and Port Harcourt.</p>
              <form id="public-inquiry-form">
                <div class="public-form-grid">
                  <div class="public-field"><label for="inq-name">Full Name *</label><input type="text" id="inq-name" required placeholder="Enter your full name" /></div>
                  <div class="public-field"><label for="inq-company">Company / Organization</label><input type="text" id="inq-company" placeholder="Your organization name" /></div>
                </div>
                <div class="public-form-grid">
                  <div class="public-field"><label for="inq-email">Email Address *</label><input type="email" id="inq-email" required placeholder="name@company.com" /></div>
                  <div class="public-field"><label for="inq-phone">Phone Number</label><input type="tel" id="inq-phone" placeholder="+234..." /></div>
                </div>
                <div class="public-field">
                  <label for="inq-sector">Service of Interest</label>
                  <select id="inq-sector">
                    <option value="General Corporate Inquiry">General Corporate Inquiry</option>
                    ${allServices.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
                  </select>
                </div>
                <div class="public-field">
                  <label for="inq-message">Project Details / Message *</label>
                  <textarea id="inq-message" rows="5" required placeholder="Describe your project requirements or inquiry..."></textarea>
                </div>
                <button type="submit" class="btn-submit-inquiry">Submit Inquiry</button>
                <div id="inquiry-feedback" class="inquiry-status-msg" style="display:none;"></div>
              </form>
            </div>
            <div class="office-quick-cards">
              <div class="office-card-box">
                <h4>${escapeHtml(ct.abujaTitle || 'ABUJA ADDRESS:')}</h4>
                <p>${(ct.abujaLines || []).map(escapeHtml).join('<br />')}</p>
              </div>
              <div class="office-card-box">
                <h4>${escapeHtml(ct.phTitle || 'PH ADDRESS:')}</h4>
                <p>${(ct.phLines || []).map(escapeHtml).join('<br />')}</p>
              </div>
              <div class="office-card-box">
                <h4>PHONE &amp; EMAIL</h4>
                <p>${(ct.phones || []).map((ph) => `<a href="tel:${escapeHtml(ph)}" class="office-link">${escapeHtml(ph)}</a>`).join('<br />')}</p>
                <p style="margin-top:8px;">${(ct.emails || []).map((em) => `<a href="mailto:${escapeHtml(em)}" class="office-link">${escapeHtml(em)}</a>`).join('<br />')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderContactSection(data) {
    const ct = data.contact || {};
    return `
      <section id="contact" class="cms-section section-bg-white">
        ${renderEditButton('tab-contact', 'Contact & Addresses')}
        <div class="section-container">
          ${sectionHeader('Our Offices', 'Abuja & Port Harcourt Offices', '', true)}
          <div class="storage-terminal-card">
            <img src="${escapeHtml(ct.bannerImage)}" alt="Avigo industrial storage facility" class="storage-terminal-photo" loading="lazy" />
            <div class="storage-terminal-details">
              <h3>${escapeHtml(data.siteSettings.companyName)}</h3>
              <div class="terminal-info-list">
                <div class="terminal-info-row">
                  <span class="terminal-info-icon">${SVG_ICONS.pin}</span>
                  <div><strong>${escapeHtml(ct.abujaTitle)}</strong><br />${(ct.abujaLines || []).map(escapeHtml).join(' ')}</div>
                </div>
                <div class="terminal-info-row">
                  <span class="terminal-info-icon">${SVG_ICONS.pin}</span>
                  <div><strong>${escapeHtml(ct.phTitle)}</strong><br />${(ct.phLines || []).map(escapeHtml).join(' ')}</div>
                </div>
                <div class="terminal-info-row">
                  <span class="terminal-info-icon">${SVG_ICONS.phone}</span>
                  <div>${(ct.phones || []).map((ph) => `<a href="tel:${escapeHtml(ph)}">${escapeHtml(ph)}</a>`).join(', ')}</div>
                </div>
                <div class="terminal-info-row">
                  <span class="terminal-info-icon">${SVG_ICONS.globe}</span>
                  <div><a href="https://${escapeHtml(ct.website)}" target="_blank" rel="noopener">${escapeHtml(ct.website)}</a></div>
                </div>
                <div class="terminal-info-row">
                  <span class="terminal-info-icon">${SVG_ICONS.mail}</span>
                  <div>${(ct.emails || []).map((em) => `<a href="mailto:${escapeHtml(em)}">${escapeHtml(em)}</a>`).join('<br />')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderConsultationBand(data) {
    return `
      <section class="cms-section section-bg-white">
        <div class="section-container">
          <div class="exec-cta-band">
            <div class="exec-cta-copy">
              <h2>Partner With ${escapeHtml(data.siteSettings.shortName || 'Avigo')}</h2>
              <p>${escapeHtml(data.siteSettings.tagline || '')} Speak with our team about your next oil and gas, logistics, engineering, or infrastructure project.</p>
            </div>
            <div class="hero-actions-row">
              <a href="/contact#inquiry-section" data-route-link="/contact#inquiry-section" class="btn-hero-primary"><span>Request a Quote</span>${SVG_ICONS.arrowSmall}</a>
              <a href="/services" data-route-link="/services" class="btn-hero-secondary"><span>Our Services</span></a>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderCustomBlocks(data) {
    const blocks = (data.customBlocks || []).filter((b) => b.visible !== false);
    return blocks.map((b, idx) => `
      <section id="custom-${escapeHtml(b.id)}" class="cms-section ${idx % 2 ? 'section-bg-slate' : 'section-bg-white'}">
        ${renderEditButton('tab-custom', b.title || 'Custom Section')}
        <div class="section-container">
          <div class="${b.imageUrl ? 'intro-exec-grid' : ''}">
            <div>
              ${sectionHeader('', b.title, b.subtitle)}
              <div class="people-paragraphs"><p>${escapeHtml(b.body)}</p></div>
            </div>
            ${b.imageUrl ? `<div class="intro-media-card"><img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.title)}" loading="lazy" /></div>` : ''}
          </div>
        </div>
      </section>
    `).join('');
  }

  // =====================================================
  // PAGE COMPOSERS
  // =====================================================
  function renderPageHeaderBanner(breadcrumb, title, subtitle, pillsHtml) {
    return `
      <section class="cms-section page-banner-section section-visible">
        <div class="page-hero-banner">
          <div class="section-container">
            <div class="page-hero-breadcrumb">
              <a href="/" data-route-link="/">Home</a><span>/</span><span>${escapeHtml(breadcrumb)}</span>
            </div>
            <h1 class="page-hero-title">${escapeHtml(title)}</h1>
            <p class="page-hero-subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </div>
        ${pillsHtml ? `<div class="page-subnav-wrap"><div class="page-subnav-bar">${pillsHtml}</div></div>` : ''}
      </section>
    `;
  }

  function composePageContent(pageKey, data) {
    const company = data.siteSettings.companyName;

    if (pageKey === 'about') {
      const pills = `
        <a href="#introduction" class="subnav-pill">Introduction</a>
        <a href="#vision-mission" class="subnav-pill">Vision &amp; Mission</a>
        <a href="#organization-structure" class="subnav-pill">Organization Structure</a>
        <a href="#our-commitment" class="subnav-pill">Our Commitment</a>
        <a href="#our-people" class="subnav-pill">Our People</a>
      `;
      return [
        renderPageHeaderBanner('About Us', `About ${company}`, 'Our story, vision and mission, leadership structure, commitments, and the people behind our work.', pills),
        renderIntroductionSection(data, false),
        renderOrganizationSection(data),
        renderCommitmentsSection(data),
        renderPeopleSection(data),
        renderCustomBlocks(data),
        renderConsultationBand(data)
      ].join('\n');
    }

    if (pageKey === 'services') {
      const pills = `
        <button type="button" class="subnav-pill ${currentServiceFilter === 'all' ? 'active' : ''}" data-service-filter="all">All Services</button>
        <button type="button" class="subnav-pill ${currentServiceFilter === 'core' ? 'active' : ''}" data-service-filter="core">Core Divisions</button>
        <button type="button" class="subnav-pill ${currentServiceFilter === 'expansion' ? 'active' : ''}" data-service-filter="expansion">Growth Sectors</button>
      `;
      const parts = [
        renderPageHeaderBanner('Services', 'Our Services & Portfolio', 'Comprehensive solutions across oil and gas, logistics, engineering, environmental stewardship, and infrastructure.', pills)
      ];
      if (currentServiceFilter === 'all') {
        parts.push(renderMajorServicesSection(data, false));
        parts.push(renderGlobalExpertiseSection(data));
        parts.push(renderExpansionPortfolioSection(data));
      } else if (currentServiceFilter === 'core') {
        parts.push(renderGlobalExpertiseSection(data));
      } else {
        parts.push(renderExpansionPortfolioSection(data));
      }
      parts.push(renderConsultationBand(data));
      return parts.join('\n');
    }

    if (pageKey === 'contact') {
      const pills = `
        <a href="#inquiry-section" class="subnav-pill">Inquiry &amp; Quote</a>
        <a href="#contact" class="subnav-pill">Our Offices</a>
      `;
      return [
        renderPageHeaderBanner('Contact Us', `Contact ${company}`, 'Reach our offices in Abuja and Port Harcourt, or send us a direct inquiry below.', pills),
        renderContactInquirySection(data),
        renderContactSection(data)
      ].join('\n');
    }

    return [
      renderHeroSection(data),
      `<div id="home-overview">${renderIntroductionSection(data, true)}</div>`,
      renderMajorServicesSection(data, true),
      renderCustomBlocks(data),
      renderConsultationBand(data)
    ].join('\n');
  }

  // =====================================================
  // UTILITY BAR & FOOTER
  // =====================================================
  function renderUtilityAndFooter(data) {
    const ct = data.contact || {};
    const s = data.siteSettings || {};
    const phone1 = (ct.phones || [])[0] || '';
    const email1 = (ct.emails || [])[0] || '';

    const label = document.getElementById('utility-company-label');
    if (label) label.textContent = `${s.companyName} | Abuja & Port Harcourt, Nigeria`;
    const links = document.getElementById('utility-contact-links');
    if (links) {
      links.innerHTML = `
        ${phone1 ? `<a href="tel:${escapeHtml(phone1)}">${escapeHtml(phone1)}</a>` : ''}
        ${phone1 && email1 ? '<span class="utility-sep">|</span>' : ''}
        ${email1 ? `<a href="mailto:${escapeHtml(email1)}">${escapeHtml(email1)}</a>` : ''}
      `;
    }

    const footer = document.getElementById('site-footer');
    if (!footer) return;
    const navItems = (s.navigation || []).filter((n) => n.visible !== false);
    footer.innerHTML = `
      <div class="footer-main-container">
        <div>
          <div class="footer-brand-box"><img src="${escapeHtml(s.logoUrl)}" alt="${escapeHtml(s.companyName)}" /></div>
          <p class="footer-brand-desc">${escapeHtml(s.tagline || '')} Integrated services across oil and gas, logistics, engineering, environmental management, and construction.</p>
        </div>
        <div>
          <h4 class="footer-col-title">Quick Links</h4>
          <ul class="footer-links-list">
            ${navItems.map((n) => `<li><a href="${escapeHtml(n.target)}" data-route-link="${escapeHtml(n.target)}">${escapeHtml(n.label)}</a></li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 class="footer-col-title">Our Offices</h4>
          <div class="footer-office-block"><strong>${escapeHtml(ct.abujaTitle || 'ABUJA ADDRESS:')}</strong>${(ct.abujaLines || []).map(escapeHtml).join('<br />')}</div>
          <div class="footer-office-block"><strong>${escapeHtml(ct.phTitle || 'PH ADDRESS:')}</strong>${(ct.phLines || []).map(escapeHtml).join('<br />')}</div>
        </div>
        <div>
          <h4 class="footer-col-title">Contact</h4>
          <div class="footer-contact-item">${SVG_ICONS.phone}<div>${(ct.phones || []).map((ph) => `<a href="tel:${escapeHtml(ph)}">${escapeHtml(ph)}</a>`).join('<br />')}</div></div>
          <div class="footer-contact-item">${SVG_ICONS.globe}<div><a href="https://${escapeHtml(ct.website)}" target="_blank" rel="noopener">${escapeHtml(ct.website)}</a></div></div>
          <div class="footer-contact-item">${SVG_ICONS.mail}<div>${(ct.emails || []).map((em) => `<a href="mailto:${escapeHtml(em)}">${escapeHtml(em)}</a>`).join('<br />')}</div></div>
        </div>
      </div>
      <div class="footer-bottom-bar">
        <div class="footer-bottom-inner">
          <span>&copy; ${new Date().getFullYear()} ${escapeHtml(s.companyName)}. All rights reserved.</span>
          <span>${escapeHtml(s.tagline || '')}</span>
        </div>
      </div>
    `;
  }

  function applyThemeColors(colors) {
    if (!colors) return;
    const root = document.documentElement;
    if (colors.primaryGreen) root.style.setProperty('--primary-green', colors.primaryGreen);
    if (colors.deepTeal) root.style.setProperty('--deep-teal', colors.deepTeal);
    if (colors.forestGreen) root.style.setProperty('--forest-green', colors.forestGreen);
    if (colors.navyAccent) root.style.setProperty('--navy-accent', colors.navyAccent);
    if (colors.amberAccent) root.style.setProperty('--amber-accent', colors.amberAccent);
  }

  // =====================================================
  // ANIMATIONS & WIDGETS
  // =====================================================
  function setupSectionScrollAnimations() {
    const sections = document.querySelectorAll('.cms-section');
    const selector = [
      '.section-header', '.hero-eyebrow-badge', '.hero-display-headline', '.hero-tricolor-bar',
      '.hero-subtitle-text', '.hero-actions-row', '.hero-pillar-card',
      '.intro-body-copy', '.intro-media-card', '.vm-card', '.btn-section-explore',
      '.service-check-list li', '.expansion-pill-grid li',
      '.core-division-content', '.core-division-media', '.petro-banner-card', '.sector-exec-card',
      '.org-header-banner', '.org-viewer-card',
      '.commitment-exec-card', '.pillar-exec-card',
      '.people-highlight-banner', '.people-paragraphs p', '.people-callout-box', '.people-stat-box',
      '.inquiry-form-card', '.office-card-box', '.storage-terminal-card', '.exec-cta-copy'
    ].join(', ');

    sections.forEach((sec) => {
      sec.querySelectorAll(selector).forEach((el, idx) => {
        el.classList.add('anim-text');
        el.style.setProperty('--stagger-delay', `${Math.min(idx * 60, 450)}ms`);
      });
    });

    if (!('IntersectionObserver' in window)) {
      sections.forEach((s) => s.classList.add('section-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });

    sections.forEach((sec, idx) => {
      if (idx === 0) sec.classList.add('section-visible');
      else observer.observe(sec);
    });
  }

  function setupInteractiveWidgets() {
    if (heroSlideTimer) {
      clearInterval(heroSlideTimer);
      heroSlideTimer = null;
    }
    const heroSection = document.getElementById('hero');
    const slideBtns = Array.from(document.querySelectorAll('[data-hero-slide]'));
    const bgSlides = Array.from(document.querySelectorAll('[data-hero-bg]'));
    const activeCaption = document.getElementById('hero-active-slide-caption');

      if (heroSection && slideBtns.length && bgSlides.length) {
        const SLIDE_MS = 6500;
        let currentSlideIdx = 0;
        let paused = false;

        const activateSlide = (idx) => {
          const total = bgSlides.length;
          currentSlideIdx = ((idx % total) + total) % total;
          bgSlides.forEach((s, i) => s.classList.toggle('active', i === currentSlideIdx));
          slideBtns.forEach((b, i) => {
            b.classList.remove('active');
            if (i === currentSlideIdx) {
              void b.offsetWidth; // restart progress animation
              b.classList.add('active');
            }
          });
          if (activeCaption) {
            activeCaption.classList.add('is-changing');
            setTimeout(() => {
              activeCaption.textContent = slideBtns[currentSlideIdx].getAttribute('data-slide-label');
              activeCaption.classList.remove('is-changing');
            }, 250);
          }
        };

        const restartTimer = () => {
          if (heroSlideTimer) clearInterval(heroSlideTimer);
          heroSlideTimer = setInterval(() => {
            if (!paused && !document.hidden) activateSlide(currentSlideIdx + 1);
          }, SLIDE_MS);
        };

        slideBtns.forEach((btn, idx) => btn.addEventListener('click', () => { activateSlide(idx); restartTimer(); }));
        const prevBtn = heroSection.querySelector('[data-hero-prev]');
        const nextBtn = heroSection.querySelector('[data-hero-next]');
        if (prevBtn) prevBtn.addEventListener('click', () => { activateSlide(currentSlideIdx - 1); restartTimer(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { activateSlide(currentSlideIdx + 1); restartTimer(); });

        const copyCol = heroSection.querySelector('.hero-copy-col');
        if (copyCol) {
          copyCol.addEventListener('mouseenter', () => { paused = true; heroSection.classList.add('is-paused'); });
          copyCol.addEventListener('mouseleave', () => { paused = false; heroSection.classList.remove('is-paused'); });
        }

        let touchStartX = null;
        heroSection.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
        heroSection.addEventListener('touchend', (e) => {
          if (touchStartX === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX;
          if (Math.abs(dx) > 50) { activateSlide(currentSlideIdx + (dx < 0 ? 1 : -1)); restartTimer(); }
          touchStartX = null;
        }, { passive: true });

        restartTimer();
      }

      const btns = document.querySelectorAll('[data-org-view]');
      const interactiveEl = document.getElementById('org-interactive-view');
      const explorerEl = document.getElementById('org-explorer-view');
      const imageEl = document.getElementById('org-image-view');
      btns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const view = btn.getAttribute('data-org-view');
          btns.forEach((b) => b.classList.toggle('active', b === btn));
          if (interactiveEl) interactiveEl.style.display = view === 'interactive' ? 'block' : 'none';
          if (explorerEl) explorerEl.style.display = view === 'mobile-explorer' ? 'block' : 'none';
          if (imageEl) imageEl.style.display = view === 'image' ? 'block' : 'none';
        });
      });

      document.querySelectorAll('[data-org-acc-toggle]').forEach((hdr) => {
        hdr.addEventListener('click', () => {
          const body = document.getElementById(`org-acc-${hdr.getAttribute('data-org-acc-toggle')}`);
          if (body) body.classList.toggle('open');
        });
      });

      document.querySelectorAll('[data-service-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentServiceFilter = btn.getAttribute('data-service-filter');
          renderSite(siteData);
        });
      });

      const inqForm = document.getElementById('public-inquiry-form');
      if (inqForm) {
        inqForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const feedback = document.getElementById('inquiry-feedback');
          const submitBtn = inqForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;
          try {
            const res = await fetch('/api/inquiries', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: document.getElementById('inq-name').value,
                company: document.getElementById('inq-company').value,
                email: document.getElementById('inq-email').value,
                phone: document.getElementById('inq-phone').value,
                sector: document.getElementById('inq-sector').value,
                message: document.getElementById('inq-message').value
              })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Unable to submit inquiry.');
            if (feedback) {
              feedback.textContent = result.message || 'Inquiry submitted.';
              feedback.className = 'inquiry-status-msg success';
              feedback.style.display = 'block';
            }
            inqForm.reset();
          } catch (err) {
            if (feedback) {
              feedback.textContent = err.message || 'Unable to submit inquiry at the moment.';
              feedback.className = 'inquiry-status-msg error';
              feedback.style.display = 'block';
            }
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }

      document.querySelectorAll('#cms-main-container [data-route-link], #site-footer [data-route-link]').forEach(bindRouteLink);
    }

    function bindRouteLink(link) {
      if (link.dataset.routeBound) return;
      link.dataset.routeBound = '1';
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('data-route-link');
        if (!href) return;
        e.preventDefault();
        navigateToRoute(href);
      });
    }

    function renderHeaderNavigation(data, activePageKey) {
      const navItems = (data.siteSettings.navigation || []).filter((n) => n.visible !== false);

      const desktopList = document.getElementById('desktop-nav-list');
      if (desktopList) {
        desktopList.innerHTML = navItems.map((item) => {
          const isActive = item.page === activePageKey;
          const subs = item.subItems || [];
          return `
          <li class="nav-item-dropdown">
            <a href="${escapeHtml(item.target)}" data-route-link="${escapeHtml(item.target)}" class="nav-top-link ${isActive ? 'active' : ''}">
              <span>${escapeHtml(item.label)}</span>${subs.length ? SVG_ICONS.chevronDown : ''}
            </a>
            ${subs.length ? `
              <ul class="nav-dropdown-menu">
                ${subs.map((sub) => `<li><a href="${escapeHtml(sub.target)}" data-route-link="${escapeHtml(sub.target)}"><span>${escapeHtml(sub.label)}</span>${SVG_ICONS.arrowSmall}</a></li>`).join('')}
              </ul>
            ` : ''}
          </li>
        `;
        }).join('');
      }

      const mobileList = document.getElementById('mobile-nav-list');
      if (mobileList) {
        mobileList.innerHTML = navItems.map((item, idx) => {
          const isActive = item.page === activePageKey;
          const subs = item.subItems || [];
          return `
          <li class="mobile-nav-group">
            <div class="mobile-nav-row">
              <a href="${escapeHtml(item.target)}" data-route-link="${escapeHtml(item.target)}" class="mobile-nav-link ${isActive ? 'active' : ''}">${escapeHtml(item.label)}</a>
              ${subs.length ? `<button type="button" class="mobile-sub-toggle" data-mobile-acc="${idx}" aria-label="Toggle ${escapeHtml(item.label)} sections">${SVG_ICONS.chevronDown}</button>` : ''}
            </div>
            ${subs.length ? `
              <ul class="mobile-sub-list ${isActive ? 'expanded' : ''}" id="mobile-sub-${idx}">
                ${subs.map((sub) => `<li><a href="${escapeHtml(sub.target)}" data-route-link="${escapeHtml(sub.target)}">${escapeHtml(sub.label)}</a></li>`).join('')}
              </ul>
            ` : ''}
          </li>
        `;
        }).join('');

        mobileList.querySelectorAll('[data-mobile-acc]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const subEl = document.getElementById(`mobile-sub-${btn.getAttribute('data-mobile-acc')}`);
            if (subEl) subEl.classList.toggle('expanded');
          });
        });
      }

      const mobileContact = document.getElementById('mobile-drawer-contact');
      if (mobileContact && data.contact) {
        const phone1 = (data.contact.phones || [])[0] || '';
        const email1 = (data.contact.emails || [])[0] || '';
        mobileContact.innerHTML = `
        <div><strong>Phone:</strong> <a href="tel:${escapeHtml(phone1)}">${escapeHtml(phone1)}</a></div>
        <div><strong>Email:</strong> <a href="mailto:${escapeHtml(email1)}">${escapeHtml(email1)}</a></div>
      `;
      }

      document.querySelectorAll('#site-header [data-route-link], #mobile-drawer [data-route-link]').forEach((link) => {
        delete link.dataset.routeBound;
        bindRouteLink(link);
      });
    }

    function closeMobileDrawer() {
      const drawer = document.getElementById('mobile-drawer');
      const backdrop = document.getElementById('mobile-drawer-backdrop');
      const trigger = document.getElementById('mobile-menu-trigger');
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    function scrollToHash(hashPart) {
      const el = hashPart ? document.getElementById(hashPart) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function navigateToRoute(href) {
      closeMobileDrawer();
      const [pathPart, hashPart] = href.split('#');
      const targetPath = pathPart || '/';
      const normalize = (p) => (p.replace(/\.html$/, '').replace(/\/+$/, '') || '/').replace(/^\/index$/, '/');

      if (normalize(targetPath) !== normalize(window.location.pathname)) {
        window.history.pushState({}, '', href);
        currentServiceFilter = 'all';
        renderSite(siteData);
        window.scrollTo(0, 0);
      } else if (hashPart) {
        window.history.pushState({}, '', href);
      }
      setTimeout(() => scrollToHash(hashPart), 80);
    }

    function renderSite(data) {
      if (!data || !data.siteSettings) return;
      siteData = data;
      const activePageKey = getActivePageKey();
      const company = data.siteSettings.companyName;
      const pageTitles = {
        home: `${company} | ${data.siteSettings.tagline || 'Corporate Profile'}`,
        about: `About Us | ${company}`,
        services: `Services | ${company}`,
        contact: `Contact Us | ${company}`
      };
      document.title = pageTitles[activePageKey] || pageTitles.home;

      applyThemeColors(data.siteSettings.colors);
      ['header-logo', 'mobile-drawer-logo'].forEach((id) => {
        const el = document.getElementById(id);
        if (el && data.siteSettings.logoUrl) el.src = data.siteSettings.logoUrl;
      });

      renderHeaderNavigation(data, activePageKey);
      renderUtilityAndFooter(data);

      const mainEl = document.getElementById('cms-main-container');
      if (mainEl) mainEl.innerHTML = composePageContent(activePageKey, data);

      setupSectionScrollAnimations();
      setupInteractiveWidgets();
    }

    async function checkAuthenticatedAdmin() {
      const token = localStorage.getItem('avigo_portal_token');
      if (!token) return;
      try {
        const res = await fetch('/api/auth/verify', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return;
        const info = await res.json();
        adminPortalPath = info.portalPath || '/avigo-portal';
        document.body.classList.add('is-avigo-admin');
        const pill = document.getElementById('avigo-admin-floating-pill');
        if (pill) {
          pill.style.display = 'flex';
          pill.innerHTML = `<span>Avigo Admin (${escapeHtml(info.username)})</span><a href="${escapeHtml(adminPortalPath)}">Open Admin Portal &rarr;</a>`;
        }
        if (siteData) renderSite(siteData);
      } catch (e) {
        // visitor mode
      }
    }

    async function init() {
      const openBtn = document.getElementById('mobile-menu-trigger');
      const closeBtn = document.getElementById('mobile-drawer-close');
      const backdrop = document.getElementById('mobile-drawer-backdrop');
      const drawer = document.getElementById('mobile-drawer');

      if (openBtn && drawer && backdrop) {
        openBtn.addEventListener('click', () => {
          drawer.classList.add('open');
          backdrop.classList.add('open');
          openBtn.setAttribute('aria-expanded', 'true');
          document.body.style.overflow = 'hidden';
        });
      }
      if (closeBtn) closeBtn.addEventListener('click', closeMobileDrawer);
      if (backdrop) backdrop.addEventListener('click', closeMobileDrawer);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMobileDrawer(); });

      const header = document.getElementById('site-header');
      if (header) {
        window.addEventListener('scroll', () => {
          header.classList.toggle('scrolled', window.scrollY > 20);
        }, { passive: true });
      }

      window.addEventListener('popstate', () => { if (siteData) renderSite(siteData); });

      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'AVIGO_LIVE_PREVIEW' && event.data.payload) {
          renderSite(event.data.payload);
        }
      });

      try {
        const res = await fetch('/api/content');
        const data = await res.json();
        renderSite(data);
        if (window.location.hash) {
          setTimeout(() => scrollToHash(window.location.hash.slice(1)), 200);
        }
      } catch (err) {
        console.error('Failed to load site content:', err);
      }

      await checkAuthenticatedAdmin();
    }

    document.addEventListener('DOMContentLoaded', init);
  }) ();
