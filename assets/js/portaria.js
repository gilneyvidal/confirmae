import {
  parseInvitationInput,
  findGuest,
  updateGuest,
  escapeHtml
} from "./app.js";

const gateForm = document.getElementById("gateForm");
const qrInput = document.getElementById("qrInput");
const gateResult = document.getElementById("gateResult");

let lastBlockedGuest = null;

function renderResult(type, icon, title, message, actionButton = "") {
  gateResult.className = `gate-result result-${type}`;
  gateResult.innerHTML = `
    <span class="result-icon">${escapeHtml(icon)}</span>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
    ${actionButton}
  `;
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

async function validateGuestEntry(event) {
  event.preventDefault();

  lastBlockedGuest = null;

  const parsedInput = parseInvitationInput(qrInput.value);

  if (!parsedInput) {
    renderResult(
      "danger",
      "!",
      "Entrada inválida",
      "Informe um token ou link de convite válido."
    );

    return;
  }

  const submitButton = gateForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Validando...";

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

      return;
    }

    if (guest.status === "declined") {
      renderDeclinedGuestResult(guest, parsedInput.eventId, parsedInput.guestId);
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
  } catch (error) {
    console.error(error);

    renderResult(
      "danger",
      "×",
      "Erro no Firebase",
      "Não foi possível validar a entrada. Confira a conexão e as regras do Firestore."
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Validar entrada";
  }
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
