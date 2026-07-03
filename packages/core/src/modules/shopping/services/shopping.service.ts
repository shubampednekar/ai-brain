import { EVENT_TYPES } from '../../../events/index.js';
import type { ServiceContext } from '../../../shared/types.js';

const SHOPPING_PROMPT = `Extract shopping list items from the text. Respond with JSON only:
{
  "list_name": "<optional list name, e.g. Grocery>",
  "items": [
    { "title": "<item name>", "quantity": "<optional quantity>", "store": "<optional store>" }
  ]
}`;

export interface ShoppingItemRow {
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

export class ShoppingService {
  constructor(private readonly ctx: ServiceContext) {}

  async extractFromMemory(memoryId: string, text: string, userId: string): Promise<void> {
    const result = await this.ctx.ai.chat({
      messages: [
        { role: 'system', content: SHOPPING_PROMPT },
        { role: 'user', content: text },
      ],
      jsonMode: true,
      temperature: 0.1,
    });

    let parsed: {
      list_name?: string;
      items: Array<{ title: string; quantity?: string; store?: string }>;
    };

    try {
      parsed = JSON.parse(result.content) as typeof parsed;
    } catch {
      return;
    }

    if (!parsed.items?.length) return;

    const list = await this.getOrCreateActiveList(userId, parsed.list_name ?? 'Shopping list', memoryId);

    const rows = parsed.items.map((item) => ({
      list_id: list.id,
      memory_id: memoryId,
      title: item.title,
      quantity: item.quantity ?? null,
      store: item.store ?? null,
    }));

    const { error } = await this.ctx.supabase.from('shopping_items').insert(rows);
    if (error) throw new Error(`Failed to create shopping items: ${error.message}`);

    await this.ctx.eventBus.publish({
      type: EVENT_TYPES.SHOPPING_EXTRACTED,
      aggregateType: 'shopping',
      aggregateId: list.id,
      userId,
      payload: { listId: list.id, memoryId, itemCount: rows.length },
    });
  }

  async listItems(userId: string): Promise<ShoppingItemRow[]> {
    const { data: lists, error: listError } = await this.ctx.supabase
      .from('shopping_lists')
      .select('id, name')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (listError) throw new Error(`Failed to list shopping lists: ${listError.message}`);
    if (!lists?.length) return [];

    const listIds = lists.map((l) => l.id);
    const listNameMap = new Map(lists.map((l) => [l.id, l.name]));

    const { data: items, error } = await this.ctx.supabase
      .from('shopping_items')
      .select('id, list_id, memory_id, title, quantity, store, is_purchased, created_at')
      .in('list_id', listIds)
      .order('is_purchased', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to list shopping items: ${error.message}`);

    return (items ?? []).map((row) => ({
      id: row.id,
      listId: row.list_id,
      listName: listNameMap.get(row.list_id) ?? 'Shopping list',
      memoryId: row.memory_id,
      title: row.title,
      quantity: row.quantity,
      store: row.store,
      isPurchased: row.is_purchased,
      createdAt: row.created_at,
    }));
  }

  async updateItem(
    itemId: string,
    userId: string,
    updates: { isPurchased?: boolean },
  ): Promise<ShoppingItemRow> {
    const item = await this.getItemForUser(itemId, userId);

    const { data, error } = await this.ctx.supabase
      .from('shopping_items')
      .update({
        is_purchased: updates.isPurchased ?? item.is_purchased,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select('id, list_id, memory_id, title, quantity, store, is_purchased, created_at')
      .single();

    if (error) throw new Error(`Failed to update shopping item: ${error.message}`);

    const { data: list } = await this.ctx.supabase
      .from('shopping_lists')
      .select('name')
      .eq('id', data.list_id)
      .single();

    return {
      id: data.id,
      listId: data.list_id,
      listName: list?.name ?? 'Shopping list',
      memoryId: data.memory_id,
      title: data.title,
      quantity: data.quantity,
      store: data.store,
      isPurchased: data.is_purchased,
      createdAt: data.created_at,
    };
  }

  async deleteItem(itemId: string, userId: string): Promise<void> {
    await this.getItemForUser(itemId, userId);

    const { error } = await this.ctx.supabase.from('shopping_items').delete().eq('id', itemId);
    if (error) throw new Error(`Failed to delete shopping item: ${error.message}`);
  }

  private async getOrCreateActiveList(
    userId: string,
    name: string,
    memoryId?: string,
  ): Promise<{ id: string; name: string }> {
    const { data: existing } = await this.ctx.supabase
      .from('shopping_lists')
      .select('id, name')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing;

    const { data, error } = await this.ctx.supabase
      .from('shopping_lists')
      .insert({
        user_id: userId,
        name,
        memory_id: memoryId,
      })
      .select('id, name')
      .single();

    if (error) throw new Error(`Failed to create shopping list: ${error.message}`);
    return data;
  }

  private async getItemForUser(itemId: string, userId: string) {
    const { data: item, error } = await this.ctx.supabase
      .from('shopping_items')
      .select('id, list_id, is_purchased')
      .eq('id', itemId)
      .single();

    if (error || !item) throw new Error('Shopping item not found');

    const { data: list } = await this.ctx.supabase
      .from('shopping_lists')
      .select('user_id')
      .eq('id', item.list_id)
      .single();

    if (!list || list.user_id !== userId) throw new Error('Not authorized to update this item');

    return item;
  }
}
