import { PosWorkspace } from "@/components/pos-workspace";
import { initialCustomers, initialProducts } from "@/lib/sample-data";

export default function HomePage() {
  return (
    <main>
      <PosWorkspace products={initialProducts} customers={initialCustomers} />
    </main>
  );
}
