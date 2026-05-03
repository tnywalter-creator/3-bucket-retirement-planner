import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Market data proxy endpoint
  // Uses Yahoo Finance API (free, no key required)
  app.get("/api/quote/:ticker", async (req, res) => {
    const { ticker } = req.params;
    
    try {
      // Using Yahoo Finance v8 API (public, no auth required)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (!response.ok) {
        return res.status(404).json({ 
          error: 'Ticker not found',
          ticker 
        });
      }

      const data = await response.json();
      const result = data?.chart?.result?.[0];
      
      if (!result) {
        return res.status(404).json({ 
          error: 'No data available',
          ticker 
        });
      }

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];
      
      // Get current price (last close or current market price)
      const currentPrice = meta.regularMarketPrice || quote?.close?.[quote.close.length - 1];
      const previousClose = meta.previousClose;
      
      // Calculate change percentage
      const changePercent = previousClose && currentPrice 
        ? ((currentPrice - previousClose) / previousClose) * 100 
        : 0;

      res.json({
        ticker: ticker.toUpperCase(),
        price: Number(currentPrice?.toFixed(2)) || 0,
        name: meta.longName || meta.shortName || ticker.toUpperCase(),
        changePercent: Number(changePercent.toFixed(2))
      });

    } catch (error) {
      console.error(`Error fetching quote for ${ticker}:`, error);
      res.status(500).json({ 
        error: 'Failed to fetch market data',
        ticker,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // PDF parsing endpoint
  app.post("/api/parse-pdf", async (req, res) => {
    try {
      const { pdfBase64 } = req.body;
      
      if (!pdfBase64) {
        return res.status(400).json({ error: 'No PDF data provided' });
      }

      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const pdfData = new Uint8Array(pdfBuffer);
      
      // Use pdfjs-dist for PDF parsing
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdfDoc = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }

      const holdings = parsePDFText(fullText);
      
      res.json({ holdings, rawText: fullText, textLength: fullText.length });
    } catch (error) {
      console.error('Error parsing PDF:', error);
      res.status(500).json({ 
        error: 'Failed to parse PDF',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}

function parsePDFText(text: string): Array<{ticker: string, name: string, shares: number, price: number, value: number, bucket: string}> {
  const holdings: Array<{ticker: string, name: string, shares: number, price: number, value: number, bucket: string}> = [];
  const seen = new Set<string>();
  
  let cleanText = text.replace(/\d+\/\d+\/\d+,\s+\d+:\d+\s+(AM|PM)\s+Empower\s+-\s+Portfolio\s+https?:\/\/[^\s]+\s+\d+\/\d+/gi, ' ');
  cleanText = cleanText.replace(/Privacy\s+Terms of Service.*?All Rights Reserved\./gi, ' ');
  
  // Detect format by checking for header. New format has "1 day $", old has "1 Day %"
  const newFormatHeader = cleanText.match(/Holding\s+Shares\s+Price\s+Change\s+1\s*day\s+\$/i);
  const oldFormatHeader = cleanText.match(/Holding\s+Shares\s+Price\s+Change\s+1\s*Day\s*%/i);
  
  const headerMatch = newFormatHeader || oldFormatHeader;
  if (headerMatch && headerMatch.index !== undefined) {
    cleanText = cleanText.substring(headerMatch.index + headerMatch[0].length);
  }
  
  // Trim at Grand Total
  const grandTotalIdx = cleanText.search(/Grand\s+Total/i);
  if (grandTotalIdx !== -1) {
    cleanText = cleanText.substring(0, grandTotalIdx);
  }

  const isNewFormat = !!newFormatHeader;
  
  const skipTickers = ['NONE', 'FROM', 'ETF', 'SHARES', 'FUND', 'INDEX', 'TRUST', 'DAY', 'HOLDINGS', 'AM', 'HTTPS', 'HTTP', 'TERMS', 'HELP', 'FAQ', 'VI', 'VIT', 'PIMCO', 'BNY', 'MELLON', 'NET', 'WORTH', 'GRAND', 'TOTAL', 'SEARCH'];

  function addHolding(ticker: string, name: string, shares: number, price: number, value: number, bucket: string) {
    const key = `${ticker}-${shares.toFixed(2)}`;
    if (!seen.has(key) && shares > 0 && price > 0) {
      seen.add(key);
      holdings.push({ ticker, name: name || ticker, shares, price, value: value || shares * price, bucket });
    }
  }

  let match;

  if (isNewFormat) {
    // =========================================================
    // NEW FORMAT: Holding | Shares | Price | Change | 1 day $ | Value
    // Row format in extracted text (name is inline after ticker):
    //   "TICKER  Name of Holding  shares  $price  $change  +$1dayDollar  $value"
    // =========================================================

    // Fix stray split numbers like "3  ,315" that appear from chart overlays
    cleanText = cleanText.replace(/(\d)\s+,(\d{3})\b/g, '$1,$2');

    // Pattern N1: PIMCO VIT multi-word ticker (no inline name, just numbers follow)
    const pimcoNew = /PIMCO\s+VIT\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
    while ((match = pimcoNew.exec(cleanText)) !== null) {
      const shares = parseFloat(match[1].replace(/,/g, ''));
      const price = parseFloat(match[2].replace(/,/g, ''));
      const value = parseFloat(match[3].replace(/,/g, ''));
      addHolding('PIMCOVIT', 'PIMCO VIT', shares, price, value, 'bridge');
    }

    // Pattern N2: Cash row (no inline name)
    const cashNew = /\bCash\s+([\d,]+\.?\d*)\s+\$1\.00\s+[+-]?\$[\d,\.]+\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
    while ((match = cashNew.exec(cleanText)) !== null) {
      const shares = parseFloat(match[1].replace(/,/g, ''));
      const value = parseFloat(match[2].replace(/,/g, ''));
      addHolding('CASH', 'Cash', shares, 1.00, value, 'cash');
    }

    // Pattern N3: Insured Bank Deposit row (no inline name)
    const depositNew = /Insured Bank Deposit\s+([\d,]+\.?\d*)\s+\$1\.00\s+[+-]?\$[\d,\.]+\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
    while ((match = depositNew.exec(cleanText)) !== null) {
      const shares = parseFloat(match[1].replace(/,/g, ''));
      const value = parseFloat(match[2].replace(/,/g, ''));
      addHolding('DEPOSIT', 'Insured Bank Deposit', shares, 1.00, value, 'cash');
    }

    // Pattern N4: Standard ticker WITH inline name between ticker and numbers
    // e.g. "VOO  Vanguard S&P 500 ETF  1085  $652.78  $7.92  +$8,593.22  $708,267.67"
    // e.g. "IBIT  INTERBIT LTD ISIN CA45845F1009...  318  $43.93  $0.00  $0.00  $13,969.74"
    // The name is any non-newline, non-$ text between ticker and shares.
    const stdNew = /\b([A-Z]{2,6})\s+(?:[^\n$]*?\s+)?([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/g;
    while ((match = stdNew.exec(cleanText)) !== null) {
      const ticker = match[1];
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      const value = parseFloat(match[4].replace(/,/g, ''));
      if (skipTickers.includes(ticker) || shares === 0) continue;
      addHolding(ticker, ticker, shares, price, value, inferBucketFromTicker(ticker));
    }

  } else {
    // =========================================================
    // OLD FORMAT: Holding | Shares | Price | Change | 1 Day % | 1 Day $ | Value
    // =========================================================

    // Pattern 1a: Standard format WITH total value column
    // Example: "GCO  Genesco Inc  2431   $27.22   $0.63   +2.37%   +$1,531.53   $66,171.82"
    const standardWithValue = /\b([A-Z]{2,6}(?:\.[A-Z]{1,2})?)\s+[^$]+?\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/g;
    while ((match = standardWithValue.exec(cleanText)) !== null) {
      const ticker = match[1];
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      const value = parseFloat(match[4].replace(/,/g, ''));
      if (skipTickers.includes(ticker) || shares === 0) continue;
      addHolding(ticker, ticker, shares, price, value, inferBucketFromTicker(ticker));
    }

    // Pattern 1b: Standard format WITHOUT total value column
    const standardNoValue = /\b([A-Z]{2,6}(?:\.[A-Z]{1,3})?)\b\s+[^$]+?\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,.]+\s+[+-]?[\d,.]+%\s+[+-]?\$[\d,]+/g;
    while ((match = standardNoValue.exec(cleanText)) !== null) {
      const ticker = match[1];
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      if (skipTickers.includes(ticker) || shares === 0) continue;
      addHolding(ticker, ticker, shares, price, shares * price, inferBucketFromTicker(ticker));
    }

    // Pattern 2a: Zero change WITH total value
    const zeroWithValue = /\b([A-Z]{2,6}(?:\.[A-Z]{1,3})?)\s+[^$]+?\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+\$0\.00\s+0\.00%\s+\$0(?:\.00)?\s+\$([\d,]+\.?\d*)/g;
    while ((match = zeroWithValue.exec(cleanText)) !== null) {
      const ticker = match[1];
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      const value = parseFloat(match[4].replace(/,/g, ''));
      if (skipTickers.includes(ticker) || shares === 0) continue;
      addHolding(ticker, ticker, shares, price, value, inferBucketFromTicker(ticker));
    }

    // Pattern 2b: Zero change WITHOUT total value
    const zeroNoValue = /\b([A-Z]{2,6}(?:\.[A-Z]{1,3})?)\b\s+[^$]+?\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+\$0\.00\s+0\.00%\s+\$0\b/g;
    while ((match = zeroNoValue.exec(cleanText)) !== null) {
      const ticker = match[1];
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      if (skipTickers.includes(ticker) || shares === 0) continue;
      addHolding(ticker, ticker, shares, price, shares * price, inferBucketFromTicker(ticker));
    }

    // Pattern 3a: Multi-word proprietary funds WITH total value
    const proprietaryWithValue = /(INVESCO VI|PIMCO VIT|BNY MELLON)\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
    while ((match = proprietaryWithValue.exec(cleanText)) !== null) {
      const name = match[1].toUpperCase();
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      const value = parseFloat(match[4].replace(/,/g, ''));
      const ticker = name.replace(/\s+/g, '').substring(0, 6);
      addHolding(ticker, name, shares, price, value, name.includes('PIMCO') ? 'bridge' : 'growth');
    }

    // Pattern 3b: Multi-word proprietary funds WITHOUT total value
    const proprietaryNoValue = /(INVESCO VI|PIMCO VIT|BNY MELLON)\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,]+/gi;
    while ((match = proprietaryNoValue.exec(cleanText)) !== null) {
      const name = match[1].toUpperCase();
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      const ticker = name.replace(/\s+/g, '').substring(0, 6);
      addHolding(ticker, name, shares, price, shares * price, name.includes('PIMCO') ? 'bridge' : 'growth');
    }

    // Pattern 4a: Cash WITH total value
    const cashWithValue = /\bCash\s+([\d,]+\.?\d*)\s+\$1\.00\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
    while ((match = cashWithValue.exec(cleanText)) !== null) {
      const shares = parseFloat(match[1].replace(/,/g, ''));
      const value = parseFloat(match[2].replace(/,/g, ''));
      addHolding('CASH', 'Cash', shares, 1.00, value, 'cash');
    }

    // Pattern 4b: Cash WITHOUT total value
    const cashNoValue = /\bCash\s+([\d,]+\.?\d*)\s+\$1\.00\s+\$0\.00\s+0\.00%\s+\$0\b/gi;
    while ((match = cashNoValue.exec(cleanText)) !== null) {
      const shares = parseFloat(match[1].replace(/,/g, ''));
      addHolding('CASH', 'Cash', shares, 1.00, shares, 'cash');
    }

    // Pattern 5: Insured Bank Deposit
    const depositPattern = /Insured Bank Deposit\s+([\d,]+\.?\d*)\s+\$1\.00\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+(?:\s+\$([\d,]+\.?\d*))?/gi;
    while ((match = depositPattern.exec(cleanText)) !== null) {
      const shares = parseFloat(match[1].replace(/,/g, ''));
      const value = match[2] ? parseFloat(match[2].replace(/,/g, '')) : shares;
      if (shares > 0) addHolding('DEPOSIT', 'Insured Bank Deposit', shares, 1.00, value, 'cash');
    }

    // Pattern 6: Bond tickers with dot (e.g. ORCL.GP)
    const bondPattern = /\b([A-Z]{2,6}\.[A-Z]{1,3})\s+(?:[^$\d]*?\s+)?([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%/g;
    while ((match = bondPattern.exec(cleanText)) !== null) {
      const ticker = match[1];
      const shares = parseFloat(match[2].replace(/,/g, ''));
      const price = parseFloat(match[3].replace(/,/g, ''));
      if (shares === 0) continue;
      addHolding(ticker, ticker, shares, price, shares * price, 'bridge');
    }
  }
  
  return holdings;
}

function inferBucketFromTicker(ticker: string): string {
  const t = ticker.toUpperCase();
  
  const cashFunds = ['SPAXX', 'FDRXX', 'VMFXX', 'SWVXX', 'SPRXX', 'FDLXX', 'FZFXX', 'FGTXX', 'MFIS', 'MFRS', 'CASH'];
  if (cashFunds.some(c => t.includes(c)) || t === 'CASH' || t.includes('MONEY') || t.includes('DEPOSIT')) return 'cash';
  
  const bondFunds = ['BND', 'AGG', 'TIP', 'TIPS', 'VTIP', 'SCHZ', 'IUSB', 'VBTLX', 'BOND', 'GOVT', 'LQD', 'HYG', 'JNK', 'MUB', 'TLT', 'IEF', 'SHY', 'VCIT', 'VCSH', 'BSV', 'BIV', 'BLV', 'VAIPX', 'VBMFX', 'FBNDX', 'VGIT', 'IGIB', 'USHY', 'LBNOX', 'JCBUX', 'VWOB', 'PIMCO'];
  if (bondFunds.some(b => t.includes(b))) return 'bridge';
  
  const bridgeFunds = ['SCHD', 'VIG', 'VYM', 'DVY', 'SDY', 'HDV', 'DGRO', 'NOBL', 'SPYD', 'SPHD', 'VDIGX', 'VHDYX'];
  if (bridgeFunds.some(i => t.includes(i))) return 'bridge';
  
  return 'growth';
}
