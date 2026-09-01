// nested object literals: address shape repeated across two interfaces via
// exact structural duplication -> both "address" nested shapes should match
// each other AND make Employee/Contact match each other (recursive scoring)
export interface Employee {
  id: string;
  address: {
    street: string;
    city: string;
    zip: string;
  };
}

export interface Contact {
  id: string;
  address: {
    street: string;
    city: string;
    zip: string;
  };
}

// near-duplicate nested shape: missing "zip" -> partial nested match, should
// pull Warehouse into the same cluster at <100% (fuzzy, needs refactor)
export interface Warehouse {
  id: string;
  address: {
    street: string;
    city: string;
  };
}
