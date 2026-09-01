// near-duplicate of User/Person: email is optional here -> similar but not identical
export interface Account {
  id: string;
  name: string;
  email?: string;
}

export interface Unrelated {
  foo: boolean;
  bar: number;
}
