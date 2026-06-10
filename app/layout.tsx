import type { Metadata } from "next";
import "./globals.css";
import AntdProvider from "@/components/providers/AntdProvider";
import { BrandProvider } from "@/components/providers/BrandProvider";

export const metadata: Metadata = {
  title: "Feedback CRM",
  description: "Customer feedback management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AntdProvider>
          <BrandProvider>{children}</BrandProvider>
        </AntdProvider>
      </body>
    </html>
  );
}
