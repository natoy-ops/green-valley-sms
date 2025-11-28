"use client";

import Image from "next/image";
import { useState } from "react";
import { Eye, EyeOff, Lock, User, ShieldCheck } from "lucide-react";
import { useAuth } from "@/shared/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    console.log("[LoginPage] Submitting login form", { email });

    try {
      await login(email, password);
      console.log("[LoginPage] Login completed, redirect handled by AuthContext");
    } catch (err) {
      console.error("[LoginPage] Login error", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please check your credentials and try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-t-4 border-[#F4B400]">
        {/* Header Section */}
        <div className="p-8 text-center space-y-4">
          <div className="relative w-24 h-24 mx-auto drop-shadow-md transition-transform hover:scale-105 duration-300">
            <Image
              src="/basic-ed-logo.png"
              alt="School Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#1B4D3E] tracking-tight">
              Welcome Back
            </h1>
            <p className="text-sm text-gray-500 font-medium">
              Unified School Management System
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="px-8 pb-8 pt-0">
          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Username Field */}
            <div className="space-y-2">
              <label 
                htmlFor="email" 
                className="block text-xs font-semibold text-gray-600 uppercase tracking-wider ml-1"
              >
                Email or Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400 group-focus-within:text-[#1B4D3E] transition-colors" />
                </div>
                <input
                  id="email"
                  type="text"
                  className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F4B400]/50 focus:border-[#F4B400] transition-all bg-white hover:bg-white/95 outline-none text-gray-800 placeholder-gray-400"
                  placeholder="Enter your ID"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label 
                htmlFor="password" 
                className="block text-xs font-semibold text-gray-600 uppercase tracking-wider ml-1"
              >
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#1B4D3E] transition-colors" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#F4B400]/50 focus:border-[#F4B400] transition-all bg-white hover:bg-white/95 outline-none text-gray-800 placeholder-gray-400"
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-[#1B4D3E] hover:bg-[#153e30] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1B4D3E] transition-all disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>

            {error && (
              <p className="text-xs text-red-600 text-center mt-2">
                {error}
              </p>
            )}

            {/* Help Text */}
            <div className="text-center">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Restricted Access</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500 max-w-[240px] mx-auto leading-relaxed">
                Access is restricted to authorized staff and parents. Contact the <span className="font-semibold text-[#1B4D3E] cursor-pointer hover:underline">Super Admin</span> for account issues.
              </p>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center space-y-2">
         <div className="flex items-center justify-center space-x-2 text-[#1B4D3E]/60">
           <ShieldCheck className="h-4 w-4" />
           <span className="text-xs font-medium">Secure SSL Connection</span>
         </div>
         <p className="text-xs text-gray-400">
           © {new Date().getFullYear()} Green Valley College Foundation Inc. All rights reserved.
         </p>
      </div>
    </div>
  );
}
