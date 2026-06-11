import { PosWorkspace } from "@/components/pos-workspace";
import {
  initialCustomers,
  initialProducts,
  initialStockMovements,
} from "@/lib/sample-data";

export default function HomePage() {
  return (
    <main>
      <PosWorkspace
        products={initialProducts}
        customers={initialCustomers}
        stockMovements={initialStockMovements}
      />
    </main>
  );
}
