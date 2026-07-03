import { Check, Loader2, ShoppingCart, Trash2 } from 'lucide-react';
import { useShopping } from '../hooks/useShopping';
import { PageLayout } from '@/shared/components/layout/PageLayout';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

export function ShoppingPanel() {
  const { items, loading, error, togglePurchased, removeItem } = useShopping();

  const pending = items.filter((i) => !i.isPurchased);
  const purchased = items.filter((i) => i.isPurchased);

  return (
    <PageLayout
      title="Shopping list"
      description="Items extracted from your shopping captures. Check them off as you buy."
      sidebarTitle="How it works"
      sidebar={
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Auto-extracted
            </CardTitle>
            <CardDescription className="text-xs">
              Shopping items are parsed from natural language captures.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Try: &ldquo;Buy milk, eggs, and bread&rdquo;</p>
            <p>Try: &ldquo;Need a PS4 controller from Amazon&rdquo;</p>
          </CardContent>
        </Card>
      }
    >
      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 mb-4">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium">No shopping items yet</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Capture something like &ldquo;Buy groceries: milk, eggs, bread&rdquo; on the Capture tab.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 ? (
            <ItemSection
              title={`To buy (${pending.length})`}
              items={pending}
              onToggle={togglePurchased}
              onRemove={removeItem}
            />
          ) : null}
          {purchased.length > 0 ? (
            <ItemSection
              title={`Purchased (${purchased.length})`}
              items={purchased}
              onToggle={togglePurchased}
              onRemove={removeItem}
            />
          ) : null}
        </div>
      )}
    </PageLayout>
  );
}

function ItemSection({
  title,
  items,
  onToggle,
  onRemove,
}: {
  title: string;
  items: ReturnType<typeof useShopping>['items'];
  onToggle: (id: string, purchased: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  return (
    <section>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 px-1">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Button
                    type="button"
                    variant={item.isPurchased ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void onToggle(item.id, !item.isPurchased)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className={`font-medium text-sm ${item.isPurchased ? 'line-through text-muted-foreground' : ''}`}>
                      {item.title}
                      {item.quantity ? ` (${item.quantity})` : ''}
                    </p>
                    {item.store ? (
                      <p className="text-xs text-muted-foreground mt-1">{item.store}</p>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => void onRemove(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
