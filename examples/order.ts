// same shape as Product in user.ts, but cross-file -> should match at 100%
export interface LineItem {
  sku: string;
  price: number;
  inStock: boolean;
}

export interface Order {
  id: string;
  items: LineItem[];
  total: number;
}
