// Portfolio page filters and interactions

// Filter elements
const applyFiltersBtn = document.getElementById('apply-filters');
const resetFiltersBtn = document.getElementById('reset-filters');
const sortBySelect = document.getElementById('sort-by');
const sortOrderSelect = document.getElementById('sort-order');
const portfolioTbody = document.getElementById('portfolio-tbody');

// Multi-select state
const selectedFilters = {
    types: new Set()
};

// State
let currentSort = { sortBy: 'value', sortOrder: 'desc' };
let allPositions = [];
let deleteTargetIsin = null;

// Initialize multi-select dropdowns
async function initializeMultiSelects() {
    try {
        const response = await fetch('/api/portfolio/filters/values');
        const result = await response.json();

        if (result.types) {
            initMultiSelect('type', result.types, 'Tipologia');
        }
    } catch (error) {
        console.error('Error loading filter values:', error);
    }
}

// Initialize a single multi-select component
function initMultiSelect(filterName, values, label) {
    const toggle = document.getElementById(`filter-${filterName}-toggle`);
    const dropdown = document.getElementById(`filter-${filterName}-dropdown`);
    const optionsContainer = document.getElementById(`filter-${filterName}-options`);

    // Populate options
    optionsContainer.innerHTML = values.map(value => `
        <div class="multi-select-option" data-value="${value}">
            <input type="checkbox" id="${filterName}-${value}" value="${value}">
            <label for="${filterName}-${value}">${value}</label>
        </div>
    `).join('');

    // Toggle dropdown
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.multi-select-dropdown').forEach(dd => {
            if (dd !== dropdown) {
                dd.classList.add('hidden');
            }
        });
        dropdown.classList.toggle('hidden');
    });

    // Handle option selection
    optionsContainer.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;

        const checkbox = e.target;
        const option = checkbox.closest('.multi-select-option');
        const value = option.dataset.value;

        if (checkbox.checked) {
            selectedFilters.types.add(value);
        } else {
            selectedFilters.types.delete(value);
        }

        updateChips();
        updatePlaceholder(filterName, toggle);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

// Update placeholder text
function updatePlaceholder(filterName, toggle) {
    const placeholder = toggle.querySelector('.multi-select-placeholder');
    const count = selectedFilters.types.size;

    if (count === 0) {
        placeholder.textContent = 'Tutte le tipologie';
    } else {
        placeholder.textContent = `${count} selezionat${count === 1 ? 'a' : 'e'}`;
    }
}

// Update chips display
function updateChips() {
    const unifiedContainer = document.getElementById('unified-chips-container');
    if (!unifiedContainer) return;

    let allChips = [];

    // Add type chips
    const selectedTypes = Array.from(selectedFilters.types);
    selectedTypes.forEach(value => {
        allChips.push({
            filterType: 'type',
            filterName: 'type',
            value: value,
            label: value
        });
    });

    if (allChips.length === 0) {
        unifiedContainer.innerHTML = '';
        return;
    }

    unifiedContainer.innerHTML = allChips.map(chip => {
        const colorMap = {
            'type': 'bg-blue-100 text-blue-800'
        };
        const colorClass = colorMap[chip.filterType] || 'bg-gray-100 text-gray-800';

        return `
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}">
                ${chip.label}
                <button class="hover:bg-opacity-80 rounded-full p-0.5"
                        data-filter-type="${chip.filterType}"
                        data-filter-name="${chip.filterName}"
                        data-value="${chip.value}">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </span>
        `;
    }).join('');

    // Add event listeners to remove buttons
    unifiedContainer.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterName = btn.dataset.filterName;
            const value = btn.dataset.value;

            // Update selectedFilters
            selectedFilters.types.delete(value);

            // Uncheck the checkbox
            const checkbox = document.getElementById(`${filterName}-${value}`);
            if (checkbox) checkbox.checked = false;

            // Update UI
            updateChips();
            updatePlaceholder(filterName, document.getElementById(`filter-${filterName}-toggle`));
        });
    });
}

