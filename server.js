// server.js - Enhanced with CoinGecko as accuracy reference + GoldRush
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Token configurations for PRICE testing
const TOKENS = {
    USDT: {
        symbol: 'USDT',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        blockchain: 'Ethereum',
        coingeckoId: 'ethereum', // asset platform for CoinGecko
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        goldrushChain: 'eth-mainnet'
    },
    ETH: {
        symbol: 'ETH',
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        blockchain: 'Ethereum',
        coingeckoId: 'ethereum',
        contractAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        goldrushChain: 'eth-mainnet'
    }
};

console.log('🔧 API Configuration:');
console.log('Alchemy:', process.env.ALCHEMY_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Mobula:', process.env.MOBULA_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Codex:', process.env.CODEX_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('CoinGecko:', process.env.COINGECKO_API_KEY ? '✓ Configured' : '✗ Missing (will use public API)');
console.log('GoldRush:', process.env.GOLDRUSH_API_KEY ? '✓ Configured' : '✗ Missing');

// ====================================
// COINGECKO REFERENCE PRICE FETCHER
// ====================================
async function getCoinGeckoReferencePrice(tokenSymbol) {
    const token = TOKENS[tokenSymbol];
    
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add API key if available (for higher rate limits)
        if (process.env.COINGECKO_API_KEY) {
            headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
        }
        
        const url = `https://api.coingecko.com/api/v3/simple/token_price/${token.coingeckoId}?contract_addresses=${token.contractAddress}&vs_currencies=usd`;
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            console.error(`CoinGecko API error: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const price = data[token.contractAddress.toLowerCase()]?.usd;
        
        return price || null;
        
    } catch (error) {
        console.error('Error fetching CoinGecko reference price:', error.message);
        return null;
    }
}

// ====================================
// HELPER: Extract price from different API responses
// ====================================
function extractPrice(provider, responseData) {
    try {
        let price = null;
        
        if (provider === 'alchemy') {
            price = responseData?.data?.[0]?.prices?.[0]?.value;
        } else if (provider === 'mobula') {
            price = responseData?.data?.priceUSD;
        } else if (provider === 'codex') {
            price = responseData?.data?.getTokenPrices?.[0]?.priceUsd;
        } else if (provider === 'coingecko') {
            // Extract from CoinGecko response
            const contractAddr = Object.keys(responseData)[0];
            price = responseData[contractAddr]?.usd;
        } else if (provider === 'goldrush') {
            // GoldRush/Covalent returns prices in data wrapper OR directly
            // Response structure: { data: [{ prices: [{ price: 123 }] }] } OR { prices: [{ price: 123 }] }
            // Try data wrapper first (from pricing endpoint)
            if (responseData?.data?.[0]?.prices?.[0]?.price) {
                price = responseData.data[0].prices[0].price;
            } 
            // Fallback to direct prices array
            else if (responseData?.prices?.[0]?.price) {
                price = responseData.prices[0].price;
            }
        }
        
        if (price === null || price === undefined) {
            return null;
        }
        
        const numPrice = parseFloat(price);
        return isNaN(numPrice) ? null : numPrice;
    } catch (e) {
        return null;
    }
}

// ====================================
// HELPER: Classify error types
// ====================================
function classifyError(errorMessage, statusCode) {
    if (!errorMessage) return 'success';
    
    const msg = errorMessage.toLowerCase();
    
    if (msg.includes('429') || msg.includes('rate limit')) return 'rate_limit';
    if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) return 'auth_error';
    if (msg.includes('404') || msg.includes('not found')) return 'not_found';
    if (msg.includes('500') || msg.includes('502') || msg.includes('503')) return 'server_error';
    if (msg.includes('timeout') || msg.includes('econnrefused')) return 'network_error';
    if (msg.includes('parse') || msg.includes('json')) return 'parse_error';
    
    return 'unknown_error';
}

// ====================================
// HELPER: Validate price accuracy against CoinGecko
// ====================================
function validatePriceAccuracy(priceValue, referencePrice, tolerance = 0.05) {
    if (!priceValue || !referencePrice || priceValue <= 0 || referencePrice <= 0) {
        return false;
    }
    
    const deviation = Math.abs(priceValue - referencePrice) / referencePrice;
    return deviation <= tolerance; // 5% tolerance by default
}

// ====================================
// HELPER: Calculate price deviation percentage
// ====================================
function calculateDeviation(priceValue, referencePrice) {
    if (!priceValue || !referencePrice || referencePrice === 0) {
        return null;
    }
    
    return ((priceValue - referencePrice) / referencePrice) * 100;
}

// ====================================
// TEST 1: TOKEN PRICE FETCHING (Enhanced with CoinGecko + GoldRush)
// ====================================

async function testTokenPrice(provider, tokenSymbol, coinGeckoReference = null) {
    const token = TOKENS[tokenSymbol];
    const startTime = performance.now();
    let success = false;
    let errorMessage = null;
    let responseData = null;
    let statusCode = null;

    try {
        let response;

        if (provider === 'alchemy') {
            response = await fetch(
                `https://api.g.alchemy.com/prices/v1/tokens/by-symbol?symbols=${tokenSymbol}`,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.ALCHEMY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
        } else if (provider === 'mobula') {
            response = await fetch(
                `https://api.mobula.io/api/2/token/price?address=${token.address}&blockchain=${token.blockchain}`,
                {
                    headers: {
                        'Authorization': process.env.MOBULA_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
        } else if (provider === 'codex') {
            response = await fetch('https://graph.codex.io/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': process.env.CODEX_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: `{
                        getTokenPrices(inputs: [{address: "${token.address}", networkId: 1}]) {
                            priceUsd
                            address
                        }
                    }`
                })
            });
        } else if (provider === 'coingecko') {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (process.env.COINGECKO_API_KEY) {
                headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
            }
            
            response = await fetch(
                `https://api.coingecko.com/api/v3/simple/token_price/${token.coingeckoId}?contract_addresses=${token.contractAddress}&vs_currencies=usd`,
                { headers }
            );
        } else if (provider === 'goldrush') {
            // GoldRush/Covalent API - historical prices endpoint
            // Returns most recent price data when no date range specified
            response = await fetch(
                `https://api.covalenthq.com/v1/pricing/historical_by_addresses_v2/${token.goldrushChain}/USD/${token.address}/`,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.GOLDRUSH_API_KEY}`
                    }
                }
            );
        }

        statusCode = response.status;
        const data = await response.json();
        responseData = data;
        success = response.ok && !data.error;
        
        if (!success) {
            errorMessage = data.error || data.message || `HTTP ${response.status}`;
        }

    } catch (error) {
        errorMessage = error.message;
    }

    const endTime = performance.now();
    const latency = endTime - startTime;
    
    // Extract price value
    const priceValue = success ? extractPrice(provider, responseData) : null;
    
    // Calculate response size
    const responseSize = responseData ? JSON.stringify(responseData).length : 0;
    
    // Classify error type
    const errorType = classifyError(errorMessage, statusCode);
    
    // Validate accuracy against CoinGecko reference
    const isAccurate = (priceValue && coinGeckoReference) 
        ? validatePriceAccuracy(priceValue, coinGeckoReference) 
        : null;
    
    // Calculate deviation from reference
    const deviation = (priceValue && coinGeckoReference)
        ? calculateDeviation(priceValue, coinGeckoReference)
        : null;

    return {
        latency,
        success,
        errorMessage,
        responseData,
        priceValue,
        responseSize,
        errorType,
        isAccurate,
        referencePrice: coinGeckoReference,
        deviation
    };
}

// ====================================
// TEST 2: WALLET BALANCE FETCHING (Enhanced with GoldRush)
// ====================================

async function testWalletBalance(provider, walletAddress) {
    const startTime = performance.now();
    let success = false;
    let errorMessage = null;
    let statusCode = null;
    let responseData = null;

    try {
        let response;

        if (provider === 'alchemy') {
            response = await fetch(
                `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'alchemy_getTokenBalances',
                        params: [walletAddress, 'DEFAULT_TOKENS'],
                        id: 1
                    })
                }
            );
            
        } else if (provider === 'mobula') {
            response = await fetch(
                `https://api.mobula.io/api/1/wallet/portfolio?wallet=${walletAddress}&blockchains=ethereum`,
                {
                    headers: {
                        'Authorization': process.env.MOBULA_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
        } else if (provider === 'codex') {
            response = await fetch('https://graph.codex.io/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': process.env.CODEX_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: `{
                        balances(input: {
                            walletAddress: "${walletAddress}"
                            networks: [1]
                            removeScams: true
                            limit: 10
                        }) {
                            items {
                                balance
                                balanceUsd
                                token {
                                    symbol
                                    name
                                }
                            }
                        }
                    }`
                })
            });
        } else if (provider === 'goldrush') {
            // GoldRush/Covalent API - balances_v2 endpoint
            // Returns all token balances with metadata
            response = await fetch(
                `https://api.covalenthq.com/v1/eth-mainnet/address/${walletAddress}/balances_v2/`,
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.GOLDRUSH_API_KEY}`
                    }
                }
            );
        }

        statusCode = response.status;
        const data = await response.json();
        responseData = data;
        success = response.ok && !data.error;
        
        if (!success) {
            errorMessage = data.error || data.message || `HTTP ${response.status}`;
        }

    } catch (error) {
        errorMessage = error.message;
    }

    const endTime = performance.now();
    const latency = endTime - startTime;
    
    const responseSize = responseData ? JSON.stringify(responseData).length : 0;
    const errorType = classifyError(errorMessage, statusCode);

    return {
        latency,
        success,
        errorMessage,
        responseSize,
        errorType
    };
}

// ====================================
// API ENDPOINTS
// ====================================

// Run price benchmark
app.post('/api/run-price-benchmark', async (req, res) => {
    console.log('\n🔄 Starting PRICE benchmark with CoinGecko reference...');
    console.log('Testing: Token price fetching for USDT and ETH');
    console.log('Providers: Alchemy, Mobula, Codex, CoinGecko (reference), GoldRush');
    console.log('Iterations: 10 per token per provider\n');
    
    const providers = ['alchemy', 'mobula', 'codex', 'coingecko', 'goldrush'];
    const tokens = ['USDT', 'ETH'];
    const iterations = 10;
    
    const testStartTime = Date.now();
    
    for (const token of tokens) {
        console.log(`\n📊 Testing ${token}...`);
        
        for (let i = 0; i < iterations; i++) {
            // First, get CoinGecko reference price
            console.log(`  Iteration ${i+1}/${iterations}`);
            const coinGeckoRef = await getCoinGeckoReferencePrice(token);
            
            if (coinGeckoRef) {
                console.log(`  ✓ CoinGecko reference: $${coinGeckoRef.toFixed(4)}`);
            } else {
                console.log(`  ⚠ CoinGecko reference unavailable`);
            }
            
            // Test each provider
            for (const provider of providers) {
                const result = await testTokenPrice(provider, token, coinGeckoRef);
                
                const priceStr = result.priceValue !== null ? `$${result.priceValue.toFixed(4)}` : 'N/A';
                const accurateStr = result.isAccurate === true ? '✓' : result.isAccurate === false ? '✗' : '-';
                const deviationStr = result.deviation !== null ? `${result.deviation > 0 ? '+' : ''}${result.deviation.toFixed(2)}%` : 'N/A';
                
                console.log(`    ${provider.padEnd(10)} ${result.latency.toFixed(0).padStart(4)}ms - ${result.success ? '✓' : '✗'} - ${priceStr} - Accurate: ${accurateStr} - Deviation: ${deviationStr}`);
                
                // Store in Supabase with ALL fields including reference price and deviation
                await supabase.from('benchmark_results').insert({
                    provider,
                    test_type: `price_${token}`,
                    latency: result.latency,
                    success: result.success,
                    error_message: result.errorMessage,
                    price_value: result.priceValue,
                    response_size: result.responseSize,
                    error_type: result.errorType,
                    is_accurate: result.isAccurate,
                    reference_price: result.referencePrice,
                    deviation: result.deviation
                });

                await new Promise(r => setTimeout(r, 100));
            }
        }
        
        console.log(`✓ ${token} complete\n`);
    }
    
    const testEndTime = Date.now();
    const totalDuration = (testEndTime - testStartTime) / 1000;
    const totalRequests = providers.length * tokens.length * iterations;
    const throughput = totalRequests / totalDuration;
    
    console.log(`✅ Price benchmark complete!`);
    console.log(`Total requests: ${totalRequests}`);
    console.log(`Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`Throughput: ${throughput.toFixed(2)} req/s\n`);
    
    res.json({ 
        success: true, 
        message: 'Price benchmark complete',
        totalRequests,
        duration: totalDuration,
        throughput
    });
});

