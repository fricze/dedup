// same shape as User/Person/Account but field renamed: id -> userId
// exercises fuzzy field-name matching (userId ~ id via token overlap)
export interface Customer {
  userId: string;
  name: string;
  email: string;
}
