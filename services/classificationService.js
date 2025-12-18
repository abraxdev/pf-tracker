const supabase = require('../config/supabase');
const { classifyTransactions } = require('./classifier');
const { normalizeDescription } = require('../utils/normalizer');

const BATCH_SIZE = 30; // Max transactions per API call
const useAntropic = process.env.ANTROPIC_USE;

/**
 * Check static classification rules
 *
 * @param {string} descriptionNormalized - Normalized description
 * @returns {Promise<Object|null>} Rule match or null
 */
async function checkStaticRules(descriptionNormalized) {
    try {
        const { data: rules } = await supabase
            .from('classification_rules')
            .select('*')
            .order('priority', { ascending: false });

        if (!rules || rules.length === 0) return null;

        for (const rule of rules) {
            const pattern = rule.pattern.toUpperCase();
            const matchType = rule.match_type;

            let matches = false;

            if (matchType === 'contains') {
                matches = descriptionNormalized.includes(pattern);
            } else if (matchType === 'startswith') {
                matches = descriptionNormalized.startsWith(pattern);
            } else if (matchType === 'regex') {
                try {
                    const regex = new RegExp(pattern, 'i');
                    matches = regex.test(descriptionNormalized);
                } catch (e) {
                    console.warn(`Invalid regex pattern: ${pattern}`);
                }
            }

            if (matches) {
                console.log(rule.type);
                console.log(rule.category);
                return {
                    type: rule.type,
                    category: rule.category,
                    confidence: 1.0,
                    source: 'rule'
                };
            }
        }

        return null;
    } catch (error) {
        console.error('Error checking static rules:', error);
        return null;
    }
}

/**
 * Classify transactions with caching and rule-based fallback
 *
 * @param {Array} transactions - Array of transactions to classify
 * @returns {Promise<Array>} Transactions with type and category added
 */
async function classifyWithCache(transactions) {
    const results = [];
    const uncached = [];

    // Step 1: Check each transaction against static rules and cache
    for (const tx of transactions) {
        const normalized = normalizeDescription(tx.description);

        // Check static rules first (highest priority)
        const ruleMatch = await checkStaticRules(normalized);
        if (ruleMatch) {
            results.push({
                ...tx,
                type: ruleMatch.type,
                category: ruleMatch.category,
                merchant: null,
                confidence: ruleMatch.confidence,
                cache_hit: false,
                source: 'rule'
            });
            continue;
        }

        // Check cache
        const { data: cached } = await supabase
            .from('classification_cache')
            .select('type, category, merchant, confidence, source, hit_count')
            .eq('description_normalized', normalized)
            .single();

        if (cached) {
            // Cache HIT: update hit count and last used timestamp
            await supabase
                .from('classification_cache')
                .update({
                    hit_count: (cached.hit_count || 0) + 1,
                    last_used_at: new Date().toISOString()
                })
                .eq('description_normalized', normalized);

            results.push({
                ...tx,
                type: cached.type,
                category: cached.category,
                merchant: cached.merchant,
                confidence: cached.confidence,
                cache_hit: true,
                source: cached.source
            });
        } else {
            // Cache MISS: add to uncached list
            uncached.push({ ...tx, normalized });
        }
    }

    // Step 2: Classify uncached transactions in batches
    if (uncached.length > 0) {
        for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
            const batch = uncached.slice(i, i + BATCH_SIZE);
            
            if (useAntropic=="TRUE") {
                try {
                const classifications = await classifyTransactions(batch);

                for (let j = 0; j < batch.length; j++) {
                    const tx = batch[j];
                    const cls = classifications[j] || {
                        type: 'other',
                        category: 'uncategorized',
                        confidence: 0.5
                    };

                    // Save to cache
                    await supabase.from('classification_cache').upsert({
                        description_normalized: tx.normalized,
                        type: cls.type,
                        category: cls.category,
                        merchant: cls.merchant || null,
                        confidence: cls.confidence,
                        source: 'ai'
                    }, {
                        onConflict: 'description_normalized'
                    });

                    results.push({
                        ...tx,
                        type: cls.type,
                        category: cls.category,
                        merchant: cls.merchant,
                        confidence: cls.confidence,
                        cache_hit: false,
                        source: 'ai'
                    });
                }
            } catch (error) {
                console.error('Error classifying batch:', error);

                // Fallback: mark as uncategorized
                for (const tx of batch) {
                    results.push({
                        ...tx,
                        type: 'other',
                        category: 'uncategorized',
                        merchant: null,
                        confidence: 0,
                        cache_hit: false,
                        source: 'fallback'
                    });
                }
            }

            } else {
                for (const tx of batch) {
                    results.push({
                        ...tx,
                        type: 'other',
                        category: 'uncategorized',
                        merchant: null,
                        confidence: 0,
                        cache_hit: false,
                        source: 'fallback'
                    });
                }
            }
            
        }
    }

    return results;
}

/**
 * Override classification manually (user correction)
 *
 * @param {string} description - Original description
 * @param {string} type - Corrected type
 * @param {string} category - Corrected category
 * @param {string} merchant - Optional merchant name
 */
async function overrideClassification(description, type, category, merchant = null) {
    const normalized = normalizeDescription(description);

    await supabase.from('classification_cache').upsert({
        description_normalized: normalized,
        type,
        category,
        merchant,
        confidence: 1.0,
        source: 'manual'
    }, {
        onConflict: 'description_normalized'
    });
}

module.exports = {
    classifyWithCache,
    overrideClassification
};
