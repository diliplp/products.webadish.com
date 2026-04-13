const {
  PLAN_CATALOG,
  buildAuthHeader,
  getBaseUrl,
  getDateHeader,
  getPaymentsUrl,
  isValidEmail,
  looksLikeRealMessage,
  looksLikeRealName,
  makeTxnId,
  readJsonBody,
  sendJson,
} = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const key = process.env.PAYU_KEY;
  const merchantSecret = process.env.PAYU_MERCHANT_SECRET;
  const accountId = process.env.PAYU_ACCOUNT_ID;

  if (!key || !merchantSecret || !accountId) {
    return sendJson(res, 500, { error: "PayU is not fully configured." });
  }

  try {
    const body = await readJsonBody(req);
    const {
      plan,
      name,
      email,
      phone = "",
      website = "",
      company = "",
      notes = "",
      fax_number = "",
      form_started_at,
    } = body || {};

    if (fax_number) {
      return sendJson(res, 200, { success: true });
    }

    const startedAt = typeof form_started_at === "number" ? form_started_at : Number(form_started_at);
    const age = Date.now() - startedAt;
    if (!startedAt || age < 3000 || age > 24 * 60 * 60 * 1000) {
      return sendJson(res, 200, { success: true });
    }

    const selectedPlan = PLAN_CATALOG[plan];
    if (!selectedPlan) {
      return sendJson(res, 400, { error: "Unknown plan selected." });
    }

    if (!looksLikeRealName(name) || !isValidEmail(email) || !looksLikeRealMessage(notes)) {
      return sendJson(res, 200, { success: true });
    }

    const txnId = makeTxnId(selectedPlan.id);
    const baseUrl = getBaseUrl(req);

    const payload = {
      txnId,
      intent: "sale",
      paymentData: {
        paymentChargeSpecification: {
          price: selectedPlan.amount,
          currency: selectedPlan.currency,
        },
      },
      productInfo: {
        paymentParts: [
          {
            name: selectedPlan.title,
            value: selectedPlan.amount,
            merchantAccessKey: key,
            commission: 0,
          },
        ],
      },
      additionalInfo: {
        udf1: selectedPlan.id,
        udf2: website.trim().slice(0, 200),
        udf3: company.trim().slice(0, 120),
        udf4: notes.trim().slice(0, 250),
        udf5: "products.webadish.com",
        txnS2sFlow: 4,
      },
      merchant: {
        successAction: `${baseUrl}/api/payu/complete?status=success&txnid=${encodeURIComponent(txnId)}&plan=${encodeURIComponent(selectedPlan.id)}`,
        failureAction: `${baseUrl}/api/payu/complete?status=failure&txnid=${encodeURIComponent(txnId)}&plan=${encodeURIComponent(selectedPlan.id)}`,
        cancelAction: `${baseUrl}/api/payu/complete?status=cancelled&txnid=${encodeURIComponent(txnId)}&plan=${encodeURIComponent(selectedPlan.id)}`,
        notificationUrl: `${baseUrl}/api/payu/complete?status=notify&txnid=${encodeURIComponent(txnId)}&plan=${encodeURIComponent(selectedPlan.id)}`,
      },
      customer: {
        firstName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      },
      udfParameters: {
        udf1: selectedPlan.id,
      },
      accountId,
      referenceId: txnId,
    };

    const payloadString = JSON.stringify(payload);
    const date = getDateHeader();
    const auth = buildAuthHeader(payloadString, date, merchantSecret, key);

    const payuResponse = await fetch(getPaymentsUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        date,
        authorization: auth,
      },
      body: payloadString,
    });

    const payuData = await payuResponse.json().catch(() => null);
    if (!payuResponse.ok || !payuData?.result?.checkoutUrl) {
      console.error("PayU create payment failed", payuData);
      return sendJson(res, 502, {
        error: "Unable to start payment right now.",
        debug: process.env.NODE_ENV !== "production" ? payuData : undefined,
      });
    }

    return sendJson(res, 200, {
      success: true,
      checkoutUrl: payuData.result.checkoutUrl,
      txnId,
      plan: selectedPlan.id,
    });
  } catch (error) {
    console.error("PayU create-order error", error);
    return sendJson(res, 500, { error: "Unable to start payment right now." });
  }
};
