// Transactions page filters and interactions

// Filter elements
const filterSearch = document.getElementById('filter-search');
const filterDateStart = document.getElementById('filter-date-start');
const filterDateEnd = document.getElementById('filter-date-end');
const applyFiltersBtn = document.getElementById('apply-filters');
const resetFiltersBtn = document.getElementById('reset-filters');
const toggleAdvancedBtn = document.getElementById('toggle-advanced-filters');
const advancedFilters = document.getElementById('advanced-filters');
const monthFilterContainer = document.getElementById('month-filter-container');
const transactionsTbody = document.getElementById('transactions-tbody');
const loadMoreBtn = document.getElementById('load-more-btn');
const loadMoreContainer = document.getElementById('load-more-container');

// Multi-select state
const selectedFilters = {
    banks: new Set(),
    types: new Set(),
    categories: new Set()
};

// Helper function to get the correct plural form and filter key
function getFilterKey(filterName) {
    const keyMap = {
        'bank': 'banks',
        'type': 'types',
        'category': 'categories'
    };
    return keyMap[filterName] || `${filterName}s`;
}

// Pagination state
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let loadedTransactionIds = new Set(); // Track loaded transaction IDs to prevent duplicates
let selectedMonth = null; // Track selected month filter

// Initialize multi-select dropdowns
async function initializeMultiSelects() {
    try {
        // Fetch filter values from API
        const response = await fetch('/api/transactions/filters/values');
        const result = await response.json();

        if (result.success) {
            const { banks, types, categories } = result.data;

            // Store categories and types globally for edit mode
            availableCategories = categories;
            availableTypes = types;

            // Initialize each multi-select
            initMultiSelect('bank', banks, 'Banca');
            initMultiSelect('type', types, 'Tipo');
            initMultiSelect('category', categories, 'Categoria');
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
    const filterKey = getFilterKey(filterName);

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

        // Close other dropdowns
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

        // Update selected filters
        if (checkbox.checked) {
            selectedFilters[filterKey].add(value);
        } else {
            selectedFilters[filterKey].delete(value);
        }

        // Update chips display
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

// Update chips display in unified container
function updateChips() {
    // Update unified chips container instead
    updateUnifiedChipsContainer();
}

// Update unified chips container with all selected filters
function updateUnifiedChipsContainer() {
    const unifiedContainer = document.getElementById('unified-chips-container');
    if (!unifiedContainer) return;

    let allChips = [];

    // Add bank chips
    const selectedBanks = Array.from(selectedFilters.banks);
    selectedBanks.forEach(value => {
        allChips.push({
            filterType: 'bank',
            filterName: 'bank',
            value: value,
            label: value
        });
    });

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

    // Add category chips
    const selectedCategories = Array.from(selectedFilters.categories);
    selectedCategories.forEach(value => {
        allChips.push({
            filterType: 'category',
            filterName: 'category',
            value: value,
            label: value
        });
    });

    if (allChips.length === 0) {
        unifiedContainer.innerHTML = '<span class="text-sm text-gray-400 italic">Nessun filtro selezionato</span>';
        return;
    }

    unifiedContainer.innerHTML = allChips.map(chip => `
        <span class="chip" data-filter-type="${chip.filterType}" data-value="${chip.value}">
            ${chip.label}
            <button type="button" class="chip-remove" data-filter="${chip.filterName}" data-value="${chip.value}">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </span>
    `).join('');

    // Handle chip removal
    unifiedContainer.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const filterName = btn.dataset.filter;
            const value = btn.dataset.value;
            removeFilter(filterName, value);
        });
    });
}

// Update placeholder text
function updatePlaceholder(filterName, toggle) {
    const filterKey = getFilterKey(filterName);
    const selected = Array.from(selectedFilters[filterKey]);
    const placeholder = toggle.querySelector('.multi-select-placeholder');

    const placeholders = {
        bank: 'Tutte le banche',
        type: 'Tutti i tipi',
        category: 'Tutte le categorie'
    };

    if (selected.length === 0) {
        placeholder.textContent = placeholders[filterName];
        placeholder.style.color = '#6b7280';
    } else {
        placeholder.textContent = `${selected.length} selezionat${selected.length > 1 ? 'i' : 'o'}`;
        placeholder.style.color = '#7e22ce';
    }
}

// Remove a filter value
function removeFilter(filterName, value) {
    const filterKey = getFilterKey(filterName);
    selectedFilters[filterKey].delete(value);

    // Update checkbox state
    const checkbox = document.getElementById(`${filterName}-${value}`);
    if (checkbox) {
        checkbox.checked = false;
    }

    // Update UI
    const toggle = document.getElementById(`filter-${filterName}-toggle`);
    updateChips();
    updatePlaceholder(filterName, toggle);
}

// Toggle advanced filters
toggleAdvancedBtn.addEventListener('click', () => {
    advancedFilters.classList.toggle('hidden');
    const isVisible = !advancedFilters.classList.contains('hidden');
    toggleAdvancedBtn.innerHTML = isVisible
        ? '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>Nascondi Filtri Avanzati'
        : '<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>Filtri Avanzati';
});

// Generate month filter buttons
function generateMonthFilters() {
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
                    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();

    let monthsHTML = '';

    // Generate from current month back to January
    for (let i = currentMonth; i >= 0; i--) {
        const monthValue = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        monthsHTML += `
            <button type="button"
                    class="month-filter-btn btn-outline text-xs px-2"
                    data-month="${monthValue}">
                ${months[i]}
            </button>
        `;
    }

    monthFilterContainer.innerHTML = monthsHTML;

    // Add click handlers to month buttons
    document.querySelectorAll('.month-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Toggle selection
            const month = btn.dataset.month;

            if (selectedMonth === month) {
                // Deselect
                selectedMonth = null;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            } else {
                // Deselect all others
                document.querySelectorAll('.month-filter-btn').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-outline');
                });

                // Select this one
                selectedMonth = month;
                btn.classList.remove('btn-outline');
                btn.classList.add('btn-primary');

                // Clear custom date range when selecting month
                filterDateStart.value = '';
                filterDateEnd.value = '';
            }
        });
    });
}

// Apply filters
applyFiltersBtn.addEventListener('click', async () => {
    currentPage = 1; // Reset to first page when applying filters
    loadedTransactionIds.clear(); // Clear loaded IDs when applying new filters
    await loadTransactions(true); // true = replace existing transactions
});

// Reset filters
resetFiltersBtn.addEventListener('click', () => {
    // Clear multi-select filters
    selectedFilters.banks.clear();
    selectedFilters.types.clear();
    selectedFilters.categories.clear();

    // Reset checkboxes
    document.querySelectorAll('.multi-select-option input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });

    // Clear unified chips container
    updateChips();

    // Reset placeholders
    ['bank', 'type', 'category'].forEach(filterName => {
        const toggle = document.getElementById(`filter-${filterName}-toggle`);
        if (toggle) updatePlaceholder(filterName, toggle);
    });

    // Clear other filters
    filterSearch.value = '';
    filterDateStart.value = '';
    filterDateEnd.value = '';
    selectedMonth = null;

    // Reset month buttons
    document.querySelectorAll('.month-filter-btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
    });

    currentPage = 1;
    loadedTransactionIds.clear(); // Clear loaded IDs when resetting filters
    loadTransactions(true);
});

// Load more button
if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async () => {
        if (!isLoading && currentPage < totalPages) {
            currentPage++;
            await loadTransactions(false); // false = append to existing transactions
        }
    });
}

