export type FiscalConnectorStatus =
  | { status: "READY" }
  | { status: "NOT_CONNECTED" }
  | { status: "ERROR"; message: string };

export type FiscalResult = {
  success: boolean;
  status: FiscalConnectorStatus["status"];
  message: string;
  externalReceiptId?: string;
};

export interface FiscalConnector {
  submitSale(saleId: string): Promise<FiscalResult>;
  voidSale(saleId: string): Promise<FiscalResult>;
  getStatus(): Promise<FiscalConnectorStatus>;
}

export class MockFiscalConnector implements FiscalConnector {
  async submitSale(_saleId: string): Promise<FiscalResult> {
    return {
      success: false,
      status: "NOT_CONNECTED",
      message: "ASPA AM-1 integration has not been configured yet.",
    };
  }

  async voidSale(_saleId: string): Promise<FiscalResult> {
    return {
      success: false,
      status: "NOT_CONNECTED",
      message: "ASPA AM-1 integration has not been configured yet.",
    };
  }

  async getStatus(): Promise<FiscalConnectorStatus> {
    return {
      status: "NOT_CONNECTED",
    };
  }
}

let fiscalConnector: FiscalConnector | null = null;

export function getFiscalConnector() {
  if (!fiscalConnector) {
    fiscalConnector = new MockFiscalConnector();
  }

  return fiscalConnector;
}
