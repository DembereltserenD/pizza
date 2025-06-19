"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RefreshCw, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Debug logging helper
const debugLog = (message: string, data?: any) => {
  console.log(`[ProtectedRoute Debug] ${message}`, data || "");
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole: "admin" | "delivery";
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    debugLog("Component mounted", { requiredRole });
    checkAuth();

    // Set up auth state change listener
    if (supabase) {
      debugLog("Setting up auth state listener");
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        debugLog("Auth state changed", {
          event,
          userId: session?.user?.id,
          hasSession: !!session,
        });
        if (event === "SIGNED_OUT" || !session) {
          debugLog("User signed out or no session, redirecting to login");
          setIsAuthorized(false);
          router.push("/login");
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          debugLog("User signed in or token refreshed, checking auth");
          checkAuth();
        }
      });

      return () => {
        debugLog("Cleaning up auth state listener");
        subscription.unsubscribe();
      };
    } else {
      debugLog("Supabase client not available for auth listener");
    }
  }, [requiredRole]);

  const checkAuth = async () => {
    try {
      debugLog("Starting authentication check");
      setError(null);

      if (!supabase) {
        const errorMsg =
          "Supabase client not initialized. Please check environment variables.";
        debugLog("Supabase client not available", { errorMsg });
        setError(errorMsg);
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      debugLog(`Checking authentication for role: ${requiredRole}`);

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        debugLog("Error getting user", {
          error: userError.message,
          code: userError.code,
        });
        setError(`Authentication error: ${userError.message}`);
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      if (!user) {
        debugLog("No authenticated user found");
        setError("No authenticated user found. Please log in.");
        setTimeout(() => router.push("/login"), 2000);
        return;
      }

      debugLog(`User found`, {
        email: user.email,
        id: user.id,
        createdAt: user.created_at,
      });

      // Check if user has the required role
      debugLog("Fetching user role from database");
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (roleError) {
        debugLog("Error fetching user role", {
          error: roleError.message,
          code: roleError.code,
          details: roleError.details,
        });
        if (roleError.code === "PGRST116") {
          setError(
            `No role assigned to user ${user.email}. Please contact administrator.`,
          );
        } else {
          setError(`Database error: ${roleError.message}`);
        }
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      if (!roleData) {
        debugLog("No role data found for user");
        setError(
          `No role data found for user ${user.email}. Please contact administrator.`,
        );
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      debugLog("Role check", {
        userRole: roleData.role,
        requiredRole,
        match: roleData.role === requiredRole,
      });

      if (roleData.role !== requiredRole) {
        const errorMsg = `Access denied. User role '${roleData.role}' does not match required role '${requiredRole}'.`;
        debugLog("Role mismatch", { errorMsg });
        setError(errorMsg);
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      debugLog(`✅ User authorized successfully`, { role: roleData.role });
      setIsAuthorized(true);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown authentication error";
      debugLog("Auth check error", { error, errorMsg });
      setError(`Authentication failed: ${errorMsg}`);
      setTimeout(() => router.push("/login"), 3000);
    } finally {
      debugLog("Authentication check completed", { isLoading: false });
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-orange-600" />
          <p className="text-lg text-gray-600">Эрх шалгаж байна...</p>
          <p className="text-sm text-gray-500 mt-2">
            Checking {requiredRole} permissions...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
          <p className="text-sm text-gray-500 mt-4 text-center">
            Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Will redirect to login
  }

  return <>{children}</>;
}
