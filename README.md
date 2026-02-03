# 🚀 Crypto API Benchmark Dashboard

A comprehensive, real-time benchmarking platform for evaluating crypto data API providers across **performance**, **accuracy**, and **reliability** metrics.


---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Why This Exists](#why-this-exists)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Metrics Explained](#metrics-explained)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Screenshots](#screenshots)
- [Contributing](#contributing)

---

## 🎯 Overview

This tool provides **data-driven insights** for choosing between crypto API providers (Alchemy, Mobula, Codex) by continuously testing and validating their:

- ⚡ **Performance** - Latency (avg, P50, P95)
- ✅ **Reliability** - Success rates and error patterns
- 🎯 **Accuracy** - Price validation against CoinGecko reference
- 📊 **Consistency** - Cross-provider variance tracking

**Made for:**
- Web3 engineering teams evaluating API providers
- CTOs monitoring current provider SLAs
- Product managers diagnosing performance issues
- DevOps teams planning infrastructure migrations

---

## ✨ Key Features

### 🔬 **Multi-Dimensional Testing**

| Test Type | What It Measures | Providers Tested |
|-----------|------------------|------------------|
| **Token Price** | USDT & ETH price fetching accuracy | Alchemy, Mobula, Codex, CoinGecko |
| **Wallet Balance** | Token holdings retrieval speed | Alchemy, Mobula, Codex |

### 📈 **Advanced Metrics**

- **Latency Distribution**: Average, P50 (median), P95 (tail latency)
- **Accuracy Validation**: ±5% tolerance against CoinGecko ground truth
- **Error Classification**: Rate limits, auth errors, network issues, server errors
- **Deviation Tracking**: Percentage drift from reference prices
- **Variance Analysis**: Maximum disagreement between providers


### 🔄 **Continuous Monitoring**

- Historical trend analysis
- Automated benchmark execution
- RESTful API for external integrations

---

## 🤔 Why This Exists

### The Problem

Most API provider comparisons rely on:
- ❌ Marketing claims ("99.9% uptime!")
- ❌ Synthetic benchmarks (not real-world conditions)
- ❌ Speed-only metrics (ignoring data quality)

### Our Solution

A **scientific approach** to API evaluation:

1. **Ground Truth Validation**: Use CoinGecko as reference for accuracy
2. **Real-World Testing**: Actual API calls with production-like conditions
3. **Holistic Metrics**: Speed + accuracy + reliability combined
4. **Transparent Data**: All raw results stored for analysis

### Real-World Impact

**Example Use Case:**
```
A DeFi protocol processes $10M daily volume.
Provider A: 80ms latency, 5% price deviation
Provider B: 200ms latency, 0.2% deviation

Choice: Provider B
Reason: 1% price error = $100K loss > latency cost

Our tool prevents this $100K mistake.
```

---

## 🏗️ Architecture

```
┌─────────────────┐
│   React UI      │  ← User triggers tests
│  (Dashboard)    │
└────────┬────────┘
         │
┌────────▼────────┐
│  Express API    │  ← Orchestrates benchmarks
│   (Node.js)     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼────┐
│ APIs │  │ Supa- │  ← Stores results
│      │  │ base  │
└──────┘  └───────┘
  ↑
  │ Validates against
  │
┌──▼──────────┐
│  CoinGecko  │  ← Ground truth
│  Reference  │
└─────────────┘
```

### Tech Stack

- **Frontend**: React 18, Chart.js, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **APIs Tested**: Alchemy, Mobula, Codex
- **Reference**: CoinGecko

---

## 🛠️ Installation

### Prerequisites

- Node.js 18+
- Supabase account
- API keys for providers you want to test

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/api-benchmark-dashboard.git
cd api-benchmark-dashboard
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create `.env` file:

```env
# Server
PORT=3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# API Keys (at least one required)
ALCHEMY_API_KEY=your-alchemy-key
MOBULA_API_KEY=your-mobula-key
CODEX_API_KEY=your-codex-key
COINGECKO_API_KEY=your-coingecko-key  # Optional (free tier works)
```


### 4. Start Server

```bash
npm start
```

Dashboard available at: `http://localhost:3000`

---

## 📊 Usage

### Running Benchmarks

#### 1. **Price Test** (Recommended First)

- Click **"Run Price Test"** button
- Tests USDT & ETH prices (10 requests each)
- Fetches CoinGecko reference for validation
- Duration: ~1-2 minutes

**Output:**
- Latency metrics per provider
- Accuracy rates against reference
- Deviation percentages
- Error counts

#### 2. **Wallet Balance Test**

- Enter Ethereum wallet address
- Click **"Run Wallet Test"**
- Tests token holdings retrieval (5 requests per provider)
- Duration: ~30-45 seconds

### Viewing Results

#### Summary Table

Shows aggregated metrics:
- **Avg Latency**: Mean response time
- **P50/P95**: Percentile latencies
- **Success %**: Reliability score
- **Accuracy %**: Percentage within ±5% of reference
- **Avg Deviation**: Typical price drift

#### Performance Graphs

- **Average Latency**: Trend over time
- **P95 Latency**: Tail latency (worst 5% of requests)
- **Throughput**: Requests processed per 5-min bucket
- **Failed Requests**: Error count timeline

#### Accuracy Graph

- Shows all provider prices overlaid
- CoinGecko reference (dashed line)
- Max deviation from reference (red dotted)
- Token selector (USDT/ETH)


## 📐 Metrics Explained

### Performance Metrics

#### **Average Latency**
```
Formula: Σ(latencies) / n
Unit: milliseconds (ms)
```
Mean response time across all requests.

**Interpretation:**
- < 150ms: Excellent
- 150-300ms: Good
- \> 300ms: Needs attention

#### **P50 Latency (Median)**
```
Formula: latency at position floor(n × 0.5)
Unit: milliseconds (ms)
```
Middle value when latencies are sorted. 50% of requests complete faster.

**Why P50?** Less affected by outliers than average.

#### **P95 Latency (95th Percentile)**
```
Formula: latency at position floor(n × 0.95)
Unit: milliseconds (ms)
```
95% of requests complete within this time.

**Why P95?** Represents "worst-case" user experience while ignoring extreme outliers. Industry standard for SLAs.

---

### Reliability Metrics

#### **Success Rate**
```
Formula: (Successful Requests / Total Requests) × 100
Unit: percentage (%)
```
Reliability indicator.

**Interpretation:**
- \> 99%: Production-ready
- 95-99%: Acceptable with monitoring
- < 95%: Investigate issues

---

### Accuracy Metrics

#### **Accuracy Rate**
```
Formula: (Accurate Prices / Total Comparable Prices) × 100
Threshold: ±5% from CoinGecko reference
Unit: percentage (%)
```
Percentage of prices within acceptable deviation.

**Why 5%?** Industry standard for financial APIs, balances strictness with timing variance.

#### **Price Deviation**
```
Formula: ((Observed - Reference) / Reference) × 100
Unit: percentage (%)
```
How far provider's price differs from CoinGecko.

**Example:**
- CoinGecko: $1.00
- Alchemy: $1.05
- Deviation: +5%

**Interpretation:**
- < 1%: Excellent accuracy
- 1-3%: Acceptable
- \> 5%: Failed accuracy check

#### **Average Absolute Deviation**
```
Formula: Σ|deviations| / n
Unit: percentage (%)
```
Typical magnitude of price error (direction ignored).

---

### Variance Metrics

#### **Cross-Provider Variance**
```
Formula: max(|deviation₁|, |deviation₂|, ..., |deviationₙ|)
Unit: percentage (%)
```
Maximum disagreement between providers.

**Example:**
```
CoinGecko: $1.00
Alchemy:   $1.00 → 0% deviation
Mobula:    $1.03 → 3% deviation
Codex:     $0.98 → 2% deviation

Variance = max(0%, 3%, 2%) = 3%
```

**Interpretation:**
- < 1%: High data confidence
- 1-3%: Normal variance
- \> 3%: Data quality concern

---

### Time Aggregation

#### **5-Minute Buckets**
```
Formula: floor(minutes / 5) × 5
Example: 14:23:47 → 14:20:00
```
Groups data into 5-minute windows for visualization.

**Trade-off:** Reduces noise but loses granularity.

---

## 🔌 API Endpoints

### POST `/api/run-price-benchmark`

Executes token price test.

**Response:**
```json
{
  "success": true,
  "message": "Price benchmark complete",
  "totalRequests": 80,
  "duration": 45.2,
  "throughput": 1.77
}
```

---

### POST `/api/run-wallet-benchmark`

Executes wallet balance test.

**Request:**
```json
{
  "walletAddress": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet balance benchmark complete",
  "totalRequests": 15,
  "duration": 30.5,
  "throughput": 0.49
}
```

---

### GET `/api/summary?range={timeRange}`

Returns aggregated metrics.

**Parameters:**
- `range`: `1h`, `6h`, `24h`, or `7d`

**Response:**
```json
[
  {
    "provider": "alchemy",
    "requests": 100,
    "failed": 2,
    "success_rate": 98.0,
    "avg_latency": 145.23,
    "p50_latency": 132.0,
    "p95_latency": 287.5,
    "accuracy_rate": 99.2,
    "avg_response_size": 2048,
    "avg_deviation": 0.42
  }
]
```

---

### GET `/api/accuracy-comparison?range={timeRange}`

Returns price comparison data.

**Response:**
```json
[
  {
    "time": "2025-02-03T14:20:00Z",
    "token": "price_USDT",
    "alchemy": 1.0002,
    "mobula": 1.0005,
    "codex": 0.9998,
    "coingecko": 1.0000,
    "reference": 1.0000,
    "variance": 0.05
  }
]
```

---

### GET `/api/error-breakdown?range={timeRange}`

Returns error counts by type.

**Response:**
```json
{
  "alchemy": {
    "success": 98,
    "rate_limit": 2
  },
  "mobula": {
    "success": 85,
    "rate_limit": 10,
    "server_error": 5
  }
}
```

---

### GET `/api/graph/{metric}?range={timeRange}`

Returns time-series data for visualization.

**Metrics:**
- `avg-latency`
- `p95-latency`
- `success-rate`
- `accuracy-rate`
- `failed-requests`
- `throughput`

**Response:**
```json
[
  {
    "time": "2025-02-03T14:20:00Z",
    "alchemy": 145.2,
    "mobula": 89.5,
    "codex": 201.3,
    "coingecko": 312.1
  }
]
```


**Built with ❤️ for the Web3 community**

*Making API provider selection transparent and data-driven*