// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface ILiquidityPool {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
    
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
}

interface IRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract LiquidBridgeAggregator is ReentrancyGuard, Ownable, Pausable {
    
    struct SwapRoute {
        address pool;
        address tokenIn;
        address tokenOut;
        uint256 expectedOutput;
        uint256 fee;
    }
    
    struct CrossChainSwap {
        uint256 swapId;
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 timestamp;
        bool completed;
    }
    
    mapping(address => bool) public registeredPools;
    mapping(address => uint256) public poolFees;
    mapping(uint256 => CrossChainSwap) public swaps;
    mapping(address => uint256[]) public userSwaps;
    
    address[] public pools;
    uint256 public swapCounter;
    uint256 public protocolFeePercentage = 25; // 0.25%
    address public feeRecipient;
    
    event PoolRegistered(address indexed pool, uint256 fee);
    event SwapExecuted(uint256 indexed swapId, address indexed user, uint256 amountIn, uint256 amountOut);
    event SwapInitiated(uint256 indexed swapId, address indexed user, address tokenIn, address tokenOut, uint256 amount);
    event CrossChainBridgeTriggered(uint256 indexed swapId, uint256 chainId);
    
    constructor(address _feeRecipient) {
        feeRecipient = _feeRecipient;
    }
    
    function registerPool(address _pool, uint256 _fee) external onlyOwner {
        require(_pool != address(0), "Invalid pool address");
        require(_fee <= 1000, "Fee too high"); // Max 10%
        
        registeredPools[_pool] = true;
        poolFees[_pool] = _fee;
        pools.push(_pool);
        
        emit PoolRegistered(_pool, _fee);
    }
    
    function calculateBestRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (SwapRoute memory bestRoute) {
        require(pools.length > 0, "No pools registered");
        
        uint256 bestOutput = 0;
        uint256 bestPoolIndex = 0;
        
        for (uint256 i = 0; i < pools.length; i++) {
            try ILiquidityPool(pools[i]).getQuote(tokenIn, tokenOut, amountIn) returns (uint256 output) {
                if (output > bestOutput) {
                    bestOutput = output;
                    bestPoolIndex = i;
                }
            } catch {}
        }
        
        require(bestOutput > 0, "No viable route found");
        
        uint256 protocolFee = (amountIn * protocolFeePercentage) / 10000;
        
        bestRoute = SwapRoute({
            pool: pools[bestPoolIndex],
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            expectedOutput: bestOutput,
            fee: protocolFee
        });
    }
    
    function initiateSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bool crossChain,
        uint256 destinationChain
    ) external nonReentrant whenNotPaused returns (uint256 swapId) {
        require(amountIn > 0, "Amount must be greater than 0");
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid tokens");
        
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        swapId = swapCounter++;
        
        CrossChainSwap storage swap = swaps[swapId];
        swap.swapId = swapId;
        swap.user = msg.sender;
        swap.tokenIn = tokenIn;
        swap.tokenOut = tokenOut;
        swap.amountIn = amountIn;
        swap.minAmountOut = minAmountOut;
        swap.timestamp = block.timestamp;
        swap.completed = false;
        
        userSwaps[msg.sender].push(swapId);
        
        emit SwapInitiated(swapId, msg.sender, tokenIn, tokenOut, amountIn);
        
        if (crossChain) {
            emit CrossChainBridgeTriggered(swapId, destinationChain);
        }
        
        return swapId;
    }
    
    function executeSwap(uint256 swapId) external nonReentrant whenNotPaused {
        CrossChainSwap storage swap = swaps[swapId];
        require(!swap.completed, "Swap already completed");
        require(swap.user == msg.sender || msg.sender == owner(), "Unauthorized");
        
        SwapRoute memory route = SwapRoute({
            pool: address(0),
            tokenIn: swap.tokenIn,
            tokenOut: swap.tokenOut,
            expectedOutput: 0,
            fee: 0
        });
        
        uint256 bestOutput = 0;
        address bestPool = address(0);
        
        for (uint256 i = 0; i < pools.length; i++) {
            try ILiquidityPool(pools[i]).getQuote(swap.tokenIn, swap.tokenOut, swap.amountIn) returns (uint256 output) {
                if (output > bestOutput) {
                    bestOutput = output;
                    bestPool = pools[i];
                }
            } catch {}
        }
        
        require(bestPool != address(0) && bestOutput >= swap.minAmountOut, "Slippage exceeded");
        
        IERC20(swap.tokenIn).approve(bestPool, swap.amountIn);
        
        uint256 amountOut = ILiquidityPool(bestPool).swap(
            swap.tokenIn,
            swap.tokenOut,
            swap.amountIn,
            swap.minAmountOut
        );
        
        uint256 protocolFee = (amountOut * protocolFeePercentage) / 10000;
        uint256 userAmount = amountOut - protocolFee;
        
        IERC20(swap.tokenOut).transfer(swap.user, userAmount);
        IERC20(swap.tokenOut).transfer(feeRecipient, protocolFee);
        
        swap.completed = true;
        
        emit SwapExecuted(swapId, swap.user, swap.amountIn, userAmount);
    }
    
    function getUserSwaps(address user) external view returns (uint256[] memory) {
        return userSwaps[user];
    }
    
    function getSwapDetails(uint256 swapId) external view returns (CrossChainSwap memory) {
        return swaps[swapId];
    }
    
    function getPools() external view returns (address[] memory) {
        return pools;
    }
    
    function setProtocolFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Fee too high");
        protocolFeePercentage = _feePercentage;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner(), balance);
    }
}