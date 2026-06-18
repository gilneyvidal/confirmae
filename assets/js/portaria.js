import {
  parseInvitationInput,
  findGuest,
  updateGuest,
  escapeHtml
} from "./app.js";

const gateForm = document.getElementById("gateForm");
const qrInput = document.getElementById("qrInput");
const gateResult = document.getElementById("gateResult");
const qrReader = document.getElementById("qrReader");
const scannerIdleContent = document.getElementById("scannerIdleContent");
const startScannerButton = document.getElementById("startScannerButton");
const stopScannerButton = document.getElementById("stopScannerButton");

let lastBlockedGuest = null;
let html5QrCode = null;
let scannerIsRunning = false;
let lastScannedText = "";
let lastScannedAt = 0;

function renderResult(type, icon, title, message, actionButton = "") {
  gateResult.className = `gate-result result-${type}`;
  gateResult.innerHTML = `
    <span class="result-icon">${escapeHtml(icon)}</span>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
    ${actionButton}
  `;
}

function setScannerButtons(isRunning) {
  scannerIsRunning = isRunning;
  startScannerButton.disabled = isRunning;
  stopScannerButton.disabled = !isRunning;

  startScannerButton.textContent = isRunning ? "Câmera ativa" : "Iniciar câmera";
  stopScannerButton.textContent = isRunning ? "Parar câmera" : "Câmera parada";
}

function renderDeclinedGuestResult(guest, eventId, guestId) {
  lastBlockedGuest = {
    eventId,
    guestId,
    name: guest.name
  };

  const actionButton = `
    <button
      type="button"
      class="btn btn-primary"
      data-action="force-release"
      style="margin-top: 18px;"
    >
      Liberar entrada mesmo assim
    </button>
  `;

  renderResult(
    "danger",
    "×",
    "Convidado recusou",
    `${guest.name} informou que não poderia comparecer. Confirme com o anfitrião antes de liberar.`,
    actionButton
  );
}

async function releaseDeclinedGuestAnyway() {
  if (!lastBlockedGuest) {
    renderResult(
      "danger",
      "×",
      "Nenhum convidado selecionado",
      "Valide novamente o convite antes de liberar a entrada."
    );

    return;
  }

  const confirmRelease = confirm(
    `Deseja liberar a entrada de ${lastBlockedGuest.name} mesmo com status recusado?`
  );

  if (!confirmRelease) {
    return;
  }

  const releaseButton = gateResult.querySelector("[data-action='force-release']");

  if (releaseButton) {
    releaseButton.disabled = true;
    releaseButton.textContent = "Liberando...";
  }

  try {
    const now = new Date();

    const updatedGuest = await updateGuest(
      lastBlockedGuest.eventId,
      lastBlockedGuest.guestId,
      {
        status: "present",
        arrivedAt: now.toISOString(),
        gateOverride: true,
        gateOverrideReason: "Convidado estava recusado, mas foi liberado manualmente pela portaria."
      }
    );

    if (!updatedGuest) {
      renderResult(
        "danger",
        "×",
        "Erro ao liberar",
        "Não foi possível liberar este convidado."
      );

      return;
    }

    renderResult(
      "success",
      "✓",
      "Entrada liberada",
      `${updatedGuest.name} foi liberado manualmente e marcado como presente.`
    );

    lastBlockedGuest = null;
    qrInput.value = "";
  } catch (error) {
    console.error(error);

    renderResult(
      "danger",
      "×",
      "Erro no Firebase",
      "Não foi possível liberar a entrada. Confira a conexão e tente novamente."
    );
  }
}

