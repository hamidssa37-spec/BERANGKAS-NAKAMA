
"use strict";

/* =====================================================
   BERANGKAS NAKAMA
   DATABASE, LOGIN, TRANSAKSI, STOK, LAPORAN
===================================================== */

const STORAGE_KEY = "berangkas_management_v2";
const SESSION_KEY = "berangkas_management_session_v2";

const STRAP_CATEGORIES = ["DE", "TEC 9", "PITON", "MEC 9", "PISTOL"];

const $ = id => document.getElementById(id);

const rupiah = value => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
}).format(Number(value || 0));

const number = value => Number(value || 0);

const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
};

function makeId() {
  return window.crypto?.randomUUID?.() ||
    "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function isStrapTransaction(type) {
  return ["Pembelian Strap", "Penjualan Strap"].includes(type);
}

function getStrapCategory(t) {
  return STRAP_CATEGORIES.includes(t.strapCategory)
    ? t.strapCategory
    : "Belum dikategorikan";
}

/* =====================================================
   DATABASE
===================================================== */

function defaultDB() {
  return {
    users: [
      {
        id: "u1",
        name: "Administrator",
        username: "admin",
        password: "admin123",
        role: "Admin"
      },
      {
        id: "u2",
        name: "Petugas",
        username: "petugas",
        password: "petugas123",
        role: "Petugas"
      }
    ],
    transactions: []
  };
}

function loadDB() {
  const initial = defaultDB();

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const data = JSON.parse(saved);

    if (!data || typeof data !== "object") {
      throw new Error("Format database tidak valid.");
    }

    const users = Array.isArray(data.users) && data.users.length
      ? data.users
      : initial.users;

    let transactions = [];

    if (Array.isArray(data.transactions)) {
      transactions = data.transactions;
    } else if (Array.isArray(data.finance)) {
      transactions = data.finance.map(item => ({
        id: item.id || makeId(),
        date: item.date || today(),
        type: item.type || "Pemasukan",
        method: item.method || "-",
        quantity: number(item.quantity),
        oilQuantity: number(item.oilQuantity),
        amount: number(item.amount),
        description: item.description || item.keterangan || "Transaksi lama",
        note: item.notes || item.note || "",
        username: item.username || "",
        userName: item.userName || item.user || "Pengguna",
        createdAt: item.createdAt || new Date().toISOString()
      }));
    }

    return { ...data, users, transactions };

  } catch (error) {
    console.error("Database gagal dibaca:", error);
    alert("Database tidak dapat dibaca. Jangan hapus data browser. Periksa Console.");
    return initial;
  }
}

let db = loadDB();
let currentUser = null;

function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return true;
  } catch (error) {
    console.error("Gagal menyimpan database:", error);
    alert("Data gagal disimpan. Periksa ruang penyimpanan browser.");
    return false;
  }
}

/* =====================================================
   HAK AKSES
===================================================== */

const PAGE_ACCESS = {
  dashboard: ["Admin"],
  transaksi: ["Admin", "Petugas"],
  riwayat: ["Admin"],
  stok: ["Admin"],
  penjualan: ["Admin"],
  laporan: ["Admin"],
  pengguna: ["Admin"]
};

function canAccessPage(page) {
  return Boolean(
    currentUser &&
    PAGE_ACCESS[page]?.includes(currentUser.role)
  );
}

function applyUserPermissions() {
  if (!currentUser) return;

  document.querySelectorAll(".nav-btn[data-page]").forEach(button => {
    const allowed = canAccessPage(button.dataset.page);
    button.classList.toggle("hidden", !allowed);
    button.disabled = !allowed;
  });

  document.querySelectorAll(".admin-only").forEach(element => {
    element.classList.toggle("hidden", currentUser.role !== "Admin");
  });
}

/* =====================================================
   HITUNG KEUANGAN DAN STOK
===================================================== */

