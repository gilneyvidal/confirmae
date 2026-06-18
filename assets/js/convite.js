import {
  getQueryParam,
  getEvent,
  findGuest,
  updateGuest,
  getStatusInfo,
  getInitials,
  escapeHtml
} from "./app.js";

const CONFIRMAE_THEME = window.CONFIRMAE_THEME;

const guestGreeting = document.getElementById("guestGreeting");
const eventIntro = document.getElementById("eventIntro");
const eventType = document.getElementById("eventType");
const eventName = document.getElementById("eventName");
const eventDate = document.getElementById("eventDate");
const eventTime = document.getElementById("eventTime");
const eventLocation = document.getElementById("eventLocation");
const confirmationMessage = document.getElementById("confirmationMessage");
const currentStatusBox = document.getElementById("currentStatusBox");
const acceptButton = document.getElementById("acceptButton");
const declineButton = document.getElementById("declineButton");
const guestInitial = document.getElementById("guestInitial");
const guestName = document.getElementById("guestName");
const guestToken = document.getElementById("guestToken");

const eventId = getQueryParam("evento") || CONFIRMAE_THEME.defaultEventId;
const guestId = getQueryParam("convidado") || "convidado-demo";

function setButtonsDisabled(disabled) {
  acceptButton.disabled = disabled;
  declineButton.disabled = disabled;
  acceptButton.style.opacity = disabled ? "0.5" : "1";
  declineButton.style.opacity = disabled ? "0.5" : "1";
}

function renderStatus(status) {
  const statusInfo = getStatusInfo(status);

  currentStatusBox.innerHTML = `
    <span class="status-dot status-dot-${escapeHtml(statusInfo.className)}"></span>
    <span id="currentStatusText">${escapeHtml(statusInfo.label)}</span>
  `;
}

function renderEventInfo(eventInfo) {
  eventType.textContent = eventInfo.type || "Evento";
  eventName.textContent = eventInfo.name || "Evento";
  eventIntro.textContent =
    eventInfo.intro ||
    "Você está recebendo este convite especial. Confirme sua presença para ajudar o anfitrião na organização.";
  eventDate.textContent = eventInfo.date || "Data a definir";
  eventTime.textContent = eventInfo.time || "Horário a definir";
  eventLocation.textContent = eventInfo.location || "Local a definir";
}

async function renderGuest() {
  setButtonsDisabled(true);

  try {
    const eventInfo = await getEvent(eventId);
    const guest = await findGuest(eventId, guestId);

    renderEventInfo(eventInfo || CONFIRMAE_THEME.demoEvent);

    if (!guest) {
      guestGreeting.textContent = "Convite não encontrado";
      guestName.textContent = "Convidado não localizado";
      guestToken.textContent = `Token: ${guestId}`;
      guestInitial.textContent = "?";

      confirmationMessage.textContent =
        "Não encontramos este convite. Confira se o link está correto ou fale com o anfitrião.";

      renderStatus("declined");
      setButtonsDisabled(true);

      return;
    }

    guestGreeting.textContent = `Olá, ${guest.name}!`;
    guestName.textContent = guest.name;
    guestToken.textContent = `Token: ${guest.id}`;
    guestInitial.textContent = getInitials(guest.name);

    renderStatus(guest.status);

    if (guest.status === "accepted") {
      confirmationMessage.textContent =
        "Sua presença já está confirmada. O anfitrião ficará feliz em receber você!";
    } else if (guest.status === "declined") {
      confirmationMessage.textContent =
        "Você informou que não poderá comparecer. Obrigado por avisar com antecedência.";
    } else if (guest.status === "present") {
      confirmationMessage.textContent =
        "Sua presença foi confirmada e sua chegada já foi registrada na portaria.";
    } else {
      confirmationMessage.textContent =
        "Confirme se você poderá comparecer. Sua resposta ajuda o anfitrião a organizar melhor o evento.";
    }

    setButtonsDisabled(false);
  } catch (error) {
    console.error(error);

    guestGreeting.textContent = "Erro ao carregar convite";
    confirmationMessage.textContent =
      "Não foi possível carregar este convite. Confira a conexão com o Firebase.";

    renderStatus("declined");
    setButtonsDisabled(true);
  }
}

async function acceptInvitation() {
  setButtonsDisabled(true);

  try {
    const updatedGuest = await updateGuest(eventId, guestId, {
      status: "accepted"
    });

    if (!updatedGuest) {
      alert("Não foi possível confirmar este convite.");
      await renderGuest();
      return;
    }

    await renderGuest();

    alert("Presença confirmada com sucesso!");
  } catch (error) {
    console.error(error);
    alert("Erro ao confirmar presença.");
    setButtonsDisabled(false);
  }
}

async function declineInvitation() {
  const confirmDecline = confirm(
    "Deseja realmente recusar este convite? O anfitrião será avisado na lista."
  );

  if (!confirmDecline) {
    return;
  }

  setButtonsDisabled(true);

  try {
    const updatedGuest = await updateGuest(eventId, guestId, {
      status: "declined"
    });

    if (!updatedGuest) {
      alert("Não foi possível recusar este convite.");
      await renderGuest();
      return;
    }

    await renderGuest();

    alert("Resposta registrada. Obrigado por avisar!");
  } catch (error) {
    console.error(error);
    alert("Erro ao registrar resposta.");
    setButtonsDisabled(false);
  }
}

acceptButton.addEventListener("click", acceptInvitation);
declineButton.addEventListener("click", declineInvitation);

renderGuest();
