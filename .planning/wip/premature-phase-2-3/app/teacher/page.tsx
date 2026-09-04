import { BoardRoom } from "@/components/board/board-room";

export default function TeacherBoardPage() {
  const sessionId = process.env.NEXT_PUBLIC_PROOF_SESSION_ID ?? "proof-room";
  return <BoardRoom sessionId={sessionId} role="teacher" teacherProofToken={process.env.SOCKET_PROOF_TEACHER_TOKEN} />;
}
