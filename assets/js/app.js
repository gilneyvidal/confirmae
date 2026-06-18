import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  orderBy
} from "./firebase-config.js";

const CONFIRMAE_THEME = window.CONFIRMAE_THEME;
const DEFAULT_EVENT_ID = CONFIRMAE_THEME.defaultEventId;

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
  },
  presentManual: {
    label: "Presente com liberação manual",
    className: "manual"
  }
};

function createEventNotReleasedError(eventId) {
  const error = new Error(`O evento ${eventId} ainda não foi liberado.`);
  error.code = "event-not-released";
  error.eventId = eventId;

  return error;
}

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

function buildWhatsappUnlockLink(eventId) {
  const business = CONFIRMAE_THEME.business;
  const message = [
    "Olá! Quero liberar um novo evento no Confirmaê.",
    "",
    `ID do evento: ${eventId}`,
    `Valor: ${business.unlockPrice}`,
    `Chave Pix: ${business.pixKey}`,
    "",
    "Vou enviar o comprovante por aqui para liberação manual."
  ].join("\n");

  return `https://wa.me/${business.whatsappNumberInternational}?text=${encodeURIComponent(message)}`;
}

function getDemoGuestsSeed() {
  return [
    {
      id: "convidado-demo",
      eventId: DEFAULT_EVENT_ID,
      name: "Gilney Vidal",
      phone: "(11) 99999-0000",
      email: "gilney@email.com",
      companions: 0,
      status: "waiting",
      arrivedAt: "",
      gateOverride: false
    },
    {
      id: "maria-oliveira",
      eventId: DEFAULT_EVENT_ID,
      name: "Maria Oliveira",
      phone: "(11) 98888-1111",
      email: "maria@email.com",
      companions: 1,
      status: "accepted",
      arrivedAt: "",
      gateOverride: false
    },
    {
      id: "carlos-santos",
      eventId: DEFAULT_EVENT_ID,
      name: "Carlos Santos",
      phone: "(11) 97777-2222",
      email: "carlos@email.com",
      companions: 0,
      status: "declined",
      arrivedAt: "",
      gateOverride: false
    },
    {
      id: "ana-lima",
      eventId: DEFAULT_EVENT_ID,
      name: "Ana Lima",
      phone: "(11) 96666-3333",
      email: "ana@email.com",
      companions: 2,
      status: "created",
      arrivedAt: "",
      gateOverride: false
    }
  ];
}

function getDefaultEventData(eventId) {
  if (eventId === DEFAULT_EVENT_ID) {
    return {
      ...CONFIRMAE_THEME.demoEvent,
      id: eventId
    };
  }

  return {
    id: eventId,
    type: "Evento",
    name: "Evento personalizado",
    intro:
      "Você está recebendo este convite especial. Confirme sua presença para ajudar o anfitrião na organização.",
    date: "Data a definir",
    time: "Horário a definir",
    location: "Local a definir",
    hostName: "Anfitrião"
  };
}

function getEventReference(eventId) {
  return doc(db, "events", eventId);
}

function getEventAccessReference(eventId) {
  return doc(db, "eventAccess", eventId);
}

function getGuestReference(eventId, guestId) {
  return doc(db, "events", eventId, "guests", guestId);
}

function getGuestsCollectionReference(eventId) {
  return collection(db, "events", eventId, "guests");
}

async function getEventAccess(eventId) {
  if (eventId === DEFAULT_EVENT_ID) {
    return {
      id: eventId,
      enabled: true,
      paid: true,
      reason: "Evento demonstrativo padrão."
    };
  }

  const accessSnapshot = await getDoc(getEventAccessReference(eventId));

  if (!accessSnapshot.exists()) {
    return {
      id: eventId,
      enabled: false,
      paid: false,
      reason: "Evento ainda não liberado."
    };
  }

  return {
    id: accessSnapshot.id,
    ...accessSnapshot.data()
  };
}