async function validateInvitationText(rawValue, origin = "manual") {
  lastBlockedGuest = null;

  const parsedInput = parseInvitationInput(rawValue);

  if (!parsedInput) {
    renderResult(
      "danger",
      "!",
      "Entrada inválida",
      "Informe um token ou link de convite válido."
    );

    return;
  }

  qrInput.value = rawValue;

  try {
    const guest = await findGuest(parsedInput.eventId, parsedInput.guestId);

    if (!guest) {
      renderResult(
        "danger",
        "×",
        "Convite não encontrado",
        "Este token não foi encontrado na lista de convidados."
      );

      return;
    }

    if (guest.status === "present") {
      renderResult(
        "warning",
        "!",
        "Entrada já registrada",
        `${guest.name} já teve a chegada registrada anteriormente.`
      );

      if (origin === "camera") {
        await stopScanner();
      }

      return;
    }

    if (guest.status === "declined") {
      renderDeclinedGuestResult(guest, parsedInput.eventId, parsedInput.guestId);

      if (origin === "camera") {
        await stopScanner();
      }

      return;
    }

    const now = new Date();

    const updatedGuest = await updateGuest(parsedInput.eventId, parsedInput.guestId, {
      status: "present",
      arrivedAt: now.toISOString(),
      gateOverride: false
    });

    if (!updatedGuest) {
      renderResult(
        "danger",
        "×",
        "Erro ao registrar",
        "Não foi possível registrar a entrada deste convidado."
      );

      return;
    }

    renderResult(
      "success",
      "✓",
      "Entrada liberada",
      `${updatedGuest.name} foi marcado como presente com sucesso.`
    );

    qrInput.value = "";

    if (origin === "camera") {
      await stopScanner();
    }
  } catch (error) {
    console.error(error);

    renderResult(
      "danger",
      "×",
      "Erro no Firebase",
      "Não foi possível validar a entrada. Confira a conexão e as regras do Firestore."
    );
  }
}

async function validateGuestEntry(event) {
  event.preventDefault();

  const submitButton = gateForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Validando...";

  await validateInvitationText(qrInput.value, "manual");

  submitButton.disabled = false;
  submitButton.textContent = "Validar entrada";
}

function shouldIgnoreRepeatedScan(decodedText) {
  const now = Date.now();
  const isSameText = decodedText === lastScannedText;
  const isTooSoon = now - lastScannedAt < 2500;

  if (isSameText && isTooSoon) {
    return true;
  }

  lastScannedText = decodedText;
  lastScannedAt = now;

  return false;
}

async function handleSuccessfulQrScan(decodedText) {
  if (shouldIgnoreRepeatedScan(decodedText)) {
    return;
  }

  renderResult(
    "info",
    "…",
    "QR Code lido",
    "Validando convite no Firebase..."
  );

  await validateInvitationText(decodedText, "camera");
}

function handleQrScanError() {
  /*
    Erros de leitura acontecem várias vezes por segundo enquanto a câmera
    procura um QR Code. Por isso, não mostramos alerta a cada erro.
  */
}

async function startScanner() {
  if (scannerIsRunning) {
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    renderResult(
      "danger",
      "×",
      "Leitor não carregou",
      "Atualize a página e tente novamente. Se continuar, use o campo manual."
    );

    return;
  }

  try {
    renderResult(
      "info",
      "⌕",
      "Abrindo câmera",
      "Permita o acesso à câmera quando o navegador solicitar."
    );

    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("qrReader");
    }

    scannerIdleContent.style.display = "none";

    const scannerConfig = {
      fps: 10,
      qrbox: {
        width: 250,
        height: 250
      },
      aspectRatio: 1
    };

    await html5QrCode.start(
      {
        facingMode: "environment"
      },
      scannerConfig,
      handleSuccessfulQrScan,
      handleQrScanError
    );

    setScannerButtons(true);

    renderResult(
      "info",
      "⌕",
      "Câmera ativa",
      "Aponte a câmera para o QR Code do convite."
    );
  } catch (error) {
    console.error(error);

    scannerIdleContent.style.display = "block";
    setScannerButtons(false);

    renderResult(
      "danger",
      "×",
      "Não foi possível abrir a câmera",
      "Confira se você permitiu o acesso à câmera. Se estiver no computador, teste também pelo celular."
    );
  }
}

async function stopScanner() {
  if (!html5QrCode || !scannerIsRunning) {
    scannerIdleContent.style.display = "block";
    setScannerButtons(false);
    return;
  }

  try {
    await html5QrCode.stop();
    await html5QrCode.clear();

    html5QrCode = null;
  } catch (error) {
    console.warn("Não foi possível parar a câmera.", error);
  }

  scannerIdleContent.style.display = "block";
  setScannerButtons(false);
}

gateForm.addEventListener("submit", validateGuestEntry);

gateResult.addEventListener("click", (event) => {
  const clickedButton = event.target.closest("button");

  if (!clickedButton) {
    return;
  }

  if (clickedButton.dataset.action === "force-release") {
    releaseDeclinedGuestAnyway();
  }
});

startScannerButton.addEventListener("click", startScanner);
stopScannerButton.addEventListener("click", stopScanner);

window.addEventListener("beforeunload", () => {
  if (html5QrCode && scannerIsRunning) {
    html5QrCode.stop().catch(() => {});
  }
});

setScannerButtons(false);
