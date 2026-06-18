import {
  getQueryParam,
  getEvent,
  parseInvitationInput,
  findGuest,
  updateGuest,
  getGuestStatusInfo,
  escapeHtml
} from "./app.js";

const CONFIRMAE_THEME = window.CONFIRMAE_THEME;

const gateEventIdInput = document.getElementById("gateEventIdInput");
const gatePinInput = document.getElementById("gatePinInput");
const gateAccessHelpText = document.getElementById("gateAccessHelpText");
const unlockGateButton = document.getElementById("unlockGateButton");
const gateWorkspaceSections = document.querySelectorAll("[data-gate-workspace]");
const authorizedGateEventText = document.getElementById("authorizedGateEventText");

const qrReader = document.getElementById("qrReader");
const scannerIdleContent = document.getElementById("scannerIdleContent");
const startScannerButton = document.getElementById("startScannerButton");
const stopScannerButton = document.getElementById("stopScannerButton");

const manualValidationForm = document.getElementById("manualValidationForm");
const qrInput = document.getElementById("qrInput");
const validationResult = document.getElementById("validationResult");

let html5QrCode = null;
let scannerRunning = false;
let lastScannedValue = "";
let currentGateEventId = "";
let currentGateEventInfo = null;

gateEventIdInput.value = getQueryParam("evento") || CONFIRMAE_THEME.defaultEventId;
gatePinInput.value = getQueryParam("pin") || "";

function getGateStorageKey(eventId) {
  return `confirmae_gate_pin_${eventId}`;
}

function hideGateWorkspace() {
  gateWorkspaceSections.forEach((section) => {
    section.hidden = true;
  });
}

function showGateWorkspace() {
  gateWorkspaceSections.forEach((section) => {
    section.hidden = false;
  });
}

function setResult(html) {
  validationResult.innerHTML = html;
}

function renderBasicResult(title, message, statusClass = "waiting") {
  setResult(`
    <div class="guest-summary-card">
      <span class="status-dot status-dot-${escapeHtml(statusClass)}"></span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(message)}</small>
      </div>
    </div>
  `);
}

function isGatePinValid(eventInfo, eventId) {
  if (eventId === CONFIRMAE_THEME.defaultEventId) {
    return true;
  }

  if (!eventInfo.gatePin) {
    return true;
  }

  const typedPin = gatePinInput.value.trim();
  const storedPin = sessionStorage.getItem(getGateStorageKey(eventId));

  return typedPin === eventInfo.gatePin || storedPin === eventInfo.gatePin;
}

function rememberGatePin(eventInfo, eventId) {
  if (eventInfo && eventInfo.gatePin) {
    sessionStorage.setItem(getGateStorageKey(eventId), eventInfo.gatePin);
  }
}

async function unlockGateAccess() {
  const eventId = gateEventIdInput.value.trim() || CONFIRMAE_THEME.defaultEventId;

  unlockGateButton.disabled = true;
  unlockGateButton.textContent = "Verificando...";
  gateAccessHelpText.textContent = "Verificando acesso da portaria...";

  try {
    const eventInfo = await getEvent(eventId);

    if (!eventInfo || eventInfo.accessEnabled === false) {
      hideGateWorkspace();
      gateAccessHelpText.textContent = "Este evento está bloqueado ou ainda não foi liberado.";
      alert("Evento bloqueado ou não liberado.");
      return;
    }

    if (!isGatePinValid(eventInfo, eventId)) {
      hideGateWorkspace();
      gateAccessHelpText.textContent = "PIN da portaria incorreto.";
      alert("PIN da portaria incorreto.");
      return;
    }

    currentGateEventId = eventId;
    currentGateEventInfo = eventInfo;

    rememberGatePin(eventInfo, eventId);

    gateEventIdInput.value = eventId;
    gateAccessHelpText.textContent = "Portaria liberada para este evento.";
    authorizedGateEventText.textContent = `${eventInfo.name || eventId} — ID: ${eventId}`;

    showGateWorkspace();

    renderBasicResult(
      "Portaria liberada",
      "Agora você pode ler QR Codes ou validar convidados manualmente.",
      "accepted"
    );
  } catch (error) {
    console.error(error);

    hideGateWorkspace();

    if (error.code === "event-not-released") {
      gateAccessHelpText.textContent = "Este evento ainda não foi liberado.";
      alert("Este evento ainda não foi liberado.");
    } else {
      gateAccessHelpText.textContent = "Não foi possível validar a portaria.";
      alert("Não foi possível validar a portaria. Confira o Firebase e tente novamente.");
    }
  } finally {
    unlockGateButton.disabled = false;
    unlockGateButton.textContent = "Liberar portaria";
  }
}

function resolveInvitationInput(inputValue) {
  const parsedInput = parseInvitationInput(inputValue);

  if (!parsedInput) {
    return null;
  }

  if (currentGateEventId && parsedInput.eventId === CONFIRMAE_THEME.defaultEventId) {
    return {
      ...parsedInput,
      eventId: currentGateEventId
    };
  }

  return parsedInput;
}

function renderGuestCard(guest, title, message, statusClass, extraHtml = "") {
  const statusInfo = getGuestStatusInfo(guest);

  setResult(`
    <div class="guest-summary-card">
      <span class="guest-avatar">${escapeHtml(String(guest.name || "C").charAt(0).toUpperCase())}</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(message)}</small>
      </div>
    </div>

    <div class="admin-help-box">
      <strong>${escapeHtml(guest.name)}</strong>
      <p>
        Status atual:
        <span class="status-pill status-pill-${escapeHtml(statusInfo.className)}">
          <span class="status-dot status-dot-${escapeHtml(statusInfo.className)}"></span>
          ${escapeHtml(statusInfo.label)}
        </span>
      </p>
      <p>
        Acompanhantes permitidos: ${escapeHtml(String(guest.companions || 0))}
      </p>
      ${extraHtml}
    </div>
  `);
}

