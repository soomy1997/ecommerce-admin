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

        method: 'post',
        url: 'https://api.moyasar.com/v1/payments',
        auth: {
          username: process.env.MOYASAR_API_KEY, // Your Moyasar API key
          password: "" // Password is not needed for token-based auth
        },
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          amount: amount,
          currency: "SAR",
          description: "Order payment",
          callback_url: `${process.env.FRONTEND_STORE_URL}/payment-callback?orderId=${order.id}`,
          source: {
            type: 'creditcard',
            // The credit card details should be securely collected from the customer
            // and should not be hardcoded
          },
          metadata: {
            orderId: order.id,
          },
          // Additional data fields as required by Moyasar
        }
      });

    return new NextResponse(JSON.stringify({ url: paymentResponse.data.url }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error processing payment:', error);
    let errorMessage = 'An unexpected error occurred';
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(error.response.data);
      errorMessage = error.response.data.message;
    }
    return new NextResponse(JSON.stringify({ error: errorMessage }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 500,
    });
  }
}
