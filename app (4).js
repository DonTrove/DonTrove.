/**
 * Don Trove — app.js
 * Multi-image carousel | Color swatches | Size selector with per-size pricing
 */

const CONFIG = {
  SHEET_URL:    "https://script.google.com/macros/s/AKfycbzEBnEeK8tf2a-gfEIpC6brmFC4hKLodlmTRJI9K8TR6zH4z4zBDI_cfdi8NJsxySL9HA/exec",
  DELIVERY_FEE: 200,
  GIFT_WRAP:    300,
};

// ── Named colour palette ──────────────────────────────────────────────────────
// In your Google Sheet, put any of these names (or raw hex/CSS) in the Colors column.
// Multiple colours separated by commas: "Light Pink, Light Blue, Mint Green, Multi"
const COLOUR_MAP = {
  // Pinks
  "rose":         "#C9697E",
  "light pink":   "#F9C6D4",
  "blush pink":   "#F5A8BC",
  "dusty rose":   "#E8A4B8",
  "hot pink":     "#F06090",
  "pink":         "#F5A8BC",
  // Reds
  "light red":    "#F4A0A0",
  "coral":        "#F2836B",
  "red":          "#E05555",
  "berry":        "#9B2A4A",
  // Blues
  "light blue":   "#B3D9F2",
  "sky blue":     "#7EC8E3",
  "periwinkle":   "#A8B8F0",
  "navy":         "#3A5A8C",
  "blue":         "#7EC8E3",
  // Greens
  "light green":  "#B5E8D5",
  "mint green":   "#B5E8D5",
  "mint":         "#B5E8D5",
  "sage green":   "#A8D8B9",
  "sage":         "#A8D8B9",
  "pistachio":    "#C8E8C0",
  "green":        "#6DBE8C",
  // Purples
  "lilac":        "#D4B8F0",
  "lavender":     "#C2A8E8",
  "purple":       "#9B72CF",
  "violet":       "#B090E0",
  // Neutrals & warm
  "peach":        "#FBCBA8",
  "butter":       "#FAE8A0",
  "yellow":       "#F5DC6A",
  "ivory":        "#F8F0E8",
  "white":        "#F8F8F8",
  "black":        "#2C2C2C",
  "grey":         "#C0B8B8",
  "gray":         "#C0B8B8",
  "beige":        "#F0DEC8",
  "brown":        "#A07858",
  "gold":         "#E8C870",
  "champagne":    "#F5E6C8",
  // Special — "multi" renders as a conic rainbow gradient via CSS class
  "multi":        "__MULTI__",
};

let allProducts    = [];
let cart           = [];
let activeCategory = "All";
let giftWrap       = false;
let selectedPayment= "Cash on Delivery";

// Per-card state (keyed by filtered grid index)
const carouselState  = {};
const selectedColors = {};
const selectedSizes  = {};

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  renderCart();
  updateCartBadge();

  document.addEventListener("click", (e) => {
    const btn = document.getElementById("hamburgerBtn");
    const dd  = document.getElementById("catDropdown");
    if (dd && btn && !btn.contains(e.target) && !dd.contains(e.target)) {
      dd.classList.remove("open");
    }
  });
});

function toggleCatMenu() {
  document.getElementById("catDropdown")?.classList.toggle("open");
}

// ── Load Products ─────────────────────────────────────────────────────────────
async function loadProducts() {
  const grid = document.getElementById("productsGrid");
  grid.innerHTML = `<div class="loading-wrap"><div class="spinner"></div><p>Loading beautiful gifts…</p></div>`;

  try {
    const res  = await fetch(`${CONFIG.SHEET_URL}?t=${Date.now()}`);
    const data = await res.json();
    allProducts = Array.isArray(data) ? data : (data.products || []);

    if (allProducts.length === 0) {
      grid.innerHTML = `<p style="text-align:center;color:var(--muted);padding:60px 20px;grid-column:1/-1;">No products found.</p>`;
      return;
    }

    buildCategoryTabs();
    renderProducts();
  } catch (err) {
    console.error(err);
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
      document.getElementById("catDropdown")?.classList.remove("open");
      renderProducts();
    };
    tabsRow.appendChild(btn);
  });
}

