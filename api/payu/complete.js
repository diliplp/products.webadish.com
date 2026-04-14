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

  await sendResendEmail({
    from: `${fromName} <${fromEmail}>`,
    to: orderTo,
    replyTo: buyerEmail || undefined,
    subject: `New AutoSheets paid order: ${plan ? plan.title : "Unknown plan"} (${txnId})`,
    text: `New AutoSheets order\n\nPlan: ${plan ? plan.title : "Unknown"}\nBuyer: ${buyerName}\nEmail: ${buyerEmail}\nTxn ID: ${txnId}\nPayU ID: ${payuId}\nStatus: ${transactionStatus}\n\nManual fulfilment is required.`,
    html: `
      <h2>New AutoSheets paid order</h2>
      <p><strong>Plan:</strong> ${safePlan}</p>
      <p><strong>Buyer:</strong> ${safeBuyerName}</p>
      <p><strong>Email:</strong> ${safeBuyerEmail}</p>
      <p><strong>Transaction ID:</strong> ${safeTxnId}</p>
      <p><strong>PayU Payment ID:</strong> ${safePayuId}</p>
      <p><strong>Status:</strong> ${safeStatus}</p>
      <p><strong>Action:</strong> Send the Pro plugin fulfilment email and license details manually.</p>
    `,
  });

  if (!buyerEmail) return;

  await sendResendEmail({
    from: `${fromName} <${fromEmail}>`,
    to: buyerEmail,
    replyTo: orderTo,
    subject: `Your AutoSheets Pro order is confirmed (${txnId})`,
    text: `Hi ${buyerName || "there"},\n\nWe received your payment for ${plan ? plan.title : "AutoSheets Pro"}.\n\nOrder reference: ${txnId}\nPayU reference: ${payuId}\n\nThe WebAdish team will email your plugin fulfilment and license details shortly.\n\nIf you need help, reply to this email.\n\nRegards,\nWebAdish Products`,
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
              <p style="margin:0 0 8px;"><strong>Order reference:</strong> ${safeTxnId}</p>
              <p style="margin:0;"><strong>PayU payment ID:</strong> ${safePayuId}</p>
            </div>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">The WebAdish team will email your Pro plugin fulfilment and license details shortly. This first version of checkout uses manual fulfilment after verified payment.</p>
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
    const result = verifyData?.result?.[txnId] || verifyData?.transaction_details?.[txnId] || null;
    const transactionStatus = (
      result?.transactionStatus ||
      result?.status ||
      result?.unmappedstatus ||
      result?.unmappedStatus ||
      ""
    ).toString().toLowerCase();
    const payuId = result?.mihpayid || result?.mihpayid?.toString?.() || result?.paymentId || "";
    const plan = PLAN_CATALOG[result?.udf1 || result?.udf_1 || planId] || fallbackPlan;
    const paymentState = ["success", "captured", "settled"].includes(transactionStatus);

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
      status: status || transactionStatus || "failed",
    });
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
