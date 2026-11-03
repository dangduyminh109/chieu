import { DocumentDetails } from '@/features/commerce/document-details';

export default function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  return <DocumentDetails params={params} />;
}
export const metadata = { title: 'Chi tiết giao dịch' };
