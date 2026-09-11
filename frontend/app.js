// app.js - LiquidBridge Frontend Application

// ============ CONFIGURATION ============

const CONFIG = {
    API_URL: 'http://localhost:5000/api',
    INFURA_KEY: 'YOUR_INFURA_KEY',
    CONTRACTS: {
        LIQUIDBRIDGE: '0x...',
    },
    CHAINS: {
        1: { name: 'Ethereum', symbol: 'ETH', rpc: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY' },
        137: { name: 'Polygon', symbol: 'MATIC', rpc: 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY' },
        43114: { name: 'Avalanche', symbol: 'AVAX', rpc: 'https://avalanche-mainnet.g.alchemy.com/v2/YOUR_KEY' },
        56: { name: 'BSC', symbol: 'BNB', rpc: 'https://bsc-dataseed.binance.org' },
        42161: { name: 'Arbitrum', symbol: 'ETH', rpc: 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY' }
    },
    TOKENS: {
        1: [
            { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
            { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
            { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
            { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 }
        ],
        137: [
            { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 },
            { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
            { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 }
        ]
    }
};

// ============ STATE MANAGEMENT ============

const state = {
    wallet: {
        connected: false,
        address: null,
        chainId: null,
        balance: '0'
    },
    swap: {
        tokenIn: null,
        tokenOut: null,
        amountIn: '0',
        amountOut: '0',
        minAmountOut: '0',
        slippageTolerance: 0.5,
        route: null,
        loading: false
    },
    ui: {
        selectedTokenModal: 'from',
        pools: [],
        recentSwaps: [],
        stats: {}
    }
};

// ============ UTILITY FUNCTIONS ============

const showNotification = (message, type = 'info') => {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type} fade-in`;
    
    const iconMap = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    notification.innerHTML = `
        <span>${iconMap[type]}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
};

const formatNumber = (num, decimals = 2) => {
    if (!num) return '0';
    const parts = num.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimals ? parts.join('.').substring(0, parts[0].length + decimals + 1) : parts[0];
};

const formatAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const parseUnits = (value, decimals) => {
    const wei = ethers.parseUnits(value.toString(), decimals);
    return wei.toString();
};

const formatUnits = (value, decimals) => {
    if (!value) return '0';
    return ethers.formatUnits(value, decimals);
};

const hideLoader = () => {
    const loader = document.getElementById('loader');
    loader.classList.add('hidden');
};

// ============ WEB3 INTEGRATION ============

let web3, web3Provider, signer, liquidBridgeContract;

const initWeb3 = async () => {
    if (!window.ethereum) {
        showNotification('Please install MetaMask or another Web3 wallet', 'error');
        return false;
    }

    try {
        web3Provider = new ethers.BrowserProvider(window.ethereum);
        signer = await web3Provider.getSigner();
        state.wallet.address = await signer.getAddress();
        state.wallet.connected = true;

        const network = await web3Provider.getNetwork();
        state.wallet.chainId = Number(network.chainId);

        updateWalletDisplay();
        loadUserData();
        return true;
    } catch (error) {
        console.error('Web3 initialization error:', error);
        showNotification('Failed to initialize Web3', 'error');
        return false;
    }
};

const connectWallet = async () => {
    try {
        const walletBtn = document.getElementById('walletBtn');
        
        if (state.wallet.connected) {
            disconnectWallet();
            return;
        }

        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length > 0) {
            await initWeb3();
            showNotification('Wallet connected successfully', 'success');
        }
    } catch (error) {
        console.error('Wallet connection error:', error);
        showNotification('Failed to connect wallet', 'error');
    }
};

const disconnectWallet = () => {
    state.wallet.connected = false;
    state.wallet.address = null;
    updateWalletDisplay();
    showNotification('Wallet disconnected', 'info');
};

const updateWalletDisplay = () => {
    const walletBtn = document.getElementById('walletBtn');
    
    if (state.wallet.connected && state.wallet.address) {
        walletBtn.textContent = formatAddress(state.wallet.address);
        walletBtn.classList.add('connected');
        document.getElementById('userProfile').style.display = 'block';
        document.getElementById('swapBtn').disabled = false;
        document.getElementById('swapBtn').textContent = 'Swap';
    } else {
        walletBtn.textContent = 'Connect Wallet';
        walletBtn.classList.remove('connected');
        document.getElementById('userProfile').style.display = 'none';
        document.getElementById('swapBtn').disabled = true;
        document.getElementById('swapBtn').textContent = 'Connect Wallet to Swap';
    }
};

// ============ API FUNCTIONS ============

const fetchAPI = async (endpoint, method = 'GET', body = null) => {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${CONFIG.API_URL}${endpoint}`, options);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showNotification(`API Error: ${error.message}`, 'error');
        return null;
    }
};

const getQuote = async (tokenIn, tokenOut, amountIn, chainId) => {
    if (!tokenIn || !tokenOut || !amountIn || amountIn === '0') {
        return null;
    }

    try {
        state.swap.loading = true;
        
        const result = await fetchAPI('/quote', 'POST', {
            tokenIn,
            tokenOut,
            amountIn,
            chainId
        });

        if (result?.success) {
            return result;
        }
        return null;
    } finally {
        state.swap.loading = false;
    }
};

const initiateSwap = async (tokenIn, tokenOut, amountIn, minAmountOut, crossChain = false, destinationChain = null) => {
    if (!state.wallet.connected) {
        showNotification('Please connect wallet first', 'error');
        return null;
    }

    try {
        const result = await fetchAPI('/swap/initiate', 'POST', {
            userAddress: state.wallet.address,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            chainId: state.wallet.chainId,
            crossChain,
            destinationChain: destinationChain || state.wallet.chainId
        });

        return result;
    } catch (error) {
        console.error('Initiate swap error:', error);
        return null;
    }
};

const getStats = async () => {
    const result = await fetchAPI('/stats');
    if (result?.success) {
        state.ui.stats = result.stats;
        updateStatsDisplay();
    }
};

const getPools = async (chainId) => {
    const result = await fetchAPI(`/pools/${chainId}`);
    if (result?.success) {
        state.ui.pools = result.pools;
        displayPools();
    }
};

const getChains = async () => {
    const result = await fetchAPI('/chains');
    if (result) {
        populateChainSelector(result);
    }
};

const getUserHistory = async (address) => {
    const result = await fetchAPI(`/user/${address}/history`);
    if (result?.success) {
        state.ui.recentSwaps = result.recentSwaps;
        displayRecentSwaps();
        updateUserStats(result.user);
    }
};

const getPopularTokens = async () => {
    const result = await fetchAPI('/tokens/popular');
    if (result?.success) {
        displayTokenList(result.tokens);
    }
};

// ============ SWAP FUNCTIONALITY ============

const calculateMinAmountOut = (amountOut, slippage) => {
    const slippageAmount = (parseFloat(amountOut) * slippage) / 100;
    return (parseFloat(amountOut) - slippageAmount).toString();
};

const updateQuote = async () => {
    const amountInInput = document.getElementById('amountIn');
    const amountIn = amountInInput.value || '0';
    
    if (!state.swap.tokenIn || !state.swap.tokenOut || amountIn === '0') {
        document.getElementById('routeDetails').style.display = 'none';
        document.getElementById('amountOut').value = '';
        return;
    }

    try {
        const quote = await getQuote(
            state.swap.tokenIn.address,
            state.swap.tokenOut.address,
            parseUnits(amountIn, state.swap.tokenIn.decimals),
            state.wallet.chainId
        );

        if (quote) {
            state.swap.route = quote.route;
            const amountOut = formatUnits(quote.route.expectedOutput, state.swap.tokenOut.decimals);
            state.swap.amountOut = amountOut;
            state.swap.minAmountOut = calculateMinAmountOut(amountOut, state.swap.slippageTolerance);
            
            document.getElementById('amountOut').value = formatNumber(amountOut, 6);
            
            document.getElementById('bestPool').textContent = quote.route.poolName || 'Uniswap V2';
            document.getElementById('priceImpact').textContent = `${quote.route.priceImpact.toFixed(2)}%`;
            
            const impactClass = quote.route.priceImpact < 1 ? 'impact-good' : 
                               quote.route.priceImpact < 3 ? 'impact-warning' : 'impact-danger';
            document.getElementById('priceImpact').className = impactClass;
            
            document.getElementById('slippage').textContent = `${state.swap.slippageTolerance.toFixed(2)}%`;
            document.getElementById('liquidity').textContent = `$${formatNumber(quote.route.liquidity)}`;
            document.getElementById('minReceived').textContent = `${formatNumber(state.swap.minAmountOut, 6)}`;
            document.getElementById('routeDetails').style.display = 'block';
        }
    } catch (error) {
        console.error('Quote update error:', error);
    }
};

const swapDirection = () => {
    [state.swap.tokenIn, state.swap.tokenOut] = [state.swap.tokenOut, state.swap.tokenIn];
    
    const fromDisplay = document.getElementById('tokenFromDisplay');
    const toDisplay = document.getElementById('tokenToDisplay');
    [fromDisplay.textContent, toDisplay.textContent] = [toDisplay.textContent, fromDisplay.textContent];
    
    document.getElementById('amountIn').value = '';
    document.getElementById('amountOut').value = '';
    document.getElementById('routeDetails').style.display = 'none';
    
    updateQuote();
};

const executeSwap = async () => {
    if (!state.wallet.connected) {
        showNotification('Please connect wallet', 'error');
        return;
    }

    if (!state.swap.tokenIn || !state.swap.tokenOut) {
        showNotification('Please select tokens', 'error');
        return;
    }

    const amountIn = document.getElementById('amountIn').value;
    if (!amountIn || parseFloat(amountIn) === 0) {
        showNotification('Please enter amount', 'error');
        return;
    }

    try {
        const swapBtn = document.getElementById('swapBtn');
        swapBtn.disabled = true;
        swapBtn.textContent = 'Processing...';

        const amountInWei = parseUnits(amountIn, state.swap.tokenIn.decimals);
        const minAmountOutWei = parseUnits(state.swap.minAmountOut, state.swap.tokenOut.decimals);

        const result = await initiateSwap(
            state.swap.tokenIn.address,
            state.swap.tokenOut.address,
            amountInWei.toString(),
            minAmountOutWei.toString()
        );

        if (result?.success) {
            showNotification('Swap initiated successfully!', 'success');
            
            document.getElementById('amountIn').value = '';
            document.getElementById('amountOut').value = '';
            document.getElementById('routeDetails').style.display = 'none';
            
            await new Promise(r => setTimeout(r, 1000));
            await getUserHistory(state.wallet.address);
        }
    } catch (error) {
        console.error('Swap execution error:', error);
        showNotification('Failed to execute swap', 'error');
    } finally {
        const swapBtn = document.getElementById('swapBtn');
        swapBtn.disabled = false;
        swapBtn.textContent = 'Swap';
    }
};

// ============ UI UPDATE FUNCTIONS ============

const populateChainSelector = (chains) => {
    const chainSelect = document.getElementById('sourceChain');
    const poolChainFilter = document.getElementById('poolChainFilter');
    
    chains.forEach(chain => {
        const option = document.createElement('option');
        option.value = chain.id;
        option.textContent = chain.name;
        chainSelect.appendChild(option);
        
        const filterOption = document.createElement('option');
        filterOption.value = chain.id;
        filterOption.textContent = chain.name;
        poolChainFilter.appendChild(filterOption);
    });

    chainSelect.addEventListener('change', (e) => {
        state.wallet.chainId = parseInt(e.target.value);
        loadPoolsForChain();
    });

    poolChainFilter.addEventListener('change', (e) => {
        const chainId = e.target.value ? parseInt(e.target.value) : null;
        if (chainId) {
            getPools(chainId);
        }
    });
};

const displayTokenList = (tokens) => {
    const tokenList = document.getElementById('tokenList');
    tokenList.innerHTML = tokens.map(token => `
        <div class="token-item" onclick="selectToken('${token.address}', '${token.symbol}', ${token.decimals})">
            <div class="token-info">
                <div class="token-icon">${token.symbol.substring(0, 2)}</div>
                <div class="token-meta">
                    <h4>${token.symbol}</h4>
                    <p>${token.address.slice(0, 10)}...</p>
                </div>
            </div>
            <div class="token-balance">
                <div class="amount">0.00</div>
                <div class="usd">$0.00</div>
            </div>
        </div>
    `).join('');
};

const selectToken = (address, symbol, decimals) => {
    const token = { address, symbol, decimals };
    
    if (state.ui.selectedTokenModal === 'from') {
        state.swap.tokenIn = token;
        document.getElementById('tokenFromDisplay').textContent = symbol;
    } else {
        state.swap.tokenOut = token;
        document.getElementById('tokenToDisplay').textContent = symbol;
    }
    
    closeModal();
    updateQuote();
};

const displayPools = () => {
    const poolsList = document.getElementById('poolsList');
    
    if (state.ui.pools.length === 0) {
        poolsList.innerHTML = '<div class="empty-state">No pools available</div>';
        return;
    }

    poolsList.innerHTML = state.ui.pools.map(pool => `
        <div class="pool-card">
            <div class="pool-header">
                <div class="pool-pair">${pool.token0.slice(2, 8)} / ${pool.token1.slice(2, 8)}</div>
                <div class="pool-fee">${(pool.fee / 10000).toFixed(2)}%</div>
            </div>
            <div class="pool-info">
                <div class="pool-info-item">
                    <span>Pool</span>
                    <span>${formatAddress(pool.poolAddress)}</span>
                </div>
                <div class="pool-info-item">
                    <span>Liquidity</span>
                    <span>$${formatNumber(pool.liquidity)}</span>
                </div>
                <div class="pool-info-item">
                    <span>Volume 24h</span>
                    <span>$0</span>
                </div>
                <div class="pool-info-item">
                    <span>APR</span>
                    <span>0%</span>
                </div>
            </div>
        </div>
    `).join('');
};

const displayRecentSwaps = () => {
    const swapsList = document.getElementById('recentSwapsList');
    
    if (state.ui.recentSwaps.length === 0) {
        swapsList.innerHTML = '<div class="empty-state">No swaps yet. Start trading!</div>';
        return;
    }

    swapsList.innerHTML = state.ui.recentSwaps.map(swap => `
        <div class="swap-item fade-in">
            <div class="swap-item-header">
                <div class="swap-tokens">
                    ${swap.tokenIn.slice(2, 8)} → ${swap.tokenOut.slice(2, 8)}
                    <span class="swap-amount">${formatNumber(formatUnits(swap.amountIn, 18), 4)}</span>
                </div>
                <div class="swap-status status-${swap.status}">${swap.status.toUpperCase()}</div>
            </div>
            <div class="swap-details">
                <div><strong>Pool:</strong> ${swap.poolUsed ? formatAddress(swap.poolUsed) : 'N/A'}</div>
                <div><strong>Impact:</strong> ${swap.priceImpact?.toFixed(2) || '0'}%</div>
                <div><strong>Time:</strong> ${new Date(swap.timestamp).toLocaleDateString()}</div>
                <div><strong>Output:</strong> ${swap.amountOut ? formatNumber(swap.amountOut) : '0'}</div>
            </div>
        </div>
    `).join('');
};

const updateStatsDisplay = () => {
    if (state.ui.stats) {
        document.getElementById('totalSwaps').textContent = state.ui.stats.totalSwaps || '0';
        document.getElementById('totalVolume').textContent = `$${formatNumber(state.ui.stats.totalVolume / 1e18)}`;
        document.getElementById('totalUsers').textContent = state.ui.stats.totalUsers || '0';
        document.getElementById('activePools').textContent = state.ui.stats.activePools || '0';
        document.getElementById('successRate').textContent = `${state.ui.stats.successRate}%`;
    }
};

const updateUserStats = (user) => {
    if (!user) return;
    
    document.getElementById('userSwaps').textContent = user.totalSwaps || '0';
    document.getElementById('userVolume').textContent = `$${formatNumber(user.totalVolume)}`;
    document.getElementById('userFees').textContent = `$${formatNumber(user.totalFeesPaid)}`;
};

const loadPoolsForChain = async () => {
    if (state.wallet.chainId) {
        await getPools(state.wallet.chainId);
    }
};

const loadUserData = async () => {
    if (state.wallet.address) {
        await getUserHistory(state.wallet.address);
    }
};

// ============ MODAL MANAGEMENT ============

const openTokenModal = (selectType) => {
    state.ui.selectedTokenModal = selectType;
    const modal = document.getElementById('tokenModal');
    modal.classList.add('show');
    getPopularTokens();
};

const closeModal = () => {
    const modal = document.getElementById('tokenModal');
    modal.classList.remove('show');
};

// ============ EVENT LISTENERS ============

document.addEventListener('DOMContentLoaded', async () => {
    hideLoader();

    document.getElementById('walletBtn').addEventListener('click', connectWallet);
    document.getElementById('startSwap').addEventListener('click', () => {
        document.getElementById('swap').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('selectTokenFrom').addEventListener('click', () => openTokenModal('from'));
    document.getElementById('selectTokenTo').addEventListener('click', () => openTokenModal('to'));
    document.getElementById('swapDirection').addEventListener('click', swapDirection);
    document.getElementById('swapBtn').addEventListener('click', executeSwap);

    document.getElementById('amountIn').addEventListener('input', updateQuote);
    document.getElementById('amountIn').addEventListener('change', updateQuote);

    document.querySelectorAll('.btn-slippage').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-slippage').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.swap.slippageTolerance = parseFloat(e.target.dataset.value);
            state.swap.minAmountOut = calculateMinAmountOut(state.swap.amountOut, state.swap.slippageTolerance);
            updateQuote();
        });
    });

    document.getElementById('customSlippage').addEventListener('change', (e) => {
        const value = parseFloat(e.target.value);
        if (value >= 0 && value <= 50) {
            state.swap.slippageTolerance = value;
            document.querySelectorAll('.btn-slippage').forEach(b => b.classList.remove('active'));
            updateQuote();
        }
    });

    document.getElementById('tokenSearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.token-item');
        items.forEach(item => {
            const symbol = item.textContent.toLowerCase();
            item.style.display = symbol.includes(query) ? 'flex' : 'none';
        });
    });

    document.getElementById('poolSearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.pool-card');
        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(query) ? 'block' : 'none';
        });
    });

    document.getElementById('tokenModal').addEventListener('click', (e) => {
        if (e.target.id === 'tokenModal') closeModal();
    });

    document.querySelector('.modal-close').addEventListener('click', closeModal);

    window.ethereum?.on('accountsChanged', async () => {
        await initWeb3();
    });

    window.ethereum?.on('chainChanged', () => {
        window.location.reload();
    });

    await getChains();
    await getStats();
    await initWeb3();

    setInterval(() => {
        getStats();
        if (state.wallet.connected) {
            loadUserData();
        }
    }, 30000);

    updateWalletDisplay();
});

// ============ EXPORT FOR GLOBAL ACCESS ============

window.LiquidBridge = {
    connectWallet,
    executeSwap,
    selectToken,
    closeModal,
    openTokenModal,
    swapDirection,
    getQuote,
    formatNumber,
    formatAddress,
    state
};