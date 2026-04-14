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

const autosheetsPlans = {
  "single-site": {
    title: "AutoSheets Pro - Single Site",
    price: "₹2,499 one-time",
    benefits: ["Use on 1 website", "All Pro integrations", "Priority support"],
  },
  "five-sites": {
    title: "AutoSheets Pro - 5 Sites",
    price: "₹4,999 one-time",
    benefits: ["Use on 5 websites", "All Pro integrations", "Priority support"],
  },
  unlimited: {
    title: "AutoSheets Pro - Unlimited",
    price: "₹9,999 one-time",
    benefits: ["Unlimited websites", "White-label option", "Priority support"],
  },
};

const checkoutForm = document.querySelector("[data-checkout-form]");

if (checkoutForm) {
  const params = new URLSearchParams(window.location.search);
  const selectedPlan = autosheetsPlans[params.get("plan")] || autosheetsPlans["single-site"];
  const planId = params.get("plan") && autosheetsPlans[params.get("plan")] ? params.get("plan") : "single-site";
  const summaryTitle = document.querySelector("[data-plan-title]");
  const summaryPrice = document.querySelector("[data-plan-price]");
  const summaryBenefits = document.querySelector("[data-plan-benefits]");
  const planInput = document.querySelector("[data-plan-input]");
  const startedAtInput = document.querySelector("[data-started-at]");
  const submitButton = document.querySelector("[data-submit-button]");
  const feedback = document.querySelector("[data-checkout-feedback]");

  if (summaryTitle) summaryTitle.textContent = selectedPlan.title;
  if (summaryPrice) summaryPrice.textContent = selectedPlan.price;
  if (summaryBenefits) {
    summaryBenefits.innerHTML = selectedPlan.benefits.map((item) => `<li>${item}</li>`).join("");
  }
  if (planInput) planInput.value = planId;
  if (startedAtInput) startedAtInput.value = String(Date.now());

  checkoutForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!submitButton || !feedback) return;

    const formData = new FormData(checkoutForm);
    if (!formData.get("terms")) {
      feedback.textContent = "Please agree to the terms and refund policy before continuing.";
      return;
    }

    submitButton.setAttribute("disabled", "disabled");
    feedback.textContent = "Starting PayU checkout...";

    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/payu/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to start payment right now.");
      }

      if (!data.checkoutUrl) {
        throw new Error(data.error || "Payment gateway did not return a checkout link. Please refresh and try again.");
      }

      window.location.href = data.checkoutUrl;
    } catch (error) {
      feedback.textContent = error instanceof Error ? error.message : "Unable to start payment right now.";
      submitButton.removeAttribute("disabled");
    }
  });
}

const orderRef = document.querySelector("[data-order-ref]");
if (orderRef) {
  const params = new URLSearchParams(window.location.search);
  const txnId = params.get("txnid");
  if (txnId) {
    orderRef.textContent = txnId;
  }
}

const planLabel = document.querySelector("[data-plan-label]");
if (planLabel) {
  const params = new URLSearchParams(window.location.search);
  const planId = params.get("plan");
  if (planId && autosheetsPlans[planId]) {
    planLabel.textContent = `${autosheetsPlans[planId].title} · ${autosheetsPlans[planId].price}`;
  }
}

const failureStatus = document.querySelector("[data-failure-status]");
if (failureStatus) {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const message = params.get("message");
  if (status) {
    failureStatus.textContent = `Current status: ${status}${message ? ` (${message})` : ""}. Please retry checkout or contact support if money was debited but access has not been issued.`;
  }
}
