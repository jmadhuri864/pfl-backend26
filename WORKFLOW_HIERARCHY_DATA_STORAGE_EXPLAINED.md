# Workflow Hierarchy Data Storage - Closure Table Pattern

## Overview

The workflow hierarchy uses a **Closure Table** pattern to store organizational hierarchies. This pattern stores ALL ancestor-descendant relationships, not just direct parent-child relationships.

## Database Schema

```typescript
@Entity("workflow_hierarchy")
export class WorkflowHierarchy {
  id: string;                    // Primary key
  department: DepartmentEnum;    // Which department (purchase, sale, etc.)
  ancestor: User;                // The manager/ancestor
  descendant: User;              // The subordinate/descendant
  depth: number;                 // Distance between ancestor and descendant
  createdAt: Date;
  updatedAt: Date;
}
```

## How Data is Stored

### Example Hierarchy:
```
CEO (Alice)
├── Manager1 (Bob)
│   ├── Employee1 (Charlie)
│   └── Employee2 (Diana)
└── Manager2 (Eve)
    └── Employee3 (Frank)
```

### Database Records Created:

| id | department | ancestor_id | descendant_id | depth | Meaning |
|----|-----------|-------------|---------------|-------|---------|
| 1  | sale | Alice | Alice | 0 | Alice manages herself (self-reference) |
| 2  | sale | Bob | Bob | 0 | Bob manages himself |
| 3  | sale | Charlie | Charlie | 0 | Charlie manages himself |
| 4  | sale | Diana | Diana | 0 | Diana manages herself |
| 5  | sale | Eve | Eve | 0 | Eve manages herself |
| 6  | sale | Frank | Frank | 0 | Frank manages himself |
| 7  | sale | Alice | Bob | 1 | Alice directly manages Bob |
| 8  | sale | Alice | Eve | 1 | Alice directly manages Eve |
| 9  | sale | Bob | Charlie | 1 | Bob directly manages Charlie |
| 10 | sale | Bob | Diana | 1 | Bob directly manages Diana |
| 11 | sale | Eve | Frank | 1 | Eve directly manages Frank |
| 12 | sale | Alice | Charlie | 2 | Alice indirectly manages Charlie (through Bob) |
| 13 | sale | Alice | Diana | 2 | Alice indirectly manages Diana (through Bob) |
| 14 | sale | Alice | Frank | 2 | Alice indirectly manages Frank (through Eve) |

**Total Records: 14 rows** for 6 people

## Depth Levels Explained

- **depth = 0**: Self-reference (every person has one)
- **depth = 1**: Direct relationship (immediate manager-subordinate)
- **depth = 2**: Indirect relationship (grandparent-grandchild)
- **depth = 3+**: Further indirect relationships

## How `addSingleRelation` Works

When you call: `addSingleRelation("sale", "Bob", "Charlie")`

### Step 1: Insert Self-References (if not exist)
```sql
INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
VALUES ('sale', 'Bob', 'Bob', 0)
ON CONFLICT DO NOTHING;

INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
VALUES ('sale', 'Charlie', 'Charlie', 0)
ON CONFLICT DO NOTHING;
```

### Step 2: Insert Direct Relation
```sql
INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
VALUES ('sale', 'Bob', 'Charlie', 1)
ON CONFLICT DO NOTHING;
```

### Step 3: Insert Indirect Relations (Closure Table Magic!)
```sql
-- This connects ALL ancestors of Bob to ALL descendants of Charlie
INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
SELECT 
  'sale',
  super_anc.ancestor_id,      -- All Bob's ancestors (Alice, Bob)
  super_desc.descendant_id,   -- All Charlie's descendants (Charlie)
  super_anc.depth + super_desc.depth + 1
FROM workflow_hierarchy AS super_anc
CROSS JOIN workflow_hierarchy AS super_desc
WHERE super_anc.descendant_id = 'Bob'
  AND super_desc.ancestor_id = 'Charlie'
  AND super_anc.department = 'sale'
  AND super_desc.department = 'sale'
ON CONFLICT DO NOTHING;
```

This automatically creates:
- Alice → Charlie (depth = 2) because Alice → Bob (depth = 1) + Bob → Charlie (depth = 1)

## Real Example: Adding Relations Step by Step

### Initial State: Empty Table

### Add: Alice → Bob
```
Records created:
1. Alice → Alice (depth 0) [self]
2. Bob → Bob (depth 0) [self]
3. Alice → Bob (depth 1) [direct]
```

