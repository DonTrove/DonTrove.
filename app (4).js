/**
 * Don Trove — app.js
 * Fetches products from Google Apps Script and handles cart + orders.
 */

const CONFIG = {
  SHEET_URL:    "https://script.google.com/macros/s/AKfycbwdLxaq6fbvbTM2yNtUl0mOaodAUebJZZBdFxFaVbiXXhP3vept-ojDtcZJMkLFUwfJ1Q/exec",
  DELIVERY_FEE: 200,
  GIFT_WRAP:    300,
};

// ── State ────────────────────────────────────────────────────────────────────
let allProducts    = [];
let cart           = [];
let activeCategory = "All";
let giftWrap       = false;
let selectedPayment= "Cash on Delivery";

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  renderCart();
  updateCartBadge();
});

// ── Load Products from Apps Script ───────────────────────────────────────────
async function loadProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><p>Loading beautiful gifts…</p></div>`;

  try {
    // Append timestamp to bust cache
    const res  = await fetch(`${CONFIG.SHEET_URL}?t=${Date.now()}`);
    const data = await res.json();

    // Script returns array of objects with lowercase keys:
    // { name, price, description, imageUrl, category }
    allProducts = Array.isArray(data) ? data : (data.products || []);

    if (allProducts.length === 0) {
      grid.innerHTML = `<p style="text-align:center;color:var(--muted);padding:60px 20px;grid-column:1/-1;">No products found. Add some in your Google Sheet!</p>`;
      return;
    }

    buildCategoryTabs();
    renderProducts();

  } catch (err) {
    console.error("Failed to load products:", err);
    grid.innerHTML = `
      <div class="loading-wrap" style="grid-column:1/-1">
        <p style="color:#c0392b;margin-bottom:16px;">⚠️ Could not load products.<br/><small>${err.message}</small></p>
        <button class="checkout-btn" style="width:auto;padding:10px 28px;" onclick="loadProducts()">Try Again</button>
      </div>`;
  }
}

// ── Category Tabs ─────────────────────────────────────────────────────────────
function buildCategoryTabs() {
  const cats    = ["All", ...new Set(allProducts.map(p => p.category).filter(Boolean))];
  const tabsRow = document.getElementById("catTabs");
  tabsRow.innerHTML = "";

  cats.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "tab" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat;
    btn.onclick = () => {
      activeCategory = cat;
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderProducts();
    };
    tabsRow.appendChild(btn);
  });
}

// ── Render Product Grid ───────────────────────────────────────────────────────
function renderProducts() {
  const query    = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const grid     = document.getElementById("productsGrid");
  const meta     = document.getElementById("resultsMeta");

  const filtered = allProducts.filter(p => {
    const matchCat    = activeCategory === "All" || p.category === activeCategory;
    const matchSearch = !query ||
      (p.name || "").toLowerCase().includes(query) ||
      (p.description || "").toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  if (meta) {
    meta.innerHTML = filtered.length
      ? `Showing <strong>${filtered.length}</strong> gift${filtered.length !== 1 ? "s" : ""}`
      : "";
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="text-align:center;color:var(--muted);padding:60px 20px;grid-column:1/-1;font-style:italic;">No gifts match your search.</p>`;
    return;
  }

  grid.innerHTML = filtered.map((p, i) => `
    <div class="product-card" style="animation-delay:${i * 0.06}s">
      <div class="product-img-wrap">
        ${p.imageUrl
          ? `<img src="${escHtml(p.imageUrl)}" alt="${escHtml(p.name)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ""}
        <div class="product-img-placeholder" style="${p.imageUrl ? "display:none" : ""}">🎁</div>
      </div>
      <div class="product-body">
        ${p.category ? `<div style="font-size:0.72rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;">${escHtml(p.category)}</div>` : ""}
        <div class="product-name">${escHtml(p.name)}</div>
        ${p.description ? `<div class="product-desc">${escHtml(p.description)}</div>` : ""}
        <div class="product-footer">
          <span class="product-price">PKR ${Number(p.price).toLocaleString()}</span>
          <button class="add-btn" onclick="addToCart(${i})">+ Add to Cart</button>
        </div>
      </div>
    </div>
  `).join("");
}

// ── Search ────────────────────────────────────────────────────────────────────
function filterProducts() {
  renderProducts();
}

// ── Cart ──────────────────────────────────────────────────────────────────────
function getProductByGridIndex(i) {
  const query    = (document.getElementById("searchInput")?.value || "").toLowerCase();
  return allProducts.filter(p => {
    const matchCat    = activeCategory === "All" || p.category === activeCategory;
    const matchSearch = !query ||
      (p.name || "").toLowerCase().includes(query) ||
      (p.description || "").toLowerCase().includes(query);
    return matchCat && matchSearch;
  })[i];
}

function addToCart(gridIndex) {
  const product = getProductByGridIndex(gridIndex);
  if (!product) return;

  const existing = cart.find(c => c.name === product.name);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  updateCartBadge();
  showToast(`🎁 "${product.name}" added to cart`);

  // Flash button
  const btns = document.querySelectorAll(".add-btn");
  if (btns[gridIndex]) {
    const btn = btns[gridIndex];
    const orig = btn.textContent;
    btn.textContent = "✓ Added";
    btn.style.background = "linear-gradient(135deg,#1A7A4A,#27ae60)";
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = "";
    }, 1200);
  }
}

function updateCartBadge() {
  const count = cart.reduce((a, b) => a + b.qty, 0);
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle("show", count > 0);
}

function renderCart() {
  const list = document.getElementById("cartItemsList");
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="cart-empty">
        <span class="empty-icon">🛍️</span>
        <p>Your cart is empty.</p>
        <button class="checkout-btn" style="width:auto;padding:10px 28px;margin-top:16px;" onclick="showView('shop')">Browse Gifts</button>
      </div>`;
    document.getElementById("proceedBtn").disabled = true;
    updateSummary();
    return;
  }

  list.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.imageUrl
          ? `<img src="${escHtml(item.imageUrl)}" alt="${escHtml(item.name)}" onerror="this.style.display='none'">`
          : "🎁"}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-price">PKR ${Number(item.price).toLocaleString()} each</div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty(${i}, -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;color:var(--royal);margin-bottom:8px;">PKR ${(Number(item.price) * item.qty).toLocaleString()}</div>
        <button class="remove-btn" onclick="removeFromCart(${i})">✕ Remove</button>
      </div>
    </div>
  `).join("");

  document.getElementById("proceedBtn").disabled = false;
  updateSummary();
}

function changeQty(index, delta) {
  cart[index].qty = Math.max(1, cart[index].qty + delta);
  renderCart();
  updateCartBadge();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  updateCartBadge();
}

function updateSummary() {
  const subtotal  = cart.reduce((a, b) => a + Number(b.price) * b.qty, 0);
  const wrapFee   = giftWrap ? CONFIG.GIFT_WRAP : 0;
  const total     = subtotal + CONFIG.DELIVERY_FEE + wrapFee;

  const el = id => document.getElementById(id);
  if (el("summSubtotal")) el("summSubtotal").textContent = `PKR ${subtotal.toLocaleString()}`;
  if (el("summDelivery"))  el("summDelivery").textContent  = `PKR ${CONFIG.DELIVERY_FEE}`;
  if (el("summTotal"))     el("summTotal").textContent     = `PKR ${total.toLocaleString()}`;

  // Also update checkout sidebar
  if (el("co-subtotal")) el("co-subtotal").textContent = `PKR ${subtotal.toLocaleString()}`;
  if (el("co-wrap"))     el("co-wrap").textContent     = wrapFee ? `PKR ${wrapFee}` : "—";
  if (el("co-total"))    el("co-total").textContent    = `PKR ${total.toLocaleString()}`;

  // Populate checkout items list
  const coList = el("checkoutItemsList");
  if (coList) {
    coList.innerHTML = cart.map(item => `
      <div class="checkout-item-row">
        <div>
          <div class="checkout-item-name">${escHtml(item.name)}</div>
          <div class="checkout-item-qty">×${item.qty}</div>
        </div>
        <div class="checkout-item-price">PKR ${(Number(item.price) * item.qty).toLocaleString()}</div>
      </div>
    `).join("");
  }
}

// Gift wrap checkbox
document.addEventListener("change", e => {
  if (e.target.id === "giftWrapCheck") {
    giftWrap = e.target.checked;
    updateSummary();
  }
});

// ── Proceed to Checkout ───────────────────────────────────────────────────────
function proceedToCheckout() {
  if (cart.length === 0) return;
  updateSummary();
  showView("checkout");
}

// ── Payment Method ────────────────────────────────────────────────────────────
function selectPayment(el, method) {
  selectedPayment = method;
  document.querySelectorAll(".payment-opt").forEach(o => o.classList.remove("selected"));
  el.classList.add("selected");
}

// ── Place Order ───────────────────────────────────────────────────────────────
async function placeOrder() {
  const val = id => (document.getElementById(id)?.value || "").trim();

  const senderName    = val("senderName");
  const phone         = val("phone");
  const recipientName = val("recipientName");
  const address       = val("address");
  const deliveryDate  = val("deliveryDate");

  if (!senderName || !phone || !recipientName || !address || !deliveryDate) {
    showToast("⚠️ Please fill in all required fields", true);
    return;
  }

  const btn = document.getElementById("placeOrderBtn");
  btn.disabled = true;
  btn.textContent = "Placing Order…";

  const subtotal  = cart.reduce((a, b) => a + Number(b.price) * b.qty, 0);
  const wrapFee   = giftWrap ? CONFIG.GIFT_WRAP : 0;
  const total     = subtotal + CONFIG.DELIVERY_FEE + wrapFee;
  const orderRef  = "DT-" + Date.now();

  const payload = {
    orderRef,
    dateTime:      new Date().toLocaleString(),
    senderName,
    phone,
    email:         val("email"),
    recipientName,
    address,
    deliveryDate,
    occasion:      val("occasion"),
    giftMessage:   val("giftMessage"),
    items:         cart.map(c => `${c.name} x${c.qty}`).join(", "),
    subtotal,
    giftWrap:      wrapFee,
    deliveryFee:   CONFIG.DELIVERY_FEE,
    total,
    paymentMethod: selectedPayment,
  };

  try {
    await fetch(CONFIG.SHEET_URL, {
      method:  "POST",
      // no-cors because Apps Script doesn't return CORS headers on POST
      mode:    "no-cors",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    // Show success
    document.getElementById("successRef").textContent = orderRef;
    cart  = [];
    giftWrap = false;
    updateCartBadge();
    showView("success");

  } catch (err) {
    console.error("Order error:", err);
    showToast("⚠️ Something went wrong. Please try again.", true);
    btn.disabled    = false;
    btn.textContent = "✦ Confirm & Place Order";
  }
}

// ── View Switching ────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add("active");

  // Update nav active state
  document.querySelectorAll(".nav-btn:not(.cart-btn)").forEach(b => b.classList.remove("active"));

  if (name === "cart") renderCart();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Reset after order ─────────────────────────────────────────────────────────
function resetAll() {
  cart     = [];
  giftWrap = false;
  document.getElementById("giftWrapCheck").checked = false;
  selectedPayment = "Cash on Delivery";
  document.querySelectorAll(".payment-opt").forEach((o, i) => {
    o.classList.toggle("selected", i === 0);
  });
  // Clear form
  ["senderName","phone","email","recipientName","address","deliveryDate","occasion","giftMessage"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  updateCartBadge();
  renderCart();
  showView("shop");
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.borderLeftColor = isError ? "#c0392b" : "var(--gold)";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function id(s) { return document.getElementById(s); }
