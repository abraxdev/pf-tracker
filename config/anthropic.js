const Anthropic = require('@anthropic-ai/sdk');

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
    throw new Error('Missing Anthropic API key. Check your .env file.');
}

const anthropic = new Anthropic({
    apiKey: apiKey,
});

module.exports = anthropic;
