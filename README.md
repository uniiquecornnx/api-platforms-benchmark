# api-platforms-benchmark

A real-time performance benchmarking tool for comparing blockchain data API providers. Track latency, success rates, and reliability metrics across multiple API platforms.

Overview
This project benchmarks three major blockchain data API providers:

Alchemy - Blockchain development platform
Mobula - Multi-chain crypto data aggregator
Codex - DeFi data and analytics platform

What It Tests

Token Price Fetching - Retrieves real-time prices for USDT and ETH
Wallet Balance Queries - Fetches token holdings for Ethereum wallets

Metrics Tracked

⏱️ Average Latency - Mean response time
📈 P50 Latency - Median response time
📊 P95 Latency - 95th percentile response time
✅ Success Rate - Percentage of successful requests
❌ Failed Requests - Count of failed API calls

🛠️ Tech Stack

Backend: Node.js + Express.js
Database: Supabase (PostgreSQL)
Frontend: Vanilla JavaScript + HTML/CSS
Deployment: Render
APIs Tested: Alchemy, Mobula, Codex