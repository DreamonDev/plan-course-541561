import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/Layout";
import StoresPage from "./pages/StoresPage";
import StorePlanEditor from "./pages/StorePlanEditor";
import CategoriesPage from "./pages/CategoriesPage";
import ArticlesPage from "./pages/ArticlesPage";
import ShoppingListsPage from "./pages/ShoppingListsPage";
import RoutePage from "./pages/RoutePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/stores" replace />} />
            <Route element={<Layout />}>
              <Route path="/stores" element={<StoresPage />} />
              <Route path="/stores/:id/plan" element={<StorePlanEditor />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/articles" element={<ArticlesPage />} />
              <Route path="/lists" element={<ShoppingListsPage />} />
              <Route path="/run/:storeId" element={<RoutePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
