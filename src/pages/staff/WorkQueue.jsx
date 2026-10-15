import RequestBoard from '../../components/RequestBoard';
import { useAuth, teamName } from '../../lib/req';
export default function WorkQueue() {
  const { profile } = useAuth();
  return <RequestBoard scope="queue" layout="columns" sweep title="Work queue" subtitle={teamName(profile?.team)} />;
}