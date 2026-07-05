import ConvexClientProvider from "@/components/ConvexClientProvider";
import { ProductMenu } from "@/app/product/ProductMenu";
import { Toaster } from "sonner";
import { ReactNode } from "react";

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <ConvexClientProvider>
      <div className="flex min-h-screen w-full flex-col md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <ProductMenu />
        <div className="min-w-0">{children}</div>
      </div>
      <Toaster richColors position="top-right" />
    </ConvexClientProvider>
  );
}
