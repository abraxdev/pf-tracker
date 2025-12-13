// Transactions page filters and interactions

const filterBank = document.getElementById('filter-bank');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const filterSearch = document.getElementById('filter-search');
const applyFiltersBtn = document.getElementById('apply-filters');
const resetFiltersBtn = document.getElementById('reset-filters');
const transactionsTbody = document.getElementById('transactions-tbody');

// Apply filters
applyFiltersBtn.addEventListener('click', async () => {
    await loadTransactions();
});

// Reset filters
resetFiltersBtn.addEventListener('click', () => {
    filterBank.value = '';
    filterType.value = '';
    filterCategory.value = '';
    filterSearch.value = '';
    loadTransactions();
});

// Load transactions with filters
async function loadTransactions() {
    const params = new URLSearchParams();

    if (filterBank.value) params.append('bank', filterBank.value);
    if (filterType.value) params.append('type', filterType.value);
    if (filterCategory.value) params.append('category', filterCategory.value);
    if (filterSearch.value) params.append('search', filterSearch.value);
    params.append('limit', '100');

    try {
        const response = await fetch(`/api/transactions?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
            displayTransactions(result.data);
        } else {
            console.error('Error loading transactions:', result.error);
            alert('Errore nel caricamento delle transazioni');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Errore nel caricamento delle transazioni');
    }
}

function displayTransactions(transactions) {
    if (!transactionsTbody) return;

    if (transactions.length === 0) {
        transactionsTbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                    Nessuna transazione trovata con i filtri selezionati.
                </td>
            </tr>
        `;
        return;
    }

    transactionsTbody.innerHTML = transactions.map(tx => {
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
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
