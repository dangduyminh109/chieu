import { DocumentDetails } from '@/features/commerce/document-details';
import { RouteDialog } from '@/components/ui/route-dialog';

export default function TransactionModal({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RouteDialog title="Chi tiết giao dịch">
      <DocumentDetails params={params} embedded />
    </RouteDialog>
  );
}
