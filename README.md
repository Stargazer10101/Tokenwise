# TokenWise - Real-Time Solana Token Intelligence Tool

**TokenWise** is a real-time intelligence tool designed to monitor and analyze the on-chain behavior of the top holders for a specific token on the Solana blockchain. This system tracks wallet activity, identifies trading protocols, and provides a foundation for market trend analysis.

This project was built to fulfill the requirements of the NPC assignment, demonstrating a robust backend architecture for data indexing and processing.

## 🚀 Live Demo

The project is live at:  
👉 [http://13.61.196.0/]()

---

## 🎯 Project Objectives

-   **Discover Top Wallets**: Identify and store the top 60 holders of a specific Solana token.
-   **Real-time Monitoring**: Continuously track token-related transactions (buys/sells) for these top wallets.
-   **Protocol Identification**: Automatically detect which protocol (e.g., Jupiter, Raydium, Orca) was used for each trade.
-   **Data Persistence**: Store clean, processed transaction data in a PostgreSQL database for historical analysis.
-   **Foundation for Insights**: Provide the backend data necessary to power a market analysis dashboard.

---

## 🛠️ Technical Architecture

The backend is built as a set of decoupled services, ensuring stability, scalability, and adherence to API rate limits.

### 1. The Discoverer (`discoverHolders.js`)

-   A standalone script that runs once to initialize the system.
-   Connects to the Solana RPC via Helius.
-   Fetches the top 60 largest token accounts for the target mint address.
-   Resolves the wallet owners for these token accounts.
-   Populates the `top_holders` table in the PostgreSQL database with this list.

### 2. The Monitor (`monitorTransactions.js`)

Smart Wallet Polling & Transaction Processor
This is the core service, built using a robust **Polling Architecture** to ensure stability and control over API usage.

- Dynamically classifies wallets as active, moderate, or inactive based on recent transaction history.
- Polls wallets at different intervals depending on their activity level.
- Fetches new transaction signatures and pushes them into a priority queue.
- Processes transactions using a rate-limited pipeline, detecting buy/sell activity of the target token.
- Identifies the DeFi protocol involved (e.g., Jupiter, Orca, Raydium) using heuristics.
- Efficiently stores structured transaction data in a PostgreSQL database.

This approach ensures scalable, rate-limit-respecting, and high-signal transaction monitoring across the Solana network.

---

## 🧱 Tech Stack

| Component            | Technology                                |
| -------------------- | ----------------------------------------- |
| **Backend**          | Node.js with Express.js (for future API)  |
| **Blockchain Library** | `@solana/web3.js`                           |
| **RPC Provider**     | Helius                                    |
| **Database**         | PostgreSQL                                |
| **Dependencies**     | `pg`, `dotenv`, `axios` (for API mgmt)    |
| **Frontend**         | (To be implemented - e.g., React, Svelte) |

---

## 🚀 Getting Started

Follow these instructions to get the backend service up and running on your local machine.

### Prerequisites

-   [Node.js](https://nodejs.org/en/) (v18 or higher)
-   [npm](https://www.npmjs.com/)
-   [PostgreSQL](https://www.postgresql.org/download/) installed and running locally
-   A Helius API Key ([get one here](https://helius.dev/))

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/tokenwise-project.git
cd tokenwise-project
```

### 2. Backend Setup
Navigate to the backend directory and install the necessary dependencies.

```
cd backend
npm install
```
### 3. Database Setup
Make sure your local PostgreSQL server is running. Then, connect to it and create the database for this project.

```
# Connect to the default postgres client
psql postgres

# In the psql shell, run the following command
CREATE DATABASE tokenwise;

# Exit the shell
\q
```

### 4. Environment Configuration
Create a .env file in the backend directory. This file will store all your secret keys and configuration variables.
Generated bash

```
# backend/.env
# Helius API Key
HELIUS_API_KEY="YOUR_HELIUS_API_KEY"

# Target Token Mint Address
TOKEN_MINT_ADDRESS="9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump"

# PostgreSQL Connection Details
# Replace 'your_username' with your actual PostgreSQL user
DB_USER="your_username"
DB_HOST="localhost"
DB_DATABASE="tokenwise"
DB_PASSWORD="your_postgres_password" # Or leave blank if none
DB_PORT=5432
```

### 5. Running the Backend Services
The backend consists of two main scripts that need to be run in order.
Step 1: Populate the Top Holders
Run the discoverHolders.js script once to populate your database with the top 60 wallets.
Generated bash
node discoverHolders.js```
*You can verify the data was added by checking the `top_holders` table in your `tokenwise` database.*

**Step 2: Start the Monitoring Service**


```
npm run dev
```
This will get the API server running on `http://localhost:3001`

```
# In a separate terminal
node monitorTransactions.js
```

The service is now live. It will periodically fetch and process new transactions, storing them in the transactions table.
### 6. Frontend Setup
(Instructions for the frontend application)

```
cd frontend
npm install
npm run dev
```

The frontend application will now be running on `http://localhost:3000` (or another specified port).

---

## 📈 Future Improvements

-   **API Layer**: Build a REST or GraphQL API (e.g., with Express.js) on top of the PostgreSQL database to serve data to the frontend dashboard.
-   **Dashboard Visualization**: Create a frontend dashboard using a framework like React or Svelte to visualize the collected data (e.g., buy/sell ratio, protocol usage pie chart).
-   **Historical Analysis**: Implement API endpoints that allow for querying transactions within a specific date range.
-   **Real-time Alerts**: Use a service like Pusher or a self-hosted WebSocket server to push real-time trade alerts to the frontend.
-   **Dockerize Application**: Containerize the backend services and database for easier deployment and environment consistency.
Use code with caution.
