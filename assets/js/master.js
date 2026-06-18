import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "./firebase-config.js";

import {
  buildAdminLink,
  buildClientAccessWhatsappLink,
  listEventAccessRecords,
  releaseEvent,
  blockEvent,
  deleteManagedEvent,
  escapeHtml
} from "./app.js";

const CONFIRMAE_THEME = window.CONFIRMAE_THEME;

const ALLOWED_MASTER_EMAILS = [
  "gw.vidal@gmail.com"
];

const masterLoadingSection = document.getElementById("masterLoadingSection");
const masterLoginSection = document.getElementById("masterLoginSection");
const masterDeniedSection = document.getElementById("masterDeniedSection");
const masterAppSection = document.getElementById("masterAppSection");

const googleSignInButton = document.getElementById("googleSignInButton");
const deniedLogoutButton = document.getElementById("deniedLogoutButton");
const deniedEmailText = document.getElementById("deniedEmailText");

const masterUserName = document.getElementById("masterUserName");
const masterUserEmail = document.getElementById("masterUserEmail");
const masterLogoutButton = document.getElementById("masterLogoutButton");

const masterEventForm = document.getElementById("masterEventForm");
const masterEventIdInput = document.getElementById("masterEventIdInput");
const masterCustomerNameInput = document.getElementById("masterCustomerNameInput");
const masterCustomerWhatsappInput = document.getElementById("masterCustomerWhatsappInput");
const masterCustomerEmailInput = document.getElementById("masterCustomerEmailInput");
const masterAmountInput = document.getElementById("masterAmountInput");
const masterEventNameInput = document.getElementById("masterEventNameInput");
const masterEventTypeInput = document.getElementById("masterEventTypeInput");
const masterNotesInput = document.getElementById("masterNotesInput");

const clearMasterFormButton = document.getElementById("clearMasterFormButton");
const reloadMasterListButton = document.getElementById("reloadMasterListButton");
const masterEventsTableBody = document.getElementById("masterEventsTableBody");

let currentMasterUser = null;
let lastReleasedRecord = null;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAuthorizedMaster(user) {
  const userEmail = normalizeEmail(user ? user.email : "");

  return ALLOWED_MASTER_EMAILS
    .map((email) => normalizeEmail(email))
    .includes(userEmail);
}

function hideAllMasterSections() {
  masterLoadingSection.hidden = true;
  masterLoginSection.hidden = true;
  masterDeniedSection.hidden = true;
  masterAppSection.hidden = true;
}

function showLoading() {
  hideAllMasterSections();
  masterLoadingSection.hidden = false;
}

function showLogin() {
  hideAllMasterSections();
  masterLoginSection.hidden = false;
}

function showAccessDenied(user) {
  hideAllMasterSections();

  deniedEmailText.textContent = user && user.email
    ? user.email
    : "E-mail não identificado.";

  masterDeniedSection.hidden = false;
}

function showMasterApp(user) {
  hideAllMasterSections();

  masterUserName.textContent = user.displayName || "Administrador";
  masterUserEmail.textContent = user.email || "--";

  masterAppSection.hidden = false;
}

function clearMasterForm() {
  masterEventForm.reset();
  masterAmountInput.value = CONFIRMAE_THEME.business.unlockPrice;
}

function setTableMessage(message) {
  masterEventsTableBody.innerHTML = `
    <tr>
      <td colspan="5">${escapeHtml(message)}</td>
    </tr>
  `;
}

function getFormData() {
  return {
    eventId: masterEventIdInput.value.trim(),
    customerName: masterCustomerNameInput.value.trim(),
    customerWhatsapp: masterCustomerWhatsappInput.value.trim(),
    customerEmail: masterCustomerEmailInput.value.trim(),
    amountPaid: masterAmountInput.value.trim(),
    eventName: masterEventNameInput.value.trim(),
    eventType: masterEventTypeInput.value.trim(),
    notes: masterNotesInput.value.trim()
  };
}

function fillFormFromRecord(record) {
  masterEventIdInput.value = record.id || "";
  masterCustomerNameInput.value = record.customerName || "";
  masterCustomerWhatsappInput.value = record.customerWhatsapp || "";
  masterCustomerEmailInput.value = record.customerEmail || "";
  masterAmountInput.value = record.amountPaid || CONFIRMAE_THEME.business.unlockPrice;
  masterEventNameInput.value = record.eventName || "";
  masterEventTypeInput.value = record.eventType || "";
  masterNotesInput.value = record.notes || "";
}

function openClientAccessWhatsapp(record) {
  const whatsappLink = buildClientAccessWhatsappLink(record);

  if (!whatsappLink) {
    alert("Este cliente não tem WhatsApp cadastrado.");
    return;
  }

  window.open(whatsappLink, "_blank");
}

async function handleGoogleSignIn() {
  googleSignInButton.disabled = true;
  googleSignInButton.textContent = "Entrando...";

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error(error);

    if (error.code === "auth/unauthorized-domain") {
      alert(
        "Domínio não autorizado no Firebase Authentication. Adicione gilneyvidal.github.io em Authentication > Settings > Authorized domains."
      );
    } else if (error.code === "auth/popup-closed-by-user") {
      alert("Login cancelado antes de concluir.");
    } else {
      alert("Não foi possível entrar com Google. Confira o Firebase Authentication.");
    }
  } finally {
    googleSignInButton.disabled = false;
    googleSignInButton.textContent = "Entrar com Google";
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert("Não foi possível sair da conta.");
  }
}

