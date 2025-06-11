(() => {
  "use strict";

  const views = {
    login: document.getElementById('login'),
    dashboard: document.getElementById('dashboard'),
    products: document.getElementById('products'),
    sales: document.getElementById('sales'),
    'cash-summary': document.getElementById('cash-summary'),
    'price-suggestions': document.getElementById('price-suggestions')
  };
  const moduleCards = Array.from(document.querySelectorAll('#modules-panel .module-card'));

  // References
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');

  // Dashboard elements
  const dashboardSalesTotalEl = document.getElementById('dashboard-sales-total');
  const dashboardProductsTotalEl = document.getElementById('dashboard-products-total');
  const dashboardCashTotalEl = document.getElementById('dashboard-cash-total');

  // Products elements
  const productsTableBody = document.getElementById('products-table-body');
  const productForm = document.getElementById('product-form');

  // Sales elements
  const saleProductsContainer = document.getElementById('sale-products-container');
  const saleTotalInput = document.getElementById('sale-total');
  const btnTemporarySale = document.getElementById('btn-temporary-sale');
  const btnRegisterSale = document.getElementById('btn-register-sale');
  const tempSalesTableBody = document.getElementById('temp-sales-table-body');

  // Cash summary elements
  const cashTotalEl = document.getElementById('cash-total');
  const salesHistoryTableBody = document.getElementById('sales-history-table-body');

  // Price suggestions elements
  const priceSuggestionsTableBody = document.getElementById('price-suggestions-table-body');

  // Modal - Payment
  const modalPayment = document.getElementById('modal-payment');
  const modalCloseBtn = modalPayment.querySelector('.modal-close');
  const paymentForm = document.getElementById('payment-form');
  const paymentAmountInput = document.getElementById('payment-amount');

  const STORAGE_KEYS = {
    PRODUCTS: 'eco_products',
    SALES_HISTORY: 'eco_sales_history',
    TEMP_SALES: 'eco_temp_sales',
    LOGGED_IN: 'eco_logged_in'
  };

  let products = [];
  let salesHistory = [];
  let tempSales = [];
  let loggedIn = false;
  let currentSaleId = null;

  // Helpers
  function formatCurrency(amount) {
    return '₡' + amount.toFixed(2);
  }
  function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
  function loadData(key) {
    const json = localStorage.getItem(key);
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  }
  function showView(view) {
    Object.entries(views).forEach(([key, el]) => {
      if (key === view) {
        el.classList.add('active');
        el.setAttribute('aria-hidden', 'false');
        el.focus();
      } else {
        el.classList.remove('active');
        el.setAttribute('aria-hidden', 'true');
      }
    });
    moduleCards.forEach(card => {
      card.setAttribute('aria-pressed', card.dataset.module === view ? 'true' : 'false');
    });
  }
  function checkLogin() {
    loggedIn = loadData(STORAGE_KEYS.LOGGED_IN) || false;
    // Show login module card only if logged out
    const loginModuleCard = moduleCards.find(c => c.dataset.module === 'login');
    if(loginModuleCard) {
      loginModuleCard.style.display = loggedIn ? 'none' : 'flex';
    }
    if(!loggedIn) {
      showView('login');
    } else {
      showView('dashboard');
    }
  }
  function login(user, pass) {
    if(user === 'admin' && pass === 'admin123') {
      loggedIn = true;
      saveData(STORAGE_KEYS.LOGGED_IN, true);
      loginError.style.display = 'none';
      checkLogin();
      updateUI();
      return true;
    }
    return false;
  }
  function logout() {
    loggedIn = false;
    saveData(STORAGE_KEYS.LOGGED_IN, false);
    checkLogin();
  }
  function loadProducts() {
    products = loadData(STORAGE_KEYS.PRODUCTS) || [];
  }
  function saveProducts() {
    saveData(STORAGE_KEYS.PRODUCTS, products);
  }
  function addProduct(name, price, stock) {
    const id = Date.now().toString();
    products.push({ id, name, price: +price, stock: +stock });
    saveProducts();
    renderProductsTable();
    renderSaleProducts();
    renderPriceSuggestions();
    updateDashboardProductsTotal();
  }
  function updateProductStock(id, newStock) {
    const p = products.find(p => p.id === id);
    if(p) {
      p.stock = newStock;
      saveProducts();
      renderProductsTable();
      renderSaleProducts();
      updateDashboardProductsTotal();
    }
  }
  function renderProductsTable() {
    productsTableBody.innerHTML = '';
    if(products.length === 0) {
      productsTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="font-style:italic; color:#9ca3af;">No hay productos agregados.</td></tr>';
      return;
    }
    for(const prod of products) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${prod.name}</td>
        <td>${formatCurrency(prod.price)}</td>
        <td>${prod.stock}</td>
        <td>
          <input type="number" min="0" value="${prod.stock}" aria-label="Ajustar inventario para ${prod.name}" style="width: 5rem; font-size:1rem;" data-prod-id="${prod.id}" />
          <button aria-label="Actualizar inventario para ${prod.name}" data-prod-id="${prod.id}">Actualizar</button>
        </td>
      `;
      productsTableBody.appendChild(tr);
    }
  }
  function renderSaleProducts() {
    saleProductsContainer.innerHTML = '';
    if(products.length === 0) {
      saleProductsContainer.innerHTML = '<p style="font-style:italic; color:#9ca3af;">No hay productos disponibles para vender.</p>';
      btnRegisterSale.disabled = true;
      btnTemporarySale.disabled = true;
      saleTotalInput.value = formatCurrency(0);
      return;
    }
    btnRegisterSale.disabled = false;
    btnTemporarySale.disabled = false;
    products.forEach(product => {
      const div = document.createElement('div');
      div.style.marginBottom = '1rem';
      div.innerHTML = `
        <label for="sale-prod-${product.id}" style="display:block; font-weight:600; margin-bottom:0.25rem; color: var(--color-text-primary);">${product.name} (Inventario: ${product.stock}) - Precio: ${formatCurrency(product.price)}</label>
        <input type="number" id="sale-prod-${product.id}" name="qty-${product.id}" min="0" max="${product.stock}" value="0" step="1" data-price="${product.price}" />
      `;
      saleProductsContainer.appendChild(div);
    });
    updateSaleTotal();
  }
  function updateSaleTotal() {
    let total = 0;
    let hasQuantity = false;
    const inputs = saleProductsContainer.querySelectorAll('input[type=number]');
    inputs.forEach(input => {
      const qty = +input.value;
      const price = +input.dataset.price;
      if(qty > 0) {
        total += qty * price;
        hasQuantity = true;
      }
    });
    saleTotalInput.value = formatCurrency(total);
    btnRegisterSale.disabled = !hasQuantity;
  }
  function loadTempSales() {
    tempSales = loadData(STORAGE_KEYS.TEMP_SALES) || [];
  }
  function saveTempSales() {
    saveData(STORAGE_KEYS.TEMP_SALES, tempSales);
  }
  function addTempSale(productsList, total) {
    const id = Date.now().toString();
    tempSales.push({ id, products: productsList, total });
    saveTempSales();
    renderTempSalesTable();
  }
  function deleteTempSale(id) {
    tempSales = tempSales.filter(s => s.id !== id);
    saveTempSales();
    renderTempSalesTable();
  }
  function renderTempSalesTable() {
    tempSalesTableBody.innerHTML = '';
    if(tempSales.length === 0) {
      tempSalesTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="font-style:italic; color:#9ca3af;">No hay ventas temporales.</td></tr>';
      return;
    }
    tempSales.forEach(sale => {
      const tr = document.createElement('tr');
      const productNames = sale.products.map(p => `${p.name} (${p.qty})`).join(', ');
      tr.innerHTML = `
        <td>${sale.id}</td>
        <td>${productNames}</td>
        <td>${formatCurrency(sale.total)}</td>
        <td><button aria-label="Eliminar venta temporal ${sale.id}" data-temp-sale-id="${sale.id}">Eliminar</button></td>
      `;
      tempSalesTableBody.appendChild(tr);
    });
  }
  function loadSalesHistory() {
    salesHistory = loadData(STORAGE_KEYS.SALES_HISTORY) || [];
  }
  function saveSalesHistory() {
    saveData(STORAGE_KEYS.SALES_HISTORY, salesHistory);
  }
  function addSaleHistory(productsList, total) {
    const id = Date.now().toString();
    const date = new Date().toLocaleString();
    salesHistory.push({ id, products: productsList, total, date });
    saveSalesHistory();
    renderSalesHistoryTable();
  }
  function renderSalesHistoryTable() {
    salesHistoryTableBody.innerHTML = '';
    if(salesHistory.length === 0) {
      salesHistoryTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="font-style:italic; color:#9ca3af;">No hay historial de ventas.</td></tr>';
      return;
    }
    salesHistory.forEach(record => {
      const tr = document.createElement('tr');
      const productList = record.products.map(p => `${p.name} (${p.qty})`).join(', ');
      tr.innerHTML = `
        <td>${record.id}</td>
        <td>${productList}</td>
        <td>${formatCurrency(record.total)}</td>
        <td>${record.date}</td>
      `;
      salesHistoryTableBody.appendChild(tr);
    });
  }
  function updateCashSummary() {
    let total = 0;
    salesHistory.forEach(sale => {
      total += sale.total;
    });
    cashTotalEl.textContent = formatCurrency(total);
    dashboardCashTotalEl.textContent = formatCurrency(total);
  }
  function updateDashboardSalesTotal() {
    let total = 0;
    salesHistory.forEach(sale => {
      total += sale.total;
    });
    dashboardSalesTotalEl.textContent = formatCurrency(total);
  }
  function updateDashboardProductsTotal() {
    const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
    dashboardProductsTotalEl.textContent = totalStock;
  }
  function generatePriceSuggestions() {
    if(products.length === 0) return [];
    return products.map(p => {
      const factor = 0.85 + Math.random() * 0.3;
      const suggested = +(p.price * factor).toFixed(2);
      return { id: p.id, name: p.name, currentPrice: p.price, suggestedPrice: suggested };
    });
  }
  function renderPriceSuggestions() {
    const suggestions = generatePriceSuggestions();
    priceSuggestionsTableBody.innerHTML = '';
    if(suggestions.length === 0) {
      priceSuggestionsTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="font-style:italic; color:#9ca3af;">No hay productos registrados.</td></tr>';
      return;
    }
    suggestions.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${formatCurrency(item.currentPrice)}</td>
        <td>${formatCurrency(item.suggestedPrice)}</td>
        <td>
          <button data-product-id="${item.id}" data-action="apply" aria-label="Aplicar sugerencia de precio para ${item.name}">Aplicar</button>
          <button style="background:#9ca3af; color:#f9fafb; margin-left:0.5rem;" data-product-id="${item.id}" data-action="ignore" aria-label="Ignorar sugerencia de precio para ${item.name}">Ignorar</button>
        </td>
      `;
      priceSuggestionsTableBody.appendChild(tr);
    });
  }
  function updateUI() {
    renderProductsTable();
    renderSaleProducts();
    renderTempSalesTable();
    renderSalesHistoryTable();
    updateCashSummary();
    updateDashboardSalesTotal();
    updateDashboardProductsTotal();
    renderPriceSuggestions();
  }
  moduleCards.forEach(card => {
    card.addEventListener('click', () => {
      const moduleName = card.dataset.module;
      if(moduleName === 'login' && loggedIn) return;
      if(moduleName !== 'login' && !loggedIn) {
        alert('Debe iniciar sesión para acceder a esta sección.');
        showView('login');
        return;
      }
      showView(moduleName);
    });
    card.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const username = loginForm['usuario'].value.trim();
    const password = loginForm['password'].value;
    if(login(username, password)) {
      loginForm.reset();
      loginError.style.display = 'none';
      updateUI();
    } else {
      loginError.style.display = 'block';
    }
  });
  productsTableBody.addEventListener('click', e => {
    const target = e.target;
    if(target.tagName === 'BUTTON' && target.dataset.prodId) {
      const id = target.dataset.prodId;
      const input = productsTableBody.querySelector(`input[data-prod-id="${id}"]`);
      if(!input) return;
      const newStock = Number(input.value);
      if(isNaN(newStock) || newStock < 0) {
        alert('Cantidad inválida para inventario.');
        return;
      }
      updateProductStock(id, newStock);
    }
  });
  productForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = productForm['name'].value.trim();
    const price = parseFloat(productForm['price'].value);
    const stock = parseInt(productForm['stock'].value, 10);
    if(!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
      alert('Por favor ingrese datos válidos para el producto.');
      return;
    }
    addProduct(name, price, stock);
    productForm.reset();
  });
  saleProductsContainer.addEventListener('input', e => {
    if(e.target.tagName === 'INPUT' && e.target.type === 'number') {
      let val = Number(e.target.value);
      if(isNaN(val) || val < 0) val = 0;
      const max = Number(e.target.max);
      if(val > max) val = max;
      e.target.value = val;
      updateSaleTotal();
    }
  });
  btnTemporarySale.addEventListener('click', () => {
    const saleProducts = collectSaleProducts();
    if(saleProducts.length === 0) {
      alert('Seleccione al menos un producto con cantidad mayor que cero.');
      return;
    }
    const total = calculateSaleTotal(saleProducts);
    addTempSale(saleProducts, total);
    resetSaleForm();
    alert('Venta temporal guardada.');
  });
  btnRegisterSale.addEventListener('click', () => {
    const saleProducts = collectSaleProducts();})
)