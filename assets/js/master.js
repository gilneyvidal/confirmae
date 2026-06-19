import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "./firebase-config.js";

import {
  buildAdminLink,
  buildGateLink,
  buildClientAccessWhatsappLink,
  generateAccessPin,
  getPlanOptions,
  getPlanById,
  calculateEventPricing,
  normalizeCouponCode,
  createOrUpdateCoupon,
  getCoupon,
  listCoupons,
  listEventAccessRecords,
  releaseEvent,
  blockEvent,
  deleteManagedEvent,
  escapeHtml
} from "./app.js";

const CONFIRMAE_THEME = window.CONFIRMAE_THEME;

const ALLOWED_MASTER_EMAILS = [
  "gw.vidal@gmail.com"
];

const masterLoadingSection = document.getElementById("masterLoadingSection");
const masterLoginSection = document.getElementById("masterLoginSection");
const masterDeniedSection = document.getElementById("masterDeniedSection");
const masterAppSection = document.getElementById("masterAppSection");

const googleSignInButton = document.getElementById("googleSignInButton");
const deniedLogoutButton = document.getElementById("deniedLogoutButton");
const deniedEmailText = document.getElementById("deniedEmailText");

const masterUserName = document.getElementById("masterUserName");
const masterUserEmail = document.getElementById("masterUserEmail");
const masterLogoutButton = document.getElementById("masterLogoutButton");

const masterEventForm = document.getElementById("masterEventForm");
const masterEventIdInput = document.getElementById("masterEventIdInput");
const masterCustomerNameInput = document.getElementById("masterCustomerNameInput");
const masterCustomerWhatsappInput = document.getElementById("masterCustomerWhatsappInput");
const masterCustomerEmailInput = document.getElementById("masterCustomerEmailInput");
const masterPlanSelect = document.getElementById("masterPlanSelect");
const masterCouponCodeInput = document.getElementById("masterCouponCodeInput");
const masterOriginalAmountInput = document.getElementById("masterOriginalAmountInput");
const masterDiscountAmountInput = document.getElementById("masterDiscountAmountInput");
const masterFinalAmountInput = document.getElementById("masterFinalAmountInput");
const masterStatusCommercialSelect = document.getElementById("masterStatusCommercialSelect");
const masterStatusOperationalSelect = document.getElementById("masterStatusOperationalSelect");
const masterEventDateIsoInput = document.getElementById("masterEventDateIsoInput");
const masterPanelPinInput = document.getElementById("masterPanelPinInput");
const masterGatePinInput = document.getElementById("masterGatePinInput");
const masterEventNameInput = document.getElementById("masterEventNameInput");
const masterEventTypeInput = document.getElementById("masterEventTypeInput");
const masterNotesInput = document.getElementById("masterNotesInput");

const generatePinsButton = document.getElementById("generatePinsButton");
const clearMasterFormButton = document.getElementById("clearMasterFormButton");
const reloadMasterListButton = document.getElementById("reloadMasterListButton");
const masterEventsTableBody = document.getElementById("masterEventsTableBody");

const couponForm = document.getElementById("couponForm");
const couponCodeInput = document.getElementById("couponCodeInput");
const couponReferrerNameInput = document.getElementById("couponReferrerNameInput");
const couponReferrerWhatsappInput = document.getElementById("couponReferrerWhatsappInput");
const couponDiscountAmountInput = document.getElementById("couponDiscountAmountInput");
const couponActiveSelect = document.getElementById("couponActiveSelect");
const couponNotesInput = document.getElementById("couponNotesInput");
const clearCouponFormButton = document.getElementById("clearCouponFormButton");
const reloadCouponsButton = document.getElementById("reloadCouponsButton");
const couponsTableBody = document.getElementById("couponsTableBody");

let currentMasterUser = null;
let lastReleasedRecord = null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAuthorizedMaster(user) {
  const userEmail = normalizeEmail(user ? user.email : "");

  return ALLOWED_MASTER_EMAILS
    .map((email) => normalizeEmail(email))
    .includes(userEmail);
}

function hideAllMasterSections() {
  masterLoadingSection.hidden = true;
  masterLoginSection.hidden = true;
  masterDeniedSection.hidden = true;
  masterAppSection.hidden = true;
}

function showLoading() {
  hideAllMasterSections();
  masterLoadingSection.hidden = false;
}

