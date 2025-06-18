// QPay API integration module

interface QPayInvoiceRequest {
  invoice_code: string;
  sender_invoice_no: string;
  invoice_receiver_code: string;
  invoice_description: string;
  amount: number;
  callback_url?: string;
}

interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  urls: {
    name: string;
    description: string;
    logo: string;
    link: string;
  }[];
}

interface QPayCheckResponse {
  count: number;
  paid_amount: number;
  qpay_payment_id: string;
  payment_status: string;
  payment_wallet: string[];
}

class QPayAPI {
  private baseUrl = "https://merchant.qpay.mn/v2";
  private username: string;
  private password: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(username: string, password: string) {
    this.username = username;
    this.password = password;
  }

  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 5 minute buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      });

      if (!response.ok) {
        throw new Error(`QPay auth failed: ${response.status}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // QPay tokens typically expire in 1 hour
      this.tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;

      return this.accessToken;
    } catch (error) {
      console.error("QPay authentication error:", error);
      throw new Error("Failed to authenticate with QPay");
    }
  }

  async createInvoice(
    invoiceData: QPayInvoiceRequest,
  ): Promise<QPayInvoiceResponse> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(invoiceData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `QPay invoice creation failed: ${response.status} - ${JSON.stringify(errorData)}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("QPay invoice creation error:", error);
      throw error;
    }
  }

  async checkPayment(invoiceId: string): Promise<QPayCheckResponse> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/payment/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          object_type: "INVOICE",
          object_id: invoiceId,
        }),
      });

      if (!response.ok) {
        throw new Error(`QPay payment check failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("QPay payment check error:", error);
      throw error;
    }
  }
}

// Export singleton instance
let qpayInstance: QPayAPI | null = null;

export function getQPayInstance(): QPayAPI {
  if (!qpayInstance) {
    const username = process.env.QPAY_USERNAME;
    const password = process.env.QPAY_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "QPay credentials not configured. Please set QPAY_USERNAME and QPAY_PASSWORD environment variables.",
      );
    }

    qpayInstance = new QPayAPI(username, password);
  }

  return qpayInstance;
}

export type { QPayInvoiceRequest, QPayInvoiceResponse, QPayCheckResponse };
