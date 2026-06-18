const eventIdInput = document.getElementById("eventIdInput");
const loadEventButton = document.getElementById("loadEventButton");
const guestForm = document.getElementById("guestForm");
const guestTableBody = document.getElementById("guestTableBody");
const resetDemoButton = document.getElementById("resetDemoButton");

const totalGuests = document.getElementById("totalGuests");
const waitingGuests = document.getElementById("waitingGuests");
const acceptedGuests = document.getElementById("acceptedGuests");
const declinedGuests = document.getElementById("declinedGuests");
const presentGuests = document.getElementById("presentGuests");

let currentEventId = CONFIRMAE_THEME.defaultEventId;

function getCurrentGuests() {
  return ConfirmaeApp.getGuestsByEvent(currentEventId);
}

function updateStats(guests) {
  totalGuests.textContent = guests.length;
  waitingGuests.textContent = guests.filter((guest) => guest.status === "waiting").length;
  acceptedGuests.textContent = guests.filter((guest) => guest.status === "accepted").length;
  declinedGuests.textContent = guests.filter((guest) => guest.status === "declined").length;
  presentGuests.textContent = guests.filter((guest) => guest.status === "present").length;
}

function renderGuests() {
  const guests = getCurrentGuests();

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
      const statusInfo = ConfirmaeApp.getStatusInfo(guest.status);
      const invitationLink = ConfirmaeApp.buildInvitationLink(guest.eventId, guest.id);

      return `
        <tr>
          <td>
            <div class="guest-name-cell">
              <strong>${guest.name}</strong>
              <small>ID: ${guest.id}</small>
            </div>
          </td>

          <td>
            <div class="guest-contact-cell">
              <strong>${guest.phone || "Sem telefone"}</strong>
              <small>${guest.email || "Sem e-mail"}</small>
            </div>
          </td>

          <td>
            <span class="status-pill status-pill-${statusInfo.className}">
              <span class="status-dot status-dot-${statusInfo.className}"></span>
              ${statusInfo.label}
            </span>
          </td>

          <td>
            <button
              type="button"
              class="btn btn-secondary btn-small"
              data-action="copy-link"
              data-link="${invitationLink}"
            >
              Copiar link
            </button>
          </td>

          <td>
            <div class="table-actions">
              <button
                type="button"
                class="btn btn-secondary btn-small"
                data-action="mark-waiting"
                data-guest-id="${guest.id}"
              >
                Enviado
              </button>

              <button
                type="button"
                class="btn btn-danger btn-small"
                data-action="remove"
                data-guest-id="${guest.id}"
              >
                Remover
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function handleGuestFormSubmit(event) {
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

  const newGuest = ConfirmaeApp.addGuest({
    eventId: currentEventId,
    name,
    phone: phoneInput.value.trim(),
    email: emailInput.value.trim(),
    companions: companionsInput.value
  });

  guestForm.reset();
  companionsInput.value = 0;

  renderGuests();

  const invitationLink = ConfirmaeApp.buildInvitationLink(newGuest.eventId, newGuest.id);

  alert(`Convite criado com sucesso!\n\nLink do convite:\n${invitationLink}`);
}

function handleTableClick(event) {
  const clickedButton = event.target.closest("button");

  if (!clickedButton) {
    return;
  }

  const action = clickedButton.dataset.action;
  const guestId = clickedButton.dataset.guestId;

  if (action === "copy-link") {
    const link = clickedButton.dataset.link;

    navigator.clipboard
      .writeText(link)
      .then(() => {
        clickedButton.textContent = "Copiado!";
        setTimeout(() => {
          clickedButton.textContent = "Copiar link";
        }, 1400);
      })
      .catch(() => {
        alert(`Copie o link manualmente:\n${link}`);
      });

    return;
  }

  if (action === "mark-waiting") {
    ConfirmaeApp.updateGuest(currentEventId, guestId, {
      status: "waiting"
    });

    renderGuests();
    return;
  }

  if (action === "remove") {
    const confirmRemoval = confirm("Tem certeza que deseja remover este convidado?");

    if (!confirmRemoval) {
      return;
    }

    ConfirmaeApp.removeGuest(currentEventId, guestId);
    renderGuests();
  }
}

function handleLoadEvent() {
  currentEventId = eventIdInput.value.trim() || CONFIRMAE_THEME.defaultEventId;
  eventIdInput.value = currentEventId;
  renderGuests();
}

function handleResetDemo() {
  const confirmReset = confirm(
    "Isso vai restaurar os convidados de demonstração neste navegador. Deseja continuar?"
  );

  if (!confirmReset) {
    return;
  }

  ConfirmaeApp.resetDemoGuests();
  currentEventId = CONFIRMAE_THEME.defaultEventId;
  eventIdInput.value = currentEventId;
  renderGuests();
}

guestForm.addEventListener("submit", handleGuestFormSubmit);
guestTableBody.addEventListener("click", handleTableClick);
loadEventButton.addEventListener("click", handleLoadEvent);
resetDemoButton.addEventListener("click", handleResetDemo);

renderGuests();
