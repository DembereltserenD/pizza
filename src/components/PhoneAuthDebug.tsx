"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { Phone, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface PhoneAuthStatus {
  isConfigured: boolean;
  providerEnabled: boolean;
  error: string | null;
  testResult: string | null;
}

export default function PhoneAuthDebug() {
  const [status, setStatus] = useState<PhoneAuthStatus>({
    isConfigured: false,
    providerEnabled: false,
    error: null,
    testResult: null,
  });
  const [isChecking, setIsChecking] = useState(false);
  const [testPhone, setTestPhone] = useState("+97699354845");

  const checkPhoneAuthStatus = async () => {
    setIsChecking(true);

    try {
      if (!supabase) {
        setStatus({
          isConfigured: false,
          providerEnabled: false,
          error: "Supabase client not initialized",
          testResult: null,
        });
        return;
      }

      // Try to get the current session to check if auth is working
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Session error:", sessionError);
      }

      // Test phone auth by attempting to send OTP
      console.log("Testing phone auth with:", testPhone);

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: testPhone,
      });

      if (error) {
        console.error("Phone auth test error:", error);

        let errorMessage = error.message;
        let isConfigured = false;
        let providerEnabled = false;

        if (error.message.includes("Phone provider not configured")) {
          errorMessage =
            "Phone provider (SMS service) not configured in Supabase";
          isConfigured = false;
          providerEnabled = false;
        } else if (error.message.includes("Phone authentication is disabled")) {
          errorMessage =
            "Phone authentication is disabled in Supabase settings";
          isConfigured = false;
          providerEnabled = false;
        } else if (error.message.includes("Invalid phone number")) {
          errorMessage = "Phone number format is invalid";
          isConfigured = true;
          providerEnabled = true;
        } else if (error.message.includes("rate limit")) {
          errorMessage = "Rate limit exceeded - too many SMS requests";
          isConfigured = true;
          providerEnabled = true;
        } else {
          // Other errors might indicate the service is configured but has other issues
          isConfigured = true;
          providerEnabled = true;
        }

        setStatus({
          isConfigured,
          providerEnabled,
          error: errorMessage,
          testResult: `Failed: ${errorMessage}`,
        });
      } else {
        console.log("Phone auth test successful:", data);
        setStatus({
          isConfigured: true,
          providerEnabled: true,
          error: null,
          testResult: "Success: SMS should be sent",
        });
      }
    } catch (err) {
      console.error("Phone auth check failed:", err);
      setStatus({
        isConfigured: false,
        providerEnabled: false,
        error: `Check failed: ${err}`,
        testResult: null,
      });
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusIcon = (isGood: boolean) => {
    return isGood ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Phone className="h-5 w-5 mr-2" />
          Phone Auth Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Phone Auth Configured</span>
            <div className="flex items-center space-x-2">
              {getStatusIcon(status.isConfigured)}
              <Badge variant={status.isConfigured ? "default" : "destructive"}>
                {status.isConfigured ? "YES" : "NO"}
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm">SMS Provider Enabled</span>
            <div className="flex items-center space-x-2">
              {getStatusIcon(status.providerEnabled)}
              <Badge
                variant={status.providerEnabled ? "default" : "destructive"}
              >
                {status.providerEnabled ? "YES" : "NO"}
              </Badge>
            </div>
          </div>
        </div>

        {status.error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex items-start">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Error Details
                </p>
                <p className="text-sm text-red-700 mt-1">{status.error}</p>
              </div>
            </div>
          </div>
        )}

        {status.testResult && (
          <div
            className={`border rounded-md p-3 ${
              status.testResult.startsWith("Success")
                ? "bg-green-50 border-green-200"
                : "bg-yellow-50 border-yellow-200"
            }`}
          >
            <p className="text-sm font-medium">{status.testResult}</p>
          </div>
        )}

        <Button
          onClick={checkPhoneAuthStatus}
          disabled={isChecking}
          className="w-full"
        >
          {isChecking ? "Checking..." : "Check Phone Auth Status"}
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>
            <strong>To fix SMS issues:</strong>
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to Supabase Dashboard → Authentication → Settings</li>
            <li>Enable "Enable phone confirmations"</li>
            <li>Configure SMS provider (Twilio recommended)</li>
            <li>Add your Twilio credentials</li>
            <li>Test with a valid phone number</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