async function ensureEventExists(eventId) {
  const eventReference = getEventReference(eventId);
  const eventSnapshot = await getDoc(eventReference);

  if (eventSnapshot.exists()) {
    return {
      id: eventSnapshot.id,
      ...eventSnapshot.data()
    };
  }

  const eventAccess = await getEventAccess(eventId);

  if (!eventAccess.enabled) {
    throw createEventNotReleasedError(eventId);
  }

  const eventData = getDefaultEventData(eventId);

  await setDoc(eventReference, {
    ...eventData,
    id: eventId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return eventData;
}

async function getEvent(eventId) {
  await ensureEventExists(eventId);

  const eventSnapshot = await getDoc(getEventReference(eventId));

  if (!eventSnapshot.exists()) {
    return null;
  }

  return {
    id: eventSnapshot.id,
    ...eventSnapshot.data()
  };
}

async function saveEvent(eventId, eventData) {
  const safeEventId = eventId || DEFAULT_EVENT_ID;
  const currentEvent = await ensureEventExists(safeEventId);

  const updatedEvent = {
    ...currentEvent,
    ...eventData,
    id: safeEventId,
    updatedAt: serverTimestamp()
  };

  await setDoc(getEventReference(safeEventId), updatedEvent, {
    merge: true
  });

  return getEvent(safeEventId);
}

async function ensureDemoGuestsExist() {
  await ensureEventExists(DEFAULT_EVENT_ID);

  const guestsSnapshot = await getDocs(getGuestsCollectionReference(DEFAULT_EVENT_ID));

  if (!guestsSnapshot.empty) {
    return;
  }

  const batch = writeBatch(db);
  const demoGuests = getDemoGuestsSeed();

  demoGuests.forEach((guest) => {
    const guestReference = getGuestReference(DEFAULT_EVENT_ID, guest.id);

    batch.set(guestReference, {
      ...guest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

async function getGuestsByEvent(eventId) {
  if (eventId === DEFAULT_EVENT_ID) {
    await ensureDemoGuestsExist();
  } else {
    await ensureEventExists(eventId);
  }

  const guestsQuery = query(
    getGuestsCollectionReference(eventId),
    orderBy("name", "asc")
  );

  const guestsSnapshot = await getDocs(guestsQuery);

  return guestsSnapshot.docs.map((guestDocument) => {
    return {
      id: guestDocument.id,
      ...guestDocument.data()
    };
  });
}

async function findGuest(eventId, guestId) {
  await ensureEventExists(eventId);

  const guestSnapshot = await getDoc(getGuestReference(eventId, guestId));

  if (!guestSnapshot.exists()) {
    return null;
  }

  return {
    id: guestSnapshot.id,
    ...guestSnapshot.data()
  };
}

async function updateGuest(eventId, guestId, updates) {
  const guestReference = getGuestReference(eventId, guestId);
  const guestSnapshot = await getDoc(guestReference);

  if (!guestSnapshot.exists()) {
    return null;
  }

  await updateDoc(guestReference, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  return findGuest(eventId, guestId);
}

async function addGuest(guestData) {
  const eventId = guestData.eventId || DEFAULT_EVENT_ID;

  await ensureEventExists(eventId);

  const newGuest = {
    id: createGuestToken(guestData.name),
    eventId,
    name: guestData.name,
    phone: guestData.phone || "",
    email: guestData.email || "",
    companions: Number(guestData.companions || 0),
    status: "created",
    arrivedAt: "",
    gateOverride: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(getGuestReference(eventId, newGuest.id), newGuest);

  return {
    ...newGuest,
    createdAt: "",
    updatedAt: ""
  };
}

async function removeGuest(eventId, guestId) {
  await deleteDoc(getGuestReference(eventId, guestId));
}

async function resetDemoGuests() {
  await ensureEventExists(DEFAULT_EVENT_ID);

  const guestsSnapshot = await getDocs(getGuestsCollectionReference(DEFAULT_EVENT_ID));

  const deleteBatch = writeBatch(db);

  guestsSnapshot.docs.forEach((guestDocument) => {
    deleteBatch.delete(guestDocument.ref);
  });

  await deleteBatch.commit();

  const createBatch = writeBatch(db);
  const demoGuests = getDemoGuestsSeed();

  demoGuests.forEach((guest) => {
    const guestReference = getGuestReference(DEFAULT_EVENT_ID, guest.id);

    createBatch.set(guestReference, {
      ...guest,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  await createBatch.commit();

  return getGuestsByEvent(DEFAULT_EVENT_ID);
}

function getStatusInfo(status) {
  return CONFIRMAE_STATUS[status] || CONFIRMAE_STATUS.created;
}

function getGuestStatusInfo(guest) {
  if (guest && guest.status === "present" && guest.gateOverride === true) {
    return CONFIRMAE_STATUS.presentManual;
  }

  return getStatusInfo(guest ? guest.status : "created");
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
    eventId: DEFAULT_EVENT_ID,
    guestId: value
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export {
  CONFIRMAE_STATUS,
  getQueryParam,
  createGuestToken,
  getBaseUrl,
  buildInvitationLink,
  buildWhatsappUnlockLink,
  getEventAccess,
  getEvent,
  saveEvent,
  getGuestsByEvent,
  findGuest,
  updateGuest,
  addGuest,
  removeGuest,
  resetDemoGuests,
  getStatusInfo,
  getGuestStatusInfo,
  getInitials,
  parseInvitationInput,
  escapeHtml
};
