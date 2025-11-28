import React from "react";
import DashboardShell from "@/components/dashboard-shell";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <DashboardShell
      mobileTitle="School Dashboard"
      mobileDescription="Administrative modules and analytics."
    >
      {children}
    </DashboardShell>
  );
}