async function renderMasterList() {
  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    return;
  }

  setTableMessage("Carregando eventos...");

  try {
    const records = await listEventAccessRecords();

    if (!records.length) {
      setTableMessage("Nenhum evento liberado ou bloqueado ainda.");
      return;
    }

    masterEventsTableBody.innerHTML = records
      .map((record) => {
        const statusText = record.enabled ? "Liberado" : "Bloqueado";
        const statusClass = record.enabled ? "accepted" : "declined";
        const paidText = record.paid ? "Pago" : "Pendente";
        const adminLink = buildAdminLink(record.id);

        return `
          <tr>
            <td>
              <div class="guest-name-cell">
                <strong>${escapeHtml(record.id)}</strong>
                <small>${escapeHtml(record.notes || "Sem observações")}</small>
              </div>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(record.customerName || "Sem nome")}</strong>
                <small>${escapeHtml(record.customerWhatsapp || "Sem WhatsApp")}</small>
              </div>
            </td>

            <td>
              <span class="status-pill status-pill-${statusClass}">
                <span class="status-dot status-dot-${statusClass}"></span>
                ${statusText}
              </span>
            </td>

            <td>
              <div class="guest-contact-cell">
                <strong>${escapeHtml(record.amountPaid || "Sem valor")}</strong>
                <small>${paidText}</small>
              </div>
            </td>

            <td>
              <div class="table-actions">
                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  data-action="edit"
                  data-record='${escapeHtml(JSON.stringify(record))}'
                >
                  Editar
                </button>

                <a
                  href="${escapeHtml(adminLink)}"
                  class="btn btn-primary btn-small"
                  target="_blank"
                  rel="noopener"
                >
                  Abrir
                </a>

                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  data-action="send-access"
                  data-record='${escapeHtml(JSON.stringify(record))}'
                >
                  Enviar acesso
                </button>

                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  data-action="block"
                  data-event-id="${escapeHtml(record.id)}"
                >
                  Bloquear
                </button>

                <button
                  type="button"
                  class="btn btn-danger btn-small"
                  data-action="delete"
                  data-event-id="${escapeHtml(record.id)}"
                >
                  Apagar
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  } catch (error) {
    console.error(error);
    setTableMessage("Erro ao carregar eventos. Confira o Firebase.");
  }
}

async function handleMasterEventSubmit(event) {
  event.preventDefault();

  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    alert("Você não tem permissão para liberar eventos.");
    return;
  }

  const data = getFormData();

  if (!data.eventId) {
    alert("Informe o ID do evento.");
    return;
  }

  const submitButton = masterEventForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Liberando...";

  try {
    const releasedRecord = await releaseEvent(data.eventId, data);

    lastReleasedRecord = {
      ...releasedRecord,
      customerName: data.customerName,
      customerWhatsapp: data.customerWhatsapp,
      amountPaid: data.amountPaid,
      eventName: data.eventName,
      eventType: data.eventType
    };

    alert("Evento liberado/atualizado com sucesso!");

    const shouldSendAccess = confirm(
      "Deseja abrir o WhatsApp agora para enviar os dados de acesso ao cliente?"
    );

    if (shouldSendAccess) {
      openClientAccessWhatsapp(lastReleasedRecord);
    }

    clearMasterForm();
    await renderMasterList();
  } catch (error) {
    console.error(error);
    alert("Não foi possível liberar o evento.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Liberar / atualizar evento";
  }
}

async function handleMasterTableClick(event) {
  const clickedButton = event.target.closest("button");

  if (!clickedButton) {
    return;
  }

  if (!currentMasterUser || !isAuthorizedMaster(currentMasterUser)) {
    alert("Você não tem permissão para executar esta ação.");
    return;
  }

  const action = clickedButton.dataset.action;
  const eventId = clickedButton.dataset.eventId;

  if (action === "edit") {
    try {
      const record = JSON.parse(clickedButton.dataset.record);
      fillFormFromRecord(record);
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } catch (error) {
      alert("Não foi possível carregar este registro no formulário.");
    }

    return;
  }

  if (action === "send-access") {
    try {
      const record = JSON.parse(clickedButton.dataset.record);
      openClientAccessWhatsapp(record);
    } catch (error) {
      alert("Não foi possível montar a mensagem de acesso.");
    }

    return;
  }

  if (action === "block") {
    const confirmBlock = confirm(`Deseja bloquear o evento ${eventId}?`);

    if (!confirmBlock) {
      return;
    }

    try {
      await blockEvent(eventId);
      await renderMasterList();
      alert("Evento bloqueado com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível bloquear o evento.");
    }

    return;
  }

  if (action === "delete") {
    const confirmDelete = confirm(
      `Deseja apagar o evento ${eventId}?\n\nIsso remove o acesso, o evento e os convidados cadastrados.`
    );

    if (!confirmDelete) {
      return;
    }

    const secondConfirm = confirm("Confirma mesmo? Essa ação não é reversível.");

    if (!secondConfirm) {
      return;
    }

    try {
      await deleteManagedEvent(eventId);
      await renderMasterList();
      alert("Evento apagado com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Não foi possível apagar o evento.");
    }
  }
}

googleSignInButton.addEventListener("click", handleGoogleSignIn);
masterLogoutButton.addEventListener("click", handleLogout);
deniedLogoutButton.addEventListener("click", handleLogout);
masterEventForm.addEventListener("submit", handleMasterEventSubmit);
clearMasterFormButton.addEventListener("click", clearMasterForm);
reloadMasterListButton.addEventListener("click", renderMasterList);
masterEventsTableBody.addEventListener("click", handleMasterTableClick);

showLoading();

onAuthStateChanged(auth, async (user) => {
  currentMasterUser = user;

  if (!user) {
    showLogin();
    return;
  }

  if (!isAuthorizedMaster(user)) {
    showAccessDenied(user);
    return;
  }

  showMasterApp(user);
  await renderMasterList();
});
