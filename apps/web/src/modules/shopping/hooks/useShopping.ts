import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/shared/lib/api';

export interface ShoppingItem {
  id: string;
  listId: string;
  listName: string;
  memoryId: string | null;
  title: string;
  quantity: string | null;
  store: string | null;
  isPurchased: boolean;
  createdAt: string;
}

export function useShopping() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items: data } = await apiJson<{ items: ShoppingItem[] }>('/shopping/items');
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const togglePurchased = async (itemId: string, isPurchased: boolean) => {
    const { item } = await apiJson<{ item: ShoppingItem }>(`/shopping/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPurchased }),
    });
    setItems((prev) => prev.map((i) => (i.id === itemId ? item : i)));
  };

  const removeItem = async (itemId: string) => {
    await apiJson(`/shopping/items/${itemId}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  return { items, loading, error, refetch: fetchItems, togglePurchased, removeItem };
}
