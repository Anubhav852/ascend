import RequestBoard from '../../components/RequestBoard';
export default function AllRequests() {
  return <RequestBoard scope="all" layout="columns" sweep teamFilter title="All requests" subtitle="Every request across the building" />;
}