function calculate() {
  const strapByCategory = {
    "DE": 0,
    "TEC 9": 0,
    "PITON": 0,
    "MEC 9": 0
  };

  const result = {
    cash: 0,
    oil: 0,
    strap: 0,

    income: 0,
    expense: 0,

    oilIn: 0,
    oilOut: 0,

    strapIn: 0,
    strapOut: 0,

    strapByCategory,
    strapUncategorized: 0
  };

  db.transactions.forEach(t => {
    const q = number(t.quantity);
    const oq = number(t.oilQuantity);
    const amount = number(t.amount);

    switch (t.type) {
      case "Pemasukan":
        result.cash += amount;
        result.income += amount;
        break;

      case "Pengeluaran":
        result.cash -= amount;
        result.expense += amount;
        break;

      case "Setoran Minyak":
        result.oil += q;
        result.oilIn += q;
        break;

      case "Pembelian Minyak":
        result.cash -= amount;
        result.expense += amount;
        result.oil += q;
        result.oilIn += q;
        break;

      case "Penjualan Minyak":
        result.cash += amount;
        result.income += amount;
        result.oil -= q;
        result.oilOut += q;
        break;

      case "Pembelian Strap": {
        result.strap += q;
        result.strapIn += q;

        const category = getStrapCategory(t);

        if (category === "Belum dikategorikan") {
          result.strapUncategorized += q;
        } else {
          result.strapByCategory[category] += q;
        }

        if (t.method === "Uang") {
          result.cash -= amount;
          result.expense += amount;
        } else if (t.method === "Minyak") {
          result.oil -= oq;
          result.oilOut += oq;
        }

        break;
      }

      case "Penjualan Strap": {
        result.strap -= q;
        result.strapOut += q;

        const category = getStrapCategory(t);

        if (category === "Belum dikategorikan") {
          result.strapUncategorized -= q;
        } else {
          result.strapByCategory[category] -= q;
        }

        if (t.method === "Uang") {
          result.cash += amount;
          result.income += amount;
        } else if (t.method === "Minyak") {
          result.oil += oq;
          result.oilIn += oq;
        }

        break;
      }
    }
  });

  return result;
}

/* =====================================================
   LOGIN DAN SESSION
===================================================== */

function setLoginError(message) {
  $("loginError").textContent = message;
}

function openApplication(user) {
  currentUser = user;

  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  $("topUsername").textContent = user.name;

  $("sideUser").innerHTML =
    "<b>" + escapeHTML(user.name) + "</b><br><span>" +
    escapeHTML(user.role) + "</span>";

  $("todayText").textContent = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  $("txDate").value = today();

  applyUserPermissions();

  if (user.role === "Admin") {
    showPage("dashboard");
  } else {
    showPage("transaksi");
  }

  refreshAll();
}

$("loginForm").addEventListener("submit", event => {
  event.preventDefault();

  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;

  const user = db.users.find(u =>
    String(u.username).toLowerCase() === username.toLowerCase() &&
    u.password === password
  );

  if (!user) {
    setLoginError("Username atau password salah.");
    return;
  }

  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ userId: user.id })
    );
  } catch (error) {
    console.error("Gagal menyimpan sesi:", error);
    setLoginError("Sesi login gagal disimpan. Periksa browser.");
    return;
  }

  setLoginError("");
  openApplication(user);
});

$("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem(SESSION_KEY);

  currentUser = null;

  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginForm").reset();

  setLoginError("");
});

/* =====================================================
   NAVIGASI
===================================================== */

function showPage(page) {
  if (!canAccessPage(page)) {
    page = currentUser?.role === "Petugas"
      ? "transaksi"
      : "dashboard";
  }

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle(
      "hidden",
      section.id !== "page-" + page
    );
  });

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const titles = {
    dashboard: "Dashboard Keuangan",
    transaksi: "Input Transaksi",
    riwayat: "Riwayat Transaksi",
    stok: "Stok Barang",
    penjualan: "Dashboard Penjualan",
    laporan: "Laporan",
    pengguna: "Kelola Pengguna"
  };

  $("pageTitle").textContent =
    titles[page] || "BERANGKAS NAKAMA";
}

document.querySelectorAll(".nav-btn[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const page = button.dataset.page;

    if (!canAccessPage(page)) {
      alert("Anda tidak memiliki hak akses ke halaman ini.");
      return;
    }

    showPage(page);
  });
});

/* =====================================================
   FORM TRANSAKSI
===================================================== */

