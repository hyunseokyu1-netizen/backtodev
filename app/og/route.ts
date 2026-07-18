import { ImageResponse } from "next/og";
import OpenGraphImage from "@/components/OpenGraphImage";

export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(OpenGraphImage(), {
    width: 1200,
    height: 630,
  });
}