async function validateGuestEntry(inputValue) {
  if (!currentGateEventId) {
    alert("Libere a portaria com ID e PIN antes de validar convidados.");
    return;
  }

  const parsedInput = resolveInvitationInput(inputValue);

  if (!parsedInput || !parsedInput.guestId) {
    renderBasicResult(
      "Entrada inválida",
      "Informe um link de convite ou token válido.",
      "declined"
    );
    return;
  }

  if (parsedInput.eventId !== currentGateEventId) {
    renderBasicResult(
      "Evento diferente",
      "Este QR Code pertence a outro evento. Confira o ID da portaria.",
      "declined"
    );
    return;
  }

  renderBasicResult(
    "Validando convidado",
    "Buscando informações no Firebase...",
    "waiting"
  );

  try {
    const guest = await findGuest(parsedInput.eventId, parsedInput.guestId);

    if (!guest) {
      renderBasicResult(
        "Convidado não encontrado",
        "O convite não existe na lista deste evento.",
        "declined"
      );
      return;
    }

    if (guest.status === "present") {
      renderGuestCard(
        guest,
        "Entrada já registrada",
        "Este convidado já foi marcado como presente anteriormente.",
        "declined"
      );
      return;
    }

    if (guest.status === "declined") {
      renderGuestCard(
        guest,
        "Convidado recusou o convite",
        "Este convidado informou que não poderia comparecer.",
        "declined",
        `
          <div class="hero-actions">
            <button
              type="button"
              class="btn btn-danger"
              data-action="manual-release"
              data-event-id="${escapeHtml(parsedInput.eventId)}"
              data-guest-id="${escapeHtml(parsedInput.guestId)}"
            >
              Liberar entrada mesmo assim
            </button>
          </div>
        `
      );
      return;
    }

    const updatedGuest = await updateGuest(parsedInput.eventId, parsedInput.guestId, {
      status: "present",
      arrivedAt: new Date().toISOString(),
      gateOverride: false
    });

    renderGuestCard(
      updatedGuest,
      "Entrada liberada",
      "Convidado validado e marcado como presente.",
      "accepted"
    );
  } catch (error) {
    console.error(error);

    renderBasicResult(
      "Erro na validação",
      "Não foi possível validar este convidado.",
      "declined"
    );
  }
}

async function handleManualRelease(eventId, guestId) {
  const confirmRelease = confirm(
    "Deseja liberar manualmente este convidado mesmo ele tendo recusado o convite?"
  );

  if (!confirmRelease) {
    return;
  }

  try {
    const updatedGuest = await updateGuest(eventId, guestId, {
      status: "present",
      arrivedAt: new Date().toISOString(),
      gateOverride: true,
      gateOverrideReason: "Liberação manual pela portaria"
    });

    renderGuestCard(
      updatedGuest,
      "Entrada liberada manualmente",
      "Convidado recusado foi liberado manualmente pela portaria.",
      "accepted"
    );
  } catch (error) {
    console.error(error);

    renderBasicResult(
      "Erro na liberação manual",
      "Não foi possível liberar este convidado.",
      "declined"
    );
  }
}

async function startScanner() {
  if (!currentGateEventId) {
    alert("Libere a portaria com ID e PIN antes de iniciar a câmera.");
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    alert("Leitor de QR Code não carregou. Atualize a página e tente novamente.");
    return;
  }

  if (scannerRunning) {
    return;
  }

  startScannerButton.disabled = true;
  startScannerButton.textContent = "Iniciando...";

  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qrReader");
    }

    scannerIdleContent.style.display = "none";

    await html5QrCode.start(
      {
        facingMode: "environment"
      },
      {
        fps: 10,
        qrbox: {
          width: 250,
          height: 250
        }
      },
      async (decodedText) => {
        if (!decodedText || decodedText === lastScannedValue) {
          return;
        }

        lastScannedValue = decodedText;

        await stopScanner();
        await validateGuestEntry(decodedText);

        setTimeout(() => {
          lastScannedValue = "";
        }, 1500);
      }
    );

    scannerRunning = true;
  } catch (error) {
    console.error(error);

    scannerIdleContent.style.display = "block";

    alert(
      "Não foi possível iniciar a câmera. Confira se o navegador tem permissão de câmera."
    );
  } finally {
    startScannerButton.disabled = false;
    startScannerButton.textContent = "Iniciar câmera";
  }
}

async function stopScanner() {
  if (!html5QrCode || !scannerRunning) {
    scannerIdleContent.style.display = "block";
    return;
  }

  try {
    await html5QrCode.stop();
  } catch (error) {
    console.warn("Não foi possível parar o scanner.", error);
  } finally {
    scannerRunning = false;
    scannerIdleContent.style.display = "block";
  }
}

unlockGateButton.addEventListener("click", unlockGateAccess);
startScannerButton.addEventListener("click", startScanner);
stopScannerButton.addEventListener("click", stopScanner);

manualValidationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const inputValue = qrInput.value.trim();

  if (!inputValue) {
    alert("Informe um link ou token para validar.");
    return;
  }

  await validateGuestEntry(inputValue);
});

validationResult.addEventListener("click", async (event) => {
  const clickedButton = event.target.closest("button");

  if (!clickedButton) {
    return;
  }

  if (clickedButton.dataset.action === "manual-release") {
    await handleManualRelease(
      clickedButton.dataset.eventId,
      clickedButton.dataset.guestId
    );
  }
});

hideGateWorkspace();

if (gateEventIdInput.value === CONFIRMAE_THEME.defaultEventId) {
  unlockGateAccess();
}
