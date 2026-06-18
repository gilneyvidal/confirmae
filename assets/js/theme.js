const CONFIRMAE_THEME = {
  productName: "Confirmaê",
  defaultEventId: "evento-demo",

  colors: {
    primary: "#6c3df4",
    primaryDark: "#4d25c9",
    secondary: "#18b38b",
    danger: "#ef4444",
    warning: "#facc15",
    success: "#22c55e",
    info: "#3b82f6",
    background: "#f7f4ff",
    text: "#221b35"
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
  root.style.setProperty("--color-text", CONFIRMAE_THEME.colors.text);
}

window.CONFIRMAE_THEME = CONFIRMAE_THEME;

applyConfirmaeTheme();
