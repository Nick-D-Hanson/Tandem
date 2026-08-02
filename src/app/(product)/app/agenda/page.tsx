import { permanentRedirect } from "next/navigation";

export default async function AgendaPage() {
  permanentRedirect("/app/my-list");
}
