const guestGreeting = document.getElementById("guestGreeting");
const eventIntro = document.getElementById("eventIntro");
const eventType = document.getElementById("eventType");
const eventName = document.getElementById("eventName");
const eventDate = document.getElementById("eventDate");
const eventTime = document.getElementById("eventTime");
const eventLocation = document.getElementById("eventLocation");
const confirmationMessage = document.getElementById("confirmationMessage");
const currentStatusBox = document.getElementById("currentStatusBox");
const currentStatusText = document.getElementById("currentStatusText");
const acceptButton = document.getElementById("acceptButton");
const declineButton = document.getElementById("declineButton");
const guestInitial = document.getElementById("guestInitial");
const guestName = document.getElementById("guestName");
const guestToken = document.getElementById("guestToken");

const eventId = ConfirmaeApp.getQueryParam("evento") || CONFIRMAE_THEME.defaultEventId;
const guestId = ConfirmaeApp.getQueryParam("convidado") || "convidado-demo";

function renderEventInfo() {
  const eventInfo = CONFIRMAE_THEME.demoEvent;

  eventType.textContent = eventInfo.type;
  eventName.textContent = eventInfo.name;
  eventIntro.textContent = eventInfo.intro;
  eventDate.textContent = eventInfo.date;
  eventTime.textContent = eventInfo.time;
  eventLocation.textContent = eventInfo.location;
}

function renderStatus(status) {
  const statusInfo = ConfirmaeApp.getStatusInfo(status);

  currentStatusBox.innerHTML = `
    <span class="status-dot status-dot-${statusInfo.className}"></span>
    <span id="currentStatusText">${statusInfo.label}</span>
  `;
}

function renderGuest() {
  const guest = ConfirmaeApp.findGuest(eventId, guestId);

  renderEventInfo();

  if (!guest) {
    guestGreeting.textContent = "Convite não encontrado";
    guestName.textContent = "Convidado não localizado";
    guestToken.textContent = `Token: ${guestId}`;
    guestInitial.textContent = "?";

    confirmationMessage.textContent =
      "Não encontramos este convite na demonstração. Confira se o link está correto ou fale com o anfitrião.";

    renderStatus("declined");

    acceptButton.disabled = true;
    declineButton.disabled = true;
    acceptButton.style.opacity = "0.5";
    declineButton.style.opacity = "0.5";

    return;
  }

  guestGreeting.textContent = `Olá, ${guest.name}!`;
  guestName.textContent = guest.name;
  guestToken.textContent = `Token: ${guest.id}`;
  guestInitial.textContent = ConfirmaeApp.getInitials(guest.name);

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
}

function acceptInvitation() {
  const updatedGuest = ConfirmaeApp.updateGuest(eventId, guestId, {
    status: "accepted"
  });

  if (!updatedGuest) {
    alert("Não foi possível confirmar este convite.");
    return;
  }

  renderGuest();

  alert("Presença confirmada com sucesso!");
}

function declineInvitation() {
  const confirmDecline = confirm(
    "Deseja realmente recusar este convite? O anfitrião será avisado na lista."
  );

  if (!confirmDecline) {
    return;
  }

  const updatedGuest = ConfirmaeApp.updateGuest(eventId, guestId, {
    status: "declined"
  });

  if (!updatedGuest) {
    alert("Não foi possível recusar este convite.");
    return;
  }

  renderGuest();

  alert("Resposta registrada. Obrigado por avisar!");
}

acceptButton.addEventListener("click", acceptInvitation);
declineButton.addEventListener("click", declineInvitation);

renderGuest();
