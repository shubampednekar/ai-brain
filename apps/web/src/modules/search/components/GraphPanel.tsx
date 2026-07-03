import { useEffect, useRef, useState } from 'react';
import { Brain, Filter, Info, Loader2, RotateCcw, Users, ZoomIn, ZoomOut } from 'lucide-react';
import { apiJson } from '@/shared/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

interface MemoryNodeData {
  id: string;
  original_text: string;
  summary: string | null;
  intent_slug: string | null;
  created_at: string;
  user_id: string;
}

interface RelationshipData {
  source_memory_id: string;
  target_memory_id: string;
  relationship_type: string;
  confidence: number;
}

interface EntityData {
  memory_id: string;
  entity_type: string;
  entity_value: string;
  normalized_value: string | null;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'memory' | 'entity';
  category: string; // intent_slug or entity_type
  originalData?: any;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  color: string;
}

interface Workspace {
  id: string;
  name: string;
  role: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  // Intents
  memory: '#14b8a6', // teal
  task: '#22c55e', // green
  reminder: '#3b82f6', // blue
  decision: '#a855f7', // purple
  approval: '#ec4899', // pink
  requirement: '#eab308', // yellow
  idea: '#f97316', // orange
  preference: '#6366f1', // indigo
  // Entities
  person: '#f43f5e', // rose
  topic: '#06b6d4', // cyan
  project: '#84cc16', // lime
  organization: '#8b5cf6', // violet
  location: '#f59e0b', // amber
};

