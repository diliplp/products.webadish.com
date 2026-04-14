const {
  PLAN_CATALOG,
  buildAuthHeader,
  escapeHtml,
  getBaseUrl,
  getDateHeader,
  getVerifyUrl,
  redirect,
  sendResendEmail,
} = require("./_lib");

function getBuyerEmail(req) {
  return (req.query.buyer_email || req.body?.email || "").toString();
}

function getBuyerName(req) {
  return (req.query.buyer_name || req.body?.firstname || req.body?.name || "there").toString();
}

function findTransactionResult(verifyData, txnId) {
  if (!verifyData) return null;

  if (verifyData?.result && !Array.isArray(verifyData.result) && verifyData.result[txnId]) {
    return verifyData.result[txnId];
  }

  if (verifyData?.transaction_details && verifyData.transaction_details[txnId]) {
    return verifyData.transaction_details[txnId];
  }

  if (Array.isArray(verifyData?.result)) {
    return verifyData.result.find((entry) => {
      const entryTxnId = (entry?.txnId || entry?.txnid || "").toString();
      return entryTxnId === txnId;
    }) || verifyData.result[0] || null;
  }

  return null;
}

async function sendOrderEmails({ plan, txnId, payuId, buyerEmail, buyerName, transactionStatus }) {
  const fromEmail = process.env.PRODUCTS_FROM_EMAIL;
  const fromName = process.env.PRODUCTS_FROM_NAME || "WebAdish Products";
  const orderTo = process.env.PRODUCTS_ORDER_TO_EMAIL || "support@webadish.com";

  if (!fromEmail) {
    console.warn("Skipping order emails because PRODUCTS_FROM_EMAIL is not configured");
    return;
  }

  const safePlan = plan ? escapeHtml(plan.title) : "AutoSheets Pro";
  const safeBuyerName = escapeHtml(buyerName || "there");
  const safeBuyerEmail = escapeHtml(buyerEmail);
  const safeTxnId = escapeHtml(txnId);
  const safePayuId = escapeHtml(String(payuId || ""));
  const safeStatus = escapeHtml(transactionStatus);
  const hasPayuId = Boolean(String(payuId || "").trim());
  const orderDetailsHtml = `
      <p style="margin:0 0 8px;"><strong>Order reference:</strong> ${safeTxnId}</p>
      ${hasPayuId ? `<p style="margin:0;"><strong>PayU payment ID:</strong> ${safePayuId}</p>` : ""}
  `;
  const orderDetailsText = `Order reference: ${txnId}${hasPayuId ? `\nPayU payment ID: ${payuId}` : ""}`;

  await sendResendEmail({
    from: `${fromName} <${fromEmail}>`,
    to: orderTo,
    replyTo: buyerEmail || undefined,
    subject: `New AutoSheets paid order: ${plan ? plan.title : "Unknown plan"} (${txnId})`,
    text: `New AutoSheets order\n\nPlan: ${plan ? plan.title : "Unknown"}\nBuyer: ${buyerName}\nEmail: ${buyerEmail}\n${orderDetailsText}\nStatus: ${transactionStatus}\n\nPlease send the Pro plugin fulfilment and license details.`,
    html: `
      <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#162033;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden;">
          <div style="padding:22px 24px;background:#0c1728;color:#ffffff;">
            <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9fb5d1;">WebAdish Products</p>
            <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">New AutoSheets paid order</h1>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;"><strong>Plan:</strong> ${safePlan}</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;"><strong>Buyer:</strong> ${safeBuyerName}</p>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;"><strong>Email:</strong> ${safeBuyerEmail}</p>
            <div style="margin:18px 0;padding:16px;border-radius:14px;background:#f6f9fd;border:1px solid #dbe4f0;">
              ${orderDetailsHtml}
            </div>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.7;"><strong>Status:</strong> ${safeStatus}</p>
            <p style="margin:0;font-size:15px;line-height:1.7;"><strong>Next step:</strong> Send the Pro plugin fulfilment and license details.</p>
          </div>
        </div>
      </div>
    `,
  });

  if (!buyerEmail) return;

  await sendResendEmail({
    from: `${fromName} <${fromEmail}>`,
    to: buyerEmail,
    replyTo: orderTo,
    subject: `Your AutoSheets Pro order is confirmed (${txnId})`,
    text: `Hi ${buyerName || "there"},\n\nWe received your payment for ${plan ? plan.title : "AutoSheets Pro"}.\n\n${orderDetailsText}\n\nYour Pro plugin fulfilment details will be emailed shortly.\n\nIf you need help, reply to this email.\n\nRegards,\nWebAdish Products`,
    html: `
      <div style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#162033;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden;">
          <div style="padding:22px 24px;background:#0c1728;color:#ffffff;">
            <p style="margin:0;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9fb5d1;">WebAdish Products</p>
            <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">Your AutoSheets Pro order is confirmed.</h1>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">Hi ${safeBuyerName},</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">We received your payment for <strong>${safePlan}</strong>.</p>
            <div style="margin:18px 0;padding:16px;border-radius:14px;background:#f6f9fd;border:1px solid #dbe4f0;">
              ${orderDetailsHtml}
            </div>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">Your Pro plugin fulfilment details will be emailed shortly.</p>
            <p style="margin:0;font-size:15px;line-height:1.7;">If you need help in the meantime, just reply to this email.</p>
          </div>
        </div>
      </div>
    `,
  });
}

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
  const buyerEmail = getBuyerEmail(req);
  const buyerName = getBuyerName(req);

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
        "merchantid": key,
        "Info-Command": "verify_payment",
      },
      body: verifyPayload,
    });

    const verifyData = await verifyResponse.json().catch(() => null);
    const result = findTransactionResult(verifyData, txnId);
    const transactionStatus = (
      result?.transactionStatus ||
      result?.status ||
      result?.unmappedstatus ||
      result?.unmappedStatus ||
      ""
    ).toString().toLowerCase();
    const rawStatus = (result?.status || "").toString().toLowerCase();
    const rawUnmappedStatus = (
      result?.unmappedStatus ||
      result?.unmappedstatus ||
      ""
    ).toString().toLowerCase();
    const resultMessage = (result?.message || verifyData?.message || "").toString();
    const payuId = result?.mihpayid || result?.mihpayid?.toString?.() || result?.paymentId || "";
    const plan = PLAN_CATALOG[result?.udf1 || result?.udf_1 || planId] || fallbackPlan;
    const paymentState =
      rawStatus === "success" ||
      ["success", "captured", "settled", "auth"].includes(rawUnmappedStatus) ||
      ["success", "captured", "settled", "auth"].includes(transactionStatus);

    console.log("PayU verify result", {
      txnId,
      rawStatus,
      rawUnmappedStatus,
      transactionStatus,
      resultMessage,
      payuId,
    });

    if (verifyResponse.ok && paymentState) {
      if (status !== "notify") {
        try {
          await sendOrderEmails({
            plan,
            txnId,
            payuId,
            buyerEmail,
            buyerName,
            transactionStatus,
          });
        } catch (error) {
          console.error("Order email sending failed", error);
        }
      }

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
      status: rawStatus || rawUnmappedStatus || status || transactionStatus || "failed",
    });
    if (resultMessage) {
      failureQuery.set("message", resultMessage.slice(0, 120));
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
