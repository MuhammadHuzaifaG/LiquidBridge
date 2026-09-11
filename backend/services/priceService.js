// backend/services/priceService.js
const axios = require('axios');
const PriceHistory = require('../models/PriceHistory');

class PriceService {
    async getTokenPrice(tokenAddress, chainId) {
        try {
            const cached = await PriceHistory.findOne({
                tokenAddress: tokenAddress.toLowerCase(),
                chainId,
                timestamp: { $gte: new Date(Date.now() - 60000) }
            }).sort({ timestamp: -1 });

            if (cached) {
                return cached.price;
            }

            const price = await this.fetchPriceFromCoingecko(tokenAddress, chainId);

            if (price > 0) {
                await PriceHistory.create({
                    tokenAddress: tokenAddress.toLowerCase(),
                    price,
                    chainId,
                    timestamp: new Date()
                });
            }

            return price;
        } catch (error) {
            console.error('Price fetch error:', error.message);
            return 0;
        }
    }

    async fetchPriceFromCoingecko(tokenAddress, chainId) {
        try {
            const chainName = this.getChainNameForCoingecko(chainId);
            if (!chainName) return 0;

            const response = await axios.get(
                `https://api.coingecko.com/api/v3/simple/token_price/${chainName}`,
                {
                    params: {
                        contract_addresses: tokenAddress.toLowerCase(),
                        vs_currencies: 'usd'
                    },
                    timeout: 5000
                }
            );

            return response.data[tokenAddress.toLowerCase()]?.usd || 0;
        } catch (error) {
            console.error('Coingecko API error:', error.message);
            return 0;
        }
    }

    getChainNameForCoingecko(chainId) {
        const chainMap = {
            1: 'ethereum',
            137: 'polygon-pos',
            43114: 'avalanche-2',
            56: 'binance-smart-chain',
            42161: 'arbitrum-one'
        };
        return chainMap[chainId] || null;
    }

    async getPriceHistory(tokenAddress, chainId, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const history = await PriceHistory.find({
                tokenAddress: tokenAddress.toLowerCase(),
                chainId,
                timestamp: { $gte: startDate }
            })
            .sort({ timestamp: 1 })
            .lean();

            return history;
        } catch (error) {
            console.error('Price history error:', error);
            return [];
        }
    }

    async getMultiplePrices(tokenAddresses, chainId) {
        try {
            const prices = {};
            for (const token of tokenAddresses) {
                prices[token] = await this.getTokenPrice(token, chainId);
            }
            return prices;
        } catch (error) {
            console.error('Multiple prices error:', error);
            return {};
        }
    }
}

module.exports = new PriceService();