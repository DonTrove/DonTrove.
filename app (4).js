/* ================================================
   DON TROVE — app.js
   Handles: sparkles, product fetch, order submit
   ================================================ */

// ── CONFIG ──────────────────────────────────────
// Replace this with your deployed Google Apps Script Web App URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";

// ── SPARKLE CANVAS ──────────────────────────────
(function initSparkles() {
  const canvas = document.getElementById("sparkle-canvas");
  const ctx = canvas.getContext("2d");
  let W, H, sparks = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function randomSpark() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 3 + 1,
      opacity: Math.random(),
      speed: Math.random() * 0.008 + 0.003,
      phase: Math.random() * Math.PI * 2,
      arms: Math.random() > 0.5 ? 4 : 6,
    };
  }

  for (let i = 0; i < 90; i++) sparks.push(randomSpark());

  function drawSpark(s, t) {
    const op = (Math.sin(t * s.speed + s.phase) + 1) / 2 * s.opacity;
    ctx.save();
    ctx.globalAlpha = op * 0.8;
    ctx.translate(s.x, s.y);
    ctx.strokeStyle = "#e91e8c";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const r = s.size;
    for (let a = 0; a < s.arms * 2; a++) {
      const angle = (a * Math.PI) / s.arms;
      const len = a % 2 === 0 ? r : r * 0.35;
      a === 0 ? ctx.moveTo(Math.cos(angle) * len, Math.sin(angle) * len)
              : ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  let t = 0;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    t++;
    sparks.forEach(s => drawSpark(s, t));
    requestAnimationFrame(loop);
  }
  loop();
})();

// ── SCROLL HELPERS ───────────────────────────────
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}
function scrollToOrder() { scrollToSection("order"); }

// ── PRODUCTS ─────────────────────────────────────
async function loadProducts() {
  const grid = document.getElementById("product-grid");
  const select = document.getElementById("product");

  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=getProducts`);
    const data = await res.json();

    if (!data.products || data.products.length === 0) {
      grid.innerHTML = `<p class="product-loading" style="grid-column:1/-1;padding:60px;text-align:center;color:var(--text-light)">No products listed yet. Check back soon ✦</p>`;
      return;
    }

    grid.innerHTML = "";
    data.products.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";
      const stockClass = p.stock === 0 ? "out" : p.stock < 5 ? "low" : "";
      const stockLabel = p.stock === 0 ? "Sold Out" : p.stock < 5 ? `Only ${p.stock} left` : `${p.stock} in stock`;
      card.innerHTML = `
        <span class="product-badge">✦ Featured</span>
        <div class="product-name">${escHtml(p.name)}</div>
        <div class="product-desc">${escHtml(p.description || "")}</div>
        <div class="product-price">${escHtml(p.price || "")}</div>
        <div class="product-stock ${stockClass}">${stockLabel}</div>
        <button class="product-order-btn" ${p.stock === 0 ? "disabled" : ""}
          onclick="selectProduct('${escHtml(p.name)}')">
          ${p.stock === 0 ? "Sold Out" : "✦ Order This Piece"}
        </button>
      `;
      grid.appendChild(card);

      // Populate form select
      if (p.stock > 0) {
        const opt = document.createElement("option");
        opt.value = p.name;
        opt.textContent = `${p.name} — ${p.price}`;
        select.appendChild(opt);
      }
    });
  } catch (err) {
    console.error("Failed to load products:", err);
    grid.innerHTML = `<p class="product-loading" style="grid-column:1/-1;padding:60px;text-align:center;color:var(--text-light)">
      Could not load collection. Please ensure the Apps Script is deployed and APPS_SCRIPT_URL is set in app.js.
    </p>`;
  }
}

function selectProduct(name) {
  const select = document.getElementById("product");
  for (let o of select.options) {
    if (o.value === name) { o.selected = true; break; }
  }
  scrollToSection("order");
}

// ── ORDER SUBMIT ──────────────────────────────────
async function submitOrder(e) {
  e.preventDefault();
  const btn = document.getElementById("submit-btn");
  const btnText = document.getElementById("btn-text");
  const btnLoader = document.getElementById("btn-loader");

  btnText.classList.add("hidden");
  btnLoader.classList.remove("hidden");
  btn.disabled = true;

  const payload = {
    action: "submitOrder",
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    product: document.getElementById("product").value,
    qty: document.getElementById("qty").value,
    country: document.getElementById("country").value.trim(),
    notes: document.getElementById("notes").value.trim(),
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("order-form").classList.add("hidden");
      document.getElementById("form-success").classList.remove("hidden");
    } else {
      throw new Error(data.error || "Unknown error");
    }
  } catch (err) {
    console.error("Order submission failed:", err);
    alert("There was an issue submitting your order. Please try again or contact us directly.");
  } finally {
    btnText.classList.remove("hidden");
    btnLoader.classList.add("hidden");
    btn.disabled = false;
  }
}

function resetForm() {
  document.getElementById("order-form").reset();
  document.getElementById("order-form").classList.remove("hidden");
  document.getElementById("form-success").classList.add("hidden");
}

// ── ESCAPE HTML ───────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── INIT ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
});
