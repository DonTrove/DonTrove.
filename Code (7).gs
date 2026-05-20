// ================================================
//  DON TROVE — Google Apps Script Backend
//  Code.gs
//
//  SETUP INSTRUCTIONS:
//  1. Open Google Sheets → Extensions → Apps Script
//  2. Paste this entire file as Code.gs
//  3. Create two sheets named exactly:
//       "Products"  — columns: Name | Description | Price | Stock | Active
//       "Orders"    — columns auto-created on first order
//  4. Deploy → New deployment → Web app
//       Execute as: Me
//       Who has access: Anyone
//  5. Copy the deployment URL into app.js (APPS_SCRIPT_URL)
// ================================================

const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

// ── CORS HELPER ──────────────────────────────────
function corsOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET (products list) ───────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action || "getProducts";
    if (action === "getProducts") {
      return corsOutput(getProducts());
    }
    return corsOutput({ error: "Unknown action" });
  } catch (err) {
    return corsOutput({ error: err.message });
  }
}

// ── POST (order submission) ───────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "submitOrder";
    if (action === "submitOrder") {
      return corsOutput(submitOrder(payload));
    }
    return corsOutput({ error: "Unknown action" });
  } catch (err) {
    return corsOutput({ error: err.message });
  }
}

// ── GET PRODUCTS ──────────────────────────────────
function getProducts() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("Products");

  // Auto-create Products sheet with sample data if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet("Products");
    sheet.appendRow(["Name", "Description", "Price", "Stock", "Active"]);
    sheet.appendRow(["Misfah Key Pin", "Enamel pin — the iconic Le Trésor de Misfah key, limited edition.", "OMR 12.500", 20, true]);
    sheet.appendRow(["Silver Gear Brooch", "Handcrafted sterling silver brooch with steampunk gears.", "OMR 28.000", 8, true]);
    sheet.appendRow(["Treble Clef Charm", "Iridescent holographic charm inspired by musical heritage.", "OMR 9.500", 15, true]);
    // Style headers
    sheet.getRange("A1:E1").setFontWeight("bold").setBackground("#f48fb1").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const nameIdx  = headers.indexOf("name");
  const descIdx  = headers.indexOf("description");
  const priceIdx = headers.indexOf("price");
  const stockIdx = headers.indexOf("stock");
  const activeIdx = headers.indexOf("active");

  const products = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const isActive = activeIdx === -1 || row[activeIdx] === true || row[activeIdx] === "TRUE" || row[activeIdx] === "true";
    if (!isActive) continue;
    products.push({
      name:        nameIdx  !== -1 ? row[nameIdx]  : "",
      description: descIdx  !== -1 ? row[descIdx]  : "",
      price:       priceIdx !== -1 ? row[priceIdx] : "",
      stock:       stockIdx !== -1 ? Number(row[stockIdx]) : 99,
    });
  }

  return { success: true, products };
}

// ── SUBMIT ORDER ──────────────────────────────────
function submitOrder(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName("Orders");

  // Auto-create Orders sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet("Orders");
    const headers = ["Timestamp", "Name", "Email", "Phone", "Product", "Quantity", "Country", "Notes", "Status"];
    sheet.appendRow(headers);
    sheet.getRange("A1:I1").setFontWeight("bold").setBackground("#f48fb1").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(8, 280);
  }

  // Validate required fields
  if (!data.name || !data.email || !data.product) {
    return { success: false, error: "Missing required fields: name, email, product." };
  }

  // Append order row
  sheet.appendRow([
    data.timestamp || new Date().toISOString(),
    data.name,
    data.email,
    data.phone     || "",
    data.product,
    data.qty       || 1,
    data.country   || "",
    data.notes     || "",
    "New",          // Default status — change to Confirmed / Shipped etc.
  ]);

  // Optional: Send confirmation email to customer
  try {
    MailApp.sendEmail({
      to: data.email,
      subject: "✦ Your Don Trove Order — Le Trésor de Misfah",
      htmlBody: buildConfirmationEmail(data),
    });
  } catch (mailErr) {
    // Email sending is optional; don't fail the order if it fails
    console.warn("Email send failed:", mailErr.message);
  }

  // Optional: Notify yourself
  try {
    const ownerEmail = Session.getActiveUser().getEmail();
    if (ownerEmail) {
      MailApp.sendEmail({
        to: ownerEmail,
        subject: `[Don Trove] New Order from ${data.name}`,
        body: `New order received:\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone}\nProduct: ${data.product}\nQty: ${data.qty}\nCountry: ${data.country}\nNotes: ${data.notes}\nTime: ${data.timestamp}`,
      });
    }
  } catch (_) {}

  return { success: true, message: "Order received!" };
}

// ── EMAIL TEMPLATE ────────────────────────────────
function buildConfirmationEmail(data) {
  return `
  <div style="font-family:'Georgia',serif;max-width:560px;margin:0 auto;padding:40px 20px;color:#2a1a20;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="font-size:2rem;font-weight:300;color:#c2185b;letter-spacing:0.08em;">Don Trove</h1>
      <p style="font-size:0.75rem;letter-spacing:0.3em;text-transform:uppercase;color:#999;">Le Trésor de Misfah</p>
    </div>
    <h2 style="font-size:1.4rem;font-weight:400;color:#2a1a20;">Thank you, ${escapeHtmlEmail(data.name)} ✦</h2>
    <p style="line-height:1.7;color:#5c3a47;margin:16px 0;">
      We have received your order and our team will be in touch shortly to confirm availability and arrange delivery.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:28px 0;">
      <tr><td style="padding:10px;border-bottom:1px solid #fce4ec;color:#8d6472;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;">Product</td>
          <td style="padding:10px;border-bottom:1px solid #fce4ec;font-weight:600;">${escapeHtmlEmail(data.product)}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid #fce4ec;color:#8d6472;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;">Quantity</td>
          <td style="padding:10px;border-bottom:1px solid #fce4ec;">${escapeHtmlEmail(String(data.qty))}</td></tr>
      <tr><td style="padding:10px;border-bottom:1px solid #fce4ec;color:#8d6472;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;">Ship To</td>
          <td style="padding:10px;border-bottom:1px solid #fce4ec;">${escapeHtmlEmail(data.country)}</td></tr>
    </table>
    <p style="line-height:1.7;color:#5c3a47;">
      If you have any questions, simply reply to this email. We look forward to sharing our treasures with you.
    </p>
    <p style="margin-top:32px;color:#c2185b;font-size:0.8rem;letter-spacing:0.15em;">✦ THE DON TROVE TEAM</p>
  </div>
  `;
}

function escapeHtmlEmail(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
