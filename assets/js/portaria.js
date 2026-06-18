import {
  parseInvitationInput,
  findGuest,
  updateGuest,
  escapeHtml
} from "./app.js";

const gateForm = document.getElementById("gateForm");
const qrInput = document.getElementById("qrInput");
const gateResult = document.getElementById("gateResult");

function renderResult(type, icon, title, message) {
  gateResult.className = `gate-result result-${type}`;
  gateResult.innerHTML = `
    <span class="result-icon">${escapeHtml(icon)}</span>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(message)}</p>
  `;
}

async function validateGuestEntry(event) {
  event.preventDefault();

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
      renderResult(
        "danger",
        "×",
        "Convidado recusou",
        `${guest.name} informou que não poderia comparecer. Confirme com o anfitrião antes de liberar.`
      );

      return;
    }

    const now = new Date();

    const updatedGuest = await updateGuest(parsedInput.eventId, parsedInput.guestId, {
      status: "present",
      arrivedAt: now.toISOString()
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
