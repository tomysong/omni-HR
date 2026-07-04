import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ProductMenu } from "@/app/product/ProductMenu";
import { Toaster } from "sonner";
import { ReactNode } from "react";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <ProductMenu />
        {children}
      </div>
      <Toaster richColors position="top-right" />
    </ConvexClientProvider>
  );
}