function showLogin() {
  hideAllMasterSections();
  masterLoginSection.hidden = false;
}

function showAccessDenied(user) {
  hideAllMasterSections();

  deniedEmailText.textContent = user && user.email
    ? user.email
    : "E-mail não identificado.";

  masterDeniedSection.hidden = false;
}

function showMasterApp(user) {
  hideAllMasterSections();

  masterUserName.textContent = user.displayName || "Administrador";
  masterUserEmail.textContent = user.email || "--";

  masterAppSection.hidden = false;

  fillPlanOptions();

  if (!masterPanelPinInput.value || !masterGatePinInput.value) {
    generateNewPins();
  }

  updatePricingPreview();
}

function fillPlanOptions() {
  const plans = getPlanOptions();

  masterPlanSelect.innerHTML = plans
    .map((plan) => {
      const limitText = plan.guestLimit === null
        ? "Convidados ilimitados"
        : `Até ${plan.guestLimit} convidados`;

      return `
        <option value="${escapeHtml(plan.id)}">
          ${escapeHtml(plan.name)} - ${escapeHtml(plan.priceLabel)} - ${escapeHtml(limitText)}
        </option>
      `;
    })
    .join("");
}

function generateNewPins() {
  masterPanelPinInput.value = generateAccessPin();
  masterGatePinInput.value = generateAccessPin();
}

function clearMasterForm() {
  masterEventForm.reset();
  masterPlanSelect.value = "essential";
  masterStatusCommercialSelect.value = "paid";
  masterStatusOperationalSelect.value = "active";
  masterEventDateIsoInput.value = "";
  generateNewPins();
  updatePricingPreview();
}

function clearCouponForm() {
  couponForm.reset();
  couponActiveSelect.value = "true";
}

function setTableMessage(message) {
  masterEventsTableBody.innerHTML = `
    <tr>
      <td colspan="7">${escapeHtml(message)}</td>
    </tr>
  `;
}

function setCouponTableMessage(message) {
  couponsTableBody.innerHTML = `
    <tr>
      <td colspan="5">${escapeHtml(message)}</td>
    </tr>
  `;
}

async function updatePricingPreview() {
  const planId = masterPlanSelect.value || "essential";
  const couponCode = normalizeCouponCode(masterCouponCodeInput.value);
  let coupon = null;

  if (couponCode) {
    coupon = await getCoupon(couponCode);
  }

  const pricing = calculateEventPricing(planId, coupon);

  masterOriginalAmountInput.value = pricing.originalAmountFormatted;
  masterDiscountAmountInput.value = pricing.discountAmountFormatted;
  masterFinalAmountInput.value = pricing.finalAmountFormatted;

  return {
    pricing,
    coupon
  };
}

function getFormData() {
  return {
    eventId: masterEventIdInput.value.trim(),
    customerName: masterCustomerNameInput.value.trim(),
    customerWhatsapp: masterCustomerWhatsappInput.value.trim(),
    customerEmail: masterCustomerEmailInput.value.trim(),
    planId: masterPlanSelect.value,
    couponCode: normalizeCouponCode(masterCouponCodeInput.value),
    statusCommercial: masterStatusCommercialSelect.value,
    operationalStatus: masterStatusOperationalSelect.value,
    eventDateIso: masterEventDateIsoInput.value.trim(),
    panelPin: masterPanelPinInput.value.trim(),
    gatePin: masterGatePinInput.value.trim(),
    eventName: masterEventNameInput.value.trim(),
    eventType: masterEventTypeInput.value.trim(),
    notes: masterNotesInput.value.trim()
  };
}

function getReleaseDataFromRecord(record) {
  return {
    eventId: record.id || record.eventId || "",
    customerName: record.customerName || "",
    customerWhatsapp: record.customerWhatsapp || "",
    customerEmail: record.customerEmail || "",
    planId: record.planId || "essential",
    couponCode: record.couponCode || "",
    statusCommercial: record.statusCommercial || "paid",
    operationalStatus: "active",
    eventDateIso: record.eventDateIso || "",
    panelPin: record.panelPin || generateAccessPin(),
    gatePin: record.gatePin || generateAccessPin(),
    eventName: record.eventName || "",
    eventType: record.eventType || "",
    notes: record.notes || ""
  };
}

