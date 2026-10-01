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

  // ---------- Supported vehicles ----------
  // Edit this list to match your real, validated coverage.
  const VEHICLES = [
    { brand: 'Toyota', model: 'Hilux 2.8D (1GD-FTV)', generation: '2015+', ecu: 'Denso Gen2', protocol: 'UDS / CAN-TP' },
    { brand: 'Toyota', model: 'Hilux 2.8D (1GD-FTV)', generation: '2020+', ecu: 'Denso Gen3', protocol: 'UDS / CAN-TP' },
    { brand: 'Toyota', model: 'Hilux 2.4D (2GD-FTV)', generation: '2015+', ecu: 'Denso Gen2', protocol: 'UDS / CAN-TP' },
    { brand: 'Toyota', model: 'Fortuner 2.8D (1GD-FTV)', generation: '2015+', ecu: 'Denso Gen2', protocol: 'UDS / CAN-TP' },
    { brand: 'Toyota', model: 'Land Cruiser Prado 2.8D (1GD-FTV)', generation: '2015+', ecu: 'Denso Gen2', protocol: 'UDS / CAN-TP' },
    { brand: 'Toyota', model: 'HiAce 2.8D (1GD-FTV)', generation: '2019+', ecu: 'Denso Gen3', protocol: 'UDS / CAN-TP' },
    { brand: 'Toyota', model: 'Innova 2.4D (2GD-FTV)', generation: '2016+', ecu: 'Denso Gen2', protocol: 'UDS / CAN-TP' }
  ];

  const tbody = document.getElementById('vehicle-rows');
  const searchInput = document.getElementById('vehicle-search');
  const brandSelect = document.getElementById('vehicle-brand');
  const ecuSelect = document.getElementById('vehicle-ecu');
  const emptyMsg = document.getElementById('vehicle-empty');

  if (tbody) {
    const fillSelect = (select, key) => {
      [...new Set(VEHICLES.map((v) => v[key]))].sort().forEach((value) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });
    };
    fillSelect(brandSelect, 'brand');
    fillSelect(ecuSelect, 'ecu');

    const render = () => {
      const q = searchInput.value.trim().toLowerCase();
      const brand = brandSelect.value;
      const ecu = ecuSelect.value;
      const rows = VEHICLES.filter((v) =>
        (!brand || v.brand === brand) &&
        (!ecu || v.ecu === ecu) &&
        (!q || Object.values(v).join(' ').toLowerCase().includes(q))
      );
      tbody.replaceChildren(...rows.map((v) => {
        const tr = document.createElement('tr');
        ['brand', 'model', 'generation', 'ecu', 'protocol'].forEach((key) => {
          const td = document.createElement('td');
          td.dataset.label = key.charAt(0).toUpperCase() + key.slice(1);
          td.textContent = v[key];
          tr.appendChild(td);
        });
        const status = document.createElement('td');
        status.dataset.label = 'Status';
        status.innerHTML = '<span class="pill pill-ok">Read / Write</span>';
        tr.appendChild(status);
        return tr;
      }));
      emptyMsg.hidden = rows.length > 0;
    };

    [searchInput, brandSelect, ecuSelect].forEach((el) => el.addEventListener('input', render));
    render();
  }

  // ---------- Profit calculator ----------
  const volume = document.getElementById('calc-volume');
  const price = document.getElementById('calc-price');
  const fee = document.getElementById('calc-fee');
  const currency = document.getElementById('calc-currency');

  if (volume) {
    const out = {
      volume: document.getElementById('calc-volume-out'),
      gross: document.getElementById('calc-gross'),
      cost: document.getElementById('calc-cost'),
      net: document.getElementById('calc-net'),
      margin: document.getElementById('calc-margin'),
      bar: document.getElementById('calc-bar')
    };

    const update = () => {
      const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.value, maximumFractionDigits: 0 });
      const n = Number(volume.value);
      const p = Math.max(0, Number(price.value) || 0);
      const f = Math.max(0, Number(fee.value) || 0);
      const gross = n * p;
      const cost = n * f;
      const net = gross - cost;
      const margin = gross > 0 ? (net / gross) * 100 : 0;

      out.volume.textContent = n;
      out.gross.textContent = fmt.format(gross);
      out.cost.textContent = fmt.format(cost);
      out.net.textContent = fmt.format(net);
      out.margin.textContent = `${margin.toFixed(1)}%`;
      out.bar.style.width = `${Math.max(0, Math.min(100, margin))}%`;
      volume.style.setProperty('--fill', `${((n - volume.min) / (volume.max - volume.min)) * 100}%`);
    };

    [volume, price, fee, currency].forEach((el) => el.addEventListener('input', update));
    update();
  }

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