function updateTransactionFields() {
  const type = $("txType").value;
  const method = $("txMethod").value;

  [
    "methodWrap",
    "quantityWrap",
    "oilQuantityWrap",
    "amountWrap",
    "strapCategoryWrap"
  ].forEach(id => {
    const element = $(id);
    if (element) element.classList.add("hidden");
  });

  $("txQuantity").required = false;
  $("txOilQuantity").required = false;
  $("txAmount").required = false;

  const categoryInput = $("txStrapCategory");

  if (categoryInput) {
    categoryInput.required = false;
  }

  if (["Pemasukan", "Pengeluaran"].includes(type)) {
    $("amountWrap").classList.remove("hidden");
    $("txAmount").required = true;
  }

  if (type === "Setoran Minyak") {
    $("quantityWrap").classList.remove("hidden");
    $("txQuantity").required = true;
  }

  if (["Pembelian Minyak", "Penjualan Minyak"].includes(type)) {
    $("quantityWrap").classList.remove("hidden");
    $("amountWrap").classList.remove("hidden");

    $("txQuantity").required = true;
    $("txAmount").required = true;
  }

  if (isStrapTransaction(type)) {
    $("methodWrap").classList.remove("hidden");
    $("quantityWrap").classList.remove("hidden");

    $("txQuantity").required = true;

    if ($("strapCategoryWrap")) {
      $("strapCategoryWrap").classList.remove("hidden");
    }

    if (categoryInput) {
      categoryInput.required = true;
    }

    if (method === "Uang") {
      $("amountWrap").classList.remove("hidden");
      $("txAmount").required = true;
    } else {
      $("oilQuantityWrap").classList.remove("hidden");
      $("txOilQuantity").required = true;
    }
  }

  const info = {
    "Pemasukan": "Uang kas bertambah.",
    "Pengeluaran": "Uang kas berkurang.",
    "Setoran Minyak": "Stok minyak bertambah tanpa mengubah uang kas.",
    "Pembelian Minyak": "Uang kas berkurang dan stok minyak bertambah.",
    "Penjualan Minyak": "Uang kas bertambah dan stok minyak berkurang.",
    "Pembelian Strap": "Pilih kategori Strap. Stok kategori tersebut akan bertambah.",
    "Penjualan Strap": "Pilih kategori Strap. Stok kategori tersebut akan berkurang."
  };

  $("txInfo").textContent = info[type] || "";
}

$("txType").addEventListener("change", updateTransactionFields);
$("txMethod").addEventListener("change", updateTransactionFields);

function showMessage(id, message, isError = false) {
  const element = $(id);
  element.textContent = message;
  element.classList.toggle("error", isError);
}

$("transactionForm").addEventListener("reset", () => {
  setTimeout(() => {
    $("txDate").value = today();
    $("txMethod").value = "Uang";

    if ($("txStrapCategory")) {
      $("txStrapCategory").value = "DE";
    }

    showMessage("txMessage", "");
    updateTransactionFields();
  }, 0);
});


