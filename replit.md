# 3-Bucket Retirement Planner

## Overview

This is a Progressive Web App (PWA) for retirement planning using the 3-bucket investment strategy: Cash Reserve (Bucket 1), Bridge (Bucket 2), and Long-Term Growth (Bucket 3). The app manages investment holdings across these three buckets, visualizes portfolio allocation with dollar-based targets, configures retirement parameters (including 4.25% withdrawal rate, spouse planning), and projects portfolio longevity using a phased withdrawal sequence. All portfolio data is stored client-side using Zustand with localStorage persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## Strategy Model (from PDF)

- **Bucket 1 - Cash Reserve ($288K target)**: 3 years of expenses, HYSA at 4.5%, spent first (years 1-3)
- **Bucket 2 - Bridge ($672K target)**: Years 4-10, moderate growth at 6.5%, diversified mix (30% US large cap, 20% growth, 15% intl, 20% bonds, 10% alternatives, 5% crypto)
- **Bucket 3 - Growth ($1.384M target)**: Year 10+, aggressive at 8.5% (35% US total, 25% US growth, 20% intl, 10% small/mid, 10% crypto)
- **Withdrawal Rate**: 4.25% ($8,000/month target)
- **Default Profile**: Age 56, spouse Angela age 54, spouse income $40K/yr

## System Architecture

### Frontend (React + Vite)

- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) with 6 pages: Dashboard, Holdings, Buckets, Projection, Settings, and Report
- **Code Splitting**: Lazy-loaded pages with React.lazy + Suspense; Vite manual chunks for recharts, forms, and UI libs
- **State Management**: Zustand with `persist` middleware (version 2, with migration from v1 "income" → "bridge" bucket renaming)
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS v4
- **Charts**: Recharts for portfolio visualization (pie charts, area charts, composed charts, reference lines for milestones)
- **Forms**: React Hook Form with Zod validation
- **Fonts**: Plus Jakarta Sans (sans-serif) and Libre Baskerville (serif)
- **PWA**: Service worker (`sw.js`) with cache-first strategy, web app manifest for installability
- **Error Handling**: ErrorBoundary component wrapping major sections with retry capability

### Backend (Express)

- **Runtime**: Node.js with Express, started via `tsx` in development
- **Purpose**: Minimal — serves the built frontend in production and provides market data proxy + PDF parsing
- **API Endpoints**:
  - `GET /api/quote/:ticker` — Proxies Yahoo Finance API for live stock/ETF prices
  - `POST /api/parse-pdf` — Server-side PDF parsing for brokerage statement imports
- **Dev Server**: Vite dev server integrated as middleware during development with HMR support

### Data Storage

- **Client-side**: Zustand store persisted to localStorage. All holdings, accounts, scenarios, and user profile data live in the browser.
- **Server-side**: Drizzle ORM configured with PostgreSQL but not actively used for core app functionality.

### Key Types

- **BucketType**: `'cash' | 'bridge' | 'growth' | 'unassigned'` (renamed from 'income' to 'bridge' in v2)
- **BucketConfig**: cashReturn, bridgeReturn, growthReturn, cashTargetYears, bridgeTargetYears, cashTarget, bridgeTarget, growthTarget, withdrawalRate
- **UserProfile**: currentAge, retirementAge, lifeExpectancy, monthlySpending, inflationRate, socialSecurityAge/Amount, spouseAge/Name/Income, spouseSocialSecurityAge/Amount, otherIncome, taxConfig
- **TaxConfig**: federalRate (22%), stateRate (5%), capitalGainsRate (15%) — used in tax-aware projections
- **AccountType**: includes 'hsa' type for HSA accounts
- **Scenario**: id, name, profile, bucketConfig — supports multiple scenarios for comparison
- **RebalanceAction**: ticker, bucket, currentValue, targetValue, difference, action

### Projection Engine

The engine (`client/src/lib/engine.ts`) implements a phased withdrawal sequence:
- Years 1-N (cashTargetYears): Draw from Cash Reserve bucket (0% tax)
- Years N+1 to N+M (bridgeTargetYears): Draw from Bridge bucket (cap gains tax), refill Cash from Bridge
- Years N+M+1+: Draw from Growth bucket (blended income tax)

Additional engine features:
- **Tax-aware projections**: Calculates gross withdrawal (net + taxes) based on withdrawal phase and account type
- **SS Optimization**: `compareSSClaimingAges()` compares claiming at ages 62/64/67/70 using SSA bend point factors
- **Income breakdown**: Tracks SS income, spouse SS, work income, and other income separately

### Rebalancing Engine

The rebalancing module (`client/src/lib/rebalance.ts`) compares current bucket allocations to targets:
- Calculates per-bucket current value vs target value
- Flags buckets as 'add', 'reduce', or 'on-target' (within 2% tolerance)
- Shows progress bars and actionable suggestions

### Project Structure

```
client/src/           - React frontend
  components/         - UI components (BucketVisualizer, HoldingsTable, ProjectionChart, ErrorBoundary, etc.)
  components/ui/      - shadcn/ui component library
  pages/              - Page components (Dashboard, Holdings, Buckets, Projection, Scenarios, Report)
  lib/                - Core logic (store, engine, types, rebalance, marketData, csvExport)
  hooks/              - Custom React hooks
server/               - Express backend
  index.ts            - Server entry point
  routes.ts           - API route definitions
  storage.ts          - In-memory storage (users)
  vite.ts             - Vite dev middleware setup
  static.ts           - Production static file serving
  github.ts           - GitHub integration via Replit connectors
shared/               - Shared code between client and server
  schema.ts           - Drizzle ORM database schema
scripts/              - Utility scripts (GitHub push)
migrations/           - Drizzle database migrations
```

## Features

- **Scenario Comparison**: Create, duplicate, rename, and delete scenarios. Side-by-side comparison cards showing final balance, spending, and portfolio longevity for each scenario.
- **Tax-Aware Projections**: Configure federal/state/capital gains tax rates. Projections show gross withdrawal (net + taxes) varying by bucket phase.
- **Social Security Optimization**: Compare claiming at ages 62/64/67/70 showing monthly benefit, lifetime total, and portfolio impact.
- **Rebalancing Dashboard**: Visual comparison of current bucket allocations vs targets with progress bars and action suggestions.
- **Enhanced Charts**: Portfolio projection with milestone reference lines (cash ends, bridge ends, SS starts). Stacked income breakdown chart. Tax impact on withdrawals.
- **Export/Reporting**: Printable retirement plan summary (Report page) with CSV export of year-by-year projection data.
- **Error Boundaries**: Graceful error handling around charts and major sections with retry buttons.
- **Code Splitting**: Lazy-loaded pages and vendor chunk splitting for faster initial load.
- **Print Styles**: CSS print media query hides navigation and formats report for clean printing.

## External Dependencies

- **PostgreSQL**: Configured via Drizzle ORM and `DATABASE_URL` environment variable
- **Yahoo Finance API**: Free, unauthenticated API used via server proxy for real-time price data
- **GitHub (Replit Connector)**: Optional integration for pushing code to GitHub (`scripts/push-to-github.ts`)
- **Google Fonts**: Libre Baskerville and Plus Jakarta Sans loaded via CDN
- **Key npm packages**: zustand (state), recharts (charts), xlsx (spreadsheet import/export), wouter (routing), react-hook-form + zod (forms/validation), drizzle-orm (database ORM), @octokit/rest (GitHub API), pdfjs-dist (PDF parsing), sonner (toast notifications)
