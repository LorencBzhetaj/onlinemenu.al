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
  isAvailable: boolean;
  allergenIds: string[];
  sortOrder: number;
};

export type AllergenDTO = { id: string; nameAl: string; nameEn: string; icon: string | null };
export type ScheduleDTO = {
  id: string;
  label: string;
  days: number[];
  startMinutes: number;
  endMinutes: number;
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
  scheduleId: string | null;
  sortOrder: number;
  items: ItemDTO[];
  subcategories: SubcategoryDTO[];
};