function fillFormFromRecord(record) {
  masterEventIdInput.value = record.id || "";
  masterCustomerNameInput.value = record.customerName || "";
  masterCustomerWhatsappInput.value = record.customerWhatsapp || "";
  masterCustomerEmailInput.value = record.customerEmail || "";
  masterPlanSelect.value = record.planId || "essential";
  masterCouponCodeInput.value = record.couponCode || "";
  masterStatusCommercialSelect.value = record.statusCommercial || "paid";
  masterStatusOperationalSelect.value = record.operationalStatus || "active";
  masterEventDateIsoInput.value = record.eventDateIso || "";
  masterPanelPinInput.value = record.panelPin || generateAccessPin();
  masterGatePinInput.value = record.gatePin || generateAccessPin();
  masterEventNameInput.value = record.eventName || "";
  masterEventTypeInput.value = record.eventType || "";
  masterNotesInput.value = record.notes || "";

  updatePricingPreview();
}

function fillCouponForm(coupon) {
  couponCodeInput.value = coupon.code || coupon.id || "";
  couponReferrerNameInput.value = coupon.referrerName || "";
  couponReferrerWhatsappInput.value = coupon.referrerWhatsapp || "";
  couponDiscountAmountInput.value = coupon.discountAmountFormatted || "";
  couponActiveSelect.value = coupon.active === false ? "false" : "true";
  couponNotesInput.value = coupon.notes || "";
}

function formatDateIsoToBrazil(dateIso) {
  if (!dateIso) {
    return "";
  }

  const [year, month, day] = String(dateIso).split("-");

  if (!year || !month || !day) {
    return dateIso;
  }

  return `${day}/${month}/${year}`;
}

function getDaysDifference(dateIso) {
  if (!dateIso) {
    return null;
  }

  const [year, month, day] = String(dateIso).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const eventDate = new Date(year, month - 1, day);
  const today = new Date();

  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const differenceMs = eventDate.getTime() - today.getTime();

  return Math.round(differenceMs / 86400000);
}

function getEventDateAdvice(record) {
  if (record.enabled === false || record.operationalStatus === "blocked") {
    return {
      label: "Evento bloqueado",
      className: "declined"
    };
  }

  const daysDifference = getDaysDifference(record.eventDateIso);

  if (daysDifference === null) {
    return {
      label: "Aguardando cliente preencher data",
      className: "waiting"
    };
  }

  if (daysDifference > 0) {
    return {
      label: `Faltam ${daysDifference} dia(s)`,
      className: "accepted"
    };
  }

  if (daysDifference === 0) {
    return {
      label: "Evento é hoje",
      className: "present"
    };
  }

  const overdueDays = Math.abs(daysDifference);

  if (overdueDays >= 7) {
    return {
      label: `Vencido há ${overdueDays} dias — excluir recomendado`,
      className: "declined"
    };
  }

  if (overdueDays >= 3) {
    return {
      label: `Vencido há ${overdueDays} dias — bloquear recomendado`,
      className: "waiting"
    };
  }

  return {
    label: `Finalizado há ${overdueDays} dia(s)`,
    className: "created"
  };
}

function getCommercialStatusLabel(status) {
  const labels = {
    paid: "Pago",
    pending: "Pendente",
    courtesy: "Cortesia",
    beta: "Beta"
  };

  return labels[status] || "Pago";
}

function getOperationalStatusLabel(status) {
  const labels = {
    active: "Ativo",
    blocked: "Bloqueado",
    finished: "Finalizado",
    waiting_delete: "Aguardando exclusão"
  };

  return labels[status] || "Ativo";
}

function openClientAccessWhatsapp(record) {
  const whatsappLink = buildClientAccessWhatsappLink(record);

  if (!whatsappLink) {
    alert("Este cliente não tem WhatsApp cadastrado.");
    return;
  }

  window.open(whatsappLink, "_blank");
}

async function handleGoogleSignIn() {
  googleSignInButton.disabled = true;
  googleSignInButton.textContent = "Entrando...";

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error(error);

    if (error.code === "auth/unauthorized-domain") {
      alert(
        "Domínio não autorizado no Firebase Authentication. Adicione gilneyvidal.github.io em Authentication > Settings > Authorized domains."
      );
    } else if (error.code === "auth/popup-closed-by-user") {
      alert("Login cancelado antes de concluir.");
    } else {
      alert("Não foi possível entrar com Google. Confira o Firebase Authentication.");
    }
  } finally {
    googleSignInButton.disabled = false;
    googleSignInButton.textContent = "Entrar com Google";
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert("Não foi possível sair da conta.");
  }
}

