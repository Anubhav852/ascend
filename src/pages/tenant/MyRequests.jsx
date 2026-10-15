import RequestBoard from '../../components/RequestBoard';
export default function MyRequests() {
  return <RequestBoard scope="mine" layout="list" title="My requests" subtitle="Everything you have asked the building team for" />;
}