// ── Get Filtered List ─────────────────────────────────────────────────────────
function getFiltered() {
  const query = (document.getElementById("searchInput")?.value || "").toLowerCase();
  return allProducts.filter(p => {
    const matchCat    = activeCategory === "All" || p.category === activeCategory;
    const matchSearch = !query ||
      (p.name || "").toLowerCase().includes(query) ||
      (p.description || "").toLowerCase().includes(query);
    return matchCat && matchSearch;
  });
}

// ── Render Products ───────────────────────────────────────────────────────────
function renderProducts() {
  const filtered = getFiltered();
  const grid     = document.getElementById("productsGrid");

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="text-align:center;color:var(--muted);padding:60px 20px;grid-column:1/-1;font-style:italic;">No gifts match your search.</p>`;
    return;
  }

  grid.innerHTML = filtered.map((p, i) => {
    // ── Images ──
    const images = (p.images && p.images.length > 0)
      ? p.images
      : (p.imageUrl ? p.imageUrl.split(',').map(u => u.trim()).filter(Boolean) : []);

    const carKey = `prod-${i}`;
    carouselState[carKey] = 0;
    const hasMany = images.length > 1;

    const slides = images.map((url, si) => `
      <img
        src="${escHtml(url)}"
        alt="${escHtml(p.name)} ${si + 1}"
        class="carousel-slide${si === 0 ? ' active' : ''}"
        loading="lazy"
        onerror="this.style.display='none'"
      />`).join("");

    const arrows = hasMany ? `
      <button class="carousel-arrow carousel-prev" onclick="event.stopPropagation();moveSlide('${carKey}',-1)">&#8249;</button>
      <button class="carousel-arrow carousel-next" onclick="event.stopPropagation();moveSlide('${carKey}',1)">&#8250;</button>` : "";

    const dots = hasMany ? `
      <div class="carousel-dots">
        ${images.map((_, di) => `
          <span class="carousel-dot${di === 0 ? ' active' : ''}"
            onclick="event.stopPropagation();goToSlide('${carKey}',${di})"></span>
        `).join("")}
      </div>` : "";

    // ── Colors ──
    const colorSwatches = buildColorSwatches(p.colors || p.color || "", i);

    // ── Sizes ──
    const hasSizes = p.sizes && p.sizes.length > 0;
    if (selectedSizes[i] === undefined) selectedSizes[i] = 0;
    const startPrice = hasSizes ? p.sizes[0].price : p.price;

    const sizesHtml = hasSizes ? `
      <div class="size-row">
        <span class="size-label">SIZE:</span>
        ${p.sizes.map((s, si) => `
          <button
            class="size-btn${si === 0 ? ' size-btn-active' : ''}"
            id="sizebtn-${i}-${si}"
            onclick="selectSize(${i}, ${si})"
          >${escHtml(s.label)}</button>
        `).join("")}
      </div>` : "";

    return `
      <div class="product-card" style="animation-delay:${i * 0.06}s">
        <div class="product-img-wrap" id="${carKey}">
          ${images.length > 0 ? slides : `<div class="product-img-placeholder">🎁</div>`}
          ${arrows}
          ${dots}
        </div>
        <div class="product-body">
          ${p.category ? `<div class="product-category-tag">${escHtml(p.category)}</div>` : ""}
          <div class="product-name">${escHtml(p.name)}</div>
          ${p.description ? `<div class="product-desc">${escHtml(p.description)}</div>` : ""}
          ${sizesHtml}
          ${colorSwatches}
          <div class="product-footer">
            <span class="product-price" id="price-${i}">PKR ${Number(startPrice).toLocaleString()}</span>
            <button class="add-btn" onclick="addToCart(${i}, this)">+ Add to Cart</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

// ── Size Selection ────────────────────────────────────────────────────────────
function selectSize(cardIdx, sizeIdx) {
  selectedSizes[cardIdx] = sizeIdx;
  const filtered = getFiltered();
  const product  = filtered[cardIdx];
  if (!product || !product.sizes) return;

  product.sizes.forEach((_, si) => {
    const btn = document.getElementById(`sizebtn-${cardIdx}-${si}`);
    if (btn) btn.classList.toggle("size-btn-active", si === sizeIdx);
  });

  const priceEl = document.getElementById(`price-${cardIdx}`);
  if (priceEl) priceEl.textContent = `PKR ${Number(product.sizes[sizeIdx].price).toLocaleString()}`;
}

// ── Colour Utilities ──────────────────────────────────────────────────────────
/**
 * Resolve a raw colour string from the sheet to { hex, name, isMulti }.
 * Accepts named colours from COLOUR_MAP, or raw hex/CSS values.
 */
function resolveColour(raw) {
  const trimmed = raw.trim();
  const key     = trimmed.toLowerCase();
  if (COLOUR_MAP[key]) {
    const hex = COLOUR_MAP[key];
    return { hex, name: trimmed, isMulti: hex === "__MULTI__" };
  }
  // Fall back to raw CSS value (hex, rgb, named CSS colour…)
  return { hex: trimmed, name: trimmed, isMulti: false };
}

// ── Color Swatches ────────────────────────────────────────────────────────────
function buildColorSwatches(colorStr, productIndex) {
  if (!colorStr || !String(colorStr).trim()) return "";

  const colours = String(colorStr)
    .split(",")
    .map(c => c.trim())
    .filter(Boolean)
    .map(resolveColour);

  if (colours.length === 0) return "";

  // Pre-select first colour
  if (selectedColors[productIndex] === undefined) {
    selectedColors[productIndex] = colours[0].isMulti ? "Multi" : colours[0].name;
  }

  const swatches = colours.map((c, ci) => {
    const isFirst = ci === 0;
    if (c.isMulti) {
      return `<span
        class="color-swatch swatch-multi${isFirst ? ' selected' : ''}"
        title="Multi"
        onclick="selectColor(this, ${productIndex}, 'Multi')"
      ></span>`;
    }
    return `<span
      class="color-swatch${isFirst ? ' selected' : ''}"
      style="background:${escHtml(c.hex)};"
      title="${escHtml(c.name)}"
      onclick="selectColor(this, ${productIndex}, '${escHtml(c.name)}')"
    ></span>`;
  }).join("");

  return `
    <div class="color-picker" style="margin-bottom:10px;">
      <div class="color-picker-label">Colour:</div>
      <div class="color-swatches" id="swatches-${productIndex}">${swatches}</div>
    </div>`;
}

function selectColor(el, productIndex, colorName) {
  selectedColors[productIndex] = colorName;
  const wrap = document.getElementById(`swatches-${productIndex}`);
  if (wrap) wrap.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
  el.classList.add("selected");
}

// ── Carousel Controls ─────────────────────────────────────────────────────────
function moveSlide(carKey, delta) {
  const wrap = document.getElementById(carKey);
  if (!wrap) return;
  const slides = wrap.querySelectorAll(".carousel-slide");
  const dots   = wrap.querySelectorAll(".carousel-dot");
  if (!slides.length) return;

  let cur = carouselState[carKey] || 0;
  slides[cur].classList.remove("active");
  if (dots[cur]) dots[cur].classList.remove("active");
  cur = (cur + delta + slides.length) % slides.length;
  carouselState[carKey] = cur;
  slides[cur].classList.add("active");
  if (dots[cur]) dots[cur].classList.add("active");
}

function goToSlide(carKey, index) {
  const wrap = document.getElementById(carKey);
  if (!wrap) return;
  const slides = wrap.querySelectorAll(".carousel-slide");
  const dots   = wrap.querySelectorAll(".carousel-dot");
  if (!slides.length) return;

  const cur = carouselState[carKey] || 0;
  slides[cur].classList.remove("active");
  if (dots[cur]) dots[cur].classList.remove("active");
  carouselState[carKey] = index;
  slides[index].classList.add("active");
  if (dots[index]) dots[index].classList.add("active");
}

// ── Search ────────────────────────────────────────────────────────────────────
function filterProducts() { renderProducts(); }

// ── Add to Cart ───────────────────────────────────────────────────────────────
function addToCart(gridIndex, btn) {
  const filtered = getFiltered();
  const product  = filtered[gridIndex];
  if (!product) return;

  const hasSizes  = product.sizes && product.sizes.length > 0;
  const sizeIdx   = selectedSizes[gridIndex] ?? 0;
  const sizeObj   = hasSizes ? product.sizes[sizeIdx] : null;
  const price     = hasSizes ? sizeObj.price : product.price;
  const sizeLabel = hasSizes ? sizeObj.label : null;

  const chosenColor = selectedColors[gridIndex] || null;

  const cartKey  = `${product.name}|${sizeLabel || ""}|${chosenColor || ""}`;
  const existing = cart.find(c => c._cartKey === cartKey);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, price, sizeLabel, chosenColor, qty: 1, _cartKey: cartKey });
  }

  updateCartBadge();
  showToast(`🎁 "${product.name}"${sizeLabel ? ` (${sizeLabel})` : ""} added to cart`);

  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "✓ Added";
    btn.style.background = "linear-gradient(135deg,#1A7A4A,#27ae60)";
    setTimeout(() => { btn.textContent = orig; btn.style.background = ""; }, 1200);
  }
}

// ── Cart Badge ────────────────────────────────────────────────────────────────
function updateCartBadge() {
  const count = cart.reduce((a, b) => a + b.qty, 0);
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle("show", count > 0);
}

// ── Render Cart ───────────────────────────────────────────────────────────────
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

  list.innerHTML = cart.map((item, i) => {
    const isMultiColor  = item.chosenColor === "Multi";
    const colorDotStyle = isMultiColor
      ? `background:conic-gradient(#F4A0A0 0deg 60deg,#F9C6D4 60deg 120deg,#B3D9F2 120deg 180deg,#B5E8D5 180deg 240deg,#D4B8F0 240deg 300deg,#FBE8A0 300deg 360deg);`
      : `background:${escHtml(COLOUR_MAP[item.chosenColor?.toLowerCase()] || item.chosenColor || "#ccc")};`;

    return `
    <div class="cart-item">
      <div class="cart-item-img">
        ${item.imageUrl
          ? `<img src="${escHtml(item.imageUrl)}" alt="${escHtml(item.name)}" onerror="this.style.display='none'">`
          : "🎁"}
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
          ${item.sizeLabel
            ? `<span style="font-size:0.75rem;background:var(--blush);color:var(--royal);padding:2px 9px;border-radius:10px;font-weight:500;">${escHtml(item.sizeLabel)}</span>`
            : ""}
          ${item.chosenColor
            ? `<div class="cart-item-color"><span class="cart-color-dot" style="${colorDotStyle}"></span>${escHtml(item.chosenColor)}</div>`
            : ""}
        </div>
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
    </div>`;
  }).join("");

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

