const TOKENS = {
  ALLO: {
    symbol: "ALLO",
    name: "Allora",
    binancePair: "ALLOUSDT",
    contractAddress: "0x8408D45b61f5823298F19a09F3b7339c0280489",
    decimals: 18,
    unlockSchedule: [
      {
        date: "2026-06-11",
        amount: 17250000,
        description: "Manual verified unlock: about 17.25M ALLO"
      }
    ]
  }
};

const WALLETS = [
  {
    label: "OKX_ALLO_wallet",
    address: "0x91D40E4818F4D4C57b4578d9ECa6AFc92aC8DEbE"
  },
  {
    label: "Gate_ALLO_wallet",
    address: "0x0d0707963952f2fba59dd06f2b425ace40b492fe"
  }
];

const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";

function send(res, status, data) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  return res.status(status).json(data);
}

function toTokenAmount(raw, decimals = 18) {
  const s = String(raw || "0");
  const d = Number(decimals);
  if (!s || s === "0") return 0;
  const padded = s.padStart(d + 1, "0");
  const whole = padded.slice(0, -d);
  const frac = padded.slice(-d).replace(/0+$/, "");
  return Number(`${whole}.${frac || "0"}`);
}

async function getBinanceTicker(pair) {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Binance error ${r.status}`);
  return await r.json();
}

async function getBinancePrice(pair) {
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  return Number(data.price);
}

async function etherscanGet(params) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ETHERSCAN_API_KEY in Vercel Environment Variables");
  }

  const url = new URL(ETHERSCAN_BASE);
  url.searchParams.set("chainid", "1");

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  url.searchParams.set("apikey", apiKey);

  const r = await fetch(url.toString());
  const data = await r.json();

  if (data.status === "0" && data.message !== "No transactions found") {
    throw new Error(`Etherscan error: ${data.message || data.result}`);
  }

  return data.result;
}

async function health() {
  return {
    ok: true,
    service: "Token Insight Tool"
  };
}

async function summary(symbol = "ALLO") {
  symbol = String(symbol).toUpperCase();
  const token = TOKENS[symbol];

  if (!token) {
    return {
      ok: false,
      error: `Unknown token: ${symbol}`
    };
  }

  let market = null;
  let marketError = null;

  try {
    const ticker = await getBinanceTicker(token.binancePair);
    market = {
      pair: token.binancePair,
      price: Number(ticker.lastPrice),
      change24hPercent: Number(ticker.priceChangePercent),
      volume24hUsdt: Number(ticker.quoteVolume)
    };
  } catch (e) {
    marketError = e.message;
  }

  const now = new Date();
  const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const upcomingUnlocks = token.unlockSchedule.filter((u) => {
    const d = new Date(`${u.date}T00:00:00Z`);
    return d >= now && d <= next30;
  });

  let pressure = "LOW";

  if (market && upcomingUnlocks.length > 0) {
    const totalUnlockValue = upcomingUnlocks.reduce(
      (sum, u) => sum + Number(u.amount || 0) * Number(market.price || 0),
      0
    );

    const ratio =
      market.volume24hUsdt > 0 ? totalUnlockValue / market.volume24hUsdt : 0;

    if (ratio > 1) pressure = "EXTREME";
    else if (ratio > 0.3) pressure = "HIGH";
    else if (ratio > 0.1) pressure = "MEDIUM";
  }

  return {
    ok: true,
    symbol: token.symbol,
    name: token.name,
    market,
    marketError,
    upcomingUnlocks,
    pressure
  };
}

async function balances(symbol = "ALLO") {
  symbol = String(symbol).toUpperCase();
  const token = TOKENS[symbol];

  if (!token) {
    return {
      ok: false,
      error: `Unknown token: ${symbol}`
    };
  }

  const price = await getBinancePrice(token.binancePair);
  const wallets = [];

  for (const wallet of WALLETS) {
    const ethRaw = await etherscanGet({
      module: "account",
      action: "balance",
      address: wallet.address,
      tag: "latest"
    });

    const tokenRaw = await etherscanGet({
      module: "account",
      action: "tokenbalance",
      contractaddress: token.contractAddress,
      address: wallet.address,
      tag: "latest"
    });

    const ethBalance = toTokenAmount(ethRaw, 18);
    const tokenBalance = toTokenAmount(tokenRaw, token.decimals);

    wallets.push({
      label: wallet.label,
      address: wallet.address,
      ethBalance,
      token: {
        symbol: token.symbol,
        balance: tokenBalance,
        valueUsd: price ? tokenBalance * price : null
      }
    });
  }

  return {
    ok: true,
    symbol: token.symbol,
    priceUsd: price,
    wallets
  };
}

export default async function handler(req, res) {
  try {
    const action = String(req.query.action || "health").toLowerCase();
    const symbol = req.query.symbol || "ALLO";

    if (action === "health") {
      return send(res, 200, await health());
    }

    if (action === "summary") {
      return send(res, 200, await summary(symbol));
    }

    if (action === "balances") {
      return send(res, 200, await balances(symbol));
    }

    return send(res, 404, {
      ok: false,
      error: "Unknown action. Use action=health, action=summary, or action=balances."
    });
  } catch (e) {
    return send(res, 500, {
      ok: false,
      error: e.message
    });
  }
}
