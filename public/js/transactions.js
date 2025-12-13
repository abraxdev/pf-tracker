// Transactions page filters and interactions

const filterBank = document.getElementById('filter-bank');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const filterSearch = document.getElementById('filter-search');
const applyFiltersBtn = document.getElementById('apply-filters');
const resetFiltersBtn = document.getElementById('reset-filters');
const transactionsTbody = document.getElementById('transactions-tbody');
const loadMoreBtn = document.getElementById('load-more-btn');
const loadMoreContainer = document.getElementById('load-more-container');

// Pagination state
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let loadedTransactionIds = new Set(); // Track loaded transaction IDs to prevent duplicates

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
                <td class="px-4 py-3 text-sm text-gray-900">${date}</td>
                <td class="px-4 py-3 text-sm text-center">
                    <span class="badge badge-${tx.bank}">${tx.bank}</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                    <div class="" title="${escapeHtml(tx.description)}">
                        ${escapeHtml(tx.description)}
                    </div>
                    ${tx.merchant ? `<div class="text-xs text-gray-500">${escapeHtml(tx.merchant)}</div>` : ''}
                </td>
                <td class="px-4 py-3 text-sm text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
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
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load transactions on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTransactions(true);
});
