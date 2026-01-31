# 🚀 API Platforms Benchmark

A real-time performance benchmarking tool for comparing blockchain data API providers. Track latency, success rates, and reliability metrics across multiple API platforms.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://api-platforms-benchmark.onrender.com/)

## 📊 Overview

This project benchmarks three major blockchain data API providers:
- **Alchemy** - Blockchain development platform
- **Mobula** - Multi-chain crypto data aggregator  
- **Codex** - DeFi data and analytics platform

### What It Tests

1. **Token Price Fetching** - Retrieves real-time prices for USDT and ETH
2. **Wallet Balance Queries** - Fetches token holdings for Ethereum wallets

### Metrics Tracked

- ⏱️ **Average Latency** - Mean response time
- 📈 **P50 Latency** - Median response time
- 📊 **P95 Latency** - 95th percentile response time
- ✅ **Success Rate** - Percentage of successful requests
- ❌ **Failed Requests** - Count of failed API calls

## 🎯 Features

- **Real-time Benchmarking** - Run tests on-demand for each API provider
- **Historical Data** - View performance trends over 1h, 6h, 24h, or 7 days
- **Visual Analytics** - Interactive charts for latency and success metrics
- **Persistent Storage** - All results saved to Supabase for analysis
- **Live Dashboard** - Clean web UI to monitor and trigger tests

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: Supabase (PostgreSQL)
- **Frontend**: Vanilla JavaScript + HTML/CSS
- **Deployment**: Render
- **APIs Tested**: Alchemy, Mobula, Codex

## 📦 Installation

### Prerequisites

- Node.js 14+ 
- npm or yarn
- Supabase account
- API keys for Alchemy, Mobula, and Codex

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/uniiquecornnx/api-platforms-benchmark.git
   cd api-platforms-benchmark
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   
   # Supabase
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   
   # API Keys
   ALCHEMY_API_KEY=your_alchemy_api_key
   MOBULA_API_KEY=your_mobula_api_key
   CODEX_API_KEY=your_codex_api_key
   ```

4. **Set up Supabase database**
   
   Create a `benchmark_results` table with this schema:
   ```sql
   CREATE TABLE benchmark_results (
     id BIGSERIAL PRIMARY KEY,
     provider TEXT NOT NULL,
     test_type TEXT NOT NULL,
     latency NUMERIC NOT NULL,
     success BOOLEAN NOT NULL,
     error_message TEXT,
     timestamp TIMESTAMPTZ DEFAULT NOW()
   );
   
   -- Create indexes for better query performance
   CREATE INDEX idx_provider ON benchmark_results(provider);
   CREATE INDEX idx_timestamp ON benchmark_results(timestamp);
   CREATE INDEX idx_test_type ON benchmark_results(test_type);
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Access the dashboard**
   
   Open your browser to `http://localhost:3000`

## 🎮 Usage

### Running Benchmarks

#### Token Price Benchmark
Tests token price fetching for USDT and ETH across all providers (10 iterations each):

```bash
POST /api/run-price-benchmark
```

Or click **"Run Price Benchmark"** in the dashboard.

#### Wallet Balance Benchmark  
Tests wallet token balance queries (5 iterations per provider):

```bash
POST /api/run-wallet-benchmark
Content-Type: application/json

{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

Or use the **"Run Wallet Benchmark"** form in the dashboard.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/run-price-benchmark` | POST | Execute token price benchmark |
| `/api/run-wallet-benchmark` | POST | Execute wallet balance benchmark |
| `/api/summary?range=24h` | GET | Get aggregated metrics summary |
| `/api/graph/:metric?range=24h` | GET | Get time-series data for charts |
| `/api/health` | GET | Health check endpoint |

### Query Parameters

- `range`: Time range for data (`1h`, `6h`, `24h`, `7d`)
- `metric`: Graph metric type (`avg-latency`, `p95-latency`, `success-rate`, `failed-requests`)

## 📈 How It Works

### Benchmark Process

1. **Sequential Testing**: Each provider is tested in sequence to avoid rate limiting
2. **Multiple Iterations**: 10 iterations for price tests, 5 for wallet queries
3. **Cooldown Periods**: 100-200ms delays between requests
4. **Data Storage**: All results immediately saved to Supabase
5. **Real-time Aggregation**: Dashboard updates with latest metrics

### API Integration Details

**Alchemy**
- Endpoint: `https://api.g.alchemy.com/prices/v1/tokens/by-symbol`
- Method: REST API with Bearer token authentication

**Mobula**  
- Endpoint: `https://api.mobula.io/api/2/token/price`
- Method: REST API with API key header

**Codex**
- Endpoint: `https://graph.codex.io/graphql`
- Method: GraphQL with API key header


## 🔍 Key Metrics Explained

- **Average Latency**: Mean time for all requests - shows typical performance
- **P50 (Median)**: Middle value - 50% of requests are faster
- **P95**: 95% of requests complete within this time - good for SLA guarantees
- **Success Rate**: Percentage of requests without errors
- **Failed Requests**: Count of timeout, error, or invalid responses



- [Live Demo](https://api-platforms-benchmark.onrender.com/)
- [Alchemy Documentation](https://docs.alchemy.com/)
- [Mobula API Docs](https://docs.mobula.io/)
- [Codex Documentation](https://docs.codex.io/)

## 👤 Author

**uniiquecornnx**
- GitHub: [@uniiquecornnx](https://github.com/uniiquecornnx)

## 📊 Sample Results

Based on typical benchmark runs:

| Provider | Avg Latency | P95 Latency | Success Rate |
|----------|-------------|-------------|--------------|
| Alchemy  | ~450ms      | ~850ms      | 98-100%      |
| Mobula   | ~380ms      | ~720ms      | 95-100%      |
| Codex    | ~520ms      | ~980ms      | 92-100%      |

*Note: Actual results vary based on network conditions, API load, and geographic location*


**⭐ If you find this project helpful, please consider giving it a star!**