$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  if (!currentUser || !canAccessPage("transaksi")) return;

  const type = $("txType").value;
  const method = $("txMethod").value;

  const quantityRaw = $("txQuantity").value.trim();
  const oilQuantityRaw = $("txOilQuantity").value.trim();
  const amountRaw = $("txAmount").value.trim();

  const quantity = Number(quantityRaw);
  const oilQuantity = Number(oilQuantityRaw);
  const amount = Number(amountRaw);

  const current = calculate();
  const strapTransaction = isStrapTransaction(type);

  const strapCategory = strapTransaction && $("txStrapCategory")
    ? $("txStrapCategory").value
    : "";

  const needsMoney =
    ["Pemasukan", "Pengeluaran", "Pembelian Minyak", "Penjualan Minyak"].includes(type) ||
    (strapTransaction && method === "Uang");

  const needsQuantity = [
    "Setoran Minyak",
    "Pembelian Minyak",
    "Penjualan Minyak",
    "Pembelian Strap",
    "Penjualan Strap"
  ].includes(type);

  const needsOilQuantity =
    strapTransaction && method === "Minyak";

  // TANGGAL
  if (!$("txDate").value) {
    return showMessage(
      "txMessage",
      "Tanggal transaksi wajib diisi.",
      true
    );
  }

  // VALIDASI NOMINAL UANG
  if (needsMoney) {
    if (
      amountRaw === "" ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      return showMessage(
        "txMessage",
        "Nominal uang tidak boleh kosong atau negatif. Masukkan 0 atau angka positif.",
        true
      );
    }
  }

  // VALIDASI JUMLAH BARANG / MINYAK
  if (needsQuantity) {
    if (
      quantityRaw === "" ||
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      return showMessage(
        "txMessage",
        "Jumlah barang tidak boleh kosong atau negatif. Masukkan 0 atau angka positif.",
        true
      );
    }
  }

  // VALIDASI JUMLAH MINYAK UNTUK TRANSAKSI STRAP
  if (needsOilQuantity) {
    if (
      oilQuantityRaw === "" ||
      !Number.isFinite(oilQuantity) ||
      oilQuantity < 0
    ) {
      return showMessage(
        "txMessage",
        "Jumlah minyak tidak boleh kosong atau negatif. Masukkan 0 atau angka positif.",
        true
      );
    }
  }

  // VALIDASI KATEGORI STRAP
  if (
    strapTransaction &&
    !STRAP_CATEGORIES.includes(strapCategory)
  ) {
    return showMessage(
      "txMessage",
      "Silakan pilih kategori Strap.",
      true
    );
  }

  // CEK UANG KAS
  if (
    ["Pengeluaran", "Pembelian Minyak"].includes(type) &&
    amount > current.cash
  ) {
    return showMessage(
      "txMessage",
      "Uang kas tidak mencukupi.",
      true
    );
  }

  // CEK STOK MINYAK
  if (
    type === "Penjualan Minyak" &&
    quantity > current.oil
  ) {
    return showMessage(
      "txMessage",
      "Stok minyak tidak mencukupi.",
      true
    );
  }

  // CEK PEMBELIAN STRAP
  if (type === "Pembelian Strap") {
    if (method === "Uang" && amount > current.cash) {
      return showMessage(
        "txMessage",
        "Uang kas tidak mencukupi.",
        true
      );
    }

    if (method === "Minyak" && oilQuantity > current.oil) {
      return showMessage(
        "txMessage",
        "Stok minyak tidak mencukupi untuk pembelian Strap.",
        true
      );
    }
  }

  // CEK STOK STRAP PER KATEGORI
  if (type === "Penjualan Strap") {
    const categoryStock = current.strapByCategory[strapCategory];

    if (quantity > categoryStock) {
      return showMessage(
        "txMessage",
        "Stok Strap kategori " + strapCategory +
        " tidak mencukupi. Stok tersedia: " +
        categoryStock + " pcs.",
        true
      );
    }
  }

  // KETERANGAN
  const description = $("txDescription").value.trim();

  if (!description) {
    return showMessage(
      "txMessage",
      "Keterangan transaksi wajib diisi.",
      true
    );
  }

  // SIMPAN TRANSAKSI
  const transaction = {
    id: makeId(),
    date: $("txDate").value,
    type,

    method: strapTransaction ? method : "-",

    quantity,
    oilQuantity: needsOilQuantity ? oilQuantity : 0,
    amount: needsMoney ? amount : 0,

    strapCategory: strapTransaction ? strapCategory : "",

    description,
    note: $("txNote").value.trim(),

    username: currentUser.username,
    userName: currentUser.name,

    createdAt: new Date().toISOString()
  };

  db.transactions.push(transaction);

  if (!saveDB()) {
    db.transactions.pop();
    return;
  }

  $("transactionForm").reset();

  showMessage("txMessage", "Transaksi berhasil disimpan.");

  refreshAll();
});

/* =====================================================
   HELPER TAMPILAN
===================================================== */

function typeBadge(type) {
  let cls = "stock";

  if (["Pemasukan", "Penjualan Minyak", "Penjualan Strap"].includes(type)) {
    cls = "in";
  }

  if (["Pengeluaran", "Pembelian Minyak", "Pembelian Strap"].includes(type)) {
    cls = "out";
  }

  return `<span class="type ${cls}">${escapeHTML(type)}</span>`;
}

function getItemName(t) {
  if (t.type.includes("Minyak")) return "Minyak";

  if (t.type.includes("Strap")) {
    return "Strap - " + getStrapCategory(t);
  }

  return "-";
}

function getQuantityText(t) {
  if (
    ["Setoran Minyak", "Pembelian Minyak", "Penjualan Minyak"].includes(t.type)
  ) {
    return number(t.quantity) + " Jerigen";
  }

  if (isStrapTransaction(t.type)) {
    const category = getStrapCategory(t);
    const main = number(t.quantity) + " pcs " + category;

    return t.method === "Minyak"
      ? main + " / " + number(t.oilQuantity) + " Jerigen Minyak"
      : main;
  }

  return "-";
}

function emptyRow(cols) {
  return `<tr><td colspan="${cols}" class="empty">Belum ada data.</td></tr>`;
}

function sortNewest(a, b) {
  return String(b.date || "").localeCompare(String(a.date || "")) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
}

