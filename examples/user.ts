export interface User {
  id: string;
  name: string;
  email: string;
}

// exact same shape as User, different name -> should match at 100%
export type Person = {
  id: string;
  name: string;
  email: string;
};

export interface Product {
  sku: string;
  price: number;
  inStock: boolean;
}
