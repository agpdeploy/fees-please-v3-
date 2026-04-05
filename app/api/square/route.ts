// Legacy Web Payments Route - Disabled in favor of POS App Switch
export async function POST(req: Request) {
  return new Response(JSON.stringify({ message: 'Legacy route disabled' }), { status: 200 });
}