/* =====================================================
   DASHBOARD
===================================================== */


function refreshDashboard() {
  const c = calculate();

  // ==============================
  // UANG KAS
  // ==============================
  $("cashBalance").textContent = rupiah(c.cash);
  $("incomeTotal").textContent = rupiah(c.income);
  $("expenseTotal").textContent = rupiah(c.expense);

  // ==============================
  // STOK MINYAK
  // ==============================
  $("dashboardOil").textContent = number(c.oil) + " Jerigen";

  if ($("dashboardOilIn")) {
    $("dashboardOilIn").textContent =
      number(c.oilIn) + " Jerigen";
  }

  if ($("dashboardOilOut")) {
    $("dashboardOilOut").textContent =
      number(c.oilOut) + " Jerigen";
  }

  // ==============================
  // STOK STRAP
  // ==============================
  $("dashboardStrap").textContent =
    number(c.strap) + " pcs";

  if ($("dashboardStrapIn")) {
    $("dashboardStrapIn").textContent =
      number(c.strapIn) + " pcs";
  }

  if ($("dashboardStrapOut")) {
    $("dashboardStrapOut").textContent =
      number(c.strapOut) + " pcs";
  }

  // ==============================
  // TOTAL TRANSAKSI
  // ==============================
  $("transactionCount").textContent =
    db.transactions.length;

  // ==============================
  // TRANSAKSI TERBARU
  // ==============================
  const rows = [...db.transactions]
    .sort(sortNewest)
    .slice(0, 8);

  $("recentRows").innerHTML = rows.length
    ? rows.map(t => `
      <tr>
        <td>${escapeHTML(t.date)}</td>
        <td>${typeBadge(t.type)}</td>
        <td>${escapeHTML(t.description)}</td>
        <td>${escapeHTML(getItemName(t))}</td>
        <td>${escapeHTML(getQuantityText(t))}</td>
        <td class="amount">
          ${t.amount ? rupiah(t.amount) : "-"}
        </td>
      </tr>
    `).join("")
    : emptyRow(6);
}

/* =====================================================
   RIWAYAT TRANSAKSI
===================================================== */

function refreshHistory() {
  const search = $("historySearch").value.toLowerCase();
  const filter = $("historyType").value;

  const rows = [...db.transactions].filter(t => {
    const text = [
      t.type,
      t.description,
      t.note,
      t.userName,
      t.method,
      getStrapCategory(t)
    ].join(" ").toLowerCase();

    return text.includes(search) &&
      (!filter || t.type === filter);
  }).sort(sortNewest);

  $("historyRows").innerHTML = rows.length ? rows.map(t => `
    <tr>
      <td>${escapeHTML(t.date)}</td>
      <td>${typeBadge(t.type)}</td>
      <td>${escapeHTML(t.method || "-")}</td>
      <td>${escapeHTML(t.description)}</td>
      <td>${escapeHTML(getQuantityText(t))}</td>
      <td class="amount">${t.amount ? rupiah(t.amount) : "-"}</td>
      <td>${escapeHTML(t.userName || t.username)}</td>
      <td>${currentUser?.role === "Admin"
        ? `<button class="btn outline" data-delete-transaction="${escapeHTML(t.id)}">Hapus</button>`
        : "-"}</td>
    </tr>
  `).join("") : emptyRow(8);

  $("historyCount").textContent = rows.length + " transaksi";
}

$("historySearch").addEventListener("input", refreshHistory);
$("historyType").addEventListener("change", refreshHistory);

$("historyRows").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-transaction]");

  if (button) {
    deleteTransaction(button.dataset.deleteTransaction);
  }
});

function deleteTransaction(id) {
  if (currentUser?.role !== "Admin") return;

  if (!confirm("Hapus transaksi ini? Saldo dan stok akan dihitung ulang.")) {
    return;
  }

  const oldTransactions = db.transactions;

  db.transactions = db.transactions.filter(t => t.id !== id);

  if (!saveDB()) {
    db.transactions = oldTransactions;
    return;
  }

  refreshAll();
}

/* =====================================================
   STOK BARANG
===================================================== */

