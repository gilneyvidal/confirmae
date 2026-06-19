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

const CONFIRMAE_PLANS = [
  {
    id: "essential",
    name: "Confirmaê Essencial",
    price: 29.9,
    priceLabel: "R$ 29,90",
    guestLimit: 30,
    description: "Até 30 convidados"
  },
  {
    id: "pro",
    name: "Confirmaê Pro",
    price: 49.9,
    priceLabel: "R$ 49,90",
    guestLimit: 60,
    description: "Até 60 convidados"
  },
  {
    id: "max",
    name: "Confirmaê Max",
    price: 89.99,
    priceLabel: "R$ 89,99",
    guestLimit: null,
    description: "Convidados ilimitados"
  }
];

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

function createGuestLimitError(limit) {
  const error = new Error(`Este plano permite até ${limit} convidados.`);
  error.code = "guest-limit-reached";
  error.limit = limit;

  return error;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function generateAccessPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getPlanOptions() {
  return CONFIRMAE_PLANS;
}

function getPlanById(planId) {
  return CONFIRMAE_PLANS.find((plan) => plan.id === planId) || CONFIRMAE_PLANS[0];
}

function formatCurrency(value) {
  const numberValue = Number(value || 0);

  return numberValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function parseCurrencyToNumber(value) {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCouponCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
}

function calculateEventPricing(planId, coupon = null) {
  const plan = getPlanById(planId);
  const originalAmount = plan.price;
  const discountAmount = coupon && coupon.active !== false
    ? Number(coupon.discountAmount || 0)
    : 0;

  const finalAmount = Math.max(0, originalAmount - discountAmount);

  return {
    planId: plan.id,
    planName: plan.name,
    planPrice: plan.price,
    planPriceLabel: plan.priceLabel,
    guestLimit: plan.guestLimit,
    originalAmount,
    originalAmountFormatted: formatCurrency(originalAmount),
    discountAmount,
    discountAmountFormatted: formatCurrency(discountAmount),
    finalAmount,
    finalAmountFormatted: formatCurrency(finalAmount)
  };
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

function buildAdminLink(eventId) {
  return `${getBaseUrl()}admin.html?evento=${encodeURIComponent(eventId)}`;
}

function buildGateLink(eventId) {
  return `${getBaseUrl()}portaria.html?evento=${encodeURIComponent(eventId)}`;
}

function formatBrazilianWhatsappNumber(rawNumber) {
  const digits = String(rawNumber || "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  return `55${digits}`;
}

function buildWhatsappUnlockLink(eventId) {
  const business = CONFIRMAE_THEME.business;
  const message = [
    "Olá! Quero liberar um novo evento no Confirmaê.",
    "",
    `ID do evento: ${eventId}`,
    "",
    "Gostaria de contratar um plano e enviar o comprovante para liberação."
  ].join("\n");

  return `https://wa.me/${business.whatsappNumberInternational}?text=${encodeURIComponent(message)}`;
}

function buildClientAccessWhatsappLink(record) {
  const customerWhatsapp = formatBrazilianWhatsappNumber(record.customerWhatsapp);
  const eventId = record.id || record.eventId || "";
  const adminLink = buildAdminLink(eventId);
  const gateLink = buildGateLink(eventId);
  const customerName = record.customerName || "tudo bem";
  const panelPin = record.panelPin || "não informado";
  const gatePin = record.gatePin || "não informado";
  const planName = record.planName || "Plano não informado";
  const finalAmount = record.finalAmountFormatted || record.amountPaid || "Valor não informado";

  if (!customerWhatsapp) {
    return "";
  }

  const message = [
    `Olá, ${customerName}! Seu evento foi liberado no Confirmaê. ✅`,
    "",
    "Resumo da contratação:",
    `Plano: ${planName}`,
    `Valor final: ${finalAmount}`,
    "",
    "Acesso do anfitrião:",
    `Link do painel: ${adminLink}`,
    `ID do evento: ${eventId}`,
    `PIN do painel: ${panelPin}`,
    "",
    "Acesso da portaria:",
    `Link da portaria: ${gateLink}`,
    `PIN da portaria: ${gatePin}`,
    "",
    "Orientação:",
    "1. Use o painel do anfitrião para personalizar o evento e cadastrar convidados.",
    "2. Use a portaria apenas no dia do evento para validar QR Codes e registrar entradas.",
    "3. Não compartilhe o PIN do painel com a equipe da portaria.",
    "",
    "Qualquer dúvida, pode me chamar por aqui."
  ].join("\n");

  return `https://wa.me/${customerWhatsapp}?text=${encodeURIComponent(message)}`;
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
  const defaultPlan = getPlanById("essential");

  if (eventId === DEFAULT_EVENT_ID) {
    return {
      ...CONFIRMAE_THEME.demoEvent,
      id: eventId,
      accessEnabled: true,
      panelPin: "",
      gatePin: "",
      planId: "max",
      planName: "Demonstração",
      guestLimit: null,
      eventDateIso: ""
    };
  }

  return {
    id: eventId,
    type: "Evento",
    name: "Evento personalizado",
    intro:
      "Você está recebendo este convite especial. Confirme sua presença para ajudar o anfitrião na organização.",
    date: "Data a definir",
    eventDateIso: "",
    time: "Horário a definir",
    location: "Local a definir",
    hostName: "Anfitrião",
    accessEnabled: true,
    panelPin: "",
    gatePin: "",
    planId: defaultPlan.id,
    planName: defaultPlan.name,
    guestLimit: defaultPlan.guestLimit
  };
}

function getEventReference(eventId) {
  return doc(db, "events", eventId);
}

function getEventAccessReference(eventId) {
  return doc(db, "eventAccess", eventId);
}

function getCouponReference(couponCode) {
  return doc(db, "coupons", normalizeCouponCode(couponCode));
}

function getGuestReference(eventId, guestId) {
  return doc(db, "events", eventId, "guests", guestId);
}

function getGuestsCollectionReference(eventId) {
  return collection(db, "events", eventId, "guests");
}

async function createOrUpdateCoupon(data) {
  const code = normalizeCouponCode(data.code);

  if (!code) {
    throw new Error("Informe o código do cupom.");
  }

  const couponData = {
    code,
    referrerName: data.referrerName || "",
    referrerWhatsapp: data.referrerWhatsapp || "",
    discountType: "fixed",
    discountAmount: parseCurrencyToNumber(data.discountAmount),
    discountAmountFormatted: formatCurrency(parseCurrencyToNumber(data.discountAmount)),
    active: data.active !== false,
    notes: data.notes || "",
    updatedAt: serverTimestamp()
  };

  const couponSnapshot = await getDoc(getCouponReference(code));

  await setDoc(getCouponReference(code), {
    ...couponData,
    createdAt: couponSnapshot.exists()
      ? couponSnapshot.data().createdAt || serverTimestamp()
      : serverTimestamp()
  }, {
    merge: true
  });

  return getCoupon(code);
}

async function getCoupon(couponCode) {
  const code = normalizeCouponCode(couponCode);

  if (!code) {
    return null;
  }

  const couponSnapshot = await getDoc(getCouponReference(code));

  if (!couponSnapshot.exists()) {
    return null;
  }

  return {
    id: couponSnapshot.id,
    ...couponSnapshot.data()
  };
}

async function listCoupons() {
  const couponsSnapshot = await getDocs(collection(db, "coupons"));

  const coupons = couponsSnapshot.docs.map((couponDocument) => {
    return {
      id: couponDocument.id,
      ...couponDocument.data()
    };
  });

  coupons.sort((a, b) => String(a.code || a.id).localeCompare(String(b.code || b.id)));

  return coupons;
}

async function getEventAccess(eventId) {
  if (eventId === DEFAULT_EVENT_ID) {
    return {
      id: eventId,
      enabled: true,
      paid: true,
      customerName: "Demonstração",
      customerWhatsapp: "",
      amountPaid: "Demo",
      panelPin: "",
      gatePin: "",
      planId: "max",
      planName: "Demonstração",
      guestLimit: null,
      statusCommercial: "beta",
      operationalStatus: "active",
      notes: "Evento demonstrativo padrão."
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

async function listEventAccessRecords() {
  const accessSnapshot = await getDocs(collection(db, "eventAccess"));

  const records = await Promise.all(
    accessSnapshot.docs.map(async (accessDocument) => {
      const accessData = {
        id: accessDocument.id,
        ...accessDocument.data()
      };

      try {
        const eventSnapshot = await getDoc(getEventReference(accessDocument.id));

        if (eventSnapshot.exists()) {
          const eventData = eventSnapshot.data();

          return {
            ...accessData,
            eventDate: eventData.date || accessData.eventDate || "",
            eventDateIso: eventData.eventDateIso || accessData.eventDateIso || "",
            eventName: eventData.name || accessData.eventName || "",
            eventType: eventData.type || accessData.eventType || "",
            accessEnabled: eventData.accessEnabled
          };
        }
      } catch (error) {
        console.warn("Não foi possível sincronizar dados do evento no master.", error);
      }

      return accessData;
    })
  );

  records.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return records;
}

async function releaseEvent(eventId, data) {
  const safeEventId = String(eventId || "").trim();

  if (!safeEventId) {
    throw new Error("Informe o ID do evento.");
  }

  const previousAccessSnapshot = await getDoc(getEventAccessReference(safeEventId));
  const previousAccessData = previousAccessSnapshot.exists()
    ? previousAccessSnapshot.data()
    : {};

  const eventSnapshot = await getDoc(getEventReference(safeEventId));
  const currentEventData = eventSnapshot.exists()
    ? eventSnapshot.data()
    : {};

  const plan = getPlanById(data.planId || previousAccessData.planId || currentEventData.planId || "essential");
  const couponCode = normalizeCouponCode(data.couponCode || previousAccessData.couponCode || "");
  const coupon = couponCode ? await getCoupon(couponCode) : null;
  const pricing = calculateEventPricing(plan.id, coupon);

  const panelPin = String(data.panelPin || previousAccessData.panelPin || currentEventData.panelPin || generateAccessPin()).trim();
  const gatePin = String(data.gatePin || previousAccessData.gatePin || currentEventData.gatePin || generateAccessPin()).trim();

  const eventDateIso = data.eventDateIso || currentEventData.eventDateIso || previousAccessData.eventDateIso || "";
  const eventDate = currentEventData.date || previousAccessData.eventDate || "";
  const statusCommercial = data.statusCommercial || previousAccessData.statusCommercial || "paid";
  const operationalStatus = data.operationalStatus || previousAccessData.operationalStatus || "active";

  const accessData = {
    id: safeEventId,
    enabled: true,
    paid: statusCommercial === "paid" || statusCommercial === "beta" || statusCommercial === "courtesy",
    customerName: data.customerName || "",
    customerWhatsapp: data.customerWhatsapp || "",
    customerEmail: data.customerEmail || "",
    amountPaid: pricing.finalAmountFormatted,
    planId: pricing.planId,
    planName: pricing.planName,
    planPrice: pricing.planPrice,
    planPriceLabel: pricing.planPriceLabel,
    guestLimit: pricing.guestLimit,
    originalAmount: pricing.originalAmount,
    originalAmountFormatted: pricing.originalAmountFormatted,
    discountAmount: pricing.discountAmount,
    discountAmountFormatted: pricing.discountAmountFormatted,
    finalAmount: pricing.finalAmount,
    finalAmountFormatted: pricing.finalAmountFormatted,
    couponCode,
    couponValid: Boolean(coupon && coupon.active !== false),
    couponReferrerName: coupon ? coupon.referrerName || "" : "",
    couponReferrerWhatsapp: coupon ? coupon.referrerWhatsapp || "" : "",
    eventName: data.eventName || currentEventData.name || "",
    eventType: data.eventType || currentEventData.type || "",
    eventDate,
    eventDateIso,
    panelPin,
    gatePin,
    statusCommercial,
    operationalStatus,
    notes: data.notes || "",
    releasedAt: previousAccessData.releasedAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(getEventAccessReference(safeEventId), accessData, {
    merge: true
  });

  if (!eventSnapshot.exists()) {
    const defaultEventData = getDefaultEventData(safeEventId);

    await setDoc(getEventReference(safeEventId), {
      ...defaultEventData,
      name: data.eventName || defaultEventData.name,
      type: data.eventType || defaultEventData.type,
      hostName: data.customerName || defaultEventData.hostName,
      accessEnabled: true,
      panelPin,
      gatePin,
      planId: pricing.planId,
      planName: pricing.planName,
      guestLimit: pricing.guestLimit,
      statusCommercial,
      operationalStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(getEventReference(safeEventId), {
      name: data.eventName || currentEventData.name || "Evento personalizado",
      type: data.eventType || currentEventData.type || "Evento",
      accessEnabled: true,
      panelPin,
      gatePin,
      planId: pricing.planId,
      planName: pricing.planName,
      guestLimit: pricing.guestLimit,
      statusCommercial,
      operationalStatus,
      updatedAt: serverTimestamp()
    }, {
      merge: true
    });
  }

  return getEventAccess(safeEventId);
}

async function blockEvent(eventId) {
  const safeEventId = String(eventId || "").trim();

  if (!safeEventId) {
    throw new Error("Informe o ID do evento.");
  }

  await setDoc(getEventAccessReference(safeEventId), {
    id: safeEventId,
    enabled: false,
    operationalStatus: "blocked",
    blockedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, {
    merge: true
  });

  const eventSnapshot = await getDoc(getEventReference(safeEventId));

  if (eventSnapshot.exists()) {
    await setDoc(getEventReference(safeEventId), {
      accessEnabled: false,
      operationalStatus: "blocked",
      updatedAt: serverTimestamp()
    }, {
      merge: true
    });
  }

  return getEventAccess(safeEventId);
}

async function deleteManagedEvent(eventId) {
  const safeEventId = String(eventId || "").trim();

  if (!safeEventId) {
    throw new Error("Informe o ID do evento.");
  }

  const guestsSnapshot = await getDocs(getGuestsCollectionReference(safeEventId));
  const guestDocs = guestsSnapshot.docs;

  for (let index = 0; index < guestDocs.length; index += 450) {
    const batch = writeBatch(db);
    const chunk = guestDocs.slice(index, index + 450);

    chunk.forEach((guestDocument) => {
      batch.delete(guestDocument.ref);
    });

    await batch.commit();
  }

  await deleteDoc(getEventReference(safeEventId));
  await deleteDoc(getEventAccessReference(safeEventId));
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

  if (eventId !== DEFAULT_EVENT_ID) {
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
  const eventInfo = await ensureEventExists(eventId);

  if (eventId !== DEFAULT_EVENT_ID && eventInfo.guestLimit !== null && eventInfo.guestLimit !== undefined) {
    const guestsSnapshot = await getDocs(getGuestsCollectionReference(eventId));

    if (guestsSnapshot.size >= Number(eventInfo.guestLimit)) {
      throw createGuestLimitError(Number(eventInfo.guestLimit));
    }
  }

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
  generateAccessPin,
  getPlanOptions,
  getPlanById,
  calculateEventPricing,
  formatCurrency,
  normalizeCouponCode,
  createGuestToken,
  getBaseUrl,
  buildInvitationLink,
  buildAdminLink,
  buildGateLink,
  buildWhatsappUnlockLink,
  buildClientAccessWhatsappLink,
  createOrUpdateCoupon,
  getCoupon,
  listCoupons,
  getEventAccess,
  listEventAccessRecords,
  releaseEvent,
  blockEvent,
  deleteManagedEvent,
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
