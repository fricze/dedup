// generic / non-object-literal aliases -> tool skips these (no field extraction), so no false matches
export type ApiResponse<T> = {
  data: T;
  error: string | null;
};

export type ID = string | number;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
}