// ── Order Summary ─────────────────────────────────────────────────────────────
function updateSummary() {
  const subtotal = cart.reduce((a, b) => a + Number(b.price) * b.qty, 0);
  const wrapFee  = giftWrap ? CONFIG.GIFT_WRAP : 0;
  const total    = subtotal + CONFIG.DELIVERY_FEE + wrapFee;

  const el = id => document.getElementById(id);
  if (el("summSubtotal")) el("summSubtotal").textContent = `PKR ${subtotal.toLocaleString()}`;
  if (el("summDelivery"))  el("summDelivery").textContent  = `PKR ${CONFIG.DELIVERY_FEE}`;
  if (el("summTotal"))     el("summTotal").textContent     = `PKR ${total.toLocaleString()}`;
  if (el("co-subtotal"))   el("co-subtotal").textContent   = `PKR ${subtotal.toLocaleString()}`;
  if (el("co-wrap"))       el("co-wrap").textContent       = wrapFee ? `PKR ${wrapFee}` : "—";
  if (el("co-total"))      el("co-total").textContent      = `PKR ${total.toLocaleString()}`;

  const coList = el("checkoutItemsList");
  if (coList) {
    coList.innerHTML = cart.map(item => `
      <div class="checkout-item-row">
        <div>
          <div class="checkout-item-name">
            ${escHtml(item.name)}
            ${item.sizeLabel ? `<span style="font-size:0.72rem;color:var(--muted);margin-left:4px;">(${escHtml(item.sizeLabel)})</span>` : ""}
            ${item.chosenColor ? `<span style="font-size:0.72rem;color:var(--muted);margin-left:2px;">${escHtml(item.chosenColor)}</span>` : ""}
          </div>
          <div class="checkout-item-qty">×${item.qty}</div>
        </div>
        <div class="checkout-item-price">PKR ${(Number(item.price) * item.qty).toLocaleString()}</div>
      </div>
    `).join("");
  }
}

