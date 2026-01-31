// server.js - CORRECTED with proper API endpoints
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
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7', // Ethereum
        blockchain: 'Ethereum'
    },
    ETH: {
        symbol: 'ETH',
        address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Ethereum native
        blockchain: 'Ethereum'
    }
};

console.log('🔧 API Configuration:');
console.log('Alchemy:', process.env.ALCHEMY_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Mobula:', process.env.MOBULA_API_KEY ? '✓ Configured' : '✗ Missing');
console.log('Codex:', process.env.CODEX_API_KEY ? '✓ Configured' : '✗ Missing');

// ====================================
// TEST 1: TOKEN PRICE FETCHING
// ====================================

async function testTokenPrice(provider, tokenSymbol) {
    const token = TOKENS[tokenSymbol];
    const startTime = performance.now();
    let success = false;
    let errorMessage = null;
    let responseData = null;

    try {
        let response;

        if (provider === 'alchemy') {
            // Alchemy: Get token price by symbol
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
            // CORRECTED: Mobula uses /api/2/token/price with address parameter
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
            // Codex: GraphQL getTokenPrices
            response = await fetch('https://graph.codex.io/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': process.env.CODEX_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: `{
                        getTokenPrices(inputs: {address: "${token.address}", networkId: 1}) {
                            address
                            priceUsd
                        }
                    }`
                })
            });
        }

        const data = await response.json();
        success = response.ok && !data.error;
        responseData = data;
        
        if (!success) {
            errorMessage = data.error || data.message || `HTTP ${response.status}`;
        }

    } catch (error) {
        errorMessage = error.message;
    }

    const endTime = performance.now();
    const latency = endTime - startTime;

    return {
        latency,
        success,
        errorMessage,
        responseData
    };
}

// ====================================
// TEST 2: WALLET BALANCE FETCHING
// ====================================

async function testWalletBalance(provider, walletAddress) {
    const startTime = performance.now();
    let success = false;
    let errorMessage = null;

    try {
        let response;

        if (provider === 'alchemy') {
            // Alchemy: getTokenBalances with DEFAULT_TOKENS
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
            // Mobula: /wallet/portfolio endpoint
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
            // Codex: GraphQL balances query
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

        const data = await response.json();
        success = response.ok && !data.error;
        
        if (!success) {
            errorMessage = data.error || data.message || `HTTP ${response.status}`;
        }

    } catch (error) {
        errorMessage = error.message;
    }

    const endTime = performance.now();
    const latency = endTime - startTime;

    return {
        latency,
        success,
        errorMessage
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
    
    for (const provider of providers) {
        console.log(`Testing ${provider}...`);
        
        for (const token of tokens) {
            for (let i = 0; i < iterations; i++) {
                const result = await testTokenPrice(provider, token);
                
                console.log(`  ${provider} ${token} #${i+1}: ${result.latency.toFixed(0)}ms - ${result.success ? '✓' : '✗ ' + result.errorMessage}`);
                
                // Store in Supabase
                await supabase.from('benchmark_results').insert({
                    provider,
                    test_type: `price_${token}`,
                    latency: result.latency,
                    success: result.success,
                    error_message: result.errorMessage
                });

                await new Promise(r => setTimeout(r, 100));
            }
        }
        
        console.log(`✓ ${provider} complete\n`);
    }

    console.log('✅ Price benchmark complete!\n');
    res.json({ success: true, message: 'Price benchmark complete' });
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
                error_message: result.errorMessage
            });

            await new Promise(r => setTimeout(r, 200));
        }
        
        console.log(`✓ ${provider} complete\n`);
    }

    console.log('✅ Wallet balance benchmark complete!\n');
    res.json({ success: true, message: 'Wallet balance benchmark complete' });
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
                p95_latency: 0
            };
            return;
        }

        const latencies = providerData.map(d => d.latency).sort((a, b) => a - b);
        const failed = providerData.filter(d => !d.success).length;

        summary[provider] = {
            provider,
            requests: providerData.length,
            failed,
            success_rate: ((providerData.length - failed) / providerData.length) * 100,
            avg_latency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            p50_latency: latencies[Math.floor(latencies.length * 0.5)],
            p95_latency: latencies[Math.floor(latencies.length * 0.95)]
        };
    });

    res.json(Object.values(summary));
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

    // Group by 5-minute buckets for better granularity
    const grouped = {};
    
    data.forEach(row => {
        const time = new Date(row.timestamp);
        // Round to nearest 5 minutes
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
    console.log('   🚀 API Benchmark Server');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Dashboard: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log('═══════════════════════════════════════════════\n');
});