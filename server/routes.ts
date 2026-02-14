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
  
  // Clean up timestamp/page break noise from the text
  let cleanText = text.replace(/\d+\/\d+\/\d+,\s+\d+:\d+\s+(AM|PM)\s+Empower\s+-\s+Portfolio\s+https?:\/\/[^\s]+\s+\d+\/\d+/gi, ' ');
  cleanText = cleanText.replace(/Privacy\s+Terms of Service.*?All Rights Reserved\./gi, ' ');
  
  const skipTickers = ['NONE', 'FROM', 'ETF', 'SHARES', 'FUND', 'INDEX', 'TRUST', 'DAY', 'HOLDINGS', 'AM', 'HTTPS', 'HTTP', 'TERMS', 'HELP', 'FAQ', 'VI', 'VIT', 'PIMCO', 'BNY', 'MELLON'];
  
  // Pattern 1: Standard format with +/- percentage
  // Example: "GCO  Genesco Inc  2431   $27.22   $0.63   +2.37%   +$1,531.53   $66,171.82"
  const standardPattern = /\b([A-Z]{2,6}(?:\.[A-Z]{1,2})?)\s+[^$]+?\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/g;
  
  let match;
  while ((match = standardPattern.exec(cleanText)) !== null) {
    const ticker = match[1];
    const shares = parseFloat(match[2].replace(/,/g, ''));
    const price = parseFloat(match[3].replace(/,/g, ''));
    const value = parseFloat(match[4].replace(/,/g, ''));
    
    if (skipTickers.includes(ticker) || shares === 0) continue;
    
    const key = `${ticker}-${shares.toFixed(2)}`;
    if (!seen.has(key) && shares > 0 && value > 0) {
      seen.add(key);
      holdings.push({ ticker, name: ticker, shares, price, value, bucket: inferBucketFromTicker(ticker) });
    }
  }
  
  // Pattern 2: Zero change format (0.00% $0.00)
  // Example: "BTC  Bitcoin  4984   $40.66   $0.00   0.00%   $0.00   $202,624.52"
  const zeroChangePattern = /\b([A-Z]{2,6}(?:\.[A-Z]{1,2})?)\s+[^$]+?\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+\$0\.00\s+0\.00%\s+\$0\.00\s+\$([\d,]+\.?\d*)/g;
  
  while ((match = zeroChangePattern.exec(cleanText)) !== null) {
    const ticker = match[1];
    const shares = parseFloat(match[2].replace(/,/g, ''));
    const price = parseFloat(match[3].replace(/,/g, ''));
    const value = parseFloat(match[4].replace(/,/g, ''));
    
    if (skipTickers.includes(ticker) || shares === 0) continue;
    
    const key = `${ticker}-${shares.toFixed(2)}`;
    if (!seen.has(key) && shares > 0 && value > 0) {
      seen.add(key);
      holdings.push({ ticker, name: ticker, shares, price, value, bucket: inferBucketFromTicker(ticker) });
    }
  }
  
  // Pattern 3: Multi-word proprietary funds (INVESCO VI, PIMCO VIT, BNY MELLON)
  // Example: "INVESCO VI   3565.13   $61.17   $0.00   0.00%   $0.00   $218,079.00"
  const proprietaryPattern = /(INVESCO VI|PIMCO VIT|BNY MELLON)\s+([\d,]+\.?\d*)\s+\$([\d,]+\.?\d*)\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
  
  while ((match = proprietaryPattern.exec(cleanText)) !== null) {
    const name = match[1].toUpperCase();
    const shares = parseFloat(match[2].replace(/,/g, ''));
    const price = parseFloat(match[3].replace(/,/g, ''));
    const value = parseFloat(match[4].replace(/,/g, ''));
    const ticker = name.replace(/\s+/g, '').substring(0, 6);
    
    const key = `${ticker}-${shares.toFixed(2)}`;
    if (!seen.has(key) && shares > 0 && value > 0) {
      seen.add(key);
      // PIMCO VIT is a bond fund
      const bucket = name.includes('PIMCO') ? 'income' : 'growth';
      holdings.push({ ticker, name, shares, price, value, bucket });
    }
  }
  
  // Pattern 4: Cash entry
  // Example: "Cash   171091.7   $1.00   $0.00   0.00%   $0.00   $171,091.69"
  const cashPattern = /\bCash\s+([\d,]+\.?\d*)\s+\$1\.00\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
  
  while ((match = cashPattern.exec(cleanText)) !== null) {
    const shares = parseFloat(match[1].replace(/,/g, ''));
    const value = parseFloat(match[2].replace(/,/g, ''));
    
    const key = `CASH-${shares.toFixed(2)}`;
    if (!seen.has(key) && shares > 0 && value > 0) {
      seen.add(key);
      holdings.push({ ticker: 'CASH', name: 'Cash', shares, price: 1.00, value, bucket: 'cash' });
    }
  }
  
  // Pattern 5: Insured Bank Deposit
  const depositPattern = /Insured Bank Deposit\s+([\d,]+\.?\d*)\s+\$1\.00\s+[+-]?\$[\d,\.]+\s+[+-]?[\d,\.]+%\s+[+-]?\$[\d,\.]+\s+\$([\d,]+\.?\d*)/gi;
  
  while ((match = depositPattern.exec(cleanText)) !== null) {
    const shares = parseFloat(match[1].replace(/,/g, ''));
    const value = parseFloat(match[2].replace(/,/g, ''));
    
    if (shares > 0 && value > 0) {
      holdings.push({ ticker: 'DEPOSIT', name: 'Insured Bank Deposit', shares, price: 1.00, value, bucket: 'cash' });
    }
  }
  
  return holdings;
}

function inferBucketFromTicker(ticker: string): string {
  const t = ticker.toUpperCase();
  
  const cashFunds = ['SPAXX', 'FDRXX', 'VMFXX', 'SWVXX', 'SPRXX', 'FDLXX', 'FZFXX', 'FGTXX', 'MFIS', 'MFRS', 'CASH'];
  if (cashFunds.some(c => t.includes(c)) || t === 'CASH' || t.includes('MONEY') || t.includes('DEPOSIT')) return 'cash';
  
  const bondFunds = ['BND', 'AGG', 'TIP', 'TIPS', 'VTIP', 'SCHZ', 'IUSB', 'VBTLX', 'BOND', 'GOVT', 'LQD', 'HYG', 'JNK', 'MUB', 'TLT', 'IEF', 'SHY', 'VCIT', 'VCSH', 'BSV', 'BIV', 'BLV', 'VAIPX', 'VBMFX', 'FBNDX', 'VGIT', 'IGIB', 'USHY', 'LBNOX', 'JCBUX', 'VWOB', 'PIMCO'];
  if (bondFunds.some(b => t.includes(b))) return 'income';
  
  const incomeFunds = ['SCHD', 'VIG', 'VYM', 'DVY', 'SDY', 'HDV', 'DGRO', 'NOBL', 'SPYD', 'SPHD', 'VDIGX', 'VHDYX'];
  if (incomeFunds.some(i => t.includes(i))) return 'income';
  
  return 'growth';
}
