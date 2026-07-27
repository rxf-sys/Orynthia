export type ListType = 'SHOPPING' | 'PACKING' | 'CHECKLIST' | 'WISHLIST' | 'GENERIC';

export interface ListItem {
  id: string;
  name: string;
  amount?: number | string | null;
  unit?: string | null;
  checked: boolean;
  sortOrder: number;
  recipeId?: string | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  type: ListType;
  icon?: string | null;
  items: ListItem[];
  _count?: { items: number };
  createdAt: string;
}

export interface CreateListData {
  name: string;
  type?: ListType;
  icon?: string;
}

export const LIST_TYPE_LABEL: Record<ListType, string> = {
  SHOPPING: 'Einkaufsliste',
  PACKING: 'Packliste',
  CHECKLIST: 'Checkliste',
  WISHLIST: 'Wunschliste',
  GENERIC: 'Liste',
};

export const LIST_TYPE_ICON: Record<ListType, string> = {
  SHOPPING: '🛒',
  PACKING: '🧳',
  CHECKLIST: '✅',
  WISHLIST: '🎁',
  GENERIC: '📋',
};
