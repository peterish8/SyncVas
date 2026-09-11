import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function StudentRoomLoading() {
  return <RouteSkeleton label="Opening the classroom board…" rows={4} />;
}
