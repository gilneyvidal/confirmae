import {
  getQueryParam,
  buildInvitationLink,
  buildWhatsappUnlockLink,
  getEvent,
  saveEvent,
  getGuestsByEvent,
  updateGuest,
  addGuest,
  removeGuest,
  resetDemoGuests,
  getGuestStatusInfo,
  getInitials,
  escapeHtml
} from "./app.js";

const CONFIRMAE_THEME = window.CONFIRMAE_THEME;
const BUSINESS_CONFIG = CONFIRMAE_THEME.business;

const eventIdInput = document.getElementById("eventIdInput");
const eventPanelPinInput = document.getElementById("eventPanelPinInput");
const panelPinHelpText = document.getElementById("panelPinHelpText");
const loadEventButton = document.getElementById("loadEventButton");

const accessLockedSection = document.getElementById("accessLockedSection");
const lockedEventIdText = document.getElementById("lockedEventIdText");
const unlockPriceText = document.getElementById("unlockPriceText");
const pixBankText = document.getElementById("pixBankText");
const pixKeyText = document.getElementById("pixKeyText");
const pixHolderText = document.getElementById("pixHolderText");
const unlockWhatsappLink = document.getElementById("unlockWhatsappLink");
const copyPixButton = document.getElementById("copyPixButton");
const eventWorkspaceSections = document.querySelectorAll("[data-event-workspace]");

const eventConfigForm = document.getElementById("eventConfigForm");
const eventNameInput = document.getElementById("eventNameInput");
const eventTypeInput = document.getElementById("eventTypeInput");
const eventHostInput = document.getElementById("eventHostInput");
const eventDateIsoInput = document.getElementById("eventDateIsoInput");
const eventDateInput = document.getElementById("eventDateInput");
const eventTimeInput = document.getElementById("eventTimeInput");
const eventLocationInput = document.getElementById("eventLocationInput");
const eventIntroInput = document.getElementById("eventIntroInput");

const guestForm = document.getElementById("guestForm");
const guestTableBody = document.getElementById("guestTableBody");
const resetDemoButton = document.getElementById("resetDemoButton");

const exportAllGuestsButton = document.getElementById("exportAllGuestsButton");
const exportAcceptedGuestsButton = document.getElementById("exportAcceptedGuestsButton");
const exportPresentGuestsButton = document.getElementById("exportPresentGuestsButton");
const exportDeclinedGuestsButton = document.getElementById("exportDeclinedGuestsButton");

const totalGuests = document.getElementById("totalGuests");
const waitingGuests = document.getElementById("waitingGuests");
const acceptedGuests = document.getElementById("acceptedGuests");
const declinedGuests = document.getElementById("declinedGuests");
const presentGuests = document.getElementById("presentGuests");

const qrModal = document.getElementById("qrModal");
const closeQrModal = document.getElementById("closeQrModal");
const qrGuestInitial = document.getElementById("qrGuestInitial");
const qrGuestName = document.getElementById("qrGuestName");
const qrGuestLink = document.getElementById("qrGuestLink");
const qrCodeBox = document.getElementById("qrCodeBox");
const copyQrLinkButton = document.getElementById("copyQrLinkButton");
const downloadQrButton = document.getElementById("downloadQrButton");

let currentEventId = getQueryParam("evento") || CONFIRMAE_THEME.defaultEventId;
let currentQrLink = "";
let currentQrGuestName = "";
let currentEventInfo = null;
let currentGuests = [];

eventIdInput.value = currentEventId;
eventPanelPinInput.value = getQueryParam("pin") || "";

function getPanelStorageKey(eventId) {
  return `confirmae_panel_pin_${eventId}`;
}

function hideEventWorkspace() {
  eventWorkspaceSections.forEach((section) => {
    section.hidden = true;
  });
}

function showEventWorkspace() {
  accessLockedSection.hidden = true;

  eventWorkspaceSections.forEach((section) => {
    section.hidden = false;
  });
}

function setTableLoading(message) {
  guestTableBody.innerHTML = `
    <tr>
      <td colspan="5">${escapeHtml(message)}</td>
    </tr>
  `;
}

