import { NextRequest, NextResponse } from "next/server";
import { getQPayInstance } from "@/lib/qpay";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("QPay webhook received:", body);

    // QPay webhook typically sends invoice_id and payment status
    const { invoice_id, payment_status } = body;

    if (!invoice_id) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 },
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 },
      );
    }

    // Find the order by QPay invoice ID
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("qpay_invoice_id", invoice_id)
      .single();

    if (orderError || !order) {
      console.error("Order not found for invoice ID:", invoice_id);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify payment status with QPay API
    try {
      const qpay = getQPayInstance();
      const paymentCheck = await qpay.checkPayment(invoice_id);

      console.log("QPay payment check result:", paymentCheck);

      // Check if payment is successful
      const isPaid =
        paymentCheck.payment_status === "PAID" ||
        paymentCheck.paid_amount >= order.total_price;

      if (isPaid && !order.is_paid) {
        // Update order as paid
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            is_paid: true,
            qpay_payment_id: paymentCheck.qpay_payment_id,
            payment_verified_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("Failed to update order payment status:", updateError);
          return NextResponse.json(
            { error: "Failed to update order" },
            { status: 500 },
          );
        }

        console.log(`Order ${order.id} marked as paid via QPay`);
      }

      return NextResponse.json({
        success: true,
        message: "Webhook processed successfully",
        payment_status: paymentCheck.payment_status,
      });
    } catch (qpayError) {
      console.error("QPay verification error:", qpayError);

      // If we can't verify with QPay API, we'll trust the webhook for now
      // but log it for manual review
      if (payment_status === "PAID" && !order.is_paid) {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            is_paid: true,
            payment_verified_at: new Date().toISOString(),
            payment_notes: "Paid via webhook (API verification failed)",
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("Failed to update order payment status:", updateError);
        } else {
          console.log(
            `Order ${order.id} marked as paid via webhook (verification failed)`,
          );
        }
      }

      return NextResponse.json({
        success: true,
        message: "Webhook processed (verification failed)",
        warning: "Payment verification failed",
      });
    }
  } catch (error) {
    console.error("QPay webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

// Handle GET requests for webhook verification
export async function GET(request: NextRequest) {
  // Some payment providers send GET requests to verify webhook endpoints
  return NextResponse.json({
    message: "QPay webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
