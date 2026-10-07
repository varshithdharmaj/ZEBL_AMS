import { ListPageSkeleton } from "@/components/loading";

export default function BatchSheetLoading() {
  return <ListPageSkeleton label="Loading batch" filterFields={1} tableRows={10} tableColumns={8} />;
}
