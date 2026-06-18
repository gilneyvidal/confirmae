const gateForm = document.getElementById("gateForm");
const qrInput = document.getElementById("qrInput");
const gateResult = document.getElementById("gateResult");

function renderResult(type, icon, title, message) {
  gateResult.className = `gate-result result-${type}`;
  gateResult.innerHTML = `
    <span class="result-icon">${icon}</span>
    <h3>${title}</h3>
    <p>${message}</p>
  `;
}

function validateGuestEntry(event) {
  event.preventDefault();

  const parsedInput = ConfirmaeApp.parseInvitationInput(qrInput.value);

  if (!parsedInput) {
    renderResult(
      "danger",
      "!",
      "Entrada inválida",
      "Informe um token ou link de convite válido."
    );

    return;
  }

  const guest = ConfirmaeApp.findGuest(parsedInput.eventId, parsedInput.guestId);

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

  const updatedGuest = ConfirmaeApp.updateGuest(parsedInput.eventId, parsedInput.guestId, {
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
}

gateForm.addEventListener("submit", validateGuestEntry);