// Load transactions with filters
async function loadTransactions(replace = true) {
    if (isLoading) return;

    const params = new URLSearchParams();

    // Multi-select filters (comma-separated values)
    if (selectedFilters.banks.size > 0) {
        params.append('bank', Array.from(selectedFilters.banks).join(','));
    }
    if (selectedFilters.types.size > 0) {
        params.append('type', Array.from(selectedFilters.types).join(','));
    }
    if (selectedFilters.categories.size > 0) {
        params.append('category', Array.from(selectedFilters.categories).join(','));
    }

    if (filterSearch.value) params.append('search', filterSearch.value);

    // Month filter (takes precedence over custom date range)
    if (selectedMonth) {
        params.append('month', selectedMonth);
    }
    // Custom date range (only if month filter is not active)
    else if (filterDateStart.value || filterDateEnd.value) {
        if (filterDateStart.value) params.append('dateStart', filterDateStart.value);
        if (filterDateEnd.value) params.append('dateEnd', filterDateEnd.value);
    }

    params.append('limit', '100');
    params.append('page', currentPage.toString());
    params.append('status', 'all'); // Show all transactions (active and excluded)

    try {
        isLoading = true;
        updateLoadMoreButton('loading');

        const response = await fetch(`/api/transactions?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
            totalPages = result.pagination.totalPages;
            displayTransactions(result.data, replace);
            updateLoadMoreButton('idle');
        } else {
            console.error('Error loading transactions:', result.error);
            alert('Errore nel caricamento delle transazioni');
            updateLoadMoreButton('idle');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Errore nel caricamento delle transazioni');
        updateLoadMoreButton('idle');
    } finally {
        isLoading = false;
    }
}

// Update load more button state
function updateLoadMoreButton(state) {
    if (!loadMoreBtn || !loadMoreContainer) return;

    if (state === 'loading') {
        loadMoreBtn.disabled = true;
        loadMoreBtn.innerHTML = '<span class="spinner"></span> Caricamento...';
    } else if (state === 'idle') {
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = 'Carica altre...';

        // Show/hide load more button based on pagination
        if (currentPage >= totalPages) {
            loadMoreContainer.style.display = 'none';
        } else {
            loadMoreContainer.style.display = 'block';
        }
    }
}

function displayTransactions(transactions, replace = true) {
    if (!transactionsTbody) return;

    // Filter out duplicates based on transaction ID
    const newTransactions = transactions.filter(tx => {
        if (loadedTransactionIds.has(tx.id)) {
            console.warn(`Duplicate transaction detected and skipped: ID ${tx.id}`);
            return false;
        }
        return true;
    });

    // Add new transaction IDs to the set
    newTransactions.forEach(tx => loadedTransactionIds.add(tx.id));

    // If replacing, clear the set and re-add all IDs
    if (replace) {
        loadedTransactionIds.clear();
        transactions.forEach(tx => loadedTransactionIds.add(tx.id));
    }

    if (newTransactions.length === 0 && replace) {
        transactionsTbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    Nessuna transazione trovata con i filtri selezionati.
                </td>
            </tr>
        `;
        // Hide load more button when no transactions
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        return;
    }

    // Skip rendering if all transactions were duplicates (append mode only)
    if (newTransactions.length === 0 && !replace) {
        console.warn('All transactions in this batch were duplicates, skipping render');
        return;
    }

    const transactionsHTML = newTransactions.map(tx => {
        const date = new Date(tx.transaction_date).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const formattedAmountIn = tx.amount_in ? new Intl.NumberFormat('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(tx.amount_in) : null;

        const formattedAmountOut = tx.amount_out ? new Intl.NumberFormat('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(tx.amount_out) : null;

        // Apply different styling for excluded transactions
        const isExcluded = tx.status === 'excluded';
        const rowClass = isExcluded ? 'transaction-row-excluded' : 'hover:bg-gray-50';
        const statusIcon = isExcluded
            ? '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
            : '<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

        return `
            <tr class="transaction-row ${rowClass}" data-transaction-id="${tx.id}" data-status="${tx.status}" data-isin="${tx.isin || ''}">
                <td class="px-3 py-3 text-xs text-gray-900 font-mono">${date}</td>
                <td class="px-3 py-3 text-sm text-center">
                    <span class="badge badge-${tx.bank}">${tx.bank}</span>
                </td>
                <td class="px-3 py-3 text-xs text-gray-900 font-mono">
                    <div class="transaction-description" data-original="${escapeHtml(tx.description)}" title="${escapeHtml(tx.description)}">
                        ${escapeHtml(tx.description)}
                    </div>
                    ${tx.merchant ? `<div class="text-xs text-gray-500">${escapeHtml(tx.merchant)}</div>` : ''}
                </td>
                <td class="px-3 py-2 text-sm text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium is-category font-mono">
                        ${tx.category || 'uncategorized'}
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium is-type bg-gray-100 text-gray-800 font-mono">
                        ${tx.type || 'uncategorized'}
                    </span>

                </td>
                <td class="px-2 py-3 text-sm text-center font-semibold">
                    ${formattedAmountIn ? `<span class="amount-in">€ ${formattedAmountIn}</span>` : '<span class="amount-zero">-</span>'}
                </td>
                <td class="px-2 py-3 text-sm text-center font-semibold">
                    ${formattedAmountOut ? `<span class="amount-out">€ ${formattedAmountOut}</span>` : '<span class="amount-zero">—</span>'}
                </td>
                <td class="px-2 py-3 text-center">
                    <div class="row-actions opacity-0 transition-opacity flex items-center justify-center gap-0.5">
                        <button class="action-edit p-1 hover:bg-gray-100 rounded" title="Modifica transazione">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button class="action-toggle p-1 hover:bg-gray-100 rounded" title="${isExcluded ? 'Attiva' : 'Escludi'}">
                            ${statusIcon}
                        </button>
                        <button class="action-delete p-1 hover:bg-gray-100 rounded" title="Elimina">
                            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Replace or append based on the parameter
    if (replace) {
        transactionsTbody.innerHTML = transactionsHTML;
    } else {
        transactionsTbody.insertAdjacentHTML('beforeend', transactionsHTML);
    }

    // Attach event handlers to action buttons
    attachActionHandlers();

    // Update summary bar with all currently displayed transactions
    updateSummaryBar();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Transaction Actions
function attachActionHandlers() {
    // Edit description
    document.querySelectorAll('.action-edit').forEach(btn => {
        btn.addEventListener('click', handleEditDescription);
    });

    // Toggle status
    document.querySelectorAll('.action-toggle').forEach(btn => {
        btn.addEventListener('click', handleToggleStatus);
    });

    // Delete transaction
    document.querySelectorAll('.action-delete').forEach(btn => {
        btn.addEventListener('click', handleDeleteTransaction);
    });
}

// Global variables to store available categories and types
let availableCategories = [];
let availableTypes = [];

async function handleEditDescription(e) {
    e.stopPropagation();
    const row = e.target.closest('tr');
    const transactionId = row.dataset.transactionId;

    // Prevent multiple edits on the same row
    if (row.dataset.isEditing === 'true') {
        return;
    }
    row.dataset.isEditing = 'true';

    const cells = row.querySelectorAll('td');

    // Get original values
    const descriptionDiv = cells[2].querySelector('.transaction-description');
    const originalDescription = descriptionDiv.dataset.original;

    const categoryTypeCell = cells[3];
    const categorySpan = categoryTypeCell.querySelector('.is-category');
    const originalCategory = categorySpan.textContent.trim();

    const typeSpan = categoryTypeCell.querySelector('.is-type');
    const originalType = typeSpan.textContent.trim();

    const amountInCell = cells[4];
    const amountOutCell = cells[5];
    const originalAmountInText = amountInCell.textContent.trim();
    const originalAmountOutText = amountOutCell.textContent.trim();

    // Parse amounts (from "€ 1.234,56" to "1234.56" for storage, "1234,56" for input)
    const parseAmount = (text) => {
        if (!text || text === '-' || text === '—') return null;
        return text.replace('€', '').trim().replace(/\./g, '').replace(',', '.');
    };

    const formatAmountForInput = (text) => {
        if (!text || text === '-' || text === '—') return '';
        const cleaned = text.replace('€', '').trim().replace(/\./g, '');
        return cleaned;
    };

    const originalAmountIn = parseAmount(originalAmountInText);
    const originalAmountOut = parseAmount(originalAmountOutText);

    const amountInForInput = formatAmountForInput(originalAmountInText);
    const amountOutForInput = formatAmountForInput(originalAmountOutText);

    // Store original HTML for all cells
    const originalDescriptionHTML = descriptionDiv.innerHTML;
    const originalCategoryHTML = categoryTypeCell.innerHTML;
    const originalAmountInHTML = amountInCell.innerHTML;
    const originalAmountOutHTML = amountOutCell.innerHTML;
    const actionsCell = cells[6];
    const originalActionsHTML = actionsCell.innerHTML;

    // Build category options
    const categoryOptions = availableCategories.map(cat =>
        `<option value="${cat}" ${cat === originalCategory ? 'selected' : ''}>${cat}</option>`
    ).join('');

    // Build type options
    const typeOptions = availableTypes.map(type =>
        `<option value="${type}" ${type === originalType ? 'selected' : ''}>${type}</option>`
    ).join('');

    // Replace description cell with input
    descriptionDiv.innerHTML = `<input type="text" class="edit-input" id="edit-desc-${transactionId}" value="${escapeHtml(originalDescription)}" placeholder="Descrizione">`;

    // Replace category/type cell with two selects
    categoryTypeCell.innerHTML = `
        <select class="edit-category-select" id="edit-cat-${transactionId}">${categoryOptions}</select>
        <select class="edit-type-select" id="edit-type-${transactionId}">${typeOptions}</select>
    `;

    // Replace amount cells with inputs
    amountInCell.innerHTML = `<input type="text" class="edit-input" id="edit-in-${transactionId}" value="${amountInForInput}" placeholder="0,00" data-type="amount">`;
    amountOutCell.innerHTML = `<input type="text" class="edit-input" id="edit-out-${transactionId}" value="${amountOutForInput}" placeholder="0,00" data-type="amount">`;

    // Replace actions cell with save/cancel buttons
    actionsCell.innerHTML = `
        <div class="edit-actions-buttons flex items-center justify-center gap-1">
            <button class="edit-save-btn p-1 hover:bg-green-100 rounded" title="Salva modifiche (Enter)">
                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </button>
            <button class="edit-cancel-btn p-1 hover:bg-red-100 rounded" title="Annulla (Esc)">
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `;

    // Focus on description
    const descInput = document.getElementById(`edit-desc-${transactionId}`);
    descInput.focus();
    descInput.select();

    // Add validation and formatting to amount inputs
    const amountInInput = document.getElementById(`edit-in-${transactionId}`);
    const amountOutInput = document.getElementById(`edit-out-${transactionId}`);

    [amountInInput, amountOutInput].forEach(input => {
        input.addEventListener('blur', (e) => {
            validateAndFormatAmount(e.target);
        });
    });

    // Handle save
    const saveEdit = async () => {
        const newDescription = descInput.value.trim();
        const newCategory = document.getElementById(`edit-cat-${transactionId}`).value;
        const newType = document.getElementById(`edit-type-${transactionId}`).value;
        const newAmountInText = amountInInput.value.trim();
        const newAmountOutText = amountOutInput.value.trim();

        // Validate amounts
        const amountInValid = !newAmountInText || validateItalianAmount(newAmountInText);
        const amountOutValid = !newAmountOutText || validateItalianAmount(newAmountOutText);

        if (!amountInValid) {
            amountInInput.classList.add('error');
            alert('Formato entrate non valido. Usa formato italiano: es. 1234,56');
            return;
        }

        if (!amountOutValid) {
            amountOutInput.classList.add('error');
            alert('Formato uscite non valido. Usa formato italiano: es. 1234,56');
            return;
        }

        // Convert amounts to database format (decimal)
        const newAmountIn = newAmountInText ? parseFloat(newAmountInText.replace(/\./g, '').replace(',', '.')) : null;
        const newAmountOut = newAmountOutText ? parseFloat(newAmountOutText.replace(/\./g, '').replace(',', '.')) : null;

        // Check if anything changed
        const descChanged = newDescription !== originalDescription;
        const catChanged = newCategory !== originalCategory;
        const typeChanged = newType !== originalType;
        const amountInChanged = newAmountIn !== (originalAmountIn ? parseFloat(originalAmountIn) : null);
        const amountOutChanged = newAmountOut !== (originalAmountOut ? parseFloat(originalAmountOut) : null);

        if (!descChanged && !catChanged && !typeChanged && !amountInChanged && !amountOutChanged) {
            // Nothing changed, just restore
            restoreOriginal();
            return;
        }

        // Build update object
        const updates = {};
        if (descChanged) updates.description = newDescription;
        if (catChanged) updates.category = newCategory;
        if (typeChanged) updates.type = newType;
        if (amountInChanged) updates.amount_in = newAmountIn;
        if (amountOutChanged) updates.amount_out = newAmountOut;

        // Show loading state on save button
        const saveBtn = actionsCell.querySelector('.edit-save-btn');
        const originalSaveBtnHTML = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
            <svg class="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;

        try {
            const response = await fetch(`/api/transactions/${transactionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            const result = await response.json();

            if (result.success) {
                // Show success state briefly
                saveBtn.innerHTML = `
                    <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                `;

                // Update only this row with fresh data instead of reloading entire table
                setTimeout(async () => {
                    await updateSingleRow(transactionId, row);
                }, 300);
            } else {
                alert('Errore nell\'aggiornamento della transazione');
                saveBtn.innerHTML = originalSaveBtnHTML;
                saveBtn.disabled = false;
                row.dataset.isEditing = 'false';
            }
        } catch (error) {
            console.error('Error updating transaction:', error);
            alert('Errore nell\'aggiornamento della transazione');
            saveBtn.innerHTML = originalSaveBtnHTML;
            saveBtn.disabled = false;
            row.dataset.isEditing = 'false';
        }
    };

    const restoreOriginal = () => {
        descriptionDiv.innerHTML = originalDescriptionHTML;
        categoryTypeCell.innerHTML = originalCategoryHTML;
        amountInCell.innerHTML = originalAmountInHTML;
        amountOutCell.innerHTML = originalAmountOutHTML;
        actionsCell.innerHTML = originalActionsHTML;

        // Reset editing flag
        row.dataset.isEditing = 'false';

        // CRITICAL: Reattach event handlers after restoring HTML
        const editBtn = actionsCell.querySelector('.action-edit');
        const toggleBtn = actionsCell.querySelector('.action-toggle');
        const deleteBtn = actionsCell.querySelector('.action-delete');

        if (editBtn) editBtn.addEventListener('click', handleEditDescription);
        if (toggleBtn) toggleBtn.addEventListener('click', handleToggleStatus);
        if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteTransaction);
    };

    // Get save and cancel buttons
    const saveBtn = actionsCell.querySelector('.edit-save-btn');
    const cancelBtn = actionsCell.querySelector('.edit-cancel-btn');

    // Save button click
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveEdit();
    });

    // Cancel button click
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        restoreOriginal();
    });

    // Save on Enter in any field
    [descInput, document.getElementById(`edit-cat-${transactionId}`), document.getElementById(`edit-type-${transactionId}`), amountInInput, amountOutInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                restoreOriginal();
            }
        });
    });
}