async function renderCoupons() {
  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    return;
  }

  setCouponTableMessage("Carregando cupons...");

  try {
    const coupons = await listCoupons();

    if (!coupons.length) {
      setCouponTableMessage("Nenhum cupom cadastrado ainda.");
      return;
    }

    couponsTableBody.innerHTML = coupons
      .map((coupon) => {
        const statusText = coupon.active === false ? "Inativo" : "Ativo";
        const statusClass = coupon.active === false ? "declined" : "accepted";

        return `
          <tr>
            <td>
              <div class="guest-name-cell">
                <strong>${escapeHtml(coupon.code || coupon.id)}</strong>
                <small>${escapeHtml(coupon.notes || "Sem observações")}</small>
              </div>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(coupon.referrerName || "Sem nome")}</strong>
                <small>${escapeHtml(coupon.referrerWhatsapp || "Sem WhatsApp")}</small>
              </div>
            </td>

            <td>
              <strong>${escapeHtml(coupon.discountAmountFormatted || "R$ 0,00")}</strong>
            </td>

            <td>
              <span class="status-pill status-pill-${statusClass}">
                <span class="status-dot status-dot-${statusClass}"></span>
                ${statusText}
              </span>
            </td>

            <td>
              <div class="table-actions">
                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  data-action="edit-coupon"
                  data-coupon='${escapeHtml(JSON.stringify(coupon))}'
                >
                  Editar
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error(error);
    setCouponTableMessage("Erro ao carregar cupons. Confira as regras do Firebase.");
  }
}

async function renderMasterList() {
  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    return;
  }

  setTableMessage("Carregando eventos...");

  try {
    const records = await listEventAccessRecords();

    if (!records.length) {
      setTableMessage("Nenhum evento liberado ou bloqueado ainda.");
      return;
    }

    masterEventsTableBody.innerHTML = records
      .map((record) => {
        const statusText = record.enabled ? "Liberado" : "Bloqueado";
        const statusClass = record.enabled ? "accepted" : "declined";
        const paidText = getCommercialStatusLabel(record.statusCommercial || "paid");
        const operationalText = getOperationalStatusLabel(record.operationalStatus || "active");
        const blockButtonLabel = record.enabled ? "Bloquear" : "Desbloquear";
        const blockButtonClass = record.enabled ? "btn-secondary" : "btn-primary";
        const blockButtonAction = record.enabled ? "block" : "unblock";
        const advice = getEventDateAdvice(record);
        const plan = getPlanById(record.planId || "essential");
        const limitText = record.guestLimit === null || record.guestLimit === undefined
          ? "Ilimitado"
          : `até ${record.guestLimit}`;

        return `
          <tr>
            <td>
              <div class="guest-name-cell">
                <strong>${escapeHtml(record.id)}</strong>
                <small>${escapeHtml(record.eventName || record.notes || "Sem nome do evento")}</small>
              </div>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(record.customerName || "Sem nome")}</strong>
                <small>${escapeHtml(record.customerWhatsapp || "Sem WhatsApp")}</small>
              </div>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(record.planName || plan.name)}</strong>
                <small>${escapeHtml(record.finalAmountFormatted || record.amountPaid || plan.priceLabel)} • ${escapeHtml(limitText)}</small>
              </div>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(record.couponCode || "Sem cupom")}</strong>
                <small>${escapeHtml(record.discountAmountFormatted || "R$ 0,00")}</small>
              </div>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(formatDateIsoToBrazil(record.eventDateIso) || record.eventDate || "Sem data")}</strong>
                <small>
                  <span class="status-pill status-pill-${escapeHtml(advice.className)}">
                    <span class="status-dot status-dot-${escapeHtml(advice.className)}"></span>
                    ${escapeHtml(advice.label)}
                  </span>
                </small>
              </div>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(statusText)}</strong>
                <small>${escapeHtml(paidText)} • ${escapeHtml(operationalText)}</small>
              </div>
            </td>

            <td>
              <div class="table-actions">
                <button type="button" class="btn btn-secondary btn-small" data-action="edit" data-record='${escapeHtml(JSON.stringify(record))}'>
                  Editar
                </button>

                <button type="button" class="btn btn-primary btn-small" data-action="open-event" data-record='${escapeHtml(JSON.stringify(record))}'>
                  Abrir
                </button>

                <a href="${escapeHtml(buildGateLink(record.id))}" class="btn btn-secondary btn-small" target="_blank" rel="noopener">
                  Portaria
                </a>

                <button type="button" class="btn btn-secondary btn-small" data-action="send-access" data-record='${escapeHtml(JSON.stringify(record))}'>
                  Enviar acesso
                </button>

                <button type="button" class="btn ${blockButtonClass} btn-small" data-action="${blockButtonAction}" data-record='${escapeHtml(JSON.stringify(record))}' data-event-id="${escapeHtml(record.id)}">
                  ${blockButtonLabel}
                </button>

                <button type="button" class="btn btn-danger btn-small" data-action="delete" data-event-id="${escapeHtml(record.id)}">
                  Apagar
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error(error);
    setTableMessage("Erro ao carregar eventos. Confira o Firebase.");
  }
}