function getStockMovements(t) {
  const result = [];

  const q = number(t.quantity);
  const oq = number(t.oilQuantity);

  if (["Setoran Minyak", "Pembelian Minyak"].includes(t.type)) {
    result.push({
      item: "Minyak",
      in: q,
      out: 0
    });
  }

  if (t.type === "Penjualan Minyak") {
    result.push({
      item: "Minyak",
      in: 0,
      out: q
    });
  }

  if (t.type === "Pembelian Strap") {
    result.push({
      item: "Strap - " + getStrapCategory(t),
      in: q,
      out: 0
    });

    if (t.method === "Minyak") {
      result.push({
        item: "Minyak",
        in: 0,
        out: oq
      });
    }
  }

  if (t.type === "Penjualan Strap") {
    result.push({
      item: "Strap - " + getStrapCategory(t),
      in: 0,
      out: q
    });

    if (t.method === "Minyak") {
      result.push({
        item: "Minyak",
        in: oq,
        out: 0
      });
    }
  }

  return result;
}

function refreshStock() {
  const c = calculate();

  $("stockOil").textContent = c.oil + " Jerigen";
  $("stockStrap").textContent = c.strap + " pcs";

  // Rincian stok Strap per kategori
  const breakdown = $("stockStrapBreakdown");

  if (breakdown) {
    const categoryCards = STRAP_CATEGORIES.map(category => `
      <div class="strap-stock-item">
        <span>${escapeHTML(category)}</span>
        <strong>${number(c.strapByCategory[category])} pcs</strong>
      </div>
    `).join("");

    const uncategorizedCard = `
      <div class="strap-stock-item">
        <span>Belum dikategorikan</span>
        <strong>${number(c.strapUncategorized)} pcs</strong>
      </div>
    `;

    breakdown.innerHTML = categoryCards + uncategorizedCard;
  }

  const rows = [...db.transactions]
    .filter(t => getStockMovements(t).length)
    .sort(sortNewest);

  $("stockRows").innerHTML = rows.length
    ? rows.map(t => getStockMovements(t).map(m => `
        <tr>
          <td>${escapeHTML(t.date)}</td>
          <td>${typeBadge(t.type)}</td>
          <td>${escapeHTML(m.item)}</td>
          <td class="positive">${m.in || "-"}</td>
          <td class="negative">${m.out || "-"}</td>
          <td>${escapeHTML(t.userName || t.username)}</td>
        </tr>
      `).join("")).join("")
    : emptyRow(6);
}

/* =====================================================
   PENJUALAN
===================================================== */

function refreshSales() {
  const rows = db.transactions.filter(t =>
    ["Penjualan Minyak", "Penjualan Strap"].includes(t.type)
  ).sort(sortNewest);

  const money = rows.reduce(
    (sum, t) => sum + number(t.amount),
    0
  );

  const oilReceived = db.transactions
    .filter(t =>
      t.type === "Penjualan Strap" &&
      t.method === "Minyak"
    )
    .reduce(
      (sum, t) => sum + number(t.oilQuantity),
      0
    );

  const oilSold = db.transactions
    .filter(t => t.type === "Penjualan Minyak")
    .reduce(
      (sum, t) => sum + number(t.quantity),
      0
    );

  const strapSold = db.transactions
    .filter(t => t.type === "Penjualan Strap")
    .reduce(
      (sum, t) => sum + number(t.quantity),
      0
    );

  $("salesMoney").textContent = rupiah(money);
  $("salesOilReceived").textContent = oilReceived + " Jerigen";
  $("salesOilSold").textContent = oilSold + " Jerigen";
  $("salesStrapSold").textContent = strapSold + " pcs";

  $("salesRows").innerHTML = rows.length ? rows.map(t => `
    <tr>
      <td>${escapeHTML(t.date)}</td>
      <td>${typeBadge(t.type)}</td>
      <td>${escapeHTML(t.method || "-")}</td>
      <td>${escapeHTML(t.description)}</td>
      <td>${escapeHTML(getQuantityText(t))}</td>
      <td>${t.amount ? rupiah(t.amount) : "-"}</td>
      <td>${escapeHTML(t.userName || t.username)}</td>
    </tr>
  `).join("") : emptyRow(7);

  $("salesCount").textContent =
    rows.length + " transaksi penjualan";
}

/* =====================================================
   LAPORAN
===================================================== */

function reportTransactions() {
  const from = $("reportFrom").value;
  const to = $("reportTo").value;

  return db.transactions.filter(t =>
    (!from || t.date >= from) &&
    (!to || t.date <= to)
  ).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
}

