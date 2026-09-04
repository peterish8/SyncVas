import { BoardRoom } from "@/components/board/board-room";

export default async function StudentBoardPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <BoardRoom sessionId={sessionId} role="student" />;
}

