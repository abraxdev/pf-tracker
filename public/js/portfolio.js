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
        updateSummary(allPositions);

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
                    <div class="font-medium text-gray-900 font-mono">${position.nome || 'N/A'}</div>
                    <div class="text-xs text-gray-500">${position.isin}</div>
                </td>
                <td class="px-1 py-1 text-sm text-center">
                    <span class="editable-field items-center px-2 py-0.5 rounded text-xs font-medium is-type bg-gray-100 text-gray-800 font-mono" data-field="ticker" data-isin="${position.isin}">
                        ${position.ticker || '-'}
                    </span>
                </td>
                <td class="px-3 py-3 text-sm text-center font-mono font-bold text-gray-900 ${position.div_yield ? 'underline' : ''}">
                    ${position.div_yield ? position.div_yield.toFixed(2) + '%' : '-'}
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
                        <div class="px-6 py-4">
                            <div class="text-sm font-medium text-gray-700 mb-3">Transazioni per ${position.nome}</div>
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
    const qtyCell = cells[4];
    const tickerCell = cells[2];
    const actionsCell = cells[8];

    // Store original HTML
    const originalQtyHTML = qtyCell.innerHTML;
    const originalTickerHTML = tickerCell.innerHTML;
    const originalActionsHTML = actionsCell.innerHTML;

    // Get current values
    const currentQty = qtyCell.textContent.trim();
    const currentTicker = tickerCell.textContent.trim();

    // Replace with input fields
    qtyCell.innerHTML = `<input type="text" value="${currentQty}" class="edit-input text-center font-mono" id="edit-qty-${isin}">`;
    tickerCell.innerHTML = `<input type="text" value="${currentTicker}" class="edit-input text-center font-mono" id="edit-ticker-${isin}">`;

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
        qtyCell.innerHTML = originalQtyHTML;
        tickerCell.innerHTML = originalTickerHTML;
        actionsCell.innerHTML = originalActionsHTML;
        row.dataset.isEditing = 'false';

        // Reattach event handlers
        attachRowEventListeners();
    };

    // Save function
    const saveEdit = async () => {
        const newQty = parseFloat(qtyInput.value);
        const newTicker = document.getElementById(`edit-ticker-${isin}`).value.trim();

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
            const response = await fetch(`/api/portfolio/${isin}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qty: newQty, ticker: newTicker })
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
        let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';

        // Investments
        html += '<div>';
        html += '<div class="flex justify-between items-center mb-2">';
        html += '<h4 class="font-medium text-sm text-gray-700">Investimenti</h4>';
        html += `<div class="text-xs font-bold text-purple-600">Tot: € ${formatNumber(transactions.tot_investito || 0)}</div>`;
        html += '</div>';
        if (transactions.investments && transactions.investments.length > 0) {
            html += '<div class="space-y-1">';
            transactions.investments.forEach(tx => {
                const amountOut = parseFloat(tx.amount_out || 0);
                const amountIn = parseFloat(tx.amount_in || 0);
                const netAmount = amountOut - amountIn;
                const displayColor = netAmount >= 0 ? 'text-gray-900' : 'text-red-600';
                html += `
                    <div class="text-xs bg-white p-2 rounded border border-gray-200">
                        <div class="flex justify-between">
                            <span class="text-gray-600">${formatDate(tx.transaction_date)}</span>
                            <span class="font-mono font-medium ${displayColor}">€ ${formatNumber(netAmount)}</span>
                        </div>
                        <div class="text-gray-500 mt-1">${tx.description || '-'}</div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<div class="text-xs text-gray-500">Nessun investimento</div>';
        }
        html += '</div>';

        // Dividends
        html += '<div>';
        html += '<h4 class="font-medium text-sm text-gray-700 mb-2">Dividendi</h4>';
        if (transactions.dividends && transactions.dividends.length > 0) {
            html += '<div class="space-y-1">';
            transactions.dividends.forEach(tx => {
                const amount = tx.amount_in || 0;
                html += `
                    <div class="text-xs bg-white p-2 rounded border border-gray-200">
                        <div class="flex justify-between">
                            <span class="text-gray-600">${formatDate(tx.transaction_date)}</span>
                            <span class="font-mono font-medium text-green-600">€ ${formatNumber(amount)}</span>
                        </div>
                        <div class="text-gray-500 mt-1">${tx.description || '-'}</div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<div class="text-xs text-gray-500">Nessun dividendo</div>';
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
function updateSummary(positions) {
    const count = positions.length;
    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);

    document.getElementById('summary-count').textContent = count;
    document.getElementById('summary-total').textContent = `€ ${formatNumber(totalValue)}`;
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeMultiSelects();
    loadPortfolio();
});
