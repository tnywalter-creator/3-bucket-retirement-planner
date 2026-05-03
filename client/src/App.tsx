import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const HoldingsPage = lazy(() => import("@/pages/Holdings"));
const BucketsPage = lazy(() => import("@/pages/Buckets"));
const ProjectionPage = lazy(() => import("@/pages/Projection"));
const ScenariosPage = lazy(() => import("@/pages/Scenarios"));
const ReportPage = lazy(() => import("@/pages/Report"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/holdings" component={HoldingsPage} />
        <Route path="/buckets" component={BucketsPage} />
        <Route path="/projection" component={ProjectionPage} />
        <Route path="/scenarios" component={ScenariosPage} />
        <Route path="/report" component={ReportPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary fallbackTitle="Application Error">
          <Toaster />
          <Router />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
