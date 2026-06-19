(function registerConfirmaePwa() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;

        if (!newWorker) {
          return;
        }

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            console.info("Confirmaê atualizado. Recarregue a página para usar a nova versão.");
          }
        });
      });

      console.info("PWA do Confirmaê registrada com sucesso.");
    } catch (error) {
      console.warn("Não foi possível registrar a PWA do Confirmaê.", error);
    }
  });
})();
