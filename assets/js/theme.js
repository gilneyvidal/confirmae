const CONFIRMAE_THEME = {
  productName: "Confirmaê",
  defaultEventId: "evento-demo",

  business: {
    whatsappNumberInternational: "5511968649673",
    whatsappDisplay: "(11) 96864-9673",
    pixBank: "Mercado Pago",
    pixKey: "11968649673",
    pixHolder: "Gilney Wesley Aparecido Vidal",
    unlockPrice: "R$ 29,90",
    paymentDescription: "Liberação de novo evento no Confirmaê"
  },

  master: {
    authorizedEmails: ["gw.vidal@gmail.com"]
  },

  colors: {
    primary: "#21BDC1",
    primaryDark: "#159CA0",
    secondary: "#5E6168",
    danger: "#ef4444",
    warning: "#facc15",
    success: "#22c55e",
    info: "#38bdf8",
    background: "#0D1014",
    surface: "#151A20",
    surfaceSoft: "#1F2630",
    text: "#FEFEFE",
    muted: "#ACADB3",
    border: "#2C343D"
  },

  demoEvent: {
    id: "evento-demo",
    type: "Casamento",
    name: "Casamento João & Maria",
    intro:
      "Você está recebendo este convite especial para celebrar um momento inesquecível com a gente.",
    date: "20 de dezembro de 2026",
    time: "19h30",
    location: "Espaço Jardim Imperial",
    hostName: "João & Maria"
  }
};

function applyConfirmaeTheme() {
  const root = document.documentElement;

  root.style.setProperty("--color-primary", CONFIRMAE_THEME.colors.primary);
  root.style.setProperty("--color-primary-dark", CONFIRMAE_THEME.colors.primaryDark);
  root.style.setProperty("--color-secondary", CONFIRMAE_THEME.colors.secondary);
  root.style.setProperty("--color-danger", CONFIRMAE_THEME.colors.danger);
  root.style.setProperty("--color-warning", CONFIRMAE_THEME.colors.warning);
  root.style.setProperty("--color-success", CONFIRMAE_THEME.colors.success);
  root.style.setProperty("--color-info", CONFIRMAE_THEME.colors.info);
  root.style.setProperty("--color-bg", CONFIRMAE_THEME.colors.background);
  root.style.setProperty("--color-surface", CONFIRMAE_THEME.colors.surface);
  root.style.setProperty("--color-surface-soft", CONFIRMAE_THEME.colors.surfaceSoft);
  root.style.setProperty("--color-text", CONFIRMAE_THEME.colors.text);
  root.style.setProperty("--color-muted", CONFIRMAE_THEME.colors.muted);
  root.style.setProperty("--color-border", CONFIRMAE_THEME.colors.border);
}

window.CONFIRMAE_THEME = CONFIRMAE_THEME;
applyConfirmaeTheme();