// Load portfolio positions
async function loadPortfolio() {
    try {
        portfolioTbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-4 py-8 text-center text-gray-500">
                    <span class="spinner"></span>
                    <span class="ml-2">Caricamento portfolio...</span>
                </td>
            </tr>
        `;

        // Build query params
        const params = new URLSearchParams();

        if (selectedFilters.types.size > 0) {
            params.append('tipo', Array.from(selectedFilters.types).join(','));
        }

        params.append('sortBy', currentSort.sortBy);
        params.append('sortOrder', currentSort.sortOrder);

        const response = await fetch(`/api/portfolio/positions?${params}`);
        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        allPositions = result.positions || [];
        renderPortfolio(allPositions);
        updateSummary(allPositions, result.summary);

    } catch (error) {
        console.error('Error loading portfolio:', error);
        portfolioTbody.innerHTML = `
            <tr>
                <td colspan="10" class="px-4 py-8 text-center text-red-500">
                    Errore nel caricamento del portfolio
                </td>
            </tr>
        `;
    }
}

// Render portfolio table
function renderPortfolio(positions) {
    if (positions.length === 0) {
        portfolioTbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-4 py-8 text-center text-gray-500">
                    Nessun titolo trovato
                </td>
            </tr>
        `;
        return;
    }

    portfolioTbody.innerHTML = positions.map(position => {
        const variazioneColor = position.variazione_perc >= 0 ? 'text-green-600' : 'text-red-600';
        const variazioneIcon = position.variazione_perc >= 0 ? '▲' : '▼';

        return `
            <tr class="hover:bg-gray-50 transition-colors portfolio-row group" data-isin="${position.isin}">
                <td class="px-2 py-3 text-sm text-center">
                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-mono lowercase font-medium ${position.tipologia === 'ETF' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                        ${position.tipologia || 'N/A'}
                    </span>
                </td>
                <td class="px-2 py-3 text-sm">
                    <div class="font-medium text-gray-900 font-mono text-pf-title">${position.nome || 'N/A'}</div>
                    <div class="text-xs text-gray-500">${position.isin}</div>
                </td>
                <td class="px-1 py-1 text-sm text-center">
                    <span class="editable-field items-center px-2 py-0.5 rounded text-xs font-medium is-type bg-gray-100 text-gray-800 font-mono" data-field="ticker" data-isin="${position.isin}">
                        ${position.ticker || '-'}
                    </span>
                </td>
                <td class="px-3 py-3 text-sm text-center">
                    <div class="font-mono font-bold text-gray-900 ${position.div_yield ? 'underline' : ''}">
                        ${position.div_yield ? position.div_yield.toFixed(2) + '%' : '-'}
                    </div>
                    ${position.div_yield && position.tax_rate ? `<div class="editable-field text-xs text-gray-500 mt-0.5" data-field="tax_rate" data-isin="${position.isin}">(${(position.tax_rate * 100).toFixed(1)}%)</div>` : ''}
                </td>
                <td class="px-1 py-1 text-sm text-center">
                    <span class="editable-field font-mono" data-field="qty" data-isin="${position.isin}">
                        ${position.qty ? position.qty.toFixed(2) : '0'}
                    </span>
                </td>
                <td class="px-2 py-3 text-sm text-center font-mono">
                    € ${formatNumber(position.last_price)}
                </td>
                <td class="px-1 py-3 text-sm text-center font-mono font-bold text-purple-600">
                    € ${formatNumber(position.value)}
                </td>
                <td class="px-3 py-3 text-sm text-center ${variazioneColor}">
                    <span class="text-xs">${variazioneIcon} </span>${Math.abs(position.variazione_perc).toFixed(2)}%
                </td>
                <td class="px-2 py-3 text-sm text-center">
                    <div class="row-actions opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                        <button class="action-edit p-1 hover:bg-gray-100 rounded" data-isin="${position.isin}" title="Modifica">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button class="action-delete p-1 hover:bg-gray-100 rounded" data-isin="${position.isin}" title="Elimina">
                            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                        <button class="action-transactions p-1 hover:bg-gray-100 rounded" data-isin="${position.isin}" title="Visualizza transazioni">
                            <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
            <tr class="transaction-details hidden" data-isin="${position.isin}">
                <td colspan="9" class="px-0 py-0">
                    <div class="bg-gray-50 border-t border-gray-200">
                        <div class="p-6">
                            <div class="transaction-details-content"></div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Attach event listeners
    attachRowEventListeners();
}

// Attach event listeners to portfolio rows
function attachRowEventListeners() {
    // Edit buttons
    document.querySelectorAll('.action-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isin = btn.dataset.isin;
            enableEditMode(isin);
        });
    });

    // Delete buttons
    document.querySelectorAll('.action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isin = btn.dataset.isin;
            showDeleteModal(isin);
        });
    });

    // Transaction buttons
    document.querySelectorAll('.action-transactions').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const isin = btn.dataset.isin;
            await toggleTransactionDetails(isin);
        });
    });

    // Editable fields (double-click to edit)
    document.querySelectorAll('.editable-field').forEach(field => {
        field.addEventListener('dblclick', (e) => {
            const isin = field.dataset.isin;
            enableEditMode(isin);
        });
    });
}

// Enable edit mode for a row
function enableEditMode(isin) {
    const row = document.querySelector(`.portfolio-row[data-isin="${isin}"]`);
    if (!row) return;

    // Prevent double-editing
    if (row.dataset.isEditing === 'true') return;
    row.dataset.isEditing = 'true';

    const cells = row.querySelectorAll('td');
    const tickerCell = cells[2];
    const dividendCell = cells[3];
    const qtyCell = cells[4];
    const actionsCell = cells[8];

    // Store original HTML
    const originalTickerHTML = tickerCell.innerHTML;
    const originalDividendHTML = dividendCell.innerHTML;
    const originalQtyHTML = qtyCell.innerHTML;
    const originalActionsHTML = actionsCell.innerHTML;

    // Get current values
    const currentTicker = tickerCell.textContent.trim();
    const currentQty = qtyCell.textContent.trim();

    // Get tax_rate value from the tax rate div if it exists
    const taxRateDiv = dividendCell.querySelector('[data-field="tax_rate"]');
    let currentTaxRate = '';
    if (taxRateDiv) {
        const taxText = taxRateDiv.textContent.trim();
        // Extract percentage value (e.g., "Tax: 27.0%" -> "27.0")
        const match = taxText.match(/Tax:\s*([\d.]+)%/);
        currentTaxRate = match ? match[1] : '';
    }

    // Replace with input fields
    tickerCell.innerHTML = `<input type="text" value="${currentTicker}" class="edit-input text-center font-mono" id="edit-ticker-${isin}">`;
    qtyCell.innerHTML = `<input type="text" value="${currentQty}" class="edit-input text-center font-mono" id="edit-qty-${isin}">`;

    // Only show tax_rate input if there's a tax rate to edit
    if (taxRateDiv) {
        const divYieldDiv = dividendCell.querySelector('div:first-child');
        const divYieldHTML = divYieldDiv ? divYieldDiv.outerHTML : '';
        dividendCell.innerHTML = `
            ${divYieldHTML}
            <input type="text" value="${currentTaxRate}" placeholder="Tax %" class="edit-input text-center font-mono mt-0.5 text-xs" id="edit-tax-${isin}">
        `;
    }

    // Replace action buttons with save/cancel icons
    actionsCell.innerHTML = `
        <div class="edit-actions-buttons opacity-100 flex items-center justify-center gap-1">
            <button class="edit-save-btn p-1 hover:bg-green-100 rounded" title="Salva modifiche">
                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </button>
            <button class="edit-cancel-btn p-1 hover:bg-red-100 rounded" title="Annulla">
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;

    // Focus on quantity
    const qtyInput = document.getElementById(`edit-qty-${isin}`);
    qtyInput.focus();
    qtyInput.select();

    // Restore function
    const restoreOriginal = () => {
        tickerCell.innerHTML = originalTickerHTML;
        dividendCell.innerHTML = originalDividendHTML;
        qtyCell.innerHTML = originalQtyHTML;
        actionsCell.innerHTML = originalActionsHTML;
        row.dataset.isEditing = 'false';

        // Reattach event handlers
        attachRowEventListeners();
    };

    // Save function
    const saveEdit = async () => {
        const newQty = parseFloat(qtyInput.value);
        const newTicker = document.getElementById(`edit-ticker-${isin}`).value.trim();

        // Get tax_rate if input exists
        const taxInput = document.getElementById(`edit-tax-${isin}`);
        let newTaxRate = null;
        if (taxInput) {
            const taxValue = parseFloat(taxInput.value);
            if (!isNaN(taxValue) && taxValue >= 0 && taxValue <= 100) {
                newTaxRate = taxValue / 100; // Convert percentage to decimal
            } else if (taxInput.value.trim() !== '') {
                alert('Tax rate non valido (deve essere tra 0 e 100)');
                return;
            }
        }

        // Validate
        if (isNaN(newQty) || newQty < 0) {
            alert('Quantità non valida');
            return;
        }

        // Show loading
        const saveBtn = actionsCell.querySelector('.edit-save-btn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <svg class="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;

        try {
            const updateData = { qty: newQty, ticker: newTicker };
            if (newTaxRate !== null) {
                updateData.tax_rate = newTaxRate;
            }

            const response = await fetch(`/api/portfolio/${isin}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData)
            });

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            // Show success
            saveBtn.innerHTML = `
                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            `;

            // Reload after brief delay
            setTimeout(() => {
                loadPortfolio();
            }, 300);

        } catch (error) {
            console.error('Error saving edit:', error);
            alert('Errore durante il salvataggio');
            restoreOriginal();
        }
    };

    // Attach save/cancel listeners
    actionsCell.querySelector('.edit-save-btn').addEventListener('click', saveEdit);
    actionsCell.querySelector('.edit-cancel-btn').addEventListener('click', restoreOriginal);

    // Keyboard shortcuts
    qtyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') restoreOriginal();
    });

    document.getElementById(`edit-ticker-${isin}`).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') restoreOriginal();
    });

    const taxInput = document.getElementById(`edit-tax-${isin}`);
    if (taxInput) {
        taxInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') restoreOriginal();
        });
    }
}


// Show delete modal
function showDeleteModal(isin) {
    const position = allPositions.find(p => p.isin === isin);
    if (!position) return;

    deleteTargetIsin = isin;

    document.getElementById('delete-modal-title').textContent = position.nome;
    document.getElementById('delete-modal-isin').textContent = isin;
    document.getElementById('delete-modal').classList.remove('hidden');
}

// Delete confirmation handlers
document.getElementById('cancel-delete').addEventListener('click', () => {
    document.getElementById('delete-modal').classList.add('hidden');
    deleteTargetIsin = null;
});

document.getElementById('confirm-delete').addEventListener('click', async () => {
    if (!deleteTargetIsin) return;

    try {
        const response = await fetch(`/api/portfolio/${deleteTargetIsin}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.error) {
            throw new Error(result.error);
        }

        document.getElementById('delete-modal').classList.add('hidden');
        deleteTargetIsin = null;

        // Reload portfolio
        await loadPortfolio();

    } catch (error) {
        console.error('Error deleting position:', error);
        alert('Errore durante l\'eliminazione');
    }
});

// Toggle transaction details accordion
async function toggleTransactionDetails(isin) {
    const detailsRow = document.querySelector(`.transaction-details[data-isin="${isin}"]`);
    if (!detailsRow) return;

    // If already open, close it
    if (!detailsRow.classList.contains('hidden')) {
        detailsRow.classList.add('hidden');
        return;
    }

    // Load transactions
    const contentDiv = detailsRow.querySelector('.transaction-details-content');
    contentDiv.innerHTML = '<div class="text-center text-gray-500 text-sm">Caricamento...</div>';
    detailsRow.classList.remove('hidden');

    try {
        const response = await fetch(`/api/portfolio/transactions/${isin}`);
        const transactions = await response.json();

        if (transactions.error) {
            throw new Error(transactions.error);
        }

        // Render transactions grouped by type
        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-10">';

        // Investments
        html += '<div>';
        html += '<div class="flex justify-between items-center mb-2">';
        html += '<h4 class="font-medium text-pf-title text-gray-900 flex gap-1">';
        html += '<svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';
        html += 'Investimenti';
        html += '</h4>';
        html += `<div class="text-pf-title font-bold font-mono text-purple-600">Tot: € ${formatNumber(transactions.tot_investito || 0)}</div>`;
        html += '</div>';
        if (transactions.investments && transactions.investments.length > 0) {
            html += '<div class="space-y-1">';
            transactions.investments.forEach(tx => {
                const amountOut = parseFloat(tx.amount_out || 0);
                const amountIn = parseFloat(tx.amount_in || 0);
                const netAmount = amountOut - amountIn;
                const displayColor = netAmount >= 0 ? 'text-red-600' : 'text-green-600';
                html += `
                    <div class="text-xs bg-white p-2 rounded border border-gray-200">
                        <div class="flex justify-between">
                            <span class="text-gray-600">${formatDate(tx.transaction_date)}</span>
                            <span class="font-mono font-medium ${displayColor}">€ ${formatNumber(netAmount)}</span>
                        </div>
                        <div class="text-gray-500 font-mono mt-1">${tx.description || '-'}</div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<div class="text-xs text-gray-500">Nessun investimento da mostrare.</div>';
        }
        html += '</div>';

        // Dividends
        html += '<div>';
        html += '<div class="flex justify-between items-center mb-2">';
        html += '<h4 class="font-medium text-pf-title text-gray-900 mb-2 flex gap-1">';
        html += '<svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>';
        html += 'Dividendi';
        html +='</h4>';
        html += '</div>';
        if (transactions.dividendsByYear && transactions.dividendsByYear.length > 0) {
            html += '<div class="space-y-2">';

            // Summary by year
            transactions.dividendsByYear.forEach(yearData => {
                html += `
                    <div class="bg-white border border-gray-200 rounded">
                        <div class="flex justify-between items-center p-2 bg-gray-50 border-b border-gray-200">
                            <span class="font-medium text-xs text-gray-700">${yearData.year}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-xs text-gray-500">${yearData.count} transazion${yearData.count === 1 ? 'e' : 'i'}</span>
                                <span class="font-mono font-bold text-pf-title text-green-600">€ ${formatNumber(yearData.total)}</span>
                            </div>
                        </div>
                        <div class="space-y-1">
                `;

                yearData.transactions.forEach(tx => {
                    const amount = parseFloat(tx.amount_in || 0);
                    html += `
                        <div class="text-xs flex justify-between p-2 border-b border-gray-200 items-start">
                            <div class="flex-1">
                                <span class="text-gray-600">${formatDate(tx.transaction_date)}</span>
                                <div class="text-gray-500 mt-0.5 font-mono">${tx.description || '-'}</div>
                            </div>
                            <span class="font-mono text-xs font-bold text-green-600 ml-2">€ ${formatNumber(amount)}</span>
                        </div>
                    `;
                });

                html += `
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        } else {
            html += '<div class="text-xs text-gray-500">Nessun dividendo da mostrare.</div>';
        }
        html += '</div>';

        html += '</div>';

        contentDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading transactions:', error);
        contentDiv.innerHTML = '<div class="text-center text-red-500 text-sm">Errore nel caricamento</div>';
    }
}

// Update summary bar
function updateSummary(positions, summary) {
    const count = positions.length;

    // Update count
    document.getElementById('summary-count').textContent = count;

    // Update financial metrics from summary
    if (summary) {
        document.getElementById('summary-invested').textContent = `€ ${formatNumber(summary.totalInvested)}`;
        document.getElementById('summary-total').textContent = `€ ${formatNumber(summary.currentValue)}`;

        // Variation % with color
        const variationEl = document.getElementById('summary-variation');
        const variation = summary.portfolioVariation;
        const variationIcon = variation >= 0 ? '▲' : '▼';
        const variationColor = variation >= 0 ? 'text-green-600' : 'text-red-600';
        variationEl.className = `font-mono font-bold ${variationColor}`;
        variationEl.innerHTML = `<span class="text-xs">${variationIcon} </span>${Math.abs(variation).toFixed(2)}%`;

        // document.getElementById('summary-dividends').textContent = `€ ${formatNumber(summary.totalDividends)}`;
        // document.getElementById('summary-total-with-div').textContent = `€ ${formatNumber(summary.totalValueWithDividends)}`;
    } else {
        // Fallback if summary not provided
        const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
        document.getElementById('summary-total').textContent = `€ ${formatNumber(totalValue)}`;
    }
}

// Format number
function formatNumber(num) {
    return new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 0);
}

// Format date
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Sync Prices Button
document.getElementById('sync-prices-btn').addEventListener('click', async () => {
    const btn = document.getElementById('sync-prices-btn');

    // Add syncing state
    btn.disabled = true;
    btn.classList.add('syncing');
    btn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Sincronizzazione in corso...
    `;

    try {
        // TODO: Implement sync logic
        await new Promise(resolve => setTimeout(resolve, 2000)); // Placeholder

        alert('Sincronizzazione completata! (funzionalità da implementare)');

        // Reload portfolio after sync
        await loadPortfolio();
    } catch (error) {
        console.error('Error syncing prices:', error);
        alert('Errore durante la sincronizzazione');
    } finally {
        // Restore button state
        btn.disabled = false;
        btn.classList.remove('syncing');
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Sincronizza Prezzi
        `;
    }
});

// CSV Export
document.getElementById('exp-csv-btn').addEventListener('click', () => {
    if (allPositions.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }

    const headers = ['Tipologia', 'Nome', 'ISIN', 'Ticker', 'Dividendo', 'Quantità', 'Prezzo', 'Valore', 'Variazione %'];
    const rows = allPositions.map(p => [
        p.tipologia || '',
        p.nome || '',
        p.isin || '',
        p.ticker || '',
        p.div_yield ? p.div_yield.toFixed(2) + '%' : '',
        p.qty || 0,
        p.last_price || 0,
        p.value || 0,
        p.variazione_perc ? p.variazione_perc.toFixed(2) + '%' : ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// Apply filters
applyFiltersBtn.addEventListener('click', () => {
    currentSort.sortBy = sortBySelect.value;
    currentSort.sortOrder = sortOrderSelect.value;
    loadPortfolio();
});

// Reset filters
resetFiltersBtn.addEventListener('click', () => {
    // Clear all filters
    selectedFilters.types.clear();

    // Uncheck all checkboxes
    document.querySelectorAll('.multi-select-option input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Reset sort
    sortBySelect.value = 'value';
    sortOrderSelect.value = 'desc';
    currentSort = { sortBy: 'value', sortOrder: 'desc' };

    // Update UI
    updateChips();
    updatePlaceholder('type', document.getElementById('filter-type-toggle'));

    // Reload
    loadPortfolio();
});

// Table header sorting
document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const sortKey = th.dataset.sort;

        // Toggle sort order if clicking same column
        if (currentSort.sortBy === sortKey) {
            currentSort.sortOrder = currentSort.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.sortBy = sortKey;
            currentSort.sortOrder = 'desc';
        }

        // Update selects
        sortBySelect.value = currentSort.sortBy;
        sortOrderSelect.value = currentSort.sortOrder;

        loadPortfolio();
    });
});

// ===============================
// GRAPHS OVERLAY
// ===============================

// Chart instances storage
const chartInstances = {};

// View Graphs Button - Open overlay
document.getElementById('view-graph').addEventListener('click', () => {
    const overlay = document.getElementById('graphs-overlay');
    overlay.classList.remove('hidden');

    // Update period info
    const periodEl = document.getElementById('graphs-period');
    const count = allPositions.length;
    periodEl.textContent = `${count} titol${count === 1 ? 'o' : 'i'} nel portfolio`;

    // Render all graphs
    setTimeout(() => renderAllGraphs(), 100);
});

// Close Graphs Button
document.getElementById('close-graphs').addEventListener('click', () => {
    document.getElementById('graphs-overlay').classList.add('hidden');
});

// Tab switching
document.querySelectorAll('.graphs-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        // Update active tab
        document.querySelectorAll('.graphs-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update active content
        document.querySelectorAll('.graphs-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.querySelector(`.graphs-tab-content[data-content="${targetTab}"]`).classList.add('active');
    });
});

// Render all graphs
function renderAllGraphs() {
    // Destroy existing charts
    Object.values(chartInstances).forEach(chart => {
        if (chart && chart.destroy) {
            chart.destroy();
        }
    });

    renderAllocationTreemap();
    renderDividendsByPosition();
    renderDividendsTotal();
}

// ===============================
// ALLOCATION GRAPHS
// ===============================

// Prepare allocation data
function prepareAllocationData() {
    if (!allPositions || allPositions.length === 0) {
        return { treemapData: [] };
    }

    // Sort positions by value (descending)
    const sortedPositions = [...allPositions].sort((a, b) => b.value - a.value);

    // Calculate total
    const totalValue = sortedPositions.reduce((sum, item) => sum + item.value, 0);

    // Treemap data
    const treemapData = sortedPositions.map(position => ({
        name: position.ticker || position.nome,
        value: position.value,
        type: position.tipologia,
        fullName: position.nome,
        percentage: (position.value / totalValue * 100).toFixed(2)
    }));

    return { treemapData };
}

// Render Treemap (as horizontal bar chart)
function renderAllocationTreemap() {
    const { treemapData } = prepareAllocationData();

    if (treemapData.length === 0) {
        document.getElementById('chart-allocation-treemap').innerHTML =
            '<div class="text-center text-gray-500 py-8">Nessun dato disponibile</div>';
        return;
    }

    const options = {
        series: [{
            name: 'Valore',
            data: treemapData.map(d => ({
                x: d.name,
                y: d.value,
                fillColor: d.type === 'ETF' ? '#3b82f6' : '#10b981',
                meta: d
            }))
        }],
        chart: {
            type: 'treemap',
            height: 600,
            toolbar: {
                show: false
            }
        },
        plotOptions: {
            treemap: {
                distributed: true,
                enableShades: false
            }
        },
        dataLabels: {
            enabled: true,
            offsetY: -10,
            style: {
                fontSize: '11px',
                fontFamily: 'monospace'
            },
            formatter: function(text, op) {
                const meta = op.w.config.series[op.seriesIndex].data[op.dataPointIndex].meta;
                return [meta.name, '€ ' + formatNumber(meta.value), meta.percentage + '%'];
            }
        },
        tooltip: {
            custom: function({seriesIndex, dataPointIndex, w}) {
                const meta = w.config.series[seriesIndex].data[dataPointIndex].meta;
                return `
                    <div style="
                        background: #ffffff;
                        color: #1f2937;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 12px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                    ">
                        <div style="font-weight: 600; margin-bottom: 4px;">${meta.fullName}</div>
                        <div style="color: #6b7280; margin-bottom: 4px;">${meta.name} (${meta.type})</div>
                        <div style="color: #333333;">Valore: € ${formatNumber(meta.value)}</div>
                        <div style="color: #333333;">Peso: ${meta.percentage}%</div>
                    </div>
                `;
            }
        },
        legend: {
            show: false
        }
    };

    if (chartInstances['chart-allocation-treemap']) {
        chartInstances['chart-allocation-treemap'].destroy();
    }

    chartInstances['chart-allocation-treemap'] = new ApexCharts(
        document.querySelector('#chart-allocation-treemap'),
        options
    );
    chartInstances['chart-allocation-treemap'].render();
}

// ===============================
// DIVIDENDS GRAPHS
// ===============================

// Prepare dividend data
function prepareDividendData() {
    if (!allPositions || allPositions.length === 0) {
        return { byPosition: [], total: 0 };
    }

    const dividendPositions = allPositions.filter(p => p.div_yield && p.div_yield > 0);

    const byPosition = dividendPositions.map(position => {
        // Calculate: dividend_yield * position_value * (1 - tax_rate)
        const grossDividend = (position.div_yield / 100) * position.value;
        const taxRate = position.tax_rate || 0;
        const netDividend = grossDividend * (1 - taxRate);

        return {
            name: position.ticker || position.nome,
            fullName: position.nome,
            value: netDividend,
            grossValue: grossDividend,
            divYield: position.div_yield,
            taxRate: taxRate,
            positionValue: position.value
        };
    });

    // Sort by net dividend (descending)
    byPosition.sort((a, b) => b.value - a.value);

    const total = byPosition.reduce((sum, item) => sum + item.value, 0);

    return { byPosition, total };
}

// Render Dividends by Position
function renderDividendsByPosition() {
    const { byPosition } = prepareDividendData();

    if (byPosition.length === 0) {
        document.getElementById('chart-dividends-by-position').innerHTML =
            '<div class="text-center text-gray-500 py-8">Nessun titolo con dividendi</div>';
        return;
    }

    // Calculate dynamic height based on number of items
    const itemHeight = 35; // Height per bar
    const baseHeight = 100; // Base padding
    const dynamicHeight = Math.max(450, (byPosition.length * itemHeight) + baseHeight);

    const options = {
        series: [{
            name: 'Dividendo Netto',
            data: byPosition.map(d => ({
                x: d.name,
                y: d.value,
                meta: d
            }))
        }],
        chart: {
            type: 'bar',
            height: dynamicHeight,
            toolbar: {
                show: false
            }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                distributed: false,
                barHeight: '70%',
                dataLabels: {
                    position: 'top'
                }
            }
        },
        colors: ['#10b981'],
        dataLabels: {
            enabled: true,
            offsetX: 30,
            style: {
                fontSize: '10px',
                fontFamily: 'monospace',
                colors: ['#10b981']
            },
            formatter: function(val) {
                return '€ ' + formatNumber(val);
            }
        },
        xaxis: {
            labels: {
                formatter: function(val) {
                    return '€ ' + formatNumber(val);
                },
                style: {
                    fontSize: '10px',
                    fontFamily: 'monospace'
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    fontSize: '10px',
                    fontFamily: 'monospace'
                }
            }
        },
        tooltip: {
            custom: function({seriesIndex, dataPointIndex, w}) {
                const meta = w.config.series[seriesIndex].data[dataPointIndex].meta;
                return `
                    <div style="
                        background: #ffffff;
                        color: #1f2937;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 12px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                    ">
                        <div style="font-weight: 600; margin-bottom: 4px;">${meta.fullName}</div>
                        <div style="color: #333333; margin-top: 4px;">Dividend Yield: ${meta.divYield.toFixed(2)}%</div>
                        <div style="color: #333333;">Valore Posizione: € ${formatNumber(meta.positionValue)}</div>
                        <div style="color: #333333;">Dividendo Lordo: € ${formatNumber(meta.grossValue)}</div>
                        <div style="color: #333333;">Tassazione: ${(meta.taxRate * 100).toFixed(1)}%</div>
                        <div style="font-weight: 600; margin-top: 4px; color: #10b981;">Dividendo Netto: € ${formatNumber(meta.value)}</div>
                    </div>
                `;
            }
        },
        grid: {
            xaxis: {
                lines: {
                    show: true
                }
            },
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 10
            }
        }
    };

    if (chartInstances['chart-dividends-by-position']) {
        chartInstances['chart-dividends-by-position'].destroy();
    }

    chartInstances['chart-dividends-by-position'] = new ApexCharts(
        document.querySelector('#chart-dividends-by-position'),
        options
    );
    chartInstances['chart-dividends-by-position'].render();
}

// Render Total Dividends
function renderDividendsTotal() {
    const { byPosition, total } = prepareDividendData();

    if (byPosition.length === 0) {
        document.getElementById('chart-dividends-total').innerHTML =
            '<div class="text-center text-gray-500 py-8">Nessun titolo con dividendi</div>';
        return;
    }

    const series = byPosition.map(d => d.value);
    const labels = byPosition.map(d => d.name);

    const options = {
        series: series,
        labels: labels,
        chart: {
            type: 'donut',
            height: 450,
            toolbar: {
                show: false
            }
        },
        plotOptions: {
            pie: {
                startAngle: 0,
                endAngle: 360,
                expandOnClick: true,
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            offsetY: -10
                        },
                        value: {
                            show: true,
                            fontSize: '20px',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            offsetY: 5,
                            formatter: function (val) {
                                return '€ ' + formatNumber(parseFloat(val));
                            }
                        },
                        total: {
                            show: true,
                            showAlways: true,
                            label: 'Totale Dividendi Annuali',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: '#373d3f',
                            formatter: function () {
                                return '€ ' + formatNumber(total);
                            }
                        }
                    }
                }
            }
        },
        colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5',
                 '#3b82f6', '#2563eb', '#60a5fa', '#93c5fd', '#dbeafe', '#eff6ff'],
        dataLabels: {
            enabled: false
        },
        tooltip: {
            custom: function({seriesIndex, dataPointIndex, w}) {
                const meta = byPosition[seriesIndex];
                const val = series[seriesIndex];
                const percentage = (val / total * 100).toFixed(2);
                return `
                    <div style="
                        background: #ffffff;
                        color: #1f2937;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-family: 'JetBrains Mono', monospace;
                        font-size: 12px;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                    ">
                        <div style="font-weight: 600; margin-bottom: 4px;">${meta.fullName}</div>
                        <div style="color: #6b7280; margin-bottom: 4px;">${meta.name}</div>
                        <div style="color: #333333;">Dividend Yield: ${meta.divYield.toFixed(2)}%</div>
                        <div style="color: #333333;">Valore Posizione: € ${formatNumber(meta.positionValue)}</div>
                        <div style="color: #333333;">Dividendo Lordo: € ${formatNumber(meta.grossValue)}</div>
                        <div style="color: #333333;">Tassazione: ${(meta.taxRate * 100).toFixed(1)}%</div>
                        <div style="font-weight: 600; margin-top: 4px; color: #10b981;">Dividendo Netto: € ${formatNumber(val)}</div>
                        <div style="color: #333333; margin-top: 2px;">Percentuale sul totale: ${percentage}%</div>
                    </div>
                `;
            }
        },
        legend: {
            show: false
        },
        responsive: [{
            breakpoint: 480,
            options: {
                chart: {
                    height: 300
                }
            }
        }]
    };

    if (chartInstances['chart-dividends-total']) {
        chartInstances['chart-dividends-total'].destroy();
    }

    chartInstances['chart-dividends-total'] = new ApexCharts(
        document.querySelector('#chart-dividends-total'),
        options
    );
    chartInstances['chart-dividends-total'].render();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeMultiSelects();
    loadPortfolio();
});
