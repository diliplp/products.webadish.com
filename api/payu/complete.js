const {
  PLAN_CATALOG,
  buildAuthHeader,
  getBaseUrl,
  getDateHeader,
  getVerifyUrl,
  redirect,
} = require("./_lib");

module.exports = async function handler(req, res) {
  const key = process.env.PAYU_KEY;
  const merchantSecret = process.env.PAYU_MERCHANT_SECRET;

  if (!key || !merchantSecret) {
    return redirect(res, `/products/autosheets-google-sheets/checkout/failed/?reason=config`);
  }

  const baseUrl = getBaseUrl(req);
  const status = (req.query.status || "failure").toString();
  const txnId = (req.query.txnid || req.body?.txnid || req.body?.txnid?.toString?.() || "").toString();
  const planId = (req.query.plan || req.body?.udf1 || "").toString();
  const fallbackPlan = PLAN_CATALOG[planId];

  if (!txnId) {
    return redirect(res, `${baseUrl}/products/autosheets-google-sheets/checkout/failed/?reason=missing-order`);
  }

  try {
    const verifyPayload = JSON.stringify({ txnId: [txnId] });
    const date = getDateHeader();
    const auth = buildAuthHeader(verifyPayload, date, merchantSecret, key);

    const verifyResponse = await fetch(getVerifyUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        date,
        authorization: auth,
        merchantid: key,
        "txnid": txnId,
      },
      body: verifyPayload,
    });

    const verifyData = await verifyResponse.json().catch(() => null);
    const result = verifyData?.result?.[txnId] || verifyData?.result?.[0] || null;
    const transactionStatus = (result?.transactionStatus || result?.status || "").toString().toLowerCase();
    const payuId = result?.mihpayid || result?.paymentId || "";
    const plan = PLAN_CATALOG[result?.udf1 || planId] || fallbackPlan;
    const email = encodeURIComponent(result?.addedon || "");

    if (verifyResponse.ok && ["success", "captured", "settled"].includes(transactionStatus)) {
      const query = new URLSearchParams({
        txnid: txnId,
        plan: plan ? plan.id : planId,
        payuid: String(payuId || ""),
      });
      return redirect(res, `${baseUrl}/products/autosheets-google-sheets/checkout/success/?${query.toString()}`);
    }

    const failureQuery = new URLSearchParams({
      txnid: txnId,
      plan: plan ? plan.id : planId,
      status: status || transactionStatus || "failed",
    });
    if (email) {
      failureQuery.set("meta", email);
    }
    return redirect(res, `${baseUrl}/products/autosheets-google-sheets/checkout/failed/?${failureQuery.toString()}`);
  } catch (error) {
    console.error("PayU verification failed", error);
    const failureQuery = new URLSearchParams({
      txnid: txnId,
      plan: planId,
      status,
    });
    return redirect(res, `${baseUrl}/products/autosheets-google-sheets/checkout/failed/?${failureQuery.toString()}`);
  }
};
