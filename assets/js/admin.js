import {
  buildInvitationLink,
  getGuestsByEvent,
  updateGuest,
  addGuest,
  removeGuest,
  resetDemoGuests,
  getStatusInfo,
  escapeHtml
} from "./app.js";

const CONFIRMAE_THEME = window.CONFIRMAE_THEME;

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

function setTableLoading(message) {
  guestTableBody.innerHTML = `
    <tr>
      <td colspan="5">${escapeHtml(message)}</td>
    </tr>
  `;
}

function updateStats(guests) {
  totalGuests.textContent = guests.length;
  waitingGuests.textContent = guests.filter((guest) => guest.status === "waiting").length;
  acceptedGuests.textContent = guests.filter((guest) => guest.status === "accepted").length;
  declinedGuests.textContent = guests.filter((guest) => guest.status === "declined").length;
  presentGuests.textContent = guests.filter((guest) => guest.status === "present").length;
}

async function renderGuests() {
  setTableLoading("Carregando convidados do Firebase...");

  try {
    const guests = await getGuestsByEvent(currentEventId);

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
        const statusInfo = getStatusInfo(guest.status);
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
              <button
                type="button"
                class="btn btn-secondary btn-small"
                data-action="copy-link"
                data-link="${escapeHtml(invitationLink)}"
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
                  data-guest-id="${escapeHtml(guest.id)}"
                >
                  Enviado
                </button>

                <button
                  type="button"
                  class="btn btn-danger btn-small"
                  data-action="remove"
                  data-guest-id="${escapeHtml(guest.id)}"
                >
                  Remover
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error(error);

    updateStats([]);

    setTableLoading(
      "Erro ao carregar convidados. Confira se o Firestore foi criado e se as regras estão em modo de teste."
    );
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
    alert("Não foi possível criar o convite. Confira o Firebase e tente novamente.");
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
    clickedButton.disabled = true;
    clickedButton.textContent = "Salvando...";

    try {
      await updateGuest(currentEventId, guestId, {
        status: "waiting"
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

async function handleLoadEvent() {
  currentEventId = eventIdInput.value.trim() || CONFIRMAE_THEME.defaultEventId;
  eventIdInput.value = currentEventId;

  await renderGuests();
}

async function handleResetDemo() {
  const confirmReset = confirm(
    "Isso vai restaurar os convidados de demonstração no Firebase. Deseja continuar?"
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

    await renderGuests();
  } catch (error) {
    console.error(error);
    alert("Não foi possível restaurar a demonstração.");
  } finally {
    resetDemoButton.disabled = false;
    resetDemoButton.textContent = "Restaurar demo";
  }
}

guestForm.addEventListener("submit", handleGuestFormSubmit);
guestTableBody.addEventListener("click", handleTableClick);
loadEventButton.addEventListener("click", handleLoadEvent);
resetDemoButton.addEventListener("click", handleResetDemo);

renderGuests();