function isPanelPinValid(eventInfo) {
  if (currentEventId === CONFIRMAE_THEME.defaultEventId) {
    return true;
  }

  if (!eventInfo.panelPin) {
    return true;
  }

  const typedPin = eventPanelPinInput.value.trim();
  const storedPin = sessionStorage.getItem(getPanelStorageKey(currentEventId));

  return typedPin === eventInfo.panelPin || storedPin === eventInfo.panelPin;
}

function rememberPanelPin(eventInfo) {
  if (eventInfo && eventInfo.panelPin) {
    sessionStorage.setItem(getPanelStorageKey(currentEventId), eventInfo.panelPin);
  }
}

function showAccessLocked(eventId) {
  lockedEventIdText.textContent = eventId;
  unlockPriceText.textContent = "Planos a partir de R$ 29,90";
  pixBankText.textContent = BUSINESS_CONFIG.pixBank;
  pixKeyText.textContent = BUSINESS_CONFIG.pixKey;
  pixHolderText.textContent = BUSINESS_CONFIG.pixHolder;
  unlockWhatsappLink.href = buildWhatsappUnlockLink(eventId);

  accessLockedSection.hidden = false;
  hideEventWorkspace();
  updateStats([]);
}

function showPanelPinDenied() {
  accessLockedSection.hidden = true;
  hideEventWorkspace();
  updateStats([]);

  panelPinHelpText.textContent = "PIN incorreto. Confira o PIN enviado pelo WhatsApp e tente novamente.";
  alert("PIN do painel incorreto.");
}

function updateStats(guests) {
  totalGuests.textContent = guests.length;
  waitingGuests.textContent = guests.filter((guest) => guest.status === "waiting").length;
  acceptedGuests.textContent = guests.filter((guest) => guest.status === "accepted").length;
  declinedGuests.textContent = guests.filter((guest) => guest.status === "declined").length;
  presentGuests.textContent = guests.filter((guest) => guest.status === "present").length;
}

