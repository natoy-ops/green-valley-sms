import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | GVCFI-SSC",
  description: "Secure access for staff and parents of Green Valley College Foundation Inc.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-[#f0fdf4] flex items-center justify-center p-4">
      {children}
    </div>
  );
}
