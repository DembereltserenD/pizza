"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import {
  Bug,
  Database,
  User,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface DebugInfo {
  supabaseStatus: "connected" | "disconnected" | "error";
  authStatus: "authenticated" | "unauthenticated" | "loading";
  userRole: string | null;
  databaseConnections: {
    orders: boolean;
    pizzas: boolean;
    userRoles: boolean;
  };
  environmentVariables: {
    supabaseUrl: boolean;
    supabaseAnonKey: boolean;
    tempoEnv: boolean;
  };
  errors: string[];
}

export default function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    supabaseStatus: "loading",
    authStatus: "loading",
    userRole: null,
    databaseConnections: {
      orders: false,
      pizzas: false,
      userRoles: false,
    },
    environmentVariables: {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      tempoEnv: !!process.env.NEXT_PUBLIC_TEMPO,
    },
    errors: [],
  });
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostics = async () => {
    setIsLoading(true);
    const errors: string[] = [];

    try {
      console.log("[Debug Panel] Running diagnostics...");

      // Check Supabase connection
      let supabaseStatus: "connected" | "disconnected" | "error" =
        "disconnected";
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("pizzas")
            .select("count")
            .limit(1);
          if (error) {
            errors.push(`Supabase connection error: ${error.message}`);
            supabaseStatus = "error";
          } else {
            supabaseStatus = "connected";
          }
        } catch (err) {
          errors.push(`Supabase connection failed: ${err}`);
          supabaseStatus = "error";
        }
      } else {
        errors.push("Supabase client not initialized");
      }

      // Check authentication
      let authStatus: "authenticated" | "unauthenticated" | "loading" =
        "unauthenticated";
      let userRole: string | null = null;

      if (supabase) {
        try {
          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError) {
            errors.push(`Auth error: ${userError.message}`);
          } else if (user) {
            authStatus = "authenticated";

            // Get user role
            const { data: roleData, error: roleError } = await supabase
              .from("user_roles")
              .select("role")
              .eq("id", user.id)
              .single();

            if (roleError) {
              errors.push(`Role fetch error: ${roleError.message}`);
            } else {
              userRole = roleData?.role || null;
            }
          }
        } catch (err) {
          errors.push(`Authentication check failed: ${err}`);
        }
      }

      // Test database connections
      const databaseConnections = {
        orders: false,
        pizzas: false,
        userRoles: false,
      };

      if (supabase) {
        try {
          const { error: ordersError } = await supabase
            .from("orders")
            .select("id")
            .limit(1);
          databaseConnections.orders = !ordersError;
          if (ordersError)
            errors.push(`Orders table error: ${ordersError.message}`);
        } catch (err) {
          errors.push(`Orders table connection failed: ${err}`);
        }

        try {
          const { error: pizzasError } = await supabase
            .from("pizzas")
            .select("id")
            .limit(1);
          databaseConnections.pizzas = !pizzasError;
          if (pizzasError)
            errors.push(`Pizzas table error: ${pizzasError.message}`);
        } catch (err) {
          errors.push(`Pizzas table connection failed: ${err}`);
        }

        try {
          const { error: rolesError } = await supabase
            .from("user_roles")
            .select("id")
            .limit(1);
          databaseConnections.userRoles = !rolesError;
          if (rolesError)
            errors.push(`User roles table error: ${rolesError.message}`);
        } catch (err) {
          errors.push(`User roles table connection failed: ${err}`);
        }
      }

      setDebugInfo({
        supabaseStatus,
        authStatus,
        userRole,
        databaseConnections,
        environmentVariables: {
          supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          tempoEnv: !!process.env.NEXT_PUBLIC_TEMPO,
        },
        errors,
      });

      console.log("[Debug Panel] Diagnostics completed", {
        errors: errors.length,
      });
    } catch (error) {
      console.error("[Debug Panel] Diagnostics failed:", error);
      errors.push(`Diagnostics failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: boolean | string) => {
    if (typeof status === "boolean") {
      return status ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      );
    }

    switch (status) {
      case "connected":
      case "authenticated":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "disconnected":
      case "unauthenticated":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "loading":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: boolean | string) => {
    if (typeof status === "boolean") {
      return (
        <Badge variant={status ? "default" : "destructive"}>
          {status ? "OK" : "FAIL"}
        </Badge>
      );
    }

    const variant =
      status === "connected" || status === "authenticated"
        ? "default"
        : status === "error"
          ? "destructive"
          : "secondary";

    return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-white shadow-lg border-2 border-orange-500 text-orange-600 hover:bg-orange-50"
        >
          <Bug className="h-4 w-4 mr-2" />
          Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="bg-white shadow-xl border-2 border-orange-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-orange-600 flex items-center">
              <Bug className="h-5 w-5 mr-2" />
              Debug Panel
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                onClick={runDiagnostics}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={() => setIsVisible(false)}
                variant="ghost"
                size="sm"
              >
                ×
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Environment Variables */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Environment
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Supabase URL</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(debugInfo.environmentVariables.supabaseUrl)}
                  {getStatusBadge(debugInfo.environmentVariables.supabaseUrl)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Supabase Key</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(
                    debugInfo.environmentVariables.supabaseAnonKey,
                  )}
                  {getStatusBadge(
                    debugInfo.environmentVariables.supabaseAnonKey,
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Tempo Env</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(debugInfo.environmentVariables.tempoEnv)}
                  {getStatusBadge(debugInfo.environmentVariables.tempoEnv)}
                </div>
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center">
              <Database className="h-4 w-4 mr-2" />
              Database
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Connection</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(debugInfo.supabaseStatus)}
                  {getStatusBadge(debugInfo.supabaseStatus)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Orders Table</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(debugInfo.databaseConnections.orders)}
                  {getStatusBadge(debugInfo.databaseConnections.orders)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Pizzas Table</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(debugInfo.databaseConnections.pizzas)}
                  {getStatusBadge(debugInfo.databaseConnections.pizzas)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>User Roles Table</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(debugInfo.databaseConnections.userRoles)}
                  {getStatusBadge(debugInfo.databaseConnections.userRoles)}
                </div>
              </div>
            </div>
          </div>

          {/* Authentication Status */}
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center">
              <User className="h-4 w-4 mr-2" />
              Authentication
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Auth Status</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(debugInfo.authStatus)}
                  {getStatusBadge(debugInfo.authStatus)}
                </div>
              </div>
              {debugInfo.userRole && (
                <div className="flex items-center justify-between">
                  <span>User Role</span>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <Badge variant="outline">{debugInfo.userRole}</Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Errors */}
          {debugInfo.errors.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center text-red-600">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Errors ({debugInfo.errors.length})
              </h4>
              <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                {debugInfo.errors.map((error, index) => (
                  <div
                    key={index}
                    className="p-2 bg-red-50 border border-red-200 rounded text-red-700"
                  >
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
