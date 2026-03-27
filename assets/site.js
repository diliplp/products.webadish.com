// Navigation Toggle
const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    nav.classList.toggle("is-open");
    navToggle.classList.toggle("is-open");
  });

  // Close nav when clicking outside
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target) && !navToggle.contains(e.target)) {
      nav.classList.remove("is-open");
      navToggle.classList.remove("is-open");
    }
  });

  // Close nav when pressing Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      nav.classList.remove("is-open");
      navToggle.classList.remove("is-open");
    }
  });
}

// Active nav link highlighting
const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

document.querySelectorAll("[data-nav-link]").forEach((link) => {
  const href = link.getAttribute("href");
  if (!href) return;
  const normalizedHref = href.replace(/\/+$/, "") || "/";
  if (normalizedHref === currentPath) {
    link.classList.add("is-active");
  }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const targetId = this.getAttribute("href");
    if (targetId === "#") return;
    
    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      
      // Close mobile nav if open
      if (nav && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        navToggle.classList.remove("is-open");
      }
    }
  });
});
