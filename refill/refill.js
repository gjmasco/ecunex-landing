(() => {
  "use strict";

  const body = document.body;
  const tenant = body.dataset.tenant;
  const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
  const apiBase = ((isLocal && body.dataset.apiDev) || body.dataset.api).replace(/\/+$/, "");
  const STORAGE_KEY = "ecunex-refill-" + tenant;
  const FINAL_STATUSES = ["Approved", "Rejected", "Expired", "Cancelled", "RequiresReview"];
  const POLL_INTERVAL_MS = 3000;
  const POLL_MAX_ATTEMPTS = 40;

  const $ = (id) => document.getElementById(id);
  const el = {
    stepDongle: $("step-dongle"), dongleForm: $("dongle-form"), dongleInput: $("dongle-id"),
    dongleError: $("dongle-error"), dongleSubmit: $("dongle-submit"),
    stepPackages: $("step-packages"), summaryDongle: $("summary-dongle"), changeDongle: $("change-dongle"),
    discount: $("discount-banner"), packages: $("packages"), packagesEmpty: $("packages-empty"),
    checkoutError: $("checkout-error"), payButton: $("pay-button"),
    stepResult: $("step-result"), resultIcon: $("result-icon"), resultTitle: $("result-title"),
    resultText: $("result-text"), resultDetails: $("result-details"), resultDongle: $("result-dongle"),
    resultCredits: $("result-credits"), resultAmount: $("result-amount"), resultAction: $("result-action")
  };

  const state = { dongleId: null, quote: null, selectedPackageId: null };

  // ---------- helpers ----------

  function normalizeDongleId(value) {
    const cleaned = String(value || "").trim().replace(/[\s:.\-]/g, "").toUpperCase();
    return /^[0-9A-F]{12}$/.test(cleaned) ? cleaned : null;
  }

  function formatMoney(amount, currency) {
    try {
      return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "ARS", maximumFractionDigits: 2 }).format(amount);
    } catch {
      return (currency || "") + " " + Number(amount).toFixed(2);
    }
  }

  function formatDate(iso) {
    const date = new Date(iso);
    return isNaN(date) ? "" : date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  }

  function show(section) {
    [el.stepDongle, el.stepPackages, el.stepResult].forEach((s) => { s.hidden = s !== section; });
  }

  function setError(target, message) {
    target.textContent = message || "";
    target.hidden = !message;
  }

  function setLoading(button, loading) {
    button.disabled = loading;
    button.classList.toggle("loading", loading);
  }

  async function api(path, options) {
    let response;
    try {
      response = await fetch(apiBase + path, {
        ...options,
        headers: { "Accept": "application/json", ...(options && options.body ? { "Content-Type": "application/json" } : {}) },
        cache: "no-store"
      });
    } catch {
      throw new Error("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
    }

    let data = null;
    try { data = await response.json(); } catch { /* empty body */ }

    if (response.ok) return data;

    const error = new Error((data && data.message) || defaultMessage(response.status));
    error.status = response.status;
    throw error;
  }

  function defaultMessage(status) {
    if (status === 429) return "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.";
    if (status === 400) return "Revisá los datos ingresados.";
    if (status === 404) return "No encontramos lo que buscabas.";
    if (status === 503) return "El servicio no está disponible en este momento. Probá de nuevo en unos minutos.";
    return "Ocurrió un error inesperado. Probá de nuevo en unos minutos.";
  }

  function replaceQuery(params) {
    const url = new URL(location.href);
    url.search = "";
    Object.entries(params).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    history.replaceState(null, "", url.pathname + url.search);
  }

  // ---------- step 1: dongle ----------

  async function loadQuote(dongleId) {
    setError(el.dongleError, null);
    setLoading(el.dongleSubmit, true);
    try {
      const quote = await api(`/api/refill/${encodeURIComponent(tenant)}/quote?dongleId=${encodeURIComponent(dongleId)}`);
      state.dongleId = quote.deviceId;
      state.quote = quote;
      replaceQuery({ dongleId: quote.deviceId });
      renderPackages();
      show(el.stepPackages);
    } catch (error) {
      el.dongleInput.value = dongleId;
      setError(el.dongleError, error.status === 404
        ? "No encontramos ese dongle o no está habilitado para recargas. Revisá el Dongle ID."
        : error.message);
      show(el.stepDongle);
      el.dongleInput.focus();
    } finally {
      setLoading(el.dongleSubmit, false);
    }
  }

  el.dongleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const dongleId = normalizeDongleId(el.dongleInput.value);
    if (!dongleId) {
      setError(el.dongleError, "El Dongle ID debe tener 12 caracteres hexadecimales (0-9, A-F).");
      el.dongleInput.focus();
      return;
    }
    loadQuote(dongleId);
  });

  el.dongleInput.addEventListener("input", () => setError(el.dongleError, null));

  el.changeDongle.addEventListener("click", () => {
    state.selectedPackageId = null;
    replaceQuery({});
    el.dongleInput.value = state.dongleId || "";
    show(el.stepDongle);
    el.dongleInput.focus();
    el.dongleInput.select();
  });

  // ---------- step 2: packages ----------

  function renderPackages() {
    const quote = state.quote;
    el.summaryDongle.textContent = quote.deviceId;
    setError(el.checkoutError, null);

    if (quote.discountPercent > 0) {
      el.discount.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = `${quote.discountPercent}% de descuento`;
      el.discount.append("Tenés un ", strong, " aplicado a este dongle");
      el.discount.append(quote.discountExpiresAt ? ` hasta el ${formatDate(quote.discountExpiresAt)}.` : ".");
      el.discount.hidden = false;
    } else {
      el.discount.hidden = true;
    }

    el.packages.innerHTML = "";
    const packages = quote.packages || [];
    if (!packages.some((p) => p.id === state.selectedPackageId)) state.selectedPackageId = null;

    packages.forEach((pkg) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "refill-package";
      button.setAttribute("role", "radio");
      button.dataset.id = pkg.id;

      const credits = document.createElement("span");
      credits.className = "refill-package-credits";
      credits.textContent = pkg.credits;

      const unit = document.createElement("span");
      unit.className = "refill-package-unit";
      unit.textContent = pkg.credits === 1 ? "crédito" : "créditos";

      button.append(credits, unit);

      if (pkg.finalPrice < pkg.listPrice) {
        const list = document.createElement("span");
        list.className = "refill-package-list";
        list.textContent = formatMoney(pkg.listPrice, quote.currency);
        button.append(list);
      }

      const price = document.createElement("span");
      price.className = "refill-package-price";
      price.textContent = formatMoney(pkg.finalPrice, quote.currency);
      button.append(price);

      button.addEventListener("click", () => selectPackage(pkg.id));
      el.packages.append(button);
    });

    el.packagesEmpty.hidden = packages.length > 0;
    if (!quote.paymentsAvailable && packages.length > 0) {
      setError(el.checkoutError, "Los pagos no están disponibles en este momento. Probá de nuevo en unos minutos.");
    }
    if (!state.selectedPackageId && packages.length === 1) state.selectedPackageId = packages[0].id;
    updateSelection();
  }

  function selectPackage(id) {
    state.selectedPackageId = id;
    setError(el.checkoutError, state.quote.paymentsAvailable ? null : el.checkoutError.textContent);
    updateSelection();
  }

  function updateSelection() {
    let selected = null;
    el.packages.querySelectorAll(".refill-package").forEach((button) => {
      const checked = button.dataset.id === state.selectedPackageId;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked || (!state.selectedPackageId && !button.previousElementSibling) ? 0 : -1;
      if (checked) selected = state.quote.packages.find((p) => p.id === button.dataset.id);
    });

    el.payButton.disabled = !selected || !state.quote.paymentsAvailable;
    el.payButton.textContent = selected
      ? `Pagar ${formatMoney(selected.finalPrice, state.quote.currency)} con Mercado Pago`
      : "Pagar con Mercado Pago";
  }

  el.packages.addEventListener("keydown", (event) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const buttons = [...el.packages.querySelectorAll(".refill-package")];
    const current = buttons.indexOf(document.activeElement);
    const next = buttons[(current + keys[event.key] + buttons.length) % buttons.length];
    if (next) { next.focus(); selectPackage(next.dataset.id); }
  });

  el.payButton.addEventListener("click", async () => {
    if (!state.selectedPackageId) return;
    setError(el.checkoutError, null);
    setLoading(el.payButton, true);
    try {
      const checkout = await api(`/api/refill/${encodeURIComponent(tenant)}/checkout`, {
        method: "POST",
        body: JSON.stringify({ dongleId: state.dongleId, packageId: state.selectedPackageId })
      });
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ order: checkout.orderToken, dongleId: state.dongleId })); } catch { /* private mode */ }
      location.assign(checkout.checkoutUrl);
    } catch (error) {
      setError(el.checkoutError, error.message);
      setLoading(el.payButton, false);
      if (error.status === 404) loadQuote(state.dongleId);
    }
  });

  // ---------- step 3: back from Mercado Pago ----------

  function renderResult(kind, title, text, order, action) {
    el.resultIcon.className = "refill-result-icon " + kind;
    el.resultIcon.textContent = kind === "ok" ? "✓" : kind === "error" ? "!" : "";
    el.resultTitle.textContent = title;
    el.resultText.textContent = text;

    if (order) {
      el.resultDongle.textContent = order.deviceId;
      el.resultCredits.textContent = order.credits;
      el.resultAmount.textContent = formatMoney(order.finalPrice, order.currency);
    }
    el.resultDetails.hidden = !order;

    el.resultAction.hidden = !action;
    if (action) {
      el.resultAction.textContent = action.label;
      el.resultAction.onclick = action.onClick;
    }
    show(el.stepResult);
  }

  function retryAction(dongleId) {
    return {
      label: "Volver a intentar",
      onClick: () => {
        replaceQuery({ dongleId });
        if (dongleId) loadQuote(dongleId); else show(el.stepDongle);
      }
    };
  }

  async function trackOrder(token, paymentId, fallbackDongleId) {
    renderResult("wait", "Confirmando tu pago…", "Esto puede tardar unos segundos. No cierres esta página.", null, null);

    const path = `/api/refill/orders/${encodeURIComponent(token)}` + (paymentId ? `?paymentId=${encodeURIComponent(paymentId)}` : "");
    let order = null;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      try {
        order = await api(path);
        if (FINAL_STATUSES.includes(order.status)) break;
      } catch (error) {
        if (error.status === 404) {
          renderResult("error", "No encontramos la compra", "El enlace no es válido. Si pagaste, comunicate con tu revendedor.", null, retryAction(fallbackDongleId));
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    const dongleId = (order && order.deviceId) || fallbackDongleId;
    const status = order ? order.status : null;

    if (status === "Approved") {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      renderResult("ok", "¡Listo! Créditos acreditados",
        `Sumamos ${order.credits} ${order.credits === 1 ? "crédito" : "créditos"} a tu dongle. Ya podés volver a la app ECUNEX.`,
        order, { label: "Comprar más créditos", onClick: () => { replaceQuery({ dongleId }); loadQuote(dongleId); } });
    } else if (status === "Rejected" || status === "Cancelled") {
      renderResult("error", "El pago no se completó", "Mercado Pago no aprobó el pago. No se te cobró nada. Podés intentar con otro medio de pago.", order, retryAction(dongleId));
    } else if (status === "Expired") {
      renderResult("error", "La compra expiró", "No recibimos el pago a tiempo. Si no pagaste, volvé a intentarlo.", order, retryAction(dongleId));
    } else if (status === "RequiresReview") {
      renderResult("error", "Estamos revisando tu pago", "Recibimos tu pago pero necesita una revisión manual. Comunicate con tu revendedor si no ves los créditos en breve.", order, null);
    } else {
      renderResult("wait", "Tu pago está en proceso",
        "Mercado Pago todavía no confirmó el pago. Los créditos se acreditan automáticamente cuando se apruebe; podés volver a revisar en unos minutos.",
        order, { label: "Revisar de nuevo", onClick: () => trackOrder(token, paymentId, dongleId) });
    }
  }

  // ---------- init ----------

  const params = new URLSearchParams(location.search);
  const orderToken = params.get("order");
  const paymentId = params.get("payment_id") || params.get("collection_id");
  const mpStatus = params.get("status") || params.get("collection_status");
  const queryDongle = normalizeDongleId(params.get("dongleId") || params.get("dongle"));

  if (orderToken && /^[0-9a-f]{32}$/i.test(orderToken)) {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); } catch { /* ignore */ }
    const fallbackDongle = (stored && stored.order === orderToken && stored.dongleId) || queryDongle;

    replaceQuery({ order: orderToken, payment_id: paymentId && paymentId !== "null" ? paymentId : null });

    if (!paymentId || paymentId === "null" || mpStatus === "null") {
      // User came back without paying (e.g. "Volver al sitio" in Mercado Pago).
      renderResult("error", "No se completó el pago", "Cancelaste el pago o no se terminó de procesar. No se te cobró nada.", null, retryAction(fallbackDongle));
    } else {
      trackOrder(orderToken, paymentId, fallbackDongle);
    }
  } else if (queryDongle) {
    el.dongleInput.value = queryDongle;
    loadQuote(queryDongle);
  } else {
    if (params.has("dongleId")) setError(el.dongleError, "El Dongle ID del enlace no es válido. Ingresalo manualmente.");
    el.dongleInput.value = params.get("dongleId") || "";
    show(el.stepDongle);
  }
})();
