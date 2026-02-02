// server.js - Enhanced with accuracy tracking and error classification
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
        expectedPrice: 1.0,
        tolerance: 0.05 // ±5% for stablecoin
    },
    ETH: {
        symbol: 'ETH',
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        blockchain: 'Ethereum',
        minPrice: 1000,
        maxPrice: 10000 // Sanity bounds
    }
};

console.log('🔧 API Configuration:');
console.log('Alchemy:', process.env.ALCHEMY_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Mobula:', process.env.MOBULA_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Codex:', process.env.CODEX_API_KEY ? '✓ Configured' : '✗ Missing');

// ====================================
// HELPER: Extract price from different API responses
// ====================================
function extractPrice(provider, responseData) {
    try {
        let price = null;
        
        if (provider === 'alchemy') {
            price = responseData?.data?.[0]?.prices?.[0]?.value;
        } else if (provider === 'mobula') {
            // Mobula uses priceUSD (capital USD)
            price = responseData?.data?.priceUSD;
        } else if (provider === 'codex') {
            // Codex returns an array, get first element
            price = responseData?.data?.getTokenPrices?.[0]?.priceUsd;
        }
        
        // Ensure it's a number
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
// HELPER: Validate price accuracy
// ====================================
function validatePriceAccuracy(tokenSymbol, priceValue) {
    if (!priceValue || priceValue <= 0) return false;
    
    const token = TOKENS[tokenSymbol];
    
    if (tokenSymbol === 'USDT') {
        // Stablecoin should be close to $1
        const deviation = Math.abs(priceValue - token.expectedPrice);
        return deviation <= token.tolerance;
    } else if (tokenSymbol === 'ETH') {
        // ETH should be within sanity bounds
        return priceValue >= token.minPrice && priceValue <= token.maxPrice;
    }
    
    return true;
}

// ====================================
// TEST 1: TOKEN PRICE FETCHING (Enhanced)
// ====================================

async function testTokenPrice(provider, tokenSymbol) {
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
    
    // Validate accuracy
    const isAccurate = priceValue ? validatePriceAccuracy(tokenSymbol, priceValue) : false;

    return {
        latency,
        success,
        errorMessage,
        responseData,
        priceValue,
        responseSize,
        errorType,
        isAccurate
    };
}

// ====================================
// TEST 2: WALLET BALANCE FETCHING (Enhanced)
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
    console.log('\n🔄 Starting PRICE benchmark...');
    console.log('Testing: Token price fetching for USDT and ETH');
    console.log('Providers: Alchemy, Mobula, Codex');
    console.log('Iterations: 10 per token per provider\n');
    
    const providers = ['alchemy', 'mobula', 'codex'];
    const tokens = ['USDT', 'ETH'];
    const iterations = 10;
    
    const testStartTime = Date.now();
    
    for (const provider of providers) {
        console.log(`Testing ${provider}...`);
        
        for (const token of tokens) {
            for (let i = 0; i < iterations; i++) {
                const result = await testTokenPrice(provider, token);
                
                const priceStr = result.priceValue !== null ? `$${result.priceValue.toFixed(4)}` : 'N/A';
                const accurateStr = result.isAccurate ? '✓' : '✗';
                console.log(`  ${provider} ${token} #${i+1}: ${result.latency.toFixed(0)}ms - ${result.success ? '✓' : '✗ ' + result.errorMessage} - Price: ${priceStr} - Accurate: ${accurateStr}`);
                
                // Store in Supabase with ALL new fields
                await supabase.from('benchmark_results').insert({
                    provider,
                    test_type: `price_${token}`,
                    latency: result.latency,
                    success: result.success,
                    error_message: result.errorMessage,
                    price_value: result.priceValue,
                    response_size: result.responseSize,
                    error_type: result.errorType,
                    is_accurate: result.isAccurate
                });

                await new Promise(r => setTimeout(r, 100));
            }
        }
        
        console.log(`✓ ${provider} complete\n`);
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
    console.log('Providers: Alchemy, Mobula, Codex');
    console.log('Iterations: 5 per provider\n');
    
    const providers = ['alchemy', 'mobula', 'codex'];
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
    const providers = ['alchemy', 'mobula', 'codex'];

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
                avg_response_size: 0
            };
            return;
        }

        const latencies = providerData.map(d => d.latency).sort((a, b) => a - b);
        const failed = providerData.filter(d => !d.success).length;
        const accurate = providerData.filter(d => d.is_accurate === true).length;
        const totalWithAccuracy = providerData.filter(d => d.is_accurate !== null).length;
        const avgResponseSize = providerData.reduce((sum, d) => sum + (d.response_size || 0), 0) / providerData.length;

        summary[provider] = {
            provider,
            requests: providerData.length,
            failed,
            success_rate: ((providerData.length - failed) / providerData.length) * 100,
            avg_latency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            p50_latency: latencies[Math.floor(latencies.length * 0.5)],
            p95_latency: latencies[Math.floor(latencies.length * 0.95)],
            accuracy_rate: totalWithAccuracy > 0 ? (accurate / totalWithAccuracy) * 100 : 0,
            avg_response_size: avgResponseSize
        };
    });

    res.json(Object.values(summary));
});

// NEW: Get accuracy comparison data
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
        const token = row.test_type; // price_USDT or price_ETH
        
        const key = `${bucket}_${token}`;
        if (!grouped[key]) {
            grouped[key] = { time: bucket, token, alchemy: [], mobula: [], codex: [] };
        }
        
        grouped[key][row.provider].push(row.price_value);
    });

    const result = Object.values(grouped).map(bucket => {
        const prices = {};
        ['alchemy', 'mobula', 'codex'].forEach(provider => {
            if (bucket[provider].length > 0) {
                prices[provider] = bucket[provider].reduce((a, b) => a + b, 0) / bucket[provider].length;
            }
        });
        
        // Calculate variance
        const priceValues = Object.values(prices);
        if (priceValues.length >= 2) {
            const avg = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
            const maxDeviation = Math.max(...priceValues.map(p => Math.abs(p - avg) / avg * 100));
            prices.variance = maxDeviation;
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

// NEW: Get error breakdown
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
    const providers = ['alchemy', 'mobula', 'codex'];

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
            grouped[bucket] = { alchemy: [], mobula: [], codex: [] };
        }
        
        grouped[bucket][row.provider].push(row);
    });

    const result = Object.keys(grouped).sort().map(time => {
        const bucket = { time };
        
        ['alchemy', 'mobula', 'codex'].forEach(provider => {
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
                bucket[provider] = providerData.length; // requests per 5-min bucket
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
    console.log('   🚀 API Benchmark Server (Enhanced)');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Dashboard: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log('═══════════════════════════════════════════════\n');
});