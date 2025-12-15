// Transactions page filters and interactions

const filterBank = document.getElementById('filter-bank');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
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

// Pagination state
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let loadedTransactionIds = new Set(); // Track loaded transaction IDs to prevent duplicates
let selectedMonth = null; // Track selected month filter

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
    filterBank.value = '';
    filterType.value = '';
    filterCategory.value = '';
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

    if (filterBank.value) params.append('bank', filterBank.value);
    if (filterType.value) params.append('type', filterType.value);
    if (filterCategory.value) params.append('category', filterCategory.value);
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
                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
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

        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm text-gray-900 font-mono">${date}</td>
                <td class="px-4 py-3 text-sm text-center">
                    <span class="badge badge-${tx.bank}">${tx.bank}</span>
                </td>
                <td class="px-4 py-3 text-xs text-gray-900 font-mono">
                    <div class="" title="${escapeHtml(tx.description)}">
                        ${escapeHtml(tx.description)}
                    </div>
                    ${tx.merchant ? `<div class="text-xs text-gray-500">${escapeHtml(tx.merchant)}</div>` : ''}
                </td>
                <td class="px-4 py-3 text-sm text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 font-mono">
                        ${tx.category || 'uncategorized'}
                    </span>
                </td>
                <td class="px-2 py-3 text-sm text-center font-semibold">
                    ${formattedAmountIn ? `<span class="amount-in">€ ${formattedAmountIn}</span>` : '<span class="amount-zero">-</span>'}
                </td>
                <td class="px-2 py-3 text-sm text-center font-semibold">
                    ${formattedAmountOut ? `<span class="amount-out">€ ${formattedAmountOut}</span>` : '<span class="amount-zero">—</span>'}
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

    // Update summary bar with all currently displayed transactions
    updateSummaryBar();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

        count++;

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
    const csvHeaders = ['Data', 'Banca', 'Descrizione', 'Merchant', 'Categoria', 'Entrate (€)', 'Uscite (€)'];
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

        // Create CSV row (escape quotes in text fields)
        const csvRow = [
            dateText,
            bank,
            `"${description.replace(/"/g, '""')}"`, // Escape quotes
            `"${merchant.replace(/"/g, '""')}"`,    // Escape quotes
            category,
            entrate,
            uscite
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
    if (filterBank.value) filename += `_${filterBank.value}`;
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
document.addEventListener('DOMContentLoaded', () => {
    generateMonthFilters(); // Generate month filter buttons
    loadTransactions(true);
});
