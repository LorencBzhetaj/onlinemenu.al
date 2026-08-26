// Tipat e pemës së menusë të përdorura nga komponentët klient.

export type ItemDTO = {
  id: string;
  nameAl: string;
  nameEn: string;
  descAl: string | null;
  descEn: string | null;
  price: number;
  imageUrl: string | null;
  isChefPick: boolean;
  isDailyMenu: boolean;
  isVisible: boolean;
  sortOrder: number;
};

export type SubcategoryDTO = {
  id: string;
  nameAl: string;
  nameEn: string;
  sortOrder: number;
  items: ItemDTO[];
};

export type CategoryDTO = {
  id: string;
  nameAl: string;
  nameEn: string;
  icon: string | null;
  sortOrder: number;
  items: ItemDTO[];
  subcategories: SubcategoryDTO[];
};
