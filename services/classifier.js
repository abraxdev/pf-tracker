const anthropic = require('../config/anthropic');

const CLASSIFICATION_PROMPT = `Sei un assistente specializzato nella classificazione di transazioni bancarie italiane.

Per ogni transazione, restituisci un oggetto JSON con:
- "type": una delle seguenti opzioni: expense, income, fee, transfer, card, atm, sdd, tax, dividend, interest, investment, subscription, salary, refund, other
- "category": una delle seguenti opzioni: groceries, restaurants, fuel, utilities, telecom, health, transport, credit card, subscriptions, insurance, investments, taxes, transfers, entertainment, shopping, travel, personal_care, education, home, pets, charity, atm, fees, salary, rent, uncategorized
- "merchant": nome del merchant/beneficiario pulito (opzionale, solo se identificabile)
- "confidence": score 0.0-1.0

Regole di classificazione:
- "Redditi" o "Cash Dividend" → type: income, category: dividend
- "Pagamento degli interessi" o "Interest payment" → type: income, category: interest
- "Cedole" o "Cedola" → type: income, category: interest
- "Danilo Serrani" → category: rent
- "Transazione con carta" + nome esercente → type: card, category: basata su esercente
- "Commercio" + "Buy trade"/"Sell trade" → type: investment, category: investments
- "Bonifico" → type: transfer, category: transfers
- "Metisoft" → type: income, category: salary
- "Imposte"/"Stamp Duty" → type: tax, category: taxes
- "Commissioni"/"Comm." → type: fee, category: fees
- Supermercati (CONAD, PAGEMA, SI CON TE, ESSELUNGA, LIDL, etc.) → category: groceries
- Farmacie → category: health
- Ristoranti/Bar/Pizzerie → category: restaurants
- Benzina (ENI, Q8, IP, SHELL, TAMOIL) → category: fuel
- Telepass, autostrada → category: transport
- Netflix, Spotify, Amazon Prime, Disney → category: subscriptions
- Utilizzo Carta Di Credito → type: card, category: credit card

Rispondi SOLO con un array JSON valido, senza markdown, commenti o testo aggiuntivo.`;

/**
 * Classify transactions using Claude API
 *
 * @param {Array} transactions - Array of transaction objects to classify
 * @returns {Promise<Array>} Promise resolving to array of classification results
 */
async function classifyTransactions(transactions) {
    if (!transactions || transactions.length === 0) {
        return [];
    }

    try {
        // Format transactions for the prompt
        const transactionsText = transactions
            .map((t, i) => {
                const bank = t.bank || 'unknown';
                const typeRaw = t.type_raw || '';
                const description = t.description || '';
                return `${i + 1}. [${bank}] ${typeRaw} - ${description}`;
            })
            .join('\n');

        // Call Claude API
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            temperature: 0,
            messages: [{
                role: 'user',
                content: `Classifica queste ${transactions.length} transazioni:\n\n${transactionsText}`
            }],
            system: CLASSIFICATION_PROMPT
        });

        // Extract JSON from response
        const content = response.content[0].text.trim();

        // Remove markdown code blocks if present
        let jsonText = content;
        if (content.startsWith('```')) {
            jsonText = content.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }

        // Parse JSON response
        const classifications = JSON.parse(jsonText);

        // Validate that we got the right number of classifications
        if (!Array.isArray(classifications)) {
            throw new Error('Claude API did not return an array');
        }

        if (classifications.length !== transactions.length) {
            console.warn(
                `Classification count mismatch: got ${classifications.length}, expected ${transactions.length}`
            );
        }

        return classifications;

    } catch (error) {
        console.error('Error calling Claude API:', error);
        throw new Error(`Failed to classify transactions: ${error.message}`);
    }
}

module.exports = { classifyTransactions };
