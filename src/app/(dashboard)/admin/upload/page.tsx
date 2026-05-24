import { PageHeader } from "@/components/ui/page-header";
import { UploadForm } from "@/components/admin/upload-form";

export default function UploadPage() {
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Upload attendance"
        description="Import daily attendance from an Excel file."
      />
      <UploadForm defaultDate={today} />
    </div>
  );
}