export function GraphPanel() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('personal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [showMemories, setShowMemories] = useState(true);
  const [showEntities, setShowEntities] = useState(true);
  const [selectedIntents, setSelectedIntents] = useState<Record<string, boolean>>({
    memory: true,
    task: true,
    reminder: true,
    decision: true,
    approval: true,
    requirement: true,
    idea: true,
    preference: true,
  });
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Record<string, boolean>>({
    person: true,
    topic: true,
    project: true,
    organization: true,
    location: true,
  });

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);

  // Viewport states
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isDraggingCanvas = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const draggedNodeId = useRef<string | null>(null);

  const isNodeVisible = (node: GraphNode) => {
    if (node.type === 'memory') {
      return showMemories && selectedIntents[node.category];
    }
    return showEntities && Boolean(selectedEntityTypes[node.category]);
  };

  const getVisibleNodes = () => nodesRef.current.filter(isNodeVisible);

  // Load workspaces
  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<{ workspaces: Workspace[] }>('/workspaces');
        setWorkspaces(data.workspaces ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Fetch graph data
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError(null);
      setSelectedNode(null);
      try {
        const url = selectedWorkspace === 'personal' ? '/graph' : `/workspaces/${selectedWorkspace}/graph`;
        const data = await apiJson<{
          memories: MemoryNodeData[];
          relationships: RelationshipData[];
          entities: EntityData[];
        }>(url);

        if (!active) return;

        // Build nodes & edges
        const rawMemories = data.memories ?? [];
        const rawRels = data.relationships ?? [];
        const rawEntities = data.entities ?? [];

        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const addedNodeIds = new Set<string>();

        // Add memory nodes
        rawMemories.forEach((mem) => {
          const id = mem.id;
          const label = mem.summary || (mem.original_text.length > 35 ? mem.original_text.slice(0, 32) + '...' : mem.original_text);
          const category = mem.intent_slug || 'memory';

          nodes.push({
            id,
            label,
            type: 'memory',
            category,
            originalData: mem,
            x: Math.random() * 400 - 200,
            y: Math.random() * 400 - 200,
            vx: 0,
            vy: 0,
            radius: 18,
          });
          addedNodeIds.add(id);
        });

        // Add entity nodes & links
        rawEntities.forEach((ent) => {
          const val = ent.normalized_value || ent.entity_value;
          const entId = `ent-${ent.entity_type}-${val}`;

          // Create unique entity node if it doesn't exist
          if (!addedNodeIds.has(entId)) {
            nodes.push({
              id: entId,
              label: ent.entity_value,
              type: 'entity',
              category: ent.entity_type,
              originalData: ent,
              x: Math.random() * 400 - 200,
              y: Math.random() * 400 - 200,
              vx: 0,
              vy: 0,
              radius: 12,
            });
            addedNodeIds.add(entId);
          }

          // Link memory to entity
          if (addedNodeIds.has(ent.memory_id)) {
            edges.push({
              source: ent.memory_id,
              target: entId,
              label: 'contains',
              color: 'rgba(255, 255, 255, 0.15)',
            });
          }
        });

        // Add direct memory-to-memory relationships
        rawRels.forEach((rel) => {
          if (addedNodeIds.has(rel.source_memory_id) && addedNodeIds.has(rel.target_memory_id)) {
            edges.push({
              source: rel.source_memory_id,
              target: rel.target_memory_id,
              label: rel.relationship_type,
              color: 'rgba(99, 102, 241, 0.4)', // indigo line
            });
          }
        });

        nodesRef.current = nodes;
        edgesRef.current = edges;
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to fetch graph data');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedWorkspace]);

  // Physics & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particleOffset = 0;

    const runPhysics = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      const visibleNodes = nodes.filter((n) => {
        if (n.type === 'memory') {
          return showMemories && selectedIntents[n.category];
        }
        return showEntities && Boolean(selectedEntityTypes[n.category]);
      });
      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));

      const visibleEdges = edges.filter(
        (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
      );

      // Simple Force-Directed Graph physics
      const k = 0.08; // Spring constant
      const repulsion = 450; // Coulomb repulsion strength
      const damping = 0.85; // Friction
      const gravity = 0.03; // Pull toward center

      // 1. Repulsion force between node pairs
      for (let i = 0; i < visibleNodes.length; i++) {
        const nodeA = visibleNodes[i];
        if (!nodeA) continue;
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const nodeB = visibleNodes[j];
          if (!nodeB) continue;
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distSq = dx * dx + dy * dy + 1; // avoid divide by zero
          const dist = Math.sqrt(distSq);

          if (dist < 350) {
            const force = repulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (draggedNodeId.current !== nodeA.id) {
              nodeA.vx -= fx;
              nodeA.vy -= fy;
            }
            if (draggedNodeId.current !== nodeB.id) {
              nodeB.vx += fx;
              nodeB.vy += fy;
            }
          }
        }
      }

      // 2. Attraction force along links/edges
      visibleEdges.forEach((edge) => {
        const sourceNode = visibleNodes.find((n) => n.id === edge.source);
        const targetNode = visibleNodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 100) * k; // natural spring length = 100
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (draggedNodeId.current !== sourceNode.id) {
            sourceNode.vx += fx;
            sourceNode.vy += fy;
          }
          if (draggedNodeId.current !== targetNode.id) {
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }
      });

      // 3. Apply gravity (center attraction) & update positions
      visibleNodes.forEach((node) => {
        if (draggedNodeId.current === node.id) return;

        // Gravitational pull to center
        node.vx -= node.x * gravity;
        node.vy -= node.y * gravity;

        // Apply friction
        node.vx *= damping;
        node.vy *= damping;

        // Update positions
        node.x += node.vx;
        node.y += node.vy;
      });

      // Clear canvas (sleek dark themed background)
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Center canvas coordinates and apply Pan / Zoom
      ctx.translate(canvas.width / 2 + panRef.current.x, canvas.height / 2 + panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      // 4. Draw Links
      visibleEdges.forEach((edge) => {
        const sourceNode = visibleNodes.find((n) => n.id === edge.source);
        const targetNode = visibleNodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.strokeStyle = edge.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (edge.label && edge.label !== 'contains') {
            const midX = (sourceNode.x + targetNode.x) / 2;
            const midY = (sourceNode.y + targetNode.y) / 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(edge.label.replace(/_/g, ' '), midX, midY - 6);
          }

          // Animated particle flow along the line representing information transfer!
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const particleCount = 1;

          for (let p = 0; p < particleCount; p++) {
            const progress = ((particleOffset + (p / particleCount) * dist) % dist) / dist;
            const px = sourceNode.x + dx * progress;
            const py = sourceNode.y + dy * progress;

            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = edge.color.includes('indigo') ? '#818cf8' : '#38bdf8';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0; // reset glow
          }
        }
      });
      particleOffset += 0.5;

      // 5. Draw Nodes
      visibleNodes.forEach((node) => {
        const color = CATEGORY_COLORS[node.category] || '#94a3b8';

        // Draw shadow glow around memory nodes
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#171717';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;

        // Custom styling based on focus/select state
        const isSelected = selectedNode && selectedNode.id === node.id;
        if (isSelected) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 15;
          ctx.lineWidth = 4;
        }

        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Draw smaller inner ring for entities
        if (node.type === 'entity') {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius - 4, 0, Math.PI * 2);
          ctx.fillStyle = color + '30'; // semi-transparent
          ctx.fill();
        }

        // Draw labels inside or near nodes
        ctx.fillStyle = '#ffffff';
        ctx.font = node.type === 'memory' ? 'bold 10px sans-serif' : '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Truncate text for inside node or underneath node
        if (node.type === 'memory') {
          // Icon representation or short letters
          const initial = (node.category[0] ?? '?').toUpperCase();
          ctx.fillText(initial, node.x, node.y);

          // Draw label below node
          ctx.fillStyle = '#e5e7eb';
          ctx.font = '10px sans-serif';
          ctx.textBaseline = 'top';
          const maxTextWidth = 80;
          let labelText = node.label;
          if (ctx.measureText(labelText).width > maxTextWidth) {
            labelText = labelText.slice(0, 10) + '...';
          }
          ctx.fillText(labelText, node.x, node.y + node.radius + 4);
        } else {
          // Entity name underneath
          ctx.fillStyle = '#9ca3af';
          ctx.font = '10px sans-serif';
          ctx.textBaseline = 'top';
          ctx.fillText(node.label, node.x, node.y + node.radius + 4);
        }
      });

      ctx.restore();
      animationId = requestAnimationFrame(runPhysics);
    };

    runPhysics();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [showMemories, showEntities, selectedIntents, selectedEntityTypes, selectedNode]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = rect?.width ?? 800;
      canvas.height = 480;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [loading]);

  // Convert mouse coords to Graph coords (accounting for Pan & Zoom)
  const getGraphCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - canvas.width / 2 - panRef.current.x;
    const y = clientY - rect.top - canvas.height / 2 - panRef.current.y;
    return { x: x / zoomRef.current, y: y / zoomRef.current };
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getGraphCoordinates(e.clientX, e.clientY);

    const visibleNodes = getVisibleNodes();
    let clickedNode: GraphNode | null = null;
    for (const node of visibleNodes) {
      const dx = coords.x - node.x;
      const dy = coords.y - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= node.radius + 5) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      draggedNodeId.current = clickedNode.id;
      setSelectedNode(clickedNode);
    } else {
      isDraggingCanvas.current = true;
      dragStartPos.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeId.current) {
      const coords = getGraphCoordinates(e.clientX, e.clientY);
      const node = nodesRef.current.find((n) => n.id === draggedNodeId.current);
      if (node) {
        node.x = coords.x;
        node.y = coords.y;
        node.vx = 0;
        node.vy = 0;
      }
    } else if (isDraggingCanvas.current) {
      panRef.current = {
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      };
    }
  };

  const handleMouseUp = () => {
    draggedNodeId.current = null;
    isDraggingCanvas.current = false;
  };

  const handleZoom = (amount: number) => {
    zoomRef.current = Math.min(Math.max(zoomRef.current + amount, 0.25), 3);
  };

  const handleResetView = () => {
    panRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
  };

  const toggleIntentFilter = (intent: string) => {
    setSelectedIntents((prev) => ({ ...prev, [intent]: !prev[intent] }));
  };

  const toggleEntityFilter = (entityType: string) => {
    setSelectedEntityTypes((prev) => ({ ...prev, [entityType]: !prev[entityType] }));
  };

  // Get links for selected Entity
  const getLinkedMemoriesForEntity = (entityNode: GraphNode) => {
    const edges = edgesRef.current;
    const nodes = nodesRef.current;
    return edges
      .filter((e) => e.target === entityNode.id)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n): n is GraphNode => !!n);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Interactive Knowledge Graph
          </h2>
          <p className="text-sm text-muted-foreground">
            Explore connections between your decisions, tasks, and topics. Click and drag nodes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> Workspace:
          </span>
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none"
            disabled={loading}
          >
            <option value="personal">Personal Brain</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Filter Controls Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </CardTitle>
            <CardDescription className="text-xs">
              Toggle visibility of nodes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            {/* Memory category intent toggles */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  id="memories-toggle"
                  checked={showMemories}
                  onChange={(e) => setShowMemories(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="memories-toggle">Memories / Intents</label>
              </div>
              {showMemories && (
                <div className="ml-5 grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                  {Object.keys(selectedIntents).map((intent) => (
                    <label key={intent} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIntents[intent]}
                        onChange={() => toggleIntentFilter(intent)}
                        className="rounded border-gray-300"
                      />
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[intent] }}
                      />
                      <span className="capitalize">{intent}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Entity category toggles */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  id="entities-toggle"
                  checked={showEntities}
                  onChange={(e) => setShowEntities(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="entities-toggle">Entities</label>
              </div>
              {showEntities && (
                <div className="ml-5 grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                  {Object.keys(selectedEntityTypes).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEntityTypes[type]}
                        onChange={() => toggleEntityFilter(type)}
                        className="rounded border-gray-300"
                      />
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[type] }}
                      />
                      <span className="capitalize">{type}s</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Interactive Canvas Graph */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="relative border rounded-xl overflow-hidden bg-[#0a0a0a] min-h-[480px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : null}

            {error ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-destructive text-sm z-20">
                {error}
              </div>
            ) : null}

            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full h-full block cursor-grab active:cursor-grabbing"
            />

            {/* Canvas Actions Control Bar */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-background/90 p-1.5 rounded-lg border shadow-md">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleZoom(0.15)}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleZoom(-0.15)}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleResetView} title="Reset view">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Node detail inspection panel */}
          {selectedNode ? (
            <Card className="border-primary/20 bg-[#0a0a0a]/50 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[selectedNode.category] }}
                    />
                    <CardTitle className="text-sm font-semibold capitalize">
                      {selectedNode.type === 'memory' ? `${selectedNode.category} Memory` : `${selectedNode.category} Entity`}
                    </CardTitle>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSelectedNode(null)}>
                    Clear Selection
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                {selectedNode.type === 'memory' ? (
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">{selectedNode.originalData.summary ?? 'Memory Detail'}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-lg border">
                      "{selectedNode.originalData.original_text}"
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Created at: {new Date(selectedNode.originalData.created_at).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-semibold text-base text-foreground flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-primary" /> {selectedNode.label}
                    </p>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                        Linked memories
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {getLinkedMemoriesForEntity(selectedNode).map((mem) => (
                          <button
                            key={mem?.id}
                            type="button"
                            onClick={() => setSelectedNode(mem ?? null)}
                            className="w-full p-2 border rounded-md text-xs bg-muted/10 hover:bg-muted/30 transition-colors text-left"
                          >
                            <span className="font-semibold capitalize text-primary text-[10px] block mb-0.5">
                              {mem?.category}
                            </span>
                            {mem?.originalData?.original_text}
                          </button>
                        ))}
                        {getLinkedMemoriesForEntity(selectedNode).length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No active connections.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center gap-2 p-4 border border-dashed rounded-lg justify-center text-xs text-muted-foreground bg-muted/5">
              <Info className="h-4 w-4" /> Click on a node in the graph to inspect its details and connections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