// Run wallet balance benchmark
app.post('/api/run-wallet-benchmark', async (req, res) => {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
    }

    console.log('\n🔄 Starting WALLET BALANCE benchmark...');
    console.log('Testing: Wallet token holdings');
    console.log('Wallet:', walletAddress);
    console.log('Providers: Alchemy, Mobula, Codex, GoldRush');
    console.log('Iterations: 5 per provider\n');
    
    const providers = ['alchemy', 'mobula', 'codex', 'goldrush'];
    const iterations = 5;
    
    const testStartTime = Date.now();
    
    for (const provider of providers) {
        console.log(`Testing ${provider}...`);
        
        for (let i = 0; i < iterations; i++) {
            const result = await testWalletBalance(provider, walletAddress);
            
            console.log(`  ${provider} #${i+1}: ${result.latency.toFixed(0)}ms - ${result.success ? '✓' : '✗ ' + result.errorMessage}`);
            
            // Store in Supabase
            await supabase.from('benchmark_results').insert({
                provider,
                test_type: 'wallet_balance',
                latency: result.latency,
                success: result.success,
                error_message: result.errorMessage,
                response_size: result.responseSize,
                error_type: result.errorType
            });

            await new Promise(r => setTimeout(r, 200));
        }
        
        console.log(`✓ ${provider} complete\n`);
    }
    
    const testEndTime = Date.now();
    const totalDuration = (testEndTime - testStartTime) / 1000;
    const totalRequests = providers.length * iterations;
    const throughput = totalRequests / totalDuration;

    console.log(`✅ Wallet balance benchmark complete!`);
    console.log(`Total requests: ${totalRequests}`);
    console.log(`Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`Throughput: ${throughput.toFixed(2)} req/s\n`);
    
    res.json({ 
        success: true, 
        message: 'Wallet balance benchmark complete',
        totalRequests,
        duration: totalDuration,
        throughput
    });
});

// Get summary data
app.get('/api/summary', async (req, res) => {
    const timeRange = req.query.range || '24h';
    let hours = 24;
    if (timeRange === '1h') hours = 1;
    else if (timeRange === '6h') hours = 6;
    else if (timeRange === '7d') hours = 168;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('benchmark_results')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: true });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    const summary = {};
    const providers = ['alchemy', 'mobula', 'codex', 'coingecko', 'goldrush'];

    providers.forEach(provider => {
        const providerData = data.filter(d => d.provider === provider);
        
        if (providerData.length === 0) {
            summary[provider] = {
                provider,
                requests: 0,
                failed: 0,
                success_rate: 0,
                avg_latency: 0,
                p50_latency: 0,
                p95_latency: 0,
                accuracy_rate: 0,
                avg_response_size: 0,
                avg_deviation: 0
            };
            return;
        }

        const latencies = providerData.map(d => d.latency).sort((a, b) => a - b);
        const failed = providerData.filter(d => !d.success).length;
        const accurate = providerData.filter(d => d.is_accurate === true).length;
        const totalWithAccuracy = providerData.filter(d => d.is_accurate !== null).length;
        const avgResponseSize = providerData.reduce((sum, d) => sum + (d.response_size || 0), 0) / providerData.length;
        
        // Calculate average deviation
        const deviations = providerData.filter(d => d.deviation !== null).map(d => Math.abs(d.deviation));
        const avgDeviation = deviations.length > 0 
            ? deviations.reduce((a, b) => a + b, 0) / deviations.length 
            : 0;

        summary[provider] = {
            provider,
            requests: providerData.length,
            failed,
            success_rate: ((providerData.length - failed) / providerData.length) * 100,
            avg_latency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            p50_latency: latencies[Math.floor(latencies.length * 0.5)],
            p95_latency: latencies[Math.floor(latencies.length * 0.95)],
            accuracy_rate: totalWithAccuracy > 0 ? (accurate / totalWithAccuracy) * 100 : 0,
            avg_response_size: avgResponseSize,
            avg_deviation: avgDeviation
        };
    });

    res.json(Object.values(summary));
});

// Get accuracy comparison data (now includes CoinGecko as reference + GoldRush)
app.get('/api/accuracy-comparison', async (req, res) => {
    const timeRange = req.query.range || '24h';
    let hours = 24;
    if (timeRange === '1h') hours = 1;
    else if (timeRange === '6h') hours = 6;
    else if (timeRange === '7d') hours = 168;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('benchmark_results')
        .select('*')
        .gte('timestamp', since)
        .like('test_type', 'price_%')
        .not('price_value', 'is', null)
        .order('timestamp', { ascending: true });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // Group by token and time bucket
    const grouped = {};
    
    data.forEach(row => {
        const time = new Date(row.timestamp);
        time.setMinutes(Math.floor(time.getMinutes() / 5) * 5, 0, 0);
        const bucket = time.toISOString();
        const token = row.test_type;
        
        const key = `${bucket}_${token}`;
        if (!grouped[key]) {
            grouped[key] = { 
                time: bucket, 
                token, 
                alchemy: [], 
                mobula: [], 
                codex: [], 
                coingecko: [],
                goldrush: [],
                reference: [] 
            };
        }
        
        grouped[key][row.provider].push(row.price_value);
        
        // Track reference prices from all providers for variance calculation
        if (row.reference_price) {
            grouped[key].reference.push(row.reference_price);
        }
    });

    const result = Object.values(grouped).map(bucket => {
        const prices = {};
        ['alchemy', 'mobula', 'codex', 'coingecko', 'goldrush'].forEach(provider => {
            if (bucket[provider].length > 0) {
                prices[provider] = bucket[provider].reduce((a, b) => a + b, 0) / bucket[provider].length;
            }
        });
        
        // Calculate variance against CoinGecko reference
        const referencePrice = bucket.reference.length > 0 
            ? bucket.reference.reduce((a, b) => a + b, 0) / bucket.reference.length 
            : null;
        
        if (referencePrice) {
            const deviations = Object.values(prices)
                .filter(p => p !== undefined)
                .map(p => Math.abs((p - referencePrice) / referencePrice * 100));
            
            prices.variance = deviations.length > 0 
                ? Math.max(...deviations) 
                : 0;
            
            prices.reference = referencePrice;
        } else {
            prices.variance = 0;
        }
        
        return {
            time: bucket.time,
            token: bucket.token,
            ...prices
        };
    });

    res.json(result);
});

// Get error breakdown
app.get('/api/error-breakdown', async (req, res) => {
    const timeRange = req.query.range || '24h';
    let hours = 24;
    if (timeRange === '1h') hours = 1;
    else if (timeRange === '6h') hours = 6;
    else if (timeRange === '7d') hours = 168;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('benchmark_results')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: true });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    const breakdown = {};
    const providers = ['alchemy', 'mobula', 'codex', 'coingecko', 'goldrush'];

    providers.forEach(provider => {
        const providerData = data.filter(d => d.provider === provider);
        const errorCounts = {};
        
        providerData.forEach(row => {
            const errorType = row.error_type || 'success';
            errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
        });
        
        breakdown[provider] = errorCounts;
    });

    res.json(breakdown);
});

// Get graph data with proper time series
app.get('/api/graph/:metric', async (req, res) => {
    const metric = req.params.metric;
    const timeRange = req.query.range || '24h';
    
    let hours = 24;
    if (timeRange === '1h') hours = 1;
    else if (timeRange === '6h') hours = 6;
    else if (timeRange === '7d') hours = 168;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('benchmark_results')
        .select('*')
        .gte('timestamp', since)
        .order('timestamp', { ascending: true });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    // Group by 5-minute buckets
    const grouped = {};
    
    data.forEach(row => {
        const time = new Date(row.timestamp);
        time.setMinutes(Math.floor(time.getMinutes() / 5) * 5, 0, 0);
        const bucket = time.toISOString();
        
        if (!grouped[bucket]) {
            grouped[bucket] = { alchemy: [], mobula: [], codex: [], coingecko: [], goldrush: [] };
        }
        
        grouped[bucket][row.provider].push(row);
    });

    const result = Object.keys(grouped).sort().map(time => {
        const bucket = { time };
        
        ['alchemy', 'mobula', 'codex', 'coingecko', 'goldrush'].forEach(provider => {
            const providerData = grouped[time][provider];
            
            if (providerData.length === 0) {
                bucket[provider] = null;
                return;
            }

            if (metric === 'failed-requests') {
                bucket[provider] = providerData.filter(d => !d.success).length;
            } else if (metric === 'avg-latency') {
                const sum = providerData.reduce((acc, d) => acc + d.latency, 0);
                bucket[provider] = sum / providerData.length;
            } else if (metric === 'p95-latency') {
                const latencies = providerData.map(d => d.latency).sort((a, b) => a - b);
                bucket[provider] = latencies[Math.floor(latencies.length * 0.95)] || latencies[latencies.length - 1];
            } else if (metric === 'success-rate') {
                const successCount = providerData.filter(d => d.success).length;
                bucket[provider] = (successCount / providerData.length) * 100;
            } else if (metric === 'accuracy-rate') {
                const accurateCount = providerData.filter(d => d.is_accurate === true).length;
                const totalWithAccuracy = providerData.filter(d => d.is_accurate !== null).length;
                bucket[provider] = totalWithAccuracy > 0 ? (accurateCount / totalWithAccuracy) * 100 : null;
            } else if (metric === 'throughput') {
                bucket[provider] = providerData.length;
            }
        });
        
        return bucket;
    });

    res.json(result);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════');
    console.log('   🚀 API Benchmark Server (Enhanced + GoldRush)');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Dashboard: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log('═══════════════════════════════════════════════\n');
});