// Update a single row with fresh data from the server
async function updateSingleRow(transactionId, row) {
    try {
        const response = await fetch(`/api/transactions/${transactionId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const tx = result.data;

            // Format data same as in displayTransactions
            const date = new Date(tx.transaction_date).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });

            const formattedAmountIn = tx.amount_in ? new Intl.NumberFormat('it-IT', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(tx.amount_in) : null;

            const formattedAmountOut = tx.amount_out ? new Intl.NumberFormat('it-IT', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(tx.amount_out) : null;

            const isExcluded = tx.status === 'excluded';
            const rowClass = isExcluded ? 'transaction-row-excluded' : 'hover:bg-gray-50';
            const statusIcon = isExcluded
                ? '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                : '<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

            // Build new row HTML
            const newRowHTML = `
                <td class="px-3 py-3 text-xs text-gray-900 font-mono">${date}</td>
                <td class="px-3 py-3 text-sm text-center">
                    <span class="badge badge-${tx.bank}">${tx.bank}</span>
                </td>
                <td class="px-3 py-3 text-xs text-gray-900 font-mono">
                    <div class="transaction-description" data-original="${escapeHtml(tx.description)}" title="${escapeHtml(tx.description)}">
                        ${escapeHtml(tx.description)}
                    </div>
                    ${tx.merchant ? `<div class="text-xs text-gray-500">${escapeHtml(tx.merchant)}</div>` : ''}
                </td>
                <td class="px-3 py-2 text-sm text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium is-category font-mono">
                        ${tx.category || 'uncategorized'}
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium is-type font-mono">
                        ${tx.type || 'uncategorized'}
                    </span>
                </td>
                <td class="px-2 py-3 text-sm text-center font-semibold">
                    ${formattedAmountIn ? `<span class="amount-in">€ ${formattedAmountIn}</span>` : '<span class="amount-zero">-</span>'}
                </td>
                <td class="px-2 py-3 text-sm text-center font-semibold">
                    ${formattedAmountOut ? `<span class="amount-out">€ ${formattedAmountOut}</span>` : '<span class="amount-zero">—</span>'}
                </td>
                <td class="px-2 py-3 text-center">
                    <div class="row-actions opacity-0 transition-opacity flex items-center justify-center gap-0.5">
                        <button class="action-edit p-1 hover:bg-gray-100 rounded" title="Modifica transazione">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                        <button class="action-toggle p-1 hover:bg-gray-100 rounded" title="${isExcluded ? 'Attiva' : 'Escludi'}">
                            ${statusIcon}
                        </button>
                        <button class="action-delete p-1 hover:bg-gray-100 rounded" title="Elimina">
                            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            `;

            // Update row class and content
            row.className = `transaction-row ${rowClass}`;
            row.dataset.status = tx.status;
            row.dataset.isin = tx.isin || '';
            row.dataset.isEditing = 'false';
            row.innerHTML = newRowHTML;

            // Reattach event handlers to this row
            const editBtn = row.querySelector('.action-edit');
            const toggleBtn = row.querySelector('.action-toggle');
            const deleteBtn = row.querySelector('.action-delete');

            if (editBtn) editBtn.addEventListener('click', handleEditDescription);
            if (toggleBtn) toggleBtn.addEventListener('click', handleToggleStatus);
            if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteTransaction);

            // Update summary bar
            updateSummaryBar();
        } else {
            console.error('Failed to fetch updated transaction data');
            // Fallback: reload entire table
            loadTransactions(true);
        }
    } catch (error) {
        console.error('Error updating single row:', error);
        // Fallback: reload entire table
        loadTransactions(true);
    }
}

// Validate Italian decimal format (allows: 1234,56 or 1.234,56)
function validateItalianAmount(value) {
    if (!value) return true;
    // Pattern: optional digits with optional thousand separators (.), comma, exactly 2 decimals
    const pattern = /^(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?$/;
    return pattern.test(value);
}

// Format and validate amount input on blur
function validateAndFormatAmount(input) {
    const value = input.value.trim();
    if (!value) {
        input.classList.remove('error');
        return;
    }

    if (validateItalianAmount(value)) {
        input.classList.remove('error');
    } else {
        input.classList.add('error');
    }
}

async function handleToggleStatus(e) {
    e.stopPropagation();
    const row = e.target.closest('tr');
    const transactionId = row.dataset.transactionId;
    const currentStatus = row.dataset.status;
    const newStatus = currentStatus === 'excluded' ? 'active' : 'excluded';

    try {
        const response = await fetch(`/api/transactions/${transactionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        const result = await response.json();

        if (result.success) {
            // Update row status
            row.dataset.status = newStatus;

            // Update row styling
            if (newStatus === 'excluded') {
                row.classList.remove('hover:bg-gray-50');
                row.classList.add('transaction-row-excluded');
            } else {
                row.classList.remove('transaction-row-excluded');
                row.classList.add('hover:bg-gray-50');
            }

            // Update button icon
            const button = e.target.closest('button');
            const isExcluded = newStatus === 'excluded';
            button.innerHTML = isExcluded
                ? '<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
                : '<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            button.setAttribute('title', isExcluded ? 'Attiva' : 'Escludi');

            // Update summary bar (excluded transactions should not be counted)
            updateSummaryBar();
        } else {
            alert('Errore nell\'aggiornamento dello stato');
        }
    } catch (error) {
        console.error('Error toggling status:', error);
        alert('Errore nell\'aggiornamento dello stato');
    }
}

async function handleDeleteTransaction(e) {
    e.stopPropagation();
    const row = e.target.closest('tr');
    const transactionId = row.dataset.transactionId;

    // Simple confirmation
    if (!confirm('Sei sicuro di voler eliminare questa transazione?')) {
        return;
    }

    try {
        const response = await fetch(`/api/transactions/${transactionId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            // Remove row with fade out animation
            row.style.transition = 'opacity 0.3s ease-out';
            row.style.opacity = '0';

            setTimeout(() => {
                row.remove();
                loadedTransactionIds.delete(transactionId);
                updateSummaryBar();
            }, 300);
        } else {
            alert('Errore nell\'eliminazione della transazione');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Errore nell\'eliminazione della transazione');
    }
}

// Summary Bar Functions
function updateSummaryBar() {
    const rows = transactionsTbody.querySelectorAll('tr');

    // If no transactions or showing "no results" message, hide summary bar
    if (rows.length === 0 || rows[0].querySelector('td[colspan]')) {
        hideSummaryBar();
        return;
    }

    let totalEntrate = 0;
    let totalUscite = 0;
    let count = 0;

    rows.forEach(row => {
        // Skip if it's a message row
        if (row.querySelector('td[colspan]')) return;

        // Skip excluded transactions from totals calculation
        const status = row.dataset.status;
        const isExcluded = status === 'excluded';

        count++;

        // Only count amounts for active transactions
        if (!isExcluded) {
            // Get entrate amount
            const entrateCell = row.querySelectorAll('td')[4]; // 5th column (0-indexed)
            const entrateText = entrateCell?.textContent.trim();
            if (entrateText && entrateText !== '-' && entrateText !== '—') {
                const amount = parseFloat(entrateText.replace('€', '').replace(/\./g, '').replace(',', '.').trim());
                if (!isNaN(amount)) {
                    totalEntrate += amount;
                }
            }

            // Get uscite amount
            const usciteCell = row.querySelectorAll('td')[5]; // 6th column (0-indexed)
            const usciteText = usciteCell?.textContent.trim();
            if (usciteText && usciteText !== '-' && usciteText !== '—') {
                const amount = parseFloat(usciteText.replace('€', '').replace(/\./g, '').replace(',', '.').trim());
                if (!isNaN(amount)) {
                    totalUscite += amount;
                }
            }
        }
    });

    // Update summary bar values
    const summaryCount = document.getElementById('summary-count');
    const summaryEntrate = document.getElementById('summary-entrate');
    const summaryUscite = document.getElementById('summary-uscite');

    if (summaryCount) summaryCount.textContent = count;
    if (summaryEntrate) summaryEntrate.textContent = formatCurrency(totalEntrate);
    if (summaryUscite) summaryUscite.textContent = formatCurrency(totalUscite);

    // Show summary bar with animation
    showSummaryBar();
}

function showSummaryBar() {
    const summaryBar = document.getElementById('summary-bar');
    if (summaryBar) {
        // Slide up animation
        summaryBar.style.transform = 'translateY(0)';
    }
}

function hideSummaryBar() {
    const summaryBar = document.getElementById('summary-bar');
    if (summaryBar) {
        // Slide down animation
        summaryBar.style.transform = 'translateY(100%)';
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// Export CSV functionality
const exportCsvBtn = document.getElementById('exp-csv-btn');
if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportToCSV);
}

function formatAmountForCSV(amountText) {
    // Format for Excel IT: remove thousand separators, keep comma as decimal separator
    // Convert from € 1.234,56 to 1234,56
    let cleaned = amountText.replace('€', '').trim();

    // Remove thousand separators (dots)
    cleaned = cleaned.replace(/\./g, '');

    return cleaned;
}

function exportToCSV() {
    const rows = transactionsTbody.querySelectorAll('tr');

    // Check if there are transactions to export
    if (rows.length === 0 || rows[0].querySelector('td[colspan]')) {
        alert('Nessuna transazione da esportare');
        return;
    }

    // CSV header
    const csvHeaders = ['Data', 'Banca', 'Descrizione', 'Merchant', 'Categoria', 'Entrate (€)', 'Uscite (€)', 'ISIN'];
    const csvRows = [csvHeaders];

    // Extract data from each visible row
    rows.forEach(row => {
        // Skip message rows
        if (row.querySelector('td[colspan]')) return;

        const cells = row.querySelectorAll('td');

        // Extract date (remove time if present)
        const dateText = cells[0]?.textContent.trim() || '';

        // Extract bank (from badge)
        const bankBadge = cells[1]?.querySelector('.badge');
        const bank = bankBadge?.textContent.trim() || '';

        // Extract description and merchant
        const descriptionDiv = cells[2]?.querySelector('div[title]');
        const description = descriptionDiv?.getAttribute('title') || cells[2]?.textContent.trim().split('\n')[0] || '';
        const merchantDiv = cells[2]?.querySelector('.text-gray-500');
        const merchant = merchantDiv?.textContent.trim() || '';

        // Extract category
        const categorySpan = cells[3]?.querySelector('span');
        const category = categorySpan?.textContent.trim() || '';

        // Extract amounts and convert from Italian format (1.234,56) to standard format (1234.56)
        const entrateText = cells[4]?.textContent.trim() || '';
        const entrate = (entrateText && entrateText !== '-' && entrateText !== '—')
            ? formatAmountForCSV(entrateText)
            : '';

        const usciteText = cells[5]?.textContent.trim() || '';
        const uscite = (usciteText && usciteText !== '-' && usciteText !== '—')
            ? formatAmountForCSV(usciteText)
            : '';

        // Extract ISIN from data attribute
        const isin = row.dataset.isin || '';

        // Create CSV row (escape quotes in text fields)
        const csvRow = [
            dateText,
            bank,
            `"${description.replace(/"/g, '""')}"`, // Escape quotes
            `"${merchant.replace(/"/g, '""')}"`,    // Escape quotes
            category,
            entrate,
            uscite,
            isin
        ];

        csvRows.push(csvRow);
    });

    // Convert to CSV string using semicolon separator (for Italian Excel compatibility)
    const csvContent = csvRows.map(row => row.join(';')).join('\n');

    // Create download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel UTF-8
    const link = document.createElement('a');

    // Generate filename with current date and filters info
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    let filename = `transazioni_${dateStr}`;

    // Add filter info to filename
    if (selectedFilters.banks.size > 0) {
        filename += `_${Array.from(selectedFilters.banks).join('-')}`;
    }
    if (selectedMonth) filename += `_${selectedMonth}`;

    filename += '.csv';

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    URL.revokeObjectURL(link.href);
}

// Load transactions on page load
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded - ApexCharts disponibile?', typeof ApexCharts !== 'undefined');
    generateMonthFilters(); // Generate month filter buttons
    await initializeMultiSelects(); // Initialize multi-select dropdowns
    loadTransactions(true);
    initializeGraphsOverlay(); // Initialize graphs overlay
});

// ============================================
// GRAPHS OVERLAY FUNCTIONALITY
// ============================================

let chartInstances = {}; // Store chart instances for cleanup

function initializeGraphsOverlay() {
    const viewGraphBtn = document.getElementById('view-graph');
    const closeGraphsBtn = document.getElementById('close-graphs');

    // Open overlay
    if (viewGraphBtn) {
        viewGraphBtn.addEventListener('click', () => {
            openGraphsOverlay();
        });
    }

    // Close overlay
    if (closeGraphsBtn) {
        closeGraphsBtn.addEventListener('click', () => {
            closeGraphsOverlay();
        });
    }

    // Initialize tabs
    initializeGraphsTabs();
}

function openGraphsOverlay() {
    const graphsOverlay = document.getElementById('graphs-overlay');

    // Check if ApexCharts is loaded
    if (typeof ApexCharts === 'undefined') {
        console.error('ApexCharts library is not loaded!');
        alert('Errore: Libreria grafici non caricata. Ricarica la pagina.');
        return;
    }

    // Extract data from visible transactions
    const transactionsData = extractTransactionsData();

    if (!transactionsData || transactionsData.activeTransactions.length === 0) {
        alert('Nessuna transazione attiva da visualizzare');
        return;
    }

    // Update period text
    updatePeriodText(transactionsData);

    // Show/hide conditional tabs
    updateConditionalTabs(transactionsData);

    // Render all charts
    renderAllCharts(transactionsData);

    // Show overlay
    graphsOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeGraphsOverlay() {
    const graphsOverlay = document.getElementById('graphs-overlay');
    graphsOverlay.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling

    // Cleanup chart instances
    Object.values(chartInstances).forEach(chart => {
        if (chart && chart.destroy) {
            chart.destroy();
        }
    });
    chartInstances = {};
}

function initializeGraphsTabs() {
    const tabs = document.querySelectorAll('.graphs-tab');
    const contents = document.querySelectorAll('.graphs-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const targetContent = document.querySelector(`[data-content="${targetTab}"]`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

function extractTransactionsData() {
    const rows = transactionsTbody.querySelectorAll('tr');

    if (rows.length === 0 || rows[0].querySelector('td[colspan]')) {
        return null;
    }

    const allTransactions = [];
    const activeTransactions = [];

    rows.forEach(row => {
        if (row.querySelector('td[colspan]')) return;

        const status = row.dataset.status;
        const isActive = status === 'active';
        const transactionId = row.dataset.transactionId;

        const cells = row.querySelectorAll('td');

        // Extract date
        const dateText = cells[0]?.textContent.trim() || '';

        // Extract bank
        const bankBadge = cells[1]?.querySelector('.badge');
        const bank = bankBadge?.textContent.trim() || '';

        // Extract category
        const categorySpan = cells[3]?.querySelector('span');
        const category = categorySpan?.textContent.trim() || 'uncategorized';

        // Extract amounts
        const entrateText = cells[4]?.textContent.trim() || '';
        const entrate = (entrateText && entrateText !== '-' && entrateText !== '—')
            ? parseFloat(entrateText.replace('€', '').replace(/\./g, '').replace(',', '.').trim())
            : 0;

        const usciteText = cells[5]?.textContent.trim() || '';
        const uscite = (usciteText && usciteText !== '-' && usciteText !== '—')
            ? parseFloat(usciteText.replace('€', '').replace(/\./g, '').replace(',', '.').trim())
            : 0;

        // Extract ISIN from data attribute (if available)
        const isin = row.dataset.isin || null;

        const transaction = {
            id: transactionId,
            date: dateText,
            bank,
            category,
            amountIn: entrate,
            amountOut: uscite,
            isin,
            status,
            isActive
        };

        allTransactions.push(transaction);
        if (isActive) {
            activeTransactions.push(transaction);
        }
    });

    return {
        allTransactions,
        activeTransactions
    };
}

function updatePeriodText(data) {
    const periodElement = document.getElementById('graphs-period');
    const dates = data.activeTransactions.map(t => t.date);

    if (dates.length === 0) {
        periodElement.textContent = 'Nessun periodo';
        return;
    }

    // Parse dates and find min/max
    const parsedDates = dates.map(d => {
        const parts = d.split('/');
        return new Date(parts[2], parts[1] - 1, parts[0]);
    });

    const minDate = new Date(Math.min(...parsedDates));
    const maxDate = new Date(Math.max(...parsedDates));

    const formatDate = (date) => {
        return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    if (minDate.getTime() === maxDate.getTime()) {
        periodElement.textContent = `Periodo: ${formatDate(minDate)} • ${data.activeTransactions.length} transazioni attive`;
    } else {
        periodElement.textContent = `Periodo: ${formatDate(minDate)} - ${formatDate(maxDate)} • ${data.activeTransactions.length} transazioni attive`;
    }
}

function updateConditionalTabs(data) {
    const trendsTab = document.getElementById('trends-tab');
    const banksTab = document.getElementById('banks-tab');

    // Check if there are multiple months
    const months = new Set();
    data.activeTransactions.forEach(t => {
        const parts = t.date.split('/');
        const monthYear = `${parts[1]}/${parts[2]}`;
        months.add(monthYear);
    });

    if (months.size > 1) {
        trendsTab.style.display = 'flex';
    } else {
        trendsTab.style.display = 'none';
    }

    // Check if there are multiple banks
    const banks = new Set(data.activeTransactions.map(t => t.bank));
    if (banks.size > 1) {
        banksTab.style.display = 'flex';
    } else {
        banksTab.style.display = 'none';
    }
}

function renderAllCharts(data) {
    // Overview charts
    renderTotalsChart(data);
    renderBalanceChart(data);

    // Categories charts
    renderExpensesCategoriesChart(data);
    renderIncomeCategoriesChart(data);

    // Passive income charts
    renderPassiveIncomeCharts(data);

    // Conditional charts
    const months = new Set();
    data.activeTransactions.forEach(t => {
        const parts = t.date.split('/');
        const monthYear = `${parts[1]}/${parts[2]}`;
        months.add(monthYear);
    });

    if (months.size > 1) {
        renderMonthlyTrendsChart(data);
    }

    const banks = new Set(data.activeTransactions.map(t => t.bank));
    if (banks.size > 1) {
        renderBanksCharts(data);
    }
}

// Chart color palette (harmonious with purple theme)
const chartColors = {
    income: '#10b981', // Green
    expense: '#ef4444', // Red
    balance: '#8b5cf6', // Purple
    passive: '#f59e0b', // Amber
    categories: [
        '#8b5cf6', // Purple
        '#06b6d4', // Cyan
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#10b981', // Green
        '#6366f1', // Indigo
        '#f97316', // Orange
        '#14b8a6', // Teal
        '#a855f7', // Violet
        '#84cc16', // Lime
    ]
};

// Common tooltip configuration for pie/donut charts
const getCommonTooltipPie = () => ({
    custom: function({ series, seriesIndex, dataPointIndex, w }) {
        // For pie/donut charts, seriesIndex IS the slice index
        const label = w.globals.labels[seriesIndex] || w.config.labels[seriesIndex] || 'N/A';
        const value = series[seriesIndex];
        const formattedValue = formatCurrency(value);

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
                <div style="font-weight: 600; margin-bottom: 4px;">${label}</div>
                <div style="color: #333333;">${formattedValue}</div>
            </div>
        `;
    }
});

// Common tooltip configuration for bar charts
const getCommonTooltipBar = () => ({
    custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const seriesName = w.globals.seriesNames[seriesIndex] || 'N/A';
        const categoryLabel = w.globals.labels[dataPointIndex] || 'N/A';
        const value = series[seriesIndex][dataPointIndex];
        const formattedValue = formatCurrency(value);

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
                <div style="font-weight: 600; margin-bottom: 4px;">${categoryLabel}</div>
                <div style="color: #333333;">${seriesName}: ${formattedValue}</div>
            </div>
        `;
    }
});

// Common tooltip configuration for multi-line charts (shows all series)
const getCommonTooltipMultiLine = () => ({
    custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const categoryLabel = w.globals.labels[dataPointIndex] || 'N/A';

        // Build HTML for all series at this data point
        let seriesHTML = '';
        series.forEach((seriesData, idx) => {
            const seriesName = w.globals.seriesNames[idx] || 'N/A';
            const value = seriesData[dataPointIndex];
            const formattedValue = formatCurrency(value);
            seriesHTML += `<div style="color: #333333; margin-top: 4px;">${seriesName}: ${formattedValue}</div>`;
        });

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
                <div style="font-weight: 600; margin-bottom: 4px;">${categoryLabel}</div>
                ${seriesHTML}
            </div>
        `;
    }
});

function renderTotalsChart(data) {
    const totalIncome = data.activeTransactions.reduce((sum, t) => sum + t.amountIn, 0);
    const totalExpenses = data.activeTransactions.reduce((sum, t) => sum + t.amountOut, 0);

    const options = {
        series: [{
            name: 'Importo',
            data: [totalIncome, totalExpenses]
        }],
        chart: {
            type: 'bar',
            height: 350,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        colors: [chartColors.income, chartColors.expense],
        plotOptions: {
            bar: {
                distributed: true,
                horizontal: false,
                borderRadius: 8,
                dataLabels: {
                    position: 'top'
                }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: (val) => formatCurrency(val),
            offsetY: -25,
            style: {
                fontSize: '12px',
                fontWeight: 600,
                fontFamily: 'JetBrains Mono, monospace'
            }
        },
        xaxis: {
            categories: ['Entrate', 'Uscite'],
            labels: {
                style: {
                    fontSize: '13px',
                    fontWeight: 600
                }
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => formatCurrency(val),
                style: {
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px'
                }
            }
        },
        legend: {
            show: false
        },
        tooltip: getCommonTooltipBar()
    };

    destroyChart('chart-totals');
    chartInstances['chart-totals'] = new ApexCharts(document.querySelector('#chart-totals'), options);
    chartInstances['chart-totals'].render();
}

function renderBalanceChart(data) {
    const totalIncome = data.activeTransactions.reduce((sum, t) => sum + t.amountIn, 0);
    const totalExpenses = data.activeTransactions.reduce((sum, t) => sum + t.amountOut, 0);
    const balance = totalIncome - totalExpenses;

    const options = {
        series: [totalIncome, totalExpenses],
        chart: {
            type: 'donut',
            height: 350,
            fontFamily: 'Inter, sans-serif'
        },
        labels: ['Entrate', 'Uscite'],
        colors: [chartColors.income, chartColors.expense],
        dataLabels: {
            enabled: false  // Disabled: no percentages on slices
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '16px',
                            fontWeight: 600
                        },
                        value: {
                            show: true,
                            fontSize: '20px',
                            fontWeight: 700,
                            fontFamily: 'JetBrains Mono, monospace',
                            formatter: (val) => formatCurrency(parseFloat(val))
                        },
                        total: {
                            show: true,
                            label: 'Bilancio',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: balance >= 0 ? chartColors.income : chartColors.expense,
                            formatter: () => formatCurrency(balance)
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '13px',
            fontWeight: 500
        },
        tooltip: getCommonTooltipPie()
    };

    destroyChart('chart-balance');
    chartInstances['chart-balance'] = new ApexCharts(document.querySelector('#chart-balance'), options);
    chartInstances['chart-balance'].render();
}

function renderExpensesCategoriesChart(data) {
    const expensesByCategory = {};

    data.activeTransactions.forEach(t => {
        if (t.amountOut > 0) {
            if (!expensesByCategory[t.category]) {
                expensesByCategory[t.category] = 0;
            }
            expensesByCategory[t.category] += t.amountOut;
        }
    });

    const categories = Object.keys(expensesByCategory).sort((a, b) => expensesByCategory[b] - expensesByCategory[a]);
    const values = categories.map(cat => expensesByCategory[cat]);

    if (categories.length === 0) {
        document.querySelector('#chart-expenses-categories').innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna uscita da visualizzare</p>';
        return;
    }

    const options = {
        series: values,
        chart: {
            type: 'donut',
            height: 400,
            fontFamily: 'Inter, sans-serif'
        },
        labels: categories,
        colors: chartColors.categories,
        dataLabels: {
            enabled: false  // Disabled: no percentages on slices
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '60%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontWeight: 600
                        },
                        value: {
                            show: true,
                            fontSize: '18px',
                            fontWeight: 700,
                            fontFamily: 'JetBrains Mono, monospace',
                            formatter: (val) => formatCurrency(parseFloat(val))
                        },
                        total: {
                            show: true,
                            label: 'Totale Uscite',
                            fontSize: '13px',
                            fontWeight: 600,
                            formatter: () => formatCurrency(values.reduce((a, b) => a + b, 0))
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '12px',
            fontWeight: 500
        },
        tooltip: getCommonTooltipPie()
    };

    destroyChart('chart-expenses-categories');
    chartInstances['chart-expenses-categories'] = new ApexCharts(document.querySelector('#chart-expenses-categories'), options);
    chartInstances['chart-expenses-categories'].render();
}

function renderIncomeCategoriesChart(data) {
    const incomeByCategory = {};

    data.activeTransactions.forEach(t => {
        if (t.amountIn > 0) {
            if (!incomeByCategory[t.category]) {
                incomeByCategory[t.category] = 0;
            }
            incomeByCategory[t.category] += t.amountIn;
        }
    });

    const categories = Object.keys(incomeByCategory).sort((a, b) => incomeByCategory[b] - incomeByCategory[a]);
    const values = categories.map(cat => incomeByCategory[cat]);

    if (categories.length === 0) {
        document.querySelector('#chart-income-categories').innerHTML = '<p class="text-center text-gray-500 py-8">Nessuna entrata da visualizzare</p>';
        return;
    }

    const options = {
        series: values,
        chart: {
            type: 'donut',
            height: 400,
            fontFamily: 'Inter, sans-serif'
        },
        labels: categories,
        colors: chartColors.categories,
        dataLabels: {
            enabled: false  // Disabled: no percentages on slices
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '60%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontWeight: 600
                        },
                        value: {
                            show: true,
                            fontSize: '18px',
                            fontWeight: 700,
                            fontFamily: 'JetBrains Mono, monospace',
                            formatter: (val) => formatCurrency(parseFloat(val))
                        },
                        total: {
                            show: true,
                            label: 'Totale Entrate',
                            fontSize: '13px',
                            fontWeight: 600,
                            formatter: () => formatCurrency(values.reduce((a, b) => a + b, 0))
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '12px',
            fontWeight: 500
        },
        tooltip: getCommonTooltipPie()
    };

    destroyChart('chart-income-categories');
    chartInstances['chart-income-categories'] = new ApexCharts(document.querySelector('#chart-income-categories'), options);
    chartInstances['chart-income-categories'].render();
}

function renderPassiveIncomeCharts(data) {
    // Identify passive income transactions (dividends and interest)
    const passiveCategories = ['investments', 'dividend', 'interest'];

    const passiveTransactions = data.activeTransactions.filter(t => {
        return t.amountIn > 0 && passiveCategories.some(cat =>
            t.category.toLowerCase().includes(cat)
        );
    });

    // Render breakdown by category as pie chart
    renderPassiveBreakdownChart(passiveTransactions);

    // Render monthly progression as stacked bar chart
    renderPassiveMonthlyChart(passiveTransactions);
}

function renderPassiveMonthlyChart(passiveTransactions) {
    if (passiveTransactions.length === 0) {
        document.querySelector('#chart-passive-monthly').innerHTML = '<p class="text-center text-gray-500 py-8">Nessun reddito passivo da visualizzare</p>';
        return;
    }

    // Group by month and category
    const monthlyData = {};
    const categoriesSet = new Set();

    passiveTransactions.forEach(t => {
        const parts = t.date.split('/');
        const monthYear = `${parts[1]}/${parts[2]}`;

        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = {};
        }

        if (!monthlyData[monthYear][t.category]) {
            monthlyData[monthYear][t.category] = 0;
        }

        monthlyData[monthYear][t.category] += t.amountIn;
        categoriesSet.add(t.category);
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
        const [monthA, yearA] = a.split('/');
        const [monthB, yearB] = b.split('/');
        return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
    });

    // Format month labels
    const monthLabels = sortedMonths.map(m => {
        const [month, year] = m.split('/');
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });

    // Create series for each category
    const categories = Array.from(categoriesSet).sort();
    const series = categories.map(category => ({
        name: category,
        data: sortedMonths.map(month => monthlyData[month][category] || 0)
    }));

    const options = {
        series: series,
        chart: {
            type: 'bar',
            height: 400,
            stacked: true,
            toolbar: { show: true },
            fontFamily: 'Inter, sans-serif'
        },
        colors: chartColors.categories.slice(0, categories.length),
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '60%',
                borderRadius: 6,
                borderRadiusApplication: 'end'
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            categories: monthLabels,
            labels: {
                style: {
                    fontSize: '11px',
                    fontWeight: 500
                }
            }
        },
        yaxis: {
            title: {
                text: 'Importo (€)',
                style: {
                    fontSize: '12px',
                    fontWeight: 600
                }
            },
            labels: {
                formatter: (val) => formatCurrency(val),
                style: {
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '10px'
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '12px',
            fontWeight: 500
        },
        tooltip: getCommonTooltipBar()
    };

    destroyChart('chart-passive-monthly');
    chartInstances['chart-passive-monthly'] = new ApexCharts(document.querySelector('#chart-passive-monthly'), options);
    chartInstances['chart-passive-monthly'].render();
}

function renderPassiveBreakdownChart(passiveTransactions) {
    if (passiveTransactions.length === 0) {
        document.querySelector('#chart-passive-breakdown').innerHTML = '<p class="text-center text-gray-500 py-8">Nessun reddito passivo da visualizzare</p>';
        return;
    }

    // Group by category
    const byCategory = {};
    passiveTransactions.forEach(t => {
        if (!byCategory[t.category]) {
            byCategory[t.category] = 0;
        }
        byCategory[t.category] += t.amountIn;
    });

    const categories = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]);
    const values = categories.map(cat => byCategory[cat]);

    const options = {
        series: values,
        chart: {
            type: 'donut',
            height: 400,
            fontFamily: 'Inter, sans-serif'
        },
        labels: categories,
        colors: chartColors.categories.slice(0, categories.length),
        dataLabels: {
            enabled: false  // Disabled: no percentages on slices
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '60%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            fontWeight: 600
                        },
                        value: {
                            show: true,
                            fontSize: '18px',
                            fontWeight: 700,
                            fontFamily: 'JetBrains Mono, monospace',
                            formatter: (val) => formatCurrency(parseFloat(val))
                        },
                        total: {
                            show: true,
                            label: 'Totale Passivi',
                            fontSize: '13px',
                            fontWeight: 600,
                            formatter: () => formatCurrency(values.reduce((a, b) => a + b, 0))
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '12px',
            fontWeight: 500
        },
        tooltip: getCommonTooltipPie()
    };

    destroyChart('chart-passive-breakdown');
    chartInstances['chart-passive-breakdown'] = new ApexCharts(document.querySelector('#chart-passive-breakdown'), options);
    chartInstances['chart-passive-breakdown'].render();
}

function renderMonthlyTrendsChart(data) {
    // Group transactions by month
    const monthlyData = {};

    data.activeTransactions.forEach(t => {
        const parts = t.date.split('/');
        const monthYear = `${parts[1]}/${parts[2]}`;

        if (!monthlyData[monthYear]) {
            monthlyData[monthYear] = { income: 0, expenses: 0 };
        }

        monthlyData[monthYear].income += t.amountIn;
        monthlyData[monthYear].expenses += t.amountOut;
    });

    // Sort by date
    const sortedMonths = Object.keys(monthlyData).sort((a, b) => {
        const [monthA, yearA] = a.split('/');
        const [monthB, yearB] = b.split('/');
        return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
    });

    const incomeData = sortedMonths.map(m => monthlyData[m].income);
    const expensesData = sortedMonths.map(m => monthlyData[m].expenses);

    // Format month labels
    const monthLabels = sortedMonths.map(m => {
        const [month, year] = m.split('/');
        const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });

    const options = {
        series: [
            {
                name: 'Entrate',
                data: incomeData
            },
            {
                name: 'Uscite',
                data: expensesData
            }
        ],
        chart: {
            type: 'line',
            height: 400,
            toolbar: { show: true },
            fontFamily: 'Inter, sans-serif'
        },
        colors: [chartColors.income, chartColors.expense],
        stroke: {
            width: 3,
            curve: 'smooth'
        },
        markers: {
            size: 5,
            hover: {
                size: 7
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            categories: monthLabels,
            labels: {
                style: {
                    fontSize: '12px',
                    fontWeight: 500
                }
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => formatCurrency(val),
                style: {
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px'
                }
            }
        },
        legend: {
            position: 'top',
            fontSize: '13px',
            fontWeight: 600
        },
        tooltip: getCommonTooltipMultiLine(),
        grid: {
            borderColor: '#f1f5f9'
        }
    };

    destroyChart('chart-monthly-trends');
    chartInstances['chart-monthly-trends'] = new ApexCharts(document.querySelector('#chart-monthly-trends'), options);
    chartInstances['chart-monthly-trends'].render();
}

function renderBanksCharts(data) {
    // Distribution chart
    const bankTotals = {};

    data.activeTransactions.forEach(t => {
        if (!bankTotals[t.bank]) {
            bankTotals[t.bank] = 0;
        }
        bankTotals[t.bank] += t.amountIn + t.amountOut;
    });

    const banks = Object.keys(bankTotals);
    const totals = banks.map(b => bankTotals[b]);

    const distributionOptions = {
        series: totals,
        chart: {
            type: 'pie',
            height: 350,
            fontFamily: 'Inter, sans-serif'
        },
        labels: banks,
        colors: chartColors.categories.slice(0, banks.length),
        dataLabels: {
            enabled: false
        },
        legend: {
            position: 'bottom',
            fontSize: '13px',
            fontWeight: 500
        },
        tooltip: getCommonTooltipPie()
    };

    destroyChart('chart-banks-distribution');
    chartInstances['chart-banks-distribution'] = new ApexCharts(document.querySelector('#chart-banks-distribution'), distributionOptions);
    chartInstances['chart-banks-distribution'].render();

    // Flow chart (income vs expenses per bank)
    const bankFlows = {};

    data.activeTransactions.forEach(t => {
        if (!bankFlows[t.bank]) {
            bankFlows[t.bank] = { income: 0, expenses: 0 };
        }
        bankFlows[t.bank].income += t.amountIn;
        bankFlows[t.bank].expenses += t.amountOut;
    });

    const flowBanks = Object.keys(bankFlows);
    const incomeByBank = flowBanks.map(b => bankFlows[b].income);
    const expensesByBank = flowBanks.map(b => bankFlows[b].expenses);

    const flowOptions = {
        series: [
            {
                name: 'Entrate',
                data: incomeByBank
            },
            {
                name: 'Uscite',
                data: expensesByBank
            }
        ],
        chart: {
            type: 'bar',
            height: 350,
            toolbar: { show: false },
            fontFamily: 'Inter, sans-serif'
        },
        colors: [chartColors.income, chartColors.expense],
        plotOptions: {
            bar: {
                horizontal: false,
                borderRadius: 8,
                columnWidth: '60%'
            }
        },
        dataLabels: {
            enabled: false
        },
        xaxis: {
            categories: flowBanks,
            labels: {
                style: {
                    fontSize: '12px',
                    fontWeight: 500
                }
            }
        },
        yaxis: {
            labels: {
                formatter: (val) => formatCurrency(val),
                style: {
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px'
                }
            }
        },
        legend: {
            position: 'top',
            fontSize: '13px',
            fontWeight: 600
        },
        tooltip: getCommonTooltipBar()
    };

    destroyChart('chart-banks-flow');
    chartInstances['chart-banks-flow'] = new ApexCharts(document.querySelector('#chart-banks-flow'), flowOptions);
    chartInstances['chart-banks-flow'].render();
}

function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}