document.addEventListener("change", e => {
  if (e.target.id === "giftWrapCheck") { giftWrap = e.target.checked; updateSummary(); }
});

// ── Checkout ──────────────────────────────────────────────────────────────────
function proceedToCheckout() {
  if (cart.length === 0) return;
  updateSummary();
  showView("checkout");
}

function selectPayment(el, method) {
  selectedPayment = method;
  document.querySelectorAll(".payment-opt").forEach(o => o.classList.remove("selected"));
  el.classList.add("selected");
}

async function placeOrder() {
  const val = id => (document.getElementById(id)?.value || "").trim();
  const senderName = val("senderName"), phone = val("phone"),
        recipientName = val("recipientName"), address = val("address"),
        deliveryDate = val("deliveryDate");

  if (!senderName || !phone || !recipientName || !address || !deliveryDate) {
    showToast("⚠️ Please fill in all required fields", true); return;
  }

  const btn = document.getElementById("placeOrderBtn");
  btn.disabled = true; btn.textContent = "Placing Order…";

  const subtotal = cart.reduce((a, b) => a + Number(b.price) * b.qty, 0);
  const wrapFee  = giftWrap ? CONFIG.GIFT_WRAP : 0;
  const total    = subtotal + CONFIG.DELIVERY_FEE + wrapFee;
  const orderRef = "DT-" + Date.now();

  const payload = {
    orderRef, dateTime: new Date().toLocaleString(),
    senderName, phone, email: val("email"),
    recipientName, address, deliveryDate,
    occasion: val("occasion"), giftMessage: val("giftMessage"),
    items: cart.map(c =>
      `${c.name}${c.sizeLabel ? ` [${c.sizeLabel}]` : ""}${c.chosenColor ? ` (${c.chosenColor})` : ""} x${c.qty} @ PKR ${c.price}`
    ).join(", "),
    subtotal, giftWrap: wrapFee, deliveryFee: CONFIG.DELIVERY_FEE,
    total, paymentMethod: selectedPayment,
  };

  try {
    await fetch(CONFIG.SHEET_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    document.getElementById("successRef").textContent = orderRef;
    cart = []; giftWrap = false;
    updateCartBadge();
    showView("success");
  } catch (err) {
    showToast("⚠️ Something went wrong. Please try again.", true);
    btn.disabled = false; btn.textContent = "✦ Confirm & Place Order";
  }
}

// ── View Switching ────────────────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${name}`)?.classList.add("active");
  document.querySelectorAll(".nav-btn:not(.cart-btn)").forEach(b => {
    b.classList.toggle("active", b.textContent.trim().toLowerCase().startsWith(name));
  });
  if (name === "cart") renderCart();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetAll() {
  cart = []; giftWrap = false;
  document.getElementById("giftWrapCheck").checked = false;
  selectedPayment = "Cash on Delivery";
  document.querySelectorAll(".payment-opt").forEach((o, i) => o.classList.toggle("selected", i === 0));
  ["senderName","phone","email","recipientName","address","deliveryDate","occasion","giftMessage"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  updateCartBadge(); renderCart(); showView("shop");
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.borderLeftColor = isError ? "#c0392b" : "var(--gold-light)";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
