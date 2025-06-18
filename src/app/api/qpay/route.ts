import { NextRequest, NextResponse } from "next/server";
import { getQPayInstance } from "@/lib/qpay";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 },
      );
    }

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 500 },
      );
    }

    // Get order details from database
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if order is already paid
    if (order.is_paid) {
      return NextResponse.json(
        { error: "Order is already paid" },
        { status: 400 },
      );
    }

    // Create QPay invoice
    const qpay = getQPayInstance();
    const invoiceData = {
      invoice_code: "PIZZA_DELIVERY",
      sender_invoice_no: `ORDER_${orderId}`,
      invoice_receiver_code: order.phone,
      invoice_description: `Пицца захиалга #${orderId}`,
      amount: order.total_price,
      callback_url: `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/qpay-webhook`,
    };

    const qpayResponse = await qpay.createInvoice(invoiceData);

    // Store QPay invoice ID in the order
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        qpay_invoice_id: qpayResponse.invoice_id,
        qpay_qr_text: qpayResponse.qr_text,
      })
      .eq("id", orderId);

    if (updateError) {
      console.error("Failed to update order with QPay info:", updateError);
      // Continue anyway, as the invoice was created successfully
    }

    return NextResponse.json({
      success: true,
      invoice_id: qpayResponse.invoice_id,
      qr_text: qpayResponse.qr_text,
      qr_image: qpayResponse.qr_image,
      urls: qpayResponse.urls,
    });
  } catch (error) {
    console.error("QPay API error:", error);

    let errorMessage = "Failed to create payment link";
    if (error instanceof Error) {
      if (error.message.includes("QPay credentials not configured")) {
        errorMessage = "Payment service not configured";
      } else if (error.message.includes("authentication")) {
        errorMessage = "Payment service authentication failed";
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