async function handleCouponSubmit(event) {
  event.preventDefault();

  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    alert("Você não tem permissão para criar cupons.");
    return;
  }

  const submitButton = couponForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";

  try {
    await createOrUpdateCoupon({
      code: couponCodeInput.value,
      referrerName: couponReferrerNameInput.value.trim(),
      referrerWhatsapp: couponReferrerWhatsappInput.value.trim(),
      discountAmount: couponDiscountAmountInput.value.trim(),
      active: couponActiveSelect.value === "true",
      notes: couponNotesInput.value.trim()
    });

    alert("Cupom salvo com sucesso!");
    clearCouponForm();
    await renderCoupons();
    await updatePricingPreview();
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar o cupom.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar cupom";
  }
}

async function handleMasterEventSubmit(event) {
  event.preventDefault();

  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    alert("Você não tem permissão para liberar eventos.");
    return;
  }

  const data = getFormData();

  if (!data.eventId) {
    alert("Informe o ID do evento.");
    return;
  }

  if (!data.panelPin) {
    data.panelPin = generateAccessPin();
    masterPanelPinInput.value = data.panelPin;
  }

  if (!data.gatePin) {
    data.gatePin = generateAccessPin();
    masterGatePinInput.value = data.gatePin;
  }

  if (data.couponCode) {
    const coupon = await getCoupon(data.couponCode);

    if (!coupon || coupon.active === false) {
      alert("Cupom não encontrado ou inativo. Crie/ative o cupom antes de aplicar no evento.");
      return;
    }
  }

  const submitButton = masterEventForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Liberando...";

  try {
    const releasedRecord = await releaseEvent(data.eventId, data);

    lastReleasedRecord = {
      ...releasedRecord,
      customerName: data.customerName,
      customerWhatsapp: data.customerWhatsapp,
      panelPin: data.panelPin,
      gatePin: data.gatePin,
      eventName: data.eventName,
      eventType: data.eventType
    };

    alert("Evento liberado/atualizado com sucesso!");

    const shouldSendAccess = confirm(
      "Deseja abrir o WhatsApp agora para enviar os dados de acesso ao cliente?"
    );

    if (shouldSendAccess) {
      openClientAccessWhatsapp(lastReleasedRecord);
    }

    clearMasterForm();
    await renderMasterList();
  } catch (error) {
    console.error(error);
    alert("Não foi possível liberar o evento. Confira as regras do Firestore e tente novamente.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Liberar / atualizar evento";
  }
}

