---
name: mission-control-ui
description: Skill for using the standardized UI components in Mission Control dashboard. Use these components instead of duplicating patterns.
---

# Mission Control UI Component Library

> Skill for using the standardized UI components in Mission Control dashboard.

## Overview

The `@/components/ui-lib` directory contains reusable React components for building consistent dashboard views. **Always use these components instead of duplicating patterns.**

## Location

```
packages/mission-control/src/components/ui-lib/
├── index.ts           # Exports all components
├── page-header.tsx    # Title + description + badges
├── stat-card.tsx      # Single stat with icon
├── stat-grid.tsx      # Grid of stat cards
├── category-nav.tsx   # Category navigation sidebar
├── item-list.tsx      # Scrollable list with items
├── search-bar.tsx     # Search input with button
├── empty-state.tsx    # Empty data placeholder
├── timestamp.tsx      # Formatted timestamp
├── badge-list.tsx     # List of badges
├── loading-state.tsx  # Loading spinner
└── content-card.tsx   # Card with title and icon
```

## Usage Examples

### PageHeader

```tsx
import { PageHeader } from "@/components/ui-lib";

<PageHeader
  title="Perennial Memory"
  description="Long-term semantic storage"
  badges={[
    { label: "memories", value: 42 },
    { label: "size", value: "1.2 MB" }
  ]}
/>
```

### StatGrid

```tsx
import { StatGrid } from "@/components/ui-lib";
import { Cpu, MemoryStick, Thermometer } from "lucide-react";

<StatGrid
  columns={3}
  stats={[
    { label: "CPU", value: "45%", icon: Cpu, iconColor: "text-green-400" },
    { label: "Memory", value: "6.2 GB", icon: MemoryStick },
    { label: "Temp", value: "52°C", icon: Thermometer },
  ]}
/>
```

### CategoryNav

```tsx
import { CategoryNav } from "@/components/ui-lib";
import { Folder } from "lucide-react";

<CategoryNav
  title="Categories"
  icon={Folder}
  categories={[
    { name: "learning", count: 25 },
    { name: "decision", count: 6 },
  ]}
  selected={selectedCategory}
  onSelect={setSelectedCategory}
  allLabel="Recent"
  allCount={42}
/>
```

### ItemList

```tsx
import { ItemList } from "@/components/ui-lib";
import { Database } from "lucide-react";
import { Timestamp, BadgeList } from "@/components/ui-lib";

<ItemList
  title="Recent Memories"
  icon={Database}
  badge={42}
  items={memories}
  maxHeight="h-[500px]"
  onSelect={(mem) => console.log(mem)}
  renderItem={(mem) => (
    <div>
      <Timestamp timestamp={mem.timestamp} />
      <p className="text-sm line-clamp-3">{mem.content}</p>
      <BadgeList items={mem.tags} max={3} />
    </div>
  )}
/>
```

### SearchBar

```tsx
import { SearchBar } from "@/components/ui-lib";

<SearchBar
  placeholder="Search memories..."
  onSearch={(query) => performSearch(query)}
/>
```

### Timestamp

```tsx
import { Timestamp } from "@/components/ui-lib";

<Timestamp timestamp="2026-03-17T02:32:34.465Z" />
<Timestamp timestamp={new Date()} format="relative" />
<Timestamp timestamp={null} />  {/* Shows "Invalid date" */}
```

### BadgeList

```tsx
import { BadgeList } from "@/components/ui-lib";

<BadgeList
  items={["success", "api", "auth"]}
  colorMap={{ error: "bg-red-500/20 text-red-400" }}
  max={3}
/>
```

### EmptyState

```tsx
import { EmptyState } from "@/components/ui-lib";
import { Inbox } from "lucide-react";

<EmptyState
  icon={Inbox}
  title="No memories found"
  description="Try adjusting your search query"
/>
```

### LoadingState

```tsx
import { LoadingState } from "@/components/ui-lib";

<LoadingState message="Loading memories..." />
```

### ContentCard

```tsx
import { ContentCard } from "@/components/ui-lib";
import { Settings } from "lucide-react";

<ContentCard
  title="Alert Rules"
  icon={Settings}
  badge={rules.length}
>
  {/* Card content */}
</ContentCard>
```

## DRY Principles

1. **Always import from `@/components/ui-lib`** - Never copy component logic
2. **Use Timestamp for dates** - Handles invalid dates gracefully
3. **Use CategoryNav for filtering** - Consistent styling across views
4. **Use StatGrid for metrics** - Responsive grid with icons
5. **Use EmptyState for empty data** - Consistent placeholder UI

## Component Props Reference

| Component | Key Props | Purpose |
|-----------|-----------|---------|
| PageHeader | title, description, badges | Page title section |
| StatCard | label, value, icon | Single metric card |
| StatGrid | stats[], columns | Grid of metrics |
| CategoryNav | categories[], selected, onSelect | Category sidebar |
| ItemList | items[], renderItem | Scrollable list |
| SearchBar | placeholder, onSearch | Search input |
| EmptyState | title, description, action | No data placeholder |
| Timestamp | timestamp, format | Date formatting |
| BadgeList | items[], max, colorMap | Tag badges |
| LoadingState | message | Loading spinner |
| ContentCard | title, icon, children | Card container |

## When to Create New Components

Create new components ONLY when:
- A UI pattern is used in 3+ views
- The pattern has consistent styling needs
- It encapsulates complex logic

Add new components to `ui-lib/index.ts` exports.