(function initConfirmaeAnimations() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    document.querySelectorAll(".reveal-up").forEach((element) => {
      element.classList.add("is-visible");
    });

    return;
  }

  const revealElements = document.querySelectorAll(".reveal-up");

  if (!revealElements.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  revealElements.forEach((element, index) => {
    element.style.setProperty("--reveal-delay", `${Math.min(index * 35, 220)}ms`);
    observer.observe(element);
  });
})();
