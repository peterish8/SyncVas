import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function NotesLoading() {
  return <RouteSkeleton label="Loading your class notes…" rows={4} />;
}
