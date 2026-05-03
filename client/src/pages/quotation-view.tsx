import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function QuotationViewPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  useEffect(() => {
    // Open print page in same tab
    if (id) {
      window.location.href = `/api/quotations/${id}/print`;
    } else {
      navigate("/quotations");
    }
  }, [id, navigate]);
  return <div className="p-8 text-center text-muted-foreground">Loading quotation...</div>;
}