function refreshReport() {
  const rows = reportTransactions();

  const income = rows.reduce((sum, t) => {
    if (["Pemasukan", "Penjualan Minyak"].includes(t.type)) {
      return sum + number(t.amount);
    }

    if (t.type === "Penjualan Strap" && t.method === "Uang") {
      return sum + number(t.amount);
    }

    return sum;
  }, 0);

  const expense = rows.reduce((sum, t) => {
    if (["Pengeluaran", "Pembelian Minyak"].includes(t.type)) {
      return sum + number(t.amount);
    }

    if (t.type === "Pembelian Strap" && t.method === "Uang") {
      return sum + number(t.amount);
    }

    return sum;
  }, 0);

  const oilIn = rows.reduce((sum, t) => {
    if (["Setoran Minyak", "Pembelian Minyak"].includes(t.type)) {
      return sum + number(t.quantity);
    }

    if (t.type === "Penjualan Strap" && t.method === "Minyak") {
      return sum + number(t.oilQuantity);
    }

    return sum;
  }, 0);

  const oilOut = rows.reduce((sum, t) => {
    if (t.type === "Penjualan Minyak") {
      return sum + number(t.quantity);
    }

    if (t.type === "Pembelian Strap" && t.method === "Minyak") {
      return sum + number(t.oilQuantity);
    }

    return sum;
  }, 0);

  $("reportIncome").textContent = rupiah(income);
  $("reportExpense").textContent = rupiah(expense);

  $("reportOilIn").textContent = oilIn + " Jerigen";
  $("reportOilOut").textContent = oilOut + " Jerigen";

  $("reportRows").innerHTML = rows.length ? rows.map(t => `
    <tr>
      <td>${escapeHTML(t.date)}</td>
      <td>${typeBadge(t.type)}</td>
      <td>${escapeHTML(t.description)}</td>
      <td>${escapeHTML(t.method || "-")}</td>
      <td>${escapeHTML(getQuantityText(t))}</td>
      <td>${t.amount ? rupiah(t.amount) : "-"}</td>
    </tr>
  `).join("") : emptyRow(6);
}

$("generateReport").addEventListener("click", () => {
  if (
    $("reportFrom").value &&
    $("reportTo").value &&
    $("reportFrom").value > $("reportTo").value
  ) {
    alert("Tanggal awal tidak boleh melewati tanggal akhir.");
    return;
  }

  refreshReport();
});

/* =====================================================
   KELOLA PENGGUNA
===================================================== */

function refreshUsers() {
  $("userRows").innerHTML = db.users.map(u => `
    <tr>
      <td>${escapeHTML(u.name)}</td>
      <td>${escapeHTML(u.username)}</td>
      <td>${escapeHTML(u.role)}</td>
      <td>${currentUser?.role === "Admin" && u.id !== currentUser.id
        ? `<button class="btn outline" data-delete-user="${escapeHTML(u.id)}">Hapus</button>`
        : "-"}</td>
    </tr>
  `).join("");
}

$("userForm").addEventListener("submit", event => {
  event.preventDefault();

  if (currentUser?.role !== "Admin") return;

  const name = $("newName").value.trim();
  const username = $("newUsername").value.trim();
  const password = $("newPassword").value;
  const role = $("newRole").value;

  if (!name || !username || password.length < 6) {
    return showMessage(
      "userMessage",
      "Lengkapi data. Password minimal 6 karakter.",
      true
    );
  }

  if (db.users.some(u =>
    String(u.username).toLowerCase() === username.toLowerCase()
  )) {
    return showMessage(
      "userMessage",
      "Username sudah digunakan.",
      true
    );
  }

  const newUser = {
    id: makeId(),
    name,
    username,
    password,
    role
  };

  db.users.push(newUser);

  if (!saveDB()) {
    db.users.pop();
    return;
  }

  $("userForm").reset();

  showMessage(
    "userMessage",
    "Pengguna berhasil ditambahkan."
  );

  refreshUsers();
});

$("userRows").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-user]");

  if (button) {
    deleteUser(button.dataset.deleteUser);
  }
});

function deleteUser(id) {
  if (currentUser?.role !== "Admin") return;

  const user = db.users.find(u => u.id === id);

  if (!user) return;

  if (user.id === currentUser.id) {
    alert("Anda tidak dapat menghapus akun sendiri.");
    return;
  }

  if (
    user.role === "Admin" &&
    db.users.filter(u => u.role === "Admin").length <= 1
  ) {
    alert("Tidak dapat menghapus Admin terakhir.");
    return;
  }

  if (!confirm("Hapus pengguna " + user.username + "?")) {
    return;
  }

  const oldUsers = db.users;

  db.users = db.users.filter(u => u.id !== id);

  if (!saveDB()) {
    db.users = oldUsers;
    return;
  }

  refreshUsers();
}