### Add: Bob → Charlie
```
Records created:
4. Charlie → Charlie (depth 0) [self]
5. Bob → Charlie (depth 1) [direct]
6. Alice → Charlie (depth 2) [indirect, auto-created!]
```

The magic is in step 6! The system automatically knows:
- Alice manages Bob (depth 1)
- Bob manages Charlie (depth 1)
- Therefore: Alice manages Charlie (depth 2)

### Add: Bob → Diana
```
Records created:
7. Diana → Diana (depth 0) [self]
8. Bob → Diana (depth 1) [direct]
9. Alice → Diana (depth 2) [indirect, auto-created!]
```

## Query Examples

### Get All Direct Subordinates of Bob:
```sql
SELECT descendant_id
FROM workflow_hierarchy
WHERE ancestor_id = 'Bob'
  AND department = 'sale'
  AND depth = 1;
```
Result: Charlie, Diana

### Get ALL Subordinates of Alice (direct + indirect):
```sql
SELECT descendant_id, depth
FROM workflow_hierarchy
WHERE ancestor_id = 'Alice'
  AND department = 'sale'
  AND depth > 0
ORDER BY depth;
```
Result:
- Bob (depth 1)
- Eve (depth 1)
- Charlie (depth 2)
- Diana (depth 2)
- Frank (depth 2)

### Get All Managers of Charlie:
```sql
SELECT ancestor_id, depth
FROM workflow_hierarchy
WHERE descendant_id = 'Charlie'
  AND department = 'sale'
  AND depth > 0
ORDER BY depth;
```
Result:
- Bob (depth 1) - Direct manager
- Alice (depth 2) - Manager's manager

## Advantages of Closure Table

✅ **Fast Queries**: Get entire subtree in one query (no recursion)
✅ **Fast Hierarchy**: Get all ancestors/descendants instantly
✅ **Referential Integrity**: Easy to maintain with foreign keys
✅ **Flexible**: Can represent any tree structure

## Disadvantages

❌ **Storage**: Uses more space (stores all relationships)
❌ **Inserts**: More complex (need to update all paths)
❌ **Updates**: Moving nodes requires recalculating paths

## Storage Calculation

For a tree with **N nodes** and **average depth D**:
- **Minimum records**: N (just self-references)
- **Maximum records**: N² (if everyone reports to everyone)
- **Typical records**: N × (D + 1) approximately

Example:
- 100 employees
- Average depth of 4 levels
- Estimated records: 100 × 5 = **500 records**

## Why Duplicates Were Created

### Problem Scenario:
If you call `addSingleRelation("sale", "Bob", "Charlie")` twice:

**Without protection:**
```
First call creates:
- Bob → Charlie (depth 1)
- Alice → Charlie (depth 2)

Second call tries to create:
- Bob → Charlie (depth 1) ❌ DUPLICATE!
- Alice → Charlie (depth 2) ❌ DUPLICATE!
```

**With our fixes:**
```
First call creates:
- Bob → Charlie (depth 1)
- Alice → Charlie (depth 2)

Second call:
- Checks if Bob → Charlie exists ✅
- Returns { skipped: true } ✅
- No duplicates created! ✅
```

## Bulk Insert Example

```javascript
POST /workflow/bulk
{
  "department": "sale",
  "relations": [
    { "manager": "Alice", "subordinate": "Bob" },
    { "manager": "Alice", "subordinate": "Eve" },
    { "manager": "Bob", "subordinate": "Charlie" },
    { "manager": "Bob", "subordinate": "Diana" },
    { "manager": "Eve", "subordinate": "Frank" }
  ]
}
```

This creates the full hierarchy with all direct and indirect relationships automatically!

## Visual Representation

```
Depth 0 (Self):        Depth 1 (Direct):       Depth 2 (Indirect):
Alice → Alice          Alice → Bob             Alice → Charlie
Bob → Bob              Alice → Eve             Alice → Diana
Charlie → Charlie      Bob → Charlie           Alice → Frank
Diana → Diana          Bob → Diana
Eve → Eve              Eve → Frank
Frank → Frank
```

## Summary

The Closure Table pattern stores:
1. **Self-references** (depth 0) for every person
2. **Direct relationships** (depth 1) for immediate manager-subordinate
3. **All indirect relationships** (depth 2+) automatically calculated

This makes queries extremely fast but requires careful handling of inserts to avoid duplicates!
