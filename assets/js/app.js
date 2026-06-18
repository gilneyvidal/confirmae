const CONFIRMAE_STORAGE_KEY = "confirmae_demo_guests_v1";

const CONFIRMAE_STATUS = {
  created: {
    label: "Convite feito",
    className: "created"
  },
  waiting: {
    label: "Aguardando confirmação",
    className: "waiting"
  },
  accepted: {
    label: "Aceito",
    className: "accepted"
  },
  declined: {
    label: "Recusado",
    className: "declined"
  },
  present: {
    label: "Presente",
    className: "present"
  }
};

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function createGuestToken(name) {
  const normalizedName = String(name || "convidado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 24);

  const randomPart = Math.random().toString(36).slice(2, 8);

  return `${normalizedName || "convidado"}-${randomPart}`;
}

function getBaseUrl() {
  const currentPath = window.location.pathname;
  const folderPath = currentPath.substring(0, currentPath.lastIndexOf("/") + 1);

  return `${window.location.origin}${folderPath}`;
}

function buildInvitationLink(eventId, guestId) {
  return `${getBaseUrl()}convite.html?evento=${encodeURIComponent(eventId)}&convidado=${encodeURIComponent(guestId)}`;
}

function getDemoGuestsSeed() {
  return [
    {
      id: "convidado-demo",
      eventId: "evento-demo",
      name: "Gilney Vidal",
      phone: "(11) 99999-0000",
      email: "gilney@email.com",
      companions: 0,
      status: "waiting",
      arrivedAt: ""
    },
    {
      id: "maria-oliveira",
      eventId: "evento-demo",
      name: "Maria Oliveira",
      phone: "(11) 98888-1111",
      email: "maria@email.com",
      companions: 1,
      status: "accepted",
      arrivedAt: ""
    },
    {
      id: "carlos-santos",
      eventId: "evento-demo",
      name: "Carlos Santos",
      phone: "(11) 97777-2222",
      email: "carlos@email.com",
      companions: 0,
      status: "declined",
      arrivedAt: ""
    },
    {
      id: "ana-lima",
      eventId: "evento-demo",
      name: "Ana Lima",
      phone: "(11) 96666-3333",
      email: "ana@email.com",
      companions: 2,
      status: "created",
      arrivedAt: ""
    }
  ];
}

function getGuests() {
  const savedGuests = localStorage.getItem(CONFIRMAE_STORAGE_KEY);

  if (!savedGuests) {
    const seedGuests = getDemoGuestsSeed();
    saveGuests(seedGuests);
    return seedGuests;
  }

  try {
    return JSON.parse(savedGuests);
  } catch (error) {
    console.warn("Erro ao carregar convidados. Restaurando demonstração.", error);
    const seedGuests = getDemoGuestsSeed();
    saveGuests(seedGuests);
    return seedGuests;
  }
}

function saveGuests(guests) {
  localStorage.setItem(CONFIRMAE_STORAGE_KEY, JSON.stringify(guests));
}

function resetDemoGuests() {
  const seedGuests = getDemoGuestsSeed();
  saveGuests(seedGuests);
  return seedGuests;
}

function getGuestsByEvent(eventId) {
  return getGuests().filter((guest) => guest.eventId === eventId);
}

function findGuest(eventId, guestId) {
  return getGuests().find((guest) => {
    return guest.eventId === eventId && guest.id === guestId;
  });
}

function updateGuest(eventId, guestId, updates) {
  const guests = getGuests();

  const updatedGuests = guests.map((guest) => {
    if (guest.eventId === eventId && guest.id === guestId) {
      return {
        ...guest,
        ...updates
      };
    }

    return guest;
  });

  saveGuests(updatedGuests);

  return findGuest(eventId, guestId);
}

function addGuest(guestData) {
  const guests = getGuests();

  const newGuest = {
    id: createGuestToken(guestData.name),
    eventId: guestData.eventId || CONFIRMAE_THEME.defaultEventId,
    name: guestData.name,
    phone: guestData.phone || "",
    email: guestData.email || "",
    companions: Number(guestData.companions || 0),
    status: "created",
    arrivedAt: ""
  };

  guests.push(newGuest);
  saveGuests(guests);

  return newGuest;
}

function removeGuest(eventId, guestId) {
  const guests = getGuests();

  const filteredGuests = guests.filter((guest) => {
    return !(guest.eventId === eventId && guest.id === guestId);
  });

  saveGuests(filteredGuests);
}

function getStatusInfo(status) {
  return CONFIRMAE_STATUS[status] || CONFIRMAE_STATUS.created;
}

function getInitials(name) {
  const cleanName = String(name || "Convidado").trim();

  if (!cleanName) {
    return "C";
  }

  return cleanName.charAt(0).toUpperCase();
}

function parseInvitationInput(inputValue) {
  const value = String(inputValue || "").trim();

  if (!value) {
    return null;
  }

  if (value.includes("?")) {
    try {
      const temporaryUrl = new URL(value, window.location.origin);
      const eventId = temporaryUrl.searchParams.get("evento");
      const guestId = temporaryUrl.searchParams.get("convidado");

      if (eventId && guestId) {
        return {
          eventId,
          guestId
        };
      }
    } catch (error) {
      console.warn("Não foi possível interpretar o link informado.", error);
    }
  }

  return {
    eventId: CONFIRMAE_THEME.defaultEventId,
    guestId: value
  };
}

window.ConfirmaeApp = {
  getQueryParam,
  createGuestToken,
  getBaseUrl,
  buildInvitationLink,
  getGuests,
  saveGuests,
  resetDemoGuests,
  getGuestsByEvent,
  findGuest,
  updateGuest,
  addGuest,
  removeGuest,
  getStatusInfo,
  getInitials,
  parseInvitationInput
};
