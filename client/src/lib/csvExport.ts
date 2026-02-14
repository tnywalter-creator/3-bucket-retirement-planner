import { Holding, Account } from './types';
import * as XLSX from 'xlsx';

export function exportHoldingsToCSV(holdings: Holding[], accounts: Account[]): string {
  const accountMap = new Map(accounts.map(a => [a.id, a.name]));

  const headers = [
    'Ticker',
    'Name',
    'Type',
    'Quantity',
    'Current Price',
    'Cost Basis Per Share',
    'Bucket',
    'Account',
    'Notes'
  ];

  const rows = holdings.map(h => [
    h.ticker,
    h.name,
    h.type,
    h.quantity.toString(),
    h.currentPrice.toString(),
    h.costBasisPerShare?.toString() || '',
    h.bucket,
    accountMap.get(h.accountId) || '',
    h.notes || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(escapeCSVField).join(','))
  ].join('\n');

  return csvContent;
}

export function downloadCSV(content: string, filename: string = 'holdings.csv') {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export interface CSVImportResult {
  success: boolean;
  holdings: Partial<Holding>[];
  errors: string[];
}

export interface CSVImportResultWithAccounts extends CSVImportResult {
  newAccounts: string[];
}

export async function parseFile(file: File, accounts: Account[]): Promise<CSVImportResultWithAccounts> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcelFile(file, accounts);
  } else if (fileName.endsWith('.csv')) {
    const text = await file.text();
    return parseHoldingsCSV(text, accounts);
  } else {
    return { success: false, holdings: [], errors: ['Unsupported file type. Please use CSV or Excel (.xlsx, .xls)'], newAccounts: [] };
  }
}

