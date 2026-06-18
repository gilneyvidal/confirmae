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

const masterLoginSection = document.getElementById("masterLoginSection");
const masterAppSection = document.getElementById("masterAppSection");
const masterLoginForm = document.getElementById("masterLoginForm");
const masterPasswordInput = document.getElementById("masterPasswordInput");
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

let lastReleasedRecord = null;

function isMasterLoggedIn() {
  return sessionStorage.getItem("confirmae_master_logged") === "true";
}

function showLogin() {
  masterLoginSection.hidden = false;
  masterAppSection.hidden = true;
}

function showMasterApp() {
  masterLoginSection.hidden = true;
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

async function renderMasterList() {
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

async function handleLogin(event) {
  event.preventDefault();

  const typedPassword = masterPasswordInput.value;

  if (typedPassword !== CONFIRMAE_THEME.master.password) {
    alert("Senha incorreta.");
    return;
  }

  sessionStorage.setItem("confirmae_master_logged", "true");
  masterPasswordInput.value = "";

  showMasterApp();
  await renderMasterList();
}

function handleLogout() {
  sessionStorage.removeItem("confirmae_master_logged");
  showLogin();
}

async function handleMasterEventSubmit(event) {
  event.preventDefault();

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

masterLoginForm.addEventListener("submit", handleLogin);
masterLogoutButton.addEventListener("click", handleLogout);
masterEventForm.addEventListener("submit", handleMasterEventSubmit);
clearMasterFormButton.addEventListener("click", clearMasterForm);
reloadMasterListButton.addEventListener("click", renderMasterList);
masterEventsTableBody.addEventListener("click", handleMasterTableClick);

if (isMasterLoggedIn()) {
  showMasterApp();
  renderMasterList();
} else {
  showLogin();
}
