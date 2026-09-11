import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function TeacherLoading() {
  return <RouteSkeleton label="Loading your classroom…" rows={3} />;
}
