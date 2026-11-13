/* ============================================================
   DRISHYA MEDIA — script.js
   - Navbar scroll state
   - Hamburger menu toggle
   - Scroll-reveal animations
   - Stats counter animation
   - Tool bar progress animation
   - Pricing toggle (monthly ↔ annual)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ── NAVBAR SCROLL STATE ── */
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  /* ── MOBILE HAMBURGER ── */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  hamburger?.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);
    // Animate bars → X
    const spans = hamburger.querySelectorAll('span');
    if (isOpen) {
      spans[0].style.cssText = 'transform: rotate(45deg) translate(5px, 5px)';
      spans[1].style.cssText = 'transform: rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.cssText = '';
      spans[1].style.cssText = '';
    }
  });

  // Close mobile menu when any link clicked
  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      const spans = hamburger.querySelectorAll('span');
      spans[0].style.cssText = '';
      spans[1].style.cssText = '';
    });
  });

  /* ── SCROLL REVEAL ── */
  const revealEls = [];

  // Add reveal classes to sections
  const sections = document.querySelectorAll([
    '.numbers-section',
    '.work-section',
    '.extraordinary-section',
    '.services-section',
    '.pricing-section',
    '.about-section',
  ].join(','));

  sections.forEach(el => {
    el.querySelectorAll([
      '.stat-item',
      '.project-card',
      '.tool-card',
      '.pricing-card',
      '.team-card',
      '.numbers-headline',
      '.numbers-label',
      '.work-title',
      '.work-label',
      '.extra-tagline',
      '.extra-brand',
      '.pricing-title',
      '.pricing-sub',
      '.about-heading',
      '.about-para',
      '.about-tags',
      '.section-label',
      '.services-heading',
    ].join(',')).forEach((child, i) => {
      child.classList.add('reveal');
      child.style.transitionDelay = `${i * 60}ms`;
      revealEls.push(child);
    });
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealEls.forEach(el => revealObserver.observe(el));

  /* ── STATS COUNTER ANIMATION ── */
  const statNumbers = document.querySelectorAll('.stat-number');

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.target);
      const isDecimal = target % 1 !== 0;
      const duration = 1600;
      const startTime = performance.now();

      const tick = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = target * eased;
        el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = isDecimal ? target.toFixed(1) : target;
      };

      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.4 });

  statNumbers.forEach(el => counterObserver.observe(el));

  /* ── PRICING TOGGLE ── */
  const toggleSwitch = document.getElementById('toggleSwitch');
  const priceAmounts = document.querySelectorAll('.price-amount');
  let isAnnual = false;

  toggleSwitch?.addEventListener('click', () => {
    isAnnual = !isAnnual;
    toggleSwitch.setAttribute('aria-checked', isAnnual ? 'true' : 'false');

    priceAmounts.forEach(el => {
      const monthly = el.dataset.monthly;
      const annual  = el.dataset.annual;
      const val = isAnnual ? annual : monthly;

      // Animate flip
      el.style.opacity = '0';
      el.style.transform = 'translateY(-8px)';
      setTimeout(() => {
        el.textContent = val ? parseInt(val).toLocaleString() : el.textContent;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 180);
    });

    // Show/hide original prices on all plans
    const origPrices = document.querySelectorAll('.price-orig');
    origPrices.forEach(p => {
      p.style.display = isAnnual ? 'inline' : 'none';
    });
  });

  // Set transition on price amounts
  priceAmounts.forEach(el => {
    el.style.transition = 'opacity .18s ease, transform .18s ease';
  });

  // Start: hide original prices
  document.querySelectorAll('.price-orig').forEach(p => p.style.display = 'none');

  /* ── LUXURY PAGE TRANSITION CURTAIN & PROGRESS BAR ── */
  const pageCurtain = document.getElementById('pageCurtain');
  const scrollProgressBar = document.getElementById('scrollProgressBar');

  // Entrance reveal
  const hideCurtain = () => {
    if (pageCurtain && !pageCurtain.classList.contains('loaded')) {
      pageCurtain.classList.add('loaded');
    }
  };
  window.addEventListener('load', () => setTimeout(hideCurtain, 220));
  setTimeout(hideCurtain, 650); // Safety fallback

  // Exit transition for external/admin links
  document.querySelectorAll('a:not([href^="#"]):not([target="_blank"])').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      e.preventDefault();
      if (pageCurtain) {
        pageCurtain.classList.remove('loaded');
        pageCurtain.classList.add('active');
        setTimeout(() => { window.location.href = href; }, 360);
      } else {
        window.location.href = href;
      }
    });
  });

  // Top Scroll Progress Bar
  window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (totalHeight > 0 && scrollProgressBar) {
      const pct = (window.scrollY / totalHeight) * 100;
      scrollProgressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    }
  }, { passive: true });

  /* ── SMOOTH SCROLL WITH SECTION PAGE-SWITCHING ANIMATION ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
        const top = target.getBoundingClientRect().top + window.scrollY - navH;
        
        // Trigger smooth scroll
        window.scrollTo({ top, behavior: 'smooth' });

        // Trigger cinematic section switch animation
        target.classList.remove('section-switch-flash');
        void target.offsetWidth; // Force reflow
        target.classList.add('section-switch-flash');
      }
    });
  });

  /* ── HERO HEADLINE ANIMATION (stagger words) ── */
  // Already handled by CSS animation via .hero-right children

  /* ── 0-LAG INSTANT ACCURATE CURSOR (No Green Glow, No Latency) ── */
  const cursorDot = document.getElementById('cursor');
  const cursorFollower = document.getElementById('cursorFollower');

  if (cursorDot && cursorFollower) {
    let isHovered = false;

    // Use pointermove with translate3d for direct 0-latency GPU updates
    window.addEventListener('pointermove', (e) => {
      const x = e.clientX;
      const y = e.clientY;

      // Real-time 0-lag positioning: locks 1:1 to pointer coordinates
      cursorDot.style.transform = `translate3d(${x - 3}px, ${y - 3}px, 0) scale(${isHovered ? 1.5 : 1})`;
      cursorFollower.style.transform = `translate3d(${x - 15}px, ${y - 15}px, 0)`;
    }, { passive: true });

    // Interactive scale reaction
    document.querySelectorAll('a, button, .project-card, .plan-btn, .addon-card, .tool-card, .service-pill-btn, .soft-chip, .toggle-switch, .extra-image-wrap').forEach(el => {
      el.addEventListener('mouseenter', () => {
        isHovered = true;
        cursorFollower?.classList.add('grow');
      });
      el.addEventListener('mouseleave', () => {
        isHovered = false;
        cursorFollower?.classList.remove('grow');
      });
    });
  }

  /* ── 1ST PAGE TO 2ND PAGE KINETIC SCROLL WARP (Webstacked Style) ── */
  const heroInner = document.querySelector('.hero-inner');
  const heroIndicator = document.getElementById('heroPageIndicator');
  const numbersSection = document.querySelector('.numbers-section');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Hero parallax & perspective squeeze
    if (scrollY < 900 && heroInner) {
      const heroOpacity = Math.max(0.15, 1 - (scrollY / 650));
      const heroLift = scrollY * 0.28;
      const heroScale = Math.max(0.92, 1 - (scrollY * 0.00018));
      heroInner.style.transform = `translateY(-${heroLift}px) scale(${heroScale})`;
      heroInner.style.opacity = heroOpacity;
    }

    // Indicator fade out
    if (heroIndicator) {
      const indOpacity = Math.max(0, 1 - (scrollY / 140));
      heroIndicator.style.opacity = indOpacity;
      heroIndicator.style.pointerEvents = indOpacity < 0.2 ? 'none' : 'all';
    }
  }, { passive: true });

  /* ════════════════════════════════════════════════════════════════
     BUTTERY 0-LAG CINEMATIC EXTRAORDINARY ANIMATION (RAF LERP PHYSICS)
  ════════════════════════════════════════════════════════════════ */
  const extraSection = document.getElementById('extraordinary');
  const extraLineTop = document.getElementById('extraLineTop');
  const extraLineBottom = document.getElementById('extraLineBottom');
  const extraStage = document.getElementById('extraStage');
  const extraBottle = document.getElementById('extraBottle');
  const bottleSheen = document.getElementById('bottleSheen');
  const apertureHalo = document.getElementById('apertureHalo');

  if (extraSection && extraLineTop && extraLineBottom && extraBottle) {
    let targetProgress = 0.5;
    let currentProgress = 0.5;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;
    let isVisible = false;
    let isHovered = false;

    // Passive Scroll State Tracker
    const updateScrollMetrics = () => {
      const rect = extraSection.getBoundingClientRect();
      const winH = window.innerHeight;

      if (rect.top < winH && rect.bottom > 0) {
        isVisible = true;
        // Progress 0 (entering bottom of screen) -> 0.5 (perfect center) -> 1 (exiting top)
        targetProgress = Math.max(0, Math.min(1, (winH - rect.top) / (winH + rect.height)));
      } else {
        isVisible = false;
      }
    };

    window.addEventListener('scroll', updateScrollMetrics, { passive: true });
    window.addEventListener('resize', updateScrollMetrics, { passive: true });
    updateScrollMetrics();

    // Smooth Cursor 3D Interaction
    extraStage.addEventListener('pointermove', (e) => {
      isHovered = true;
      const rect = extraStage.getBoundingClientRect();
      targetMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }, { passive: true });

    extraStage.addEventListener('pointerleave', () => {
      isHovered = false;
      targetMouseX = 0;
      targetMouseY = 0;
    });

    // Shutter Flash on Click
    extraBottle.addEventListener('click', () => {
      extraBottle.style.filter = 'brightness(1.6) contrast(1.1)';
      setTimeout(() => {
        extraBottle.style.filter = '';
      }, 150);
    });

    // Dedicated 60fps/120fps Hardware-Accelerated Animation Loop
    function renderExtraordinary() {
      if (isVisible || isHovered) {
        // Silky smooth inertia damping (0.1 = instant feel with no sluggishness)
        currentProgress += (targetProgress - currentProgress) * 0.12;
        currentMouseX += (targetMouseX - currentMouseX) * 0.1;
        currentMouseY += (targetMouseY - currentMouseY) * 0.1;

        // Centered delta: 0 when exactly centered in the viewport
        const delta = currentProgress - 0.5;

        // 1. Kinetic Text Parallax & Dimensional Expansion
        // Opposing vertical breathing + subtle micro-drift (never breaks center symmetry or clips)
        const topY = -delta * 28 + (currentMouseY * -3);
        const topX = -delta * 18 + (currentMouseX * -4);
        const bottomY = delta * 28 + (currentMouseY * 3);
        const bottomX = delta * 18 + (currentMouseX * 4);
        const bottomScale = 1 + (Math.abs(delta) * 0.025);

        extraLineTop.style.transform = `translate3d(${topX.toFixed(2)}px, ${topY.toFixed(2)}px, 0)`;
        extraLineBottom.style.transform = `translate3d(${bottomX.toFixed(2)}px, ${bottomY.toFixed(2)}px, 0) scale(${bottomScale.toFixed(3)})`;

        // 2. 3D Bottle Perspective Tilt
        const bottleTiltX = -currentMouseY * 15;
        const bottleTiltY = currentMouseX * 15;
        const bottleLiftY = -12 + (delta * -22);
        extraBottle.style.transform = `translate3d(0, ${bottleLiftY.toFixed(2)}px, 0) rotateX(${bottleTiltX.toFixed(2)}deg) rotateY(${bottleTiltY.toFixed(2)}deg)`;

        // 3. Specular Silver Sheen Tracker
        if (bottleSheen) {
          const sheenX = currentMouseX * 120;
          const sheenY = currentMouseY * 120;
          bottleSheen.style.transform = `translate3d(${sheenX.toFixed(1)}px, ${sheenY.toFixed(1)}px, 0) rotate(-15deg)`;
        }

        // 4. Aperture Halo Orbital Parallax
        if (apertureHalo) {
          const haloRotate = currentProgress * 160 + (currentMouseX * 20);
          const haloScale = 0.95 + (currentProgress * 0.12);
          const haloX = currentMouseX * 12;
          const haloY = currentMouseY * 12;
          apertureHalo.style.transform = `translate3d(calc(-50% + ${haloX.toFixed(1)}px), calc(-50% + ${haloY.toFixed(1)}px), 0) rotate(${haloRotate.toFixed(2)}deg) scale(${haloScale.toFixed(3)})`;
        }
      }

      requestAnimationFrame(renderExtraordinary);
    }

    requestAnimationFrame(renderExtraordinary);
  }

  /* ── PROJECT CARD HOVER TILT (smooth spring physics) ── */
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `translateY(-6px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform .5s cubic-bezier(0.16, 1, 0.3, 1), background .2s';
    });
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform .1s ease, background .2s';
    });
  });

  /* ── PARALLAX on hero background ── */
  const heroBgLines = document.querySelector('.hero-bg-lines');
  if (heroBgLines) {
    window.addEventListener('scroll', () => {
      const scrollY = window.scrollY;
      heroBgLines.style.transform = `translateY(${scrollY * 0.08}px)`;
    }, { passive: true });
  }

  /* ── INTERACTIVE BOOKING & ENQUIRY FORM ── */
  const servicePills = document.querySelectorAll('.service-pill-btn');
  const selectedServiceInput = document.getElementById('selectedService');
  const budgetSelect = document.getElementById('clientBudget');

  // Ensure Desired Package / Budget dropdown is never disabled for any service
  const unlockBudgetSelect = () => {
    if (!budgetSelect) return;
    budgetSelect.disabled = false;
    budgetSelect.removeAttribute('disabled');
  };
  unlockBudgetSelect();

  servicePills.forEach(pill => {
    pill.addEventListener('click', () => {
      servicePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (selectedServiceInput) {
        selectedServiceInput.value = pill.dataset.value;
      }
      unlockBudgetSelect();
    });
  });

  // Pre-select budget when clicking pricing plan buttons
  document.querySelectorAll('.plan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.pricing-card');
      const planName = card ? card.querySelector('.plan-name')?.textContent?.trim() : '';
      unlockBudgetSelect();
      if (budgetSelect && planName) {
        Array.from(budgetSelect.options).forEach(opt => {
          if (opt.value.toLowerCase().includes(planName.toLowerCase())) {
            budgetSelect.value = opt.value;
          }
        });
      }
      setTimeout(() => {
        document.getElementById('clientName')?.focus();
      }, 400);
    });
  });

  // Clicking an add-on card selects Custom Plan in the booking form
  document.querySelectorAll('.addon-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      unlockBudgetSelect();
      if (budgetSelect) {
        budgetSelect.value = 'Custom Plan + Add-ons';
      }
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => {
          document.getElementById('clientMessage')?.focus();
        }, 500);
      }
    });
  });

  // Form submission handler
  const enquiryForm = document.getElementById('enquiryForm');
  const formStatus = document.getElementById('formStatus');
  const submitBtn = document.getElementById('submitBtn');
  const btnText = submitBtn?.querySelector('.btn-text');
  const btnLoader = submitBtn?.querySelector('.btn-loader');

  enquiryForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById('clientName');
    const emailInput = document.getElementById('clientEmail');

    if (!nameInput.value.trim() || !emailInput.value.trim()) {
      showStatus('Please fill in both your name and a valid email address.', 'error');
      nameInput.focus();
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      phone: document.getElementById('clientPhone')?.value.trim() || '',
      brand_name: document.getElementById('brandName')?.value.trim() || '',
      service: selectedServiceInput?.value || 'Full Visual Growth',
      budget: document.getElementById('clientBudget')?.value || 'Flexible',
      preferred_date: document.getElementById('preferredDate')?.value || '',
      message: document.getElementById('clientMessage')?.value.trim() || '',
    };

    // UI Loading state
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoader) btnLoader.style.display = 'inline-flex';
    hideStatus();

    // API Endpoint (works locally, on Render, or when hosted on Vercel)
    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? ''
      : (window.location.origin.includes('onrender.com') ? '' : 'https://drishya-media.onrender.com');

    try {
      const res = await fetch(`${API_BASE}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showStatus(`🎉 <strong>Booking Request Sent!</strong> Thank you ${payload.name}, your enquiry [#${data.id}] is logged. We'll reach out within 24 hours to schedule your strategy session.`, 'success');
        enquiryForm.reset();
        // Reset pills
        servicePills.forEach((p, idx) => {
          if (idx === 0) p.classList.add('active');
          else p.classList.remove('active');
        });
        if (selectedServiceInput) selectedServiceInput.value = 'Full Visual Growth';
        unlockBudgetSelect();
      } else {
        showStatus(data.error || 'Failed to submit enquiry. Please try again or email us directly.', 'error');
      }
    } catch (err) {
      console.error('Submission error:', err);
      showStatus('Network error occurred. Please check your connection or contact drishyamedia693@gmail.com directly.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline-flex';
      if (btnLoader) btnLoader.style.display = 'none';
    }
  });

  function showStatus(msg, type) {
    if (!formStatus) return;
    formStatus.innerHTML = msg;
    formStatus.className = `form-status ${type}`;
    formStatus.style.display = 'block';
  }

  function hideStatus() {
    if (!formStatus) return;
    formStatus.style.display = 'none';
  }

});

/* ── PROJECT CARD 9:16 REELS PLAYER & LIGHTBOX VIEWER ── */
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('.project-card[data-work-index]'));
  if (!cards.length) return;

  var lightbox = document.getElementById('reelLightbox');
  var backdrop = document.getElementById('reelLightboxBackdrop');
  var closeBtn = document.getElementById('reelLightboxClose');
  var prevProjBtn = document.getElementById('reelLightboxPrev');
  var nextProjBtn = document.getElementById('reelLightboxNext');
  var lbTag = document.getElementById('reelLightboxTag');
  var lbTitle = document.getElementById('reelLightboxTitle');
  var lbService = document.getElementById('reelLightboxService');
  var lbVideo = document.getElementById('reelLightboxVideo');
  var lbGallery = document.getElementById('reelLightboxGallery');
  var galleryMainImg = document.getElementById('galleryMainImg');
  var galleryThumbs = document.getElementById('galleryThumbs');
  var galleryPrevBtn = document.getElementById('galleryPrevBtn');
  var galleryNextBtn = document.getElementById('galleryNextBtn');

  var currentProjIndex = 0;
  var galleryImages = [];
  var currentPhotoIndex = 0;

  function setPlayIcon(card, playing) {
    card.classList.toggle('is-playing', playing);
    var icon = card.querySelector('.reel-toggle-play i');
    if (icon) {
      icon.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
  }

  function setMuteIcon(card, muted) {
    var icon = card.querySelector('.reel-toggle-mute i');
    if (icon) {
      icon.className = muted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
    }
  }

  function pauseAllInline(exceptCard) {
    cards.forEach(function (c) {
      if (c === exceptCard) return;
      var v = c.querySelector('.project-video');
      if (v && !v.paused) {
        v.pause();
      }
      c.dataset.pinnedPlay = '';
      setPlayIcon(c, false);
    });
  }

  cards.forEach(function (card) {
    var video = card.querySelector('.project-video');
    var playBtn = card.querySelector('.reel-toggle-play');
    var muteBtn = card.querySelector('.reel-toggle-mute');
    var expandBtn = card.querySelector('.reel-open-modal');

    if (video) {
      // Desktop hover preview (only when not explicitly pinned by user)
      card.addEventListener('mouseenter', function () {
        if (window.matchMedia('(hover: hover)').matches && video.paused) {
          video.play().then(function () {
            setPlayIcon(card, true);
          }).catch(function () {});
        }
      });

      card.addEventListener('mouseleave', function () {
        if (!card.dataset.pinnedPlay && !video.paused) {
          video.pause();
          setPlayIcon(card, false);
        }
      });

      video.addEventListener('play', function () { setPlayIcon(card, true); });
      video.addEventListener('pause', function () { setPlayIcon(card, false); });
    }

    if (playBtn && video) {
      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (video.paused) {
          pauseAllInline(card);
          card.dataset.pinnedPlay = '1';
          video.play().catch(function () {});
        } else {
          card.dataset.pinnedPlay = '';
          video.pause();
        }
      });
    }

    if (muteBtn && video) {
      muteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        video.muted = !video.muted;
        setMuteIcon(card, video.muted);
        if (!video.muted && video.paused) {
          pauseAllInline(card);
          card.dataset.pinnedPlay = '1';
          video.play().catch(function () {});
        }
      });
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openLightbox(Number(card.dataset.workIndex) || 0);
      });
    }

    card.addEventListener('click', function () {
      openLightbox(Number(card.dataset.workIndex) || 0);
    });
  });

  function renderGalleryPhoto(idx) {
    if (!galleryImages.length) return;
    currentPhotoIndex = (idx + galleryImages.length) % galleryImages.length;
    if (galleryMainImg) {
      galleryMainImg.src = galleryImages[currentPhotoIndex];
    }
    if (galleryThumbs) {
      Array.prototype.forEach.call(galleryThumbs.children, function (btn, i) {
        btn.classList.toggle('active', i === currentPhotoIndex);
      });
    }
  }

  function showProjectInLightbox(index) {
    currentProjIndex = (index + cards.length) % cards.length;
    var card = cards[currentProjIndex];
    if (!card || !lightbox) return;

    var tagEl = card.querySelector('.project-tag');
    var nameEl = card.querySelector('.project-name');
    var svcEl = card.querySelector('.project-service');
    if (lbTag) lbTag.textContent = tagEl ? tagEl.textContent : '';
    if (lbTitle) lbTitle.textContent = nameEl ? nameEl.textContent : '';
    if (lbService) lbService.textContent = svcEl ? svcEl.textContent : '';

    var type = card.dataset.workType;
    if (type === 'gallery') {
      if (lbVideo) {
        lbVideo.pause();
        lbVideo.removeAttribute('src');
        lbVideo.style.display = 'none';
      }
      if (lbGallery) lbGallery.style.display = 'flex';

      galleryImages = (card.dataset.workImages || '').split(',').filter(Boolean);
      if (galleryThumbs) {
        galleryThumbs.innerHTML = '';
        galleryImages.forEach(function (src, i) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'gallery-thumb-btn';
          btn.setAttribute('aria-label', 'View photo ' + (i + 1));
          var img = document.createElement('img');
          img.src = src;
          img.alt = 'Photo ' + (i + 1);
          btn.appendChild(img);
          btn.addEventListener('click', function () { renderGalleryPhoto(i); });
          galleryThumbs.appendChild(btn);
        });
      }
      renderGalleryPhoto(0);
    } else {
      if (lbGallery) lbGallery.style.display = 'none';
      if (lbVideo) {
        lbVideo.style.display = 'block';
        lbVideo.src = card.dataset.workSrc || '';
        lbVideo.poster = card.dataset.workPoster || '';
        lbVideo.muted = false;
        lbVideo.play().catch(function () {
          lbVideo.muted = true;
          lbVideo.play().catch(function () {});
        });
      }
    }
  }

  function openLightbox(index) {
    if (!lightbox) return;
    pauseAllInline(null);
    showProjectInLightbox(index);
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lbVideo) {
      lbVideo.pause();
      lbVideo.removeAttribute('src');
      lbVideo.load();
    }
  }

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (backdrop) backdrop.addEventListener('click', closeLightbox);
  if (prevProjBtn) prevProjBtn.addEventListener('click', function () { showProjectInLightbox(currentProjIndex - 1); });
  if (nextProjBtn) nextProjBtn.addEventListener('click', function () { showProjectInLightbox(currentProjIndex + 1); });
  if (galleryPrevBtn) galleryPrevBtn.addEventListener('click', function () { renderGalleryPhoto(currentPhotoIndex - 1); });
  if (galleryNextBtn) galleryNextBtn.addEventListener('click', function () { renderGalleryPhoto(currentPhotoIndex + 1); });

  document.addEventListener('keydown', function (e) {
    if (!lightbox || !lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') showProjectInLightbox(currentProjIndex - 1);
    else if (e.key === 'ArrowRight') showProjectInLightbox(currentProjIndex + 1);
  });
})();