async function parseExcelFile(file: File, accounts: Account[]): Promise<CSVImportResultWithAccounts> {
  const errors: string[] = [];
  const holdings: Partial<Holding>[] = [];
  const newAccounts: string[] = [];
  const tempAccountMap = new Map<string, string>();
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
    
    if (data.length < 2) {
      return { success: false, holdings: [], errors: ['Excel file is empty or has no data rows'], newAccounts: [] };
    }

    const headers = (data[0] as any[]).map((h: any) => String(h || '').toLowerCase().trim());
    
    const tickerIdx = findColumnIndex(headers, ['ticker', 'symbol', 'fund', 'security']);
    const nameIdx = findColumnIndex(headers, ['name', 'description', 'security name']);
    const quantityIdx = findColumnIndex(headers, ['quantity', 'shares', 'units', 'qty', 'amount']);
    const priceIdx = findColumnIndex(headers, ['price', 'current price', 'market price', 'value', 'market value']);
    const accountIdx = findColumnIndex(headers, ['account', 'account name', 'acct']);
    const typeIdx = findColumnIndex(headers, ['type', 'asset type', 'security type', 'asset class']);
    const bucketIdx = findColumnIndex(headers, ['bucket', 'category']);

    if (tickerIdx === -1) {
      errors.push('Could not find Ticker/Symbol/Fund column. Please ensure your file has a column with one of these headers.');
    }
    if (quantityIdx === -1) {
      errors.push('Could not find Quantity/Shares/Units column. Please ensure your file has a column with one of these headers.');
    }

    if (errors.length > 0) {
      return { success: false, holdings: [], errors, newAccounts: [] };
    }

    const accountByName = new Map(accounts.map(a => [a.name.toLowerCase(), a.id]));

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        const ticker = String(row[tickerIdx] || '').trim().toUpperCase();
        if (!ticker) continue;

        const name = nameIdx !== -1 ? String(row[nameIdx] || ticker) : ticker;
        const quantity = parseFloat(String(row[quantityIdx] || '0').replace(/[,$]/g, '')) || 0;
        const price = priceIdx !== -1 ? parseFloat(String(row[priceIdx] || '0').replace(/[,$]/g, '')) || 0 : 0;
        const accountNameRaw = accountIdx !== -1 ? String(row[accountIdx] || 'Default Account').trim() : 'Default Account';
        const accountNameLower = accountNameRaw.toLowerCase();
        const typeRaw = typeIdx !== -1 ? String(row[typeIdx] || '').toLowerCase() : '';
        const bucketRaw = bucketIdx !== -1 ? String(row[bucketIdx] || '').toLowerCase() : '';

        let accountId = accountByName.get(accountNameLower) || tempAccountMap.get(accountNameLower);
        
        if (!accountId) {
          const newId = `temp-${Date.now()}-${i}`;
          tempAccountMap.set(accountNameLower, newId);
          newAccounts.push(accountNameRaw);
          accountId = newId;
        }

        const type = inferType(typeRaw, ticker);
        const bucket = inferBucket(bucketRaw, ticker);

        holdings.push({
          ticker,
          name,
          type,
          quantity,
          currentPrice: price,
          bucket,
          accountId,
          notes: `account:${accountNameRaw}`
        });
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Parse error'}`);
      }
    }

    return { success: errors.length === 0, holdings, errors, newAccounts: Array.from(new Set(newAccounts)) };
  } catch (e) {
    return { success: false, holdings: [], errors: [`Failed to parse Excel file: ${e instanceof Error ? e.message : 'Unknown error'}`], newAccounts: [] };
  }
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const idx = headers.findIndex(h => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

function inferType(typeStr: string, ticker: string): 'stock' | 'etf' | 'mutual_fund' | 'bond' | 'cash' | 'other' {
  const lower = typeStr.toLowerCase();
  if (lower.includes('etf')) return 'etf';
  if (lower.includes('mutual') || lower.includes('fund')) return 'mutual_fund';
  if (lower.includes('bond')) return 'bond';
  if (lower.includes('cash') || lower.includes('money market')) return 'cash';
  if (lower.includes('stock') || lower.includes('equity')) return 'stock';
  
  if (ticker.includes('CASH') || ticker === 'USD' || ticker === 'SPAXX') return 'cash';
  if (ticker.endsWith('X')) return 'mutual_fund';
  
  return 'stock';
}

function inferBucket(bucketStr: string, ticker?: string): 'cash' | 'income' | 'growth' | 'unassigned' {
  const lower = bucketStr.toLowerCase();
  if (lower.includes('cash') || lower === '1') return 'cash';
  if (lower.includes('income') || lower.includes('bond') || lower === '2') return 'income';
  if (lower.includes('growth') || lower.includes('equity') || lower === '3') return 'growth';
  
  if (ticker) {
    return inferBucketFromTicker(ticker);
  }
  return 'unassigned';
}

function inferBucketFromTicker(ticker: string): 'cash' | 'income' | 'growth' | 'unassigned' {
  const t = ticker.toUpperCase();
  
  const cashFunds = [
    'SPAXX', 'FDRXX', 'VMFXX', 'SWVXX', 'SPRXX', 'FDLXX', 'FZFXX',
    'CASH', 'USD', 'MONEY', 'MMKT'
  ];
  if (cashFunds.some(c => t.includes(c)) || t === 'CASH') return 'cash';
  
  const bondFunds = [
    'BND', 'AGG', 'TIP', 'TIPS', 'VTIP', 'SCHZ', 'IUSB', 'VBTLX',
    'BOND', 'GOVT', 'LQD', 'HYG', 'JNK', 'MUB', 'TLT', 'IEF', 'SHY',
    'VCIT', 'VCSH', 'BSV', 'BIV', 'BLV', 'VAIPX', 'VBMFX', 'FBNDX'
  ];
  if (bondFunds.some(b => t.includes(b))) return 'income';
  
  const incomeFunds = [
    'SCHD', 'VIG', 'VYM', 'DVY', 'SDY', 'HDV', 'DGRO', 'NOBL',
    'SPYD', 'SPHD', 'VDIGX', 'VHDYX', 'DIV', 'DIVD'
  ];
  if (incomeFunds.some(i => t.includes(i))) return 'income';
  
  const growthFunds = [
    'VOO', 'VTI', 'SPY', 'IVV', 'QQQ', 'VGT', 'SCHG', 'VUG', 'IWF',
    'ARKK', 'ARKW', 'ARKG', 'VTV', 'IWD', 'IWM', 'IJR', 'IJH',
    'VFIAX', 'FXAIX', 'SWPPX', 'FSKAX', 'VTSAX', 'VTSMX',
    'VXUS', 'VEA', 'VWO', 'IEMG', 'EFA', 'VEMAX', 'VTIAX',
    'RGAFX', 'VINIX', 'VIMAX', 'VMCIX',
    'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
    'BRK', 'JPM', 'V', 'MA', 'UNH', 'JNJ', 'PG', 'HD', 'DIS',
    'CMG', 'GCO', 'IBIT', 'GBTC', 'BTC', 'ETH'
  ];
  if (growthFunds.some(g => t.includes(g))) return 'growth';
  
  if (t.length <= 5 && !t.endsWith('X')) return 'growth';
  if (t.endsWith('X') && t.length === 5) return 'growth';
  
  return 'growth';
}

export function parseHoldingsCSV(csvText: string, accounts: Account[]): CSVImportResultWithAccounts {
  const lines = csvText.trim().split('\n');
  const errors: string[] = [];
  const holdings: Partial<Holding>[] = [];
  const newAccounts: string[] = [];
  const tempAccountMap = new Map<string, string>();

  if (lines.length < 2) {
    return { success: false, holdings: [], errors: ['CSV file is empty or invalid'], newAccounts: [] };
  }

  const accountByName = new Map(accounts.map(a => [a.name.toLowerCase(), a.id]));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const fields = parseCSVLine(line);
      
      if (fields.length < 4) {
        errors.push(`Row ${i + 1}: Insufficient columns`);
        continue;
      }

      const [ticker, name, type, quantity, currentPrice, costBasis, bucket, accountName, notes] = fields;

      const accountNameRaw = accountName || 'Default Account';
      const accountNameLower = accountNameRaw.toLowerCase();
      let accountId = accountByName.get(accountNameLower) || tempAccountMap.get(accountNameLower);
      
      if (!accountId) {
        const newId = `temp-${Date.now()}-${i}`;
        tempAccountMap.set(accountNameLower, newId);
        newAccounts.push(accountNameRaw);
        accountId = newId;
      }

      const tickerUpper = ticker.toUpperCase();
      const holding: Partial<Holding> = {
        ticker: tickerUpper,
        name: name || ticker,
        type: inferType(type || '', tickerUpper),
        quantity: parseFloat(quantity) || 0,
        currentPrice: parseFloat(currentPrice) || 0,
        costBasisPerShare: costBasis ? parseFloat(costBasis) : undefined,
        bucket: inferBucket(bucket || '', tickerUpper),
        accountId,
        notes: `account:${accountNameRaw}`
      };

      holdings.push(holding);
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Parse error'}`);
    }
  }

  return {
    success: errors.length === 0,
    holdings,
    errors,
    newAccounts: Array.from(new Set(newAccounts))
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
