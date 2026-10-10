export type CreateSupplierRequest = {
  name: string;
};

export type Supplier = {
  id: string;
  name: string;
  country: string | null;
  createdAt: string;
};

export type SupplierListResponse = {
  suppliers: Supplier[];
};