function formatDateIsoToLongText(dateIso) {
  if (!dateIso) {
    return "";
  }

  const [year, month, day] = String(dateIso).split("-").map(Number);

  if (!year || !month || !day) {
    return "";
  }

  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function formatDateTimeForCsv(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("pt-BR");
}

function sanitizeFileName(value) {
  return String(value || "evento")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createCsvCell(value) {
  let safeValue = String(value ?? "");

  if (/^[=+\-@]/.test(safeValue)) {
    safeValue = `'${safeValue}`;
  }

  return `"${safeValue.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const csvContent = rows
    .map((row) => row.map(createCsvCell).join(";"))
    .join("\n");

  const blob = new Blob([`\ufeff${csvContent}`], {
    type: "text/csv;charset=utf-8;"
  });

  const temporaryUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  downloadLink.href = temporaryUrl;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  URL.revokeObjectURL(temporaryUrl);
}

function getGuestsForExport(type) {
  if (type === "accepted") {
    return currentGuests.filter((guest) => guest.status === "accepted");
  }

  if (type === "present") {
    return currentGuests.filter((guest) => guest.status === "present");
  }

  if (type === "declined") {
    return currentGuests.filter((guest) => guest.status === "declined");
  }

  return currentGuests;
}

function getExportLabel(type) {
  const labels = {
    all: "todos",
    accepted: "confirmados",
    present: "presentes",
    declined: "recusados"
  };

  return labels[type] || "convidados";
}

function exportGuests(type) {
  const guestsToExport = getGuestsForExport(type);
  const exportLabel = getExportLabel(type);

  if (!guestsToExport.length) {
    alert(`Nenhum convidado encontrado para exportar em: ${exportLabel}.`);
    return;
  }

  const header = [
    "Evento",
    "ID do evento",
    "Nome do convidado",
    "Telefone",
    "E-mail",
    "Acompanhantes permitidos",
    "Status",
    "Presente com liberação manual",
    "Data/hora de entrada",
    "ID do convite",
    "Link do convite"
  ];

  const rows = guestsToExport.map((guest) => {
    const statusInfo = getGuestStatusInfo(guest);
    const invitationLink = buildInvitationLink(guest.eventId, guest.id);

    return [
      currentEventInfo?.name || currentEventId,
      currentEventId,
      guest.name || "",
      guest.phone || "",
      guest.email || "",
      guest.companions || 0,
      statusInfo.label,
      guest.gateOverride === true ? "Sim" : "Não",
      formatDateTimeForCsv(guest.arrivedAt),
      guest.id || "",
      invitationLink
    ];
  });

  const fileName = `confirmae-${sanitizeFileName(currentEventId)}-${exportLabel}.csv`;

  downloadCsv(fileName, [header, ...rows]);
}

function renderEventConfig(eventInfo) {
  eventNameInput.value = eventInfo.name || "";
  eventTypeInput.value = eventInfo.type || "";
  eventHostInput.value = eventInfo.hostName || "";
  eventDateIsoInput.value = eventInfo.eventDateIso || "";
  eventDateInput.value = eventInfo.date || "";
  eventTimeInput.value = eventInfo.time || "";
  eventLocationInput.value = eventInfo.location || "";
  eventIntroInput.value = eventInfo.intro || "";
}

async function renderGuests() {
  setTableLoading("Carregando convidados do Firebase...");

  const guests = await getGuestsByEvent(currentEventId);
  currentGuests = guests;

  updateStats(guests);

  if (!guests.length) {
    guestTableBody.innerHTML = `
      <tr>
        <td colspan="5">
          Nenhum convidado cadastrado para este evento.
        </td>
      </tr>
    `;
    return;
  }

  guestTableBody.innerHTML = guests
    .map((guest) => {
      const statusInfo = getGuestStatusInfo(guest);
      const invitationLink = buildInvitationLink(guest.eventId, guest.id);

      return `
        <tr>
          <td>
            <div class="guest-name-cell">
              <strong>${escapeHtml(guest.name)}</strong>
              <small>ID: ${escapeHtml(guest.id)}</small>
            </div>
          </td>

          <td>
            <div class="guest-contact-cell">
              <strong>${escapeHtml(guest.phone || "Sem telefone")}</strong>
              <small>${escapeHtml(guest.email || "Sem e-mail")}</small>
            </div>
          </td>

          <td>
            <span class="status-pill status-pill-${escapeHtml(statusInfo.className)}">
              <span class="status-dot status-dot-${escapeHtml(statusInfo.className)}"></span>
              ${escapeHtml(statusInfo.label)}
            </span>
          </td>

          <td>
            <div class="invitation-actions">
              <button type="button" class="btn btn-secondary btn-small" data-action="copy-link" data-link="${escapeHtml(invitationLink)}">
                Copiar link
              </button>

              <button type="button" class="btn btn-primary btn-small" data-action="show-qr" data-link="${escapeHtml(invitationLink)}" data-guest-name="${escapeHtml(guest.name)}">
                Ver QR
              </button>
            </div>
          </td>

          <td>
            <div class="table-actions">
              <button type="button" class="btn btn-secondary btn-small" data-action="mark-waiting" data-guest-id="${escapeHtml(guest.id)}">
                Enviado
              </button>

              <button type="button" class="btn btn-danger btn-small" data-action="remove" data-guest-id="${escapeHtml(guest.id)}">
                Remover
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadCurrentEvent() {
  currentEventId = eventIdInput.value.trim() || CONFIRMAE_THEME.defaultEventId;
  eventIdInput.value = currentEventId;

  panelPinHelpText.textContent = "Verificando acesso...";
  loadEventButton.disabled = true;
  loadEventButton.textContent = "Carregando...";

  try {
    const eventInfo = await getEvent(currentEventId);
    currentEventInfo = eventInfo;

    if (!eventInfo || eventInfo.accessEnabled === false) {
      showAccessLocked(currentEventId);
      return;
    }

    if (!isPanelPinValid(eventInfo)) {
      showPanelPinDenied();
      return;
    }

    rememberPanelPin(eventInfo);
    panelPinHelpText.textContent = "Acesso liberado para este evento.";

    renderEventConfig(eventInfo);
    await renderGuests();
    showEventWorkspace();
  } catch (error) {
    console.error(error);

    if (error.code === "event-not-released") {
      showAccessLocked(currentEventId);
    } else {
      alert("Não foi possível carregar o evento. Confira o Firebase e tente novamente.");
      showAccessLocked(currentEventId);
    }
  } finally {
    loadEventButton.disabled = false;
    loadEventButton.textContent = "Acessar evento";
  }
}

function openQrModal(guestName, invitationLink) {
  currentQrLink = invitationLink;
  currentQrGuestName = guestName;

  qrGuestInitial.textContent = getInitials(guestName);
  qrGuestName.textContent = guestName;
  qrGuestLink.textContent = invitationLink;

  qrCodeBox.innerHTML = "";

  if (typeof QRCode === "undefined") {
    qrCodeBox.innerHTML = `
      <p>Não foi possível carregar o gerador de QR Code. Atualize a página e tente novamente.</p>
    `;
  } else {
    new QRCode(qrCodeBox, {
      text: invitationLink,
      width: 220,
      height: 220,
      colorDark: "#221b35",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  }

  qrModal.classList.add("is-open");
  qrModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  qrModal.classList.remove("is-open");
  qrModal.setAttribute("aria-hidden", "true");
  currentQrLink = "";
  currentQrGuestName = "";
  qrCodeBox.innerHTML = "";
}

function downloadCurrentQrCode() {
  const canvas = qrCodeBox.querySelector("canvas");
  const image = qrCodeBox.querySelector("img");

  let imageUrl = "";

  if (canvas) {
    imageUrl = canvas.toDataURL("image/png");
  } else if (image) {
    imageUrl = image.src;
  }

  if (!imageUrl) {
    alert("Não foi possível baixar o QR Code. Gere o QR novamente.");
    return;
  }

  const safeGuestName = String(currentQrGuestName || "convidado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const downloadLink = document.createElement("a");
  downloadLink.href = imageUrl;
  downloadLink.download = `qrcode-${safeGuestName || "convidado"}.png`;
  downloadLink.click();
}

async function copyTextToClipboard(text, successButton = null, defaultText = "") {
  try {
    await navigator.clipboard.writeText(text);

    if (successButton) {
      successButton.textContent = "Copiado!";

      setTimeout(() => {
        successButton.textContent = defaultText;
      }, 1400);
    }
  } catch (error) {
    alert(`Copie manualmente:\n${text}`);
  }
}

async function handleEventConfigSubmit(event) {
  event.preventDefault();

  const submitButton = eventConfigForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Salvando...";

  const eventDateIso = eventDateIsoInput.value.trim();
  const dateText = eventDateInput.value.trim() || formatDateIsoToLongText(eventDateIso);

  try {
    await saveEvent(currentEventId, {
      name: eventNameInput.value.trim(),
      type: eventTypeInput.value.trim(),
      hostName: eventHostInput.value.trim(),
      eventDateIso,
      date: dateText,
      time: eventTimeInput.value.trim(),
      location: eventLocationInput.value.trim(),
      intro: eventIntroInput.value.trim()
    });

    alert("Dados do evento salvos com sucesso!");

    await loadCurrentEvent();
  } catch (error) {
    console.error(error);
    alert("Não foi possível salvar os dados do evento.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Salvar dados do evento";
  }
}

async function handleGuestFormSubmit(event) {
  event.preventDefault();

  const nameInput = document.getElementById("guestNameInput");
  const phoneInput = document.getElementById("guestPhoneInput");
  const emailInput = document.getElementById("guestEmailInput");
  const companionsInput = document.getElementById("guestCompanionsInput");

  const name = nameInput.value.trim();

  if (!name) {
    alert("Informe o nome do convidado.");
    return;
  }

  if (
    currentEventId !== CONFIRMAE_THEME.defaultEventId &&
    currentEventInfo &&
    currentEventInfo.guestLimit !== null &&
    currentEventInfo.guestLimit !== undefined &&
    currentGuests.length >= Number(currentEventInfo.guestLimit)
  ) {
    alert(
      `Seu plano permite até ${currentEventInfo.guestLimit} convidados.\n\nPara cadastrar mais pessoas, solicite upgrade pelo WhatsApp.`
    );
    return;
  }

  const submitButton = guestForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Criando...";

  try {
    const newGuest = await addGuest({
      eventId: currentEventId,
      name,
      phone: phoneInput.value.trim(),
      email: emailInput.value.trim(),
      companions: companionsInput.value
    });

    guestForm.reset();
    companionsInput.value = 0;

    await renderGuests();

    const invitationLink = buildInvitationLink(newGuest.eventId, newGuest.id);

    alert(`Convite criado com sucesso!\n\nLink do convite:\n${invitationLink}`);
  } catch (error) {
    console.error(error);

    if (error.code === "guest-limit-reached") {
      alert(
        `Seu plano permite até ${error.limit} convidados.\n\nPara cadastrar mais pessoas, solicite upgrade pelo WhatsApp.`
      );
    } else {
      alert("Não foi possível criar o convite. Confira o Firebase e tente novamente.");
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Criar convite";
  }
}

async function handleTableClick(event) {
  const clickedButton = event.target.closest("button");

  if (!clickedButton) {
    return;
  }

  const action = clickedButton.dataset.action;
  const guestId = clickedButton.dataset.guestId;

  if (action === "copy-link") {
    const link = clickedButton.dataset.link;
    await copyTextToClipboard(link, clickedButton, "Copiar link");
    return;
  }

  if (action === "show-qr") {
    const link = clickedButton.dataset.link;
    const guestName = clickedButton.dataset.guestName;

    openQrModal(guestName, link);
    return;
  }

  if (action === "mark-waiting") {
    clickedButton.disabled = true;
    clickedButton.textContent = "Salvando...";

    try {
      await updateGuest(currentEventId, guestId, {
        status: "waiting",
        gateOverride: false
      });

      await renderGuests();
    } catch (error) {
      console.error(error);
      alert("Não foi possível atualizar o status.");
    }

    return;
  }

  if (action === "remove") {
    const confirmRemoval = confirm("Tem certeza que deseja remover este convidado?");

    if (!confirmRemoval) {
      return;
    }

    try {
      await removeGuest(currentEventId, guestId);
      await renderGuests();
    } catch (error) {
      console.error(error);
      alert("Não foi possível remover o convidado.");
    }
  }
}

async function handleResetDemo() {
  const confirmReset = confirm(
    "Isso vai restaurar os convidados de demonstração no Firebase. Os dados personalizados do evento serão mantidos. Deseja continuar?"
  );

  if (!confirmReset) {
    return;
  }

  resetDemoButton.disabled = true;
  resetDemoButton.textContent = "Restaurando...";

  try {
    await resetDemoGuests();

    currentEventId = CONFIRMAE_THEME.defaultEventId;
    eventIdInput.value = currentEventId;

    await loadCurrentEvent();
  } catch (error) {
    console.error(error);
    alert("Não foi possível restaurar a demonstração.");
  } finally {
    resetDemoButton.disabled = false;
    resetDemoButton.textContent = "Restaurar demo";
  }
}

eventConfigForm.addEventListener("submit", handleEventConfigSubmit);
guestForm.addEventListener("submit", handleGuestFormSubmit);
guestTableBody.addEventListener("click", handleTableClick);
loadEventButton.addEventListener("click", loadCurrentEvent);
resetDemoButton.addEventListener("click", handleResetDemo);

exportAllGuestsButton.addEventListener("click", () => exportGuests("all"));
exportAcceptedGuestsButton.addEventListener("click", () => exportGuests("accepted"));
exportPresentGuestsButton.addEventListener("click", () => exportGuests("present"));
exportDeclinedGuestsButton.addEventListener("click", () => exportGuests("declined"));

eventDateIsoInput.addEventListener("change", () => {
  if (!eventDateInput.value.trim()) {
    eventDateInput.value = formatDateIsoToLongText(eventDateIsoInput.value);
  }
});

copyPixButton.addEventListener("click", () => {
  copyTextToClipboard(BUSINESS_CONFIG.pixKey, copyPixButton, "Copiar chave Pix");
});

closeQrModal.addEventListener("click", closeModal);

qrModal.addEventListener("click", (event) => {
  if (event.target === qrModal) {
    closeModal();
  }
});

copyQrLinkButton.addEventListener("click", () => {
  copyTextToClipboard(currentQrLink, copyQrLinkButton, "Copiar link");
});

downloadQrButton.addEventListener("click", downloadCurrentQrCode);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && qrModal.classList.contains("is-open")) {
    closeModal();
  }
});

hideEventWorkspace();
loadCurrentEvent();
