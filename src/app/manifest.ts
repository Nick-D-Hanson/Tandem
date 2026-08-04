import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tandem Shared Planner",
    short_name: "Tandem",
    description: "A calm shared calendar and task workspace for couples, families, and groups.",
    start_url: "/app/my-list",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    icons: [{ src: "/tandem-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
