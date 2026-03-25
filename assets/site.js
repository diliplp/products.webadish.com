const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    nav.classList.toggle("is-open");
    navToggle.classList.toggle("is-open");
  });
}

const currentPath = window.location.pathname.replace(/\/+$/, "") || "/";

document.querySelectorAll("[data-nav-link]").forEach((link) => {
  const href = link.getAttribute("href");
  if (!href) return;
  const normalizedHref = href.replace(/\/+$/, "") || "/";
  if (normalizedHref === currentPath) {
    link.classList.add("is-active");
  }
});