async function handleMasterTableClick(event) {
  const clickedButton = event.target.closest("button");

  if (!clickedButton) {
    return;
  }

  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    alert("Você não tem permissão para executar esta ação.");
    return;
  }

  const action = clickedButton.dataset.action;
  const eventId = clickedButton.dataset.eventId;

  if (action === "edit") {
    try {
      const record = JSON.parse(clickedButton.dataset.record);
      fillFormFromRecord(record);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      alert("Não foi possível carregar este registro no formulário.");
    }

    return;
  }

  if (action === "open-event") {
    clickedButton.disabled = true;
    clickedButton.textContent = "Abrindo...";

    try {
      const record = JSON.parse(clickedButton.dataset.record);

      if (!record.enabled) {
        alert("Este evento está bloqueado. Clique em Desbloquear antes de abrir.");
        return;
      }

      await releaseEvent(record.id, getReleaseDataFromRecord(record));

      window.open(buildAdminLink(record.id), "_blank");
    } catch (error) {
      console.error(error);
      alert("Não foi possível abrir/reparar este evento.");
    } finally {
      clickedButton.disabled = false;
      clickedButton.textContent = "Abrir";
    }

    return;
  }

  if (action === "send-access") {
    try {
      const record = JSON.parse(clickedButton.dataset.record);

      if (!record.enabled) {
        alert("Este evento está bloqueado. Desbloqueie antes de enviar o acesso.");
        return;
      }

      openClientAccessWhatsapp(record);
    } catch (error) {
      alert("Não foi possível montar a mensagem de acesso.");
    }

    return;
  }

  if (action === "block") {
    const confirmBlock = confirm(`Deseja bloquear o evento ${eventId}?`);

    if (!confirmBlock) {
      return;
    }

    try {
      await blockEvent(eventId);
      await renderMasterList();
      alert("Evento bloqueado com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível bloquear o evento.");
    }

    return;
  }

  if (action === "unblock") {
    let record = null;

    try {
      record = JSON.parse(clickedButton.dataset.record);
    } catch (error) {
      alert("Não foi possível ler os dados deste evento.");
      return;
    }

    const confirmUnblock = confirm(`Deseja desbloquear o evento ${record.id}?`);

    if (!confirmUnblock) {
      return;
    }

    clickedButton.disabled = true;
    clickedButton.textContent = "Liberando...";

    try {
      await releaseEvent(record.id, getReleaseDataFromRecord(record));
      await renderMasterList();

      alert("Evento desbloqueado com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível desbloquear este evento.");
    } finally {
      clickedButton.disabled = false;
      clickedButton.textContent = "Desbloquear";
    }

    return;
  }

  if (action === "delete") {
    const confirmDelete = confirm(
      `Deseja apagar o evento ${eventId}?\n\nIsso remove o acesso, o evento e os convidados cadastrados.`
    );

    if (!confirmDelete) {
      return;
    }

    const secondConfirm = confirm("Confirma mesmo? Essa ação não é reversível.");

    if (!secondConfirm) {
      return;
    }

    try {
      await deleteManagedEvent(eventId);
      await renderMasterList();
      alert("Evento apagado com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível apagar o evento. Confira as regras do Firestore.");
    }
  }
}

function handleCouponTableClick(event) {
  const clickedButton = event.target.closest("button");

  if (!clickedButton) {
    return;
  }

  if (clickedButton.dataset.action === "edit-coupon") {
    try {
      const coupon = JSON.parse(clickedButton.dataset.coupon);
      fillCouponForm(coupon);
      couponCodeInput.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      alert("Não foi possível carregar este cupom.");
    }
  }
}

googleSignInButton.addEventListener("click", handleGoogleSignIn);
masterLogoutButton.addEventListener("click", handleLogout);
deniedLogoutButton.addEventListener("click", handleLogout);
masterEventForm.addEventListener("submit", handleMasterEventSubmit);
couponForm.addEventListener("submit", handleCouponSubmit);
generatePinsButton.addEventListener("click", generateNewPins);
clearMasterFormButton.addEventListener("click", clearMasterForm);
clearCouponFormButton.addEventListener("click", clearCouponForm);
reloadMasterListButton.addEventListener("click", renderMasterList);
reloadCouponsButton.addEventListener("click", renderCoupons);
masterEventsTableBody.addEventListener("click", handleMasterTableClick);
couponsTableBody.addEventListener("click", handleCouponTableClick);

masterPlanSelect.addEventListener("change", updatePricingPreview);
masterCouponCodeInput.addEventListener("blur", updatePricingPreview);
masterCouponCodeInput.addEventListener("change", updatePricingPreview);

showLoading();

onAuthStateChanged(auth, async (user) => {
  currentMasterUser = user;

  if (!user) {
    showLogin();
    return;
  }

  if (!isAuthorizedMaster(user)) {
    showAccessDenied(user);
    return;
  }

  showMasterApp(user);
  await renderCoupons();
  await renderMasterList();
});
