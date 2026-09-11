// backend/routes/quote.js
const express = require('express');
const router = express.Router();
const routingService = require('../services/routingService');
const priceService = require('../services/priceService');

router.post('/', async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, chainId } = req.body;

        if (!tokenIn || !tokenOut || !amountIn || !chainId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
            return res.status(400).json({ error: 'Tokens cannot be the same' });
        }

        const route = await routingService.findBestRoute(tokenIn, tokenOut, amountIn, chainId);

        if (!route) {
            return res.status(404).json({ error: 'No liquidity route found' });
        }

        const [tokenInPrice, tokenOutPrice] = await Promise.all([
            priceService.getTokenPrice(tokenIn, chainId),
            priceService.getTokenPrice(tokenOut, chainId)
        ]);

        const slippage = this.calculateSlippage(amountIn, route.expectedOutput, tokenInPrice, tokenOutPrice);

        res.json({
            success: true,
            route,
            slippage,
            priceImpact: route.priceImpact,
            estimatedOutput: route.expectedOutput,
            tokenInPrice,
            tokenOutPrice,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Quote error:', error);
        res.status(500).json({ error: 'Failed to generate quote', details: error.message });
    }
});

router.get('/:tokenIn/:tokenOut/:amount/:chainId', async (req, res) => {
    try {
        const { tokenIn, tokenOut, amount, chainId } = req.params;

        const route = await routingService.findBestRoute(
            tokenIn,
            tokenOut,
            amount,
            parseInt(chainId)
        );

        if (!route) {
            return res.status(404).json({ error: 'No route found' });
        }

        res.json({ success: true, route });
    } catch (error) {
        res.status(500).json({ error: 'Quote fetch failed', details: error.message });
    }
});

module.exports = router;