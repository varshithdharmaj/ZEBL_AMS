import { ListPageSkeleton } from "@/components/loading";

export default function BatchesLoading() {
  return <ListPageSkeleton label="Loading batches" filterFields={1} tableColumns={5} />;
}
