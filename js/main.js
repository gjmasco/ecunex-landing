(() => {
  'use strict';

  // ---------- Mobile navigation ----------
  const navToggle = document.querySelector('.nav-toggle');
  const header = document.querySelector('.site-header');
  if (navToggle && header) {
    navToggle.addEventListener('click', () => {
      const open = header.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    header.querySelectorAll('.main-nav a').forEach((a) =>
      a.addEventListener('click', () => {
        header.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      })
    );
  }

  window.addEventListener('scroll', () => {
    header?.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // ---------- Product showcase tabs ----------
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const activateTab = (tab) => {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      if (next) { e.preventDefault(); next.focus(); activateTab(next); }
    });
  });

  // ---------- Admin screenshot gallery ----------
  const mainShot = document.getElementById('portal-main-shot');
  document.querySelectorAll('.thumbs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.thumbs button').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      mainShot.src = btn.dataset.src;
      mainShot.alt = btn.dataset.alt;
    });
  });

  // ---------- Dealer application form ----------
  const form = document.getElementById('dealer-form');
  const statusEl = document.getElementById('form-status');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      statusEl.className = 'form-status';
      statusEl.textContent = '';

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = Object.fromEntries(new FormData(form).entries());
      // Honeypot: bots fill hidden fields, humans don't.
      if (data.website) return;
      delete data.website;

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.classList.add('loading');

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        form.reset();
        statusEl.classList.add('ok');
        statusEl.textContent = 'Thank you! Your dealer application has been received. Our team will contact you within 24 business hours.';
      } catch {
        statusEl.classList.add('error');
        statusEl.textContent = 'We could not send your application right now. Please try again or email us at info@ecunex.com.';
      } finally {
        button.disabled = false;
        button.classList.remove('loading');
      }
    });
  }

  // ---------- Reveal on scroll ----------
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('visible'));
  }

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
