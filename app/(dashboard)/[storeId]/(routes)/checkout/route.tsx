import prismadb from "@/lib/prismadb";
import { NextResponse } from "next/server";
import axios from "axios";

const corsHeaders = {
  "Access—Control-Allow-Origin": "x",
  "Access—Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access—Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}
export async function POST(
  req: Request,

  { params }: { params: { storeId: string } }
) {
  const { productIds } = await req.json();

  if (!productIds || productIds.length === 0) {
    return new NextResponse("Product ids are required", { status: 400 });
  }

  const products = await prismadb.product.findMany({
    where: {
      id: {
        in: productIds,
      },
    },
  });
  const amount =
    products.reduce((total, product) => {
      return total + product.price.toNumber(); // Assuming price is stored as a number in the database
    }, 0) * 100; // Moyasar's amount is in halalas (cents)

  const order = await prismadb.order.create({
    data: {
      storeId: params.storeId,
      isPaid: false,
      orderItems: {
        create: productIds.map((productId: string) => ({
          product: {
            connect: {
              id: productId,
            },
          },
        })),
      },
    },
  });

  try {
    const paymentResponse = await axios.post(
      "https://api.moyasar.com/v1/payments",
      {
        amount: amount,
        currency: "SAR",
        description: "Order payment",
        callback_url: `${process.env.FRONTEND_STORE_URL}/payment-callback?orderId=${order.id}`,
        metadata: {
          orderlId: order.id,
        },
        credit_card: {
          save_card: "true",
        },

        // You can add more fields as required by your application logic
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MOYASAR_API_KEY}`,
        },
      }
    );

    return new NextResponse(JSON.stringify({ url: paymentResponse.data.url }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    // Handle error appropriately
    return new NextResponse(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
}
