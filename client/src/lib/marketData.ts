import { MarketData } from './types';

// Simulated market data to avoid API keys and rate limits for the prototype
const MOCK_DB: Record<string, { price: number; name: string; change: number }> = {
  'VTI': { price: 242.50, name: 'Vanguard Total Stock Market ETF', change: 0.45 },
  'VOO': { price: 475.20, name: 'Vanguard S&P 500 ETF', change: 0.55 },
  'BND': { price: 72.40, name: 'Vanguard Total Bond Market ETF', change: -0.12 },
  'BSV': { price: 75.80, name: 'Vanguard Short-Term Bond ETF', change: 0.05 },
  'QQQ': { price: 425.60, name: 'Invesco QQQ Trust', change: 1.20 },
  'SPY': { price: 510.30, name: 'SPDR S&P 500 ETF Trust', change: 0.60 },
  'AAPL': { price: 175.50, name: 'Apple Inc.', change: -0.50 },
  'MSFT': { price: 420.10, name: 'Microsoft Corporation', change: 1.10 },
  'GOOGL': { price: 150.25, name: 'Alphabet Inc.', change: 0.80 },
  'AMZN': { price: 178.90, name: 'Amazon.com Inc.', change: 0.95 },
  'TSLA': { price: 175.40, name: 'Tesla Inc.', change: -2.30 },
  'TLT': { price: 92.50, name: 'iShares 20+ Year Treasury Bond ETF', change: -0.40 },
  'GLD': { price: 205.60, name: 'SPDR Gold Shares', change: 0.30 },
  'VXUS': { price: 58.20, name: 'Vanguard Total International Stock ETF', change: 0.15 },
  'SCHD': { price: 78.40, name: 'Schwab US Dividend Equity ETF', change: 0.20 },
  'JNJ': { price: 155.30, name: 'Johnson & Johnson', change: 0.10 },
  'KO': { price: 60.10, name: 'Coca-Cola Company', change: 0.05 },
  'O': { price: 54.20, name: 'Realty Income Corporation', change: 0.15 },
  'VIG': { price: 175.80, name: 'Vanguard Dividend Appreciation ETF', change: 0.40 },
  'USD': { price: 1.00, name: 'Cash / Money Market', change: 0.00 },
};

// Cache to avoid hammering the API
const priceCache = new Map<string, { data: MarketData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getMarketPrice(ticker: string): Promise<MarketData> {
  const cleanTicker = ticker.toUpperCase().trim();

  // Check cache first
  const cached = priceCache.get(cleanTicker);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }

  // Special case for cash
  if (cleanTicker === 'USD' || cleanTicker === 'CASH') {
    const data: MarketData = {
      ticker: 'USD',
      price: 1.00,
      name: 'Cash / Money Market',
      changePercent: 0.00
    };
    priceCache.set(cleanTicker, { data, timestamp: Date.now() });
    return data;
  }

  try {
    // Try to fetch from backend API
    const response = await fetch(`/api/quote/${cleanTicker}`);
    
    if (response.ok) {
      const data: MarketData = await response.json();
      priceCache.set(cleanTicker, { data, timestamp: Date.now() });
      return data;
    }

    // If API fails, fall back to mock data
    console.warn(`API failed for ${cleanTicker}, using fallback data`);
    return getFallbackData(cleanTicker);

  } catch (error) {
    console.error(`Error fetching ${cleanTicker}:`, error);
    return getFallbackData(cleanTicker);
  }
}

function getFallbackData(ticker: string): MarketData {
  // Return mock data if available
  if (MOCK_DB[ticker]) {
    const base = MOCK_DB[ticker];
    const variation = (Math.random() - 0.5) * 0.1;
    return {
      ticker,
      price: Number((base.price + variation).toFixed(2)),
      name: base.name,
      changePercent: base.change
    };
  }

  // Generic fallback for unknown tickers
  return {
    ticker,
    price: 100.00,
    name: `${ticker} (Simulated)`,
    changePercent: 0.00
  };
}