/* =====================================================
   EXPORT CSV
===================================================== */

function downloadCSV(filename, rows) {
  if (!rows.length) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  const csv = rows.map(row => row.map(value =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"'
  ).join(";")).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function transactionCSV(rows) {
  return [
    [
      "Tanggal",
      "Jenis",
      "Kategori Strap",
      "Metode",
      "Keterangan",
      "Jumlah Barang",
      "Jumlah Minyak",
      "Nominal Uang",
      "Petugas",
      "Catatan"
    ],

    ...rows.map(t => [
      t.date,
      t.type,
      isStrapTransaction(t.type) ? getStrapCategory(t) : "-",
      t.method,
      t.description,
      t.quantity,
      t.oilQuantity,
      t.amount,
      t.userName || t.username,
      t.note
    ])
  ];
}

$("exportHistory").addEventListener("click", () => {
  downloadCSV(
    "Riwayat_Transaksi.csv",
    transactionCSV(db.transactions)
  );
});

$("exportStock").addEventListener("click", () => {
  const rows = [[
    "Tanggal",
    "Jenis",
    "Barang",
    "Masuk",
    "Keluar",
    "Petugas"
  ]];

  db.transactions.forEach(t => {
    getStockMovements(t).forEach(m => {
      rows.push([
        t.date,
        t.type,
        m.item,
        m.in,
        m.out,
        t.userName || t.username
      ]);
    });
  });

  downloadCSV("Riwayat_Stok.csv", rows);
});

$("exportSales").addEventListener("click", () => {
  const sales = db.transactions.filter(t =>
    ["Penjualan Minyak", "Penjualan Strap"].includes(t.type)
  );

  downloadCSV(
    "Riwayat_Penjualan.csv",
    transactionCSV(sales)
  );
});

$("exportReport").addEventListener("click", () => {
  downloadCSV(
    "Laporan_Transaksi.csv",
    transactionCSV(reportTransactions())
  );
});

/* =====================================================
   REFRESH SEMUA TAMPILAN
===================================================== */

function refreshAll() {
  if (!currentUser) return;

  updateTransactionFields();

  // Petugas hanya dapat membuka dan menggunakan Input Transaksi.
  if (currentUser.role === "Petugas") {
    $("recentRows").innerHTML = "";
    $("historyRows").innerHTML = "";
    $("stockRows").innerHTML = "";
    $("salesRows").innerHTML = "";
    $("reportRows").innerHTML = "";
    $("userRows").innerHTML = "";
    return;
  }

  refreshDashboard();
  refreshHistory();
  refreshStock();
  refreshSales();
  refreshReport();
  refreshUsers();
}

/* =====================================================
   INISIALISASI
===================================================== */

function initializeApp() {
  $("txDate").value = today();

  $("reportFrom").value =
    today().slice(0, 7) + "-01";

  $("reportTo").value = today();

  if ($("txStrapCategory")) {
    $("txStrapCategory").value = "DE";
  }

  updateTransactionFields();

  try {
    const session = JSON.parse(
      localStorage.getItem(SESSION_KEY) || "null"
    );

    if (session?.userId) {
      const user = db.users.find(u =>
        u.id === session.userId
      );

      if (user) {
        openApplication(user);
        return;
      }
    }
  } catch (error) {
    console.warn(
      "Sesi login tidak dapat dipulihkan:",
      error
    );

    localStorage.removeItem(SESSION_KEY);
  }

  currentUser = null;

  $("loginView").classList.remove("hidden");
  $("appView").classList.add("hidden");
}

initializeApp();

/* =====================================================
   ZOOM BERANGKAS NAKAMA
===================================================== */

let appZoom = 1;

function applyAppZoom() {
  const app = document.querySelector(".app");

  if (!app) return;

  app.style.zoom = appZoom;

  const label = document.getElementById("zoomLevel");

  if (label) {
    label.textContent =
      Math.round(appZoom * 100) + "%";
  }
}

function changeAppZoom(amount) {
  appZoom = Math.min(
    1.5,
    Math.max(0.7, appZoom + amount)
  );

  applyAppZoom();
}

function resetAppZoom() {
  appZoom = 1;
  applyAppZoom();
}
