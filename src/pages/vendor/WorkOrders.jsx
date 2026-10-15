import RequestBoard from '../../components/RequestBoard';
export default function WorkOrders() {
  return <RequestBoard scope="vendor" layout="list" title="Assigned work orders" subtitle="Only jobs sent to your company appear here" />;
}