# Workflow Hierarchy Duplicate Fix Guide

## Problem Identified
The `workflow_hierarchy` table was creating duplicate entries when:
1. `addBulkRelations` was called with duplicate relations in the input
2. The same relation was added multiple times
3. No unique constraint existed at the database level

## Fixes Applied

### 1. Service Layer (`workFlowHierarchy.service.ts`)

#### Enhanced `addSingleRelation`:
- ✅ Added self-assignment prevention
- ✅ Added `.orIgnore()` to direct relation insert
- ✅ Returns `skipped: true` flag when relation already exists

#### Improved `addBulkRelations`:
- ✅ Removes duplicate relations from input array
- ✅ Tracks added, skipped, and error counts
- ✅ Better error handling per relation
- ✅ Returns detailed results

#### New Methods:
- `checkDuplicates(department?)` - Check for existing duplicates
- `cleanDuplicates(department?)` - Remove duplicate entries

### 2. Controller Layer (`WorkflowHierarchy.controller.ts`)

#### New Endpoints:
- `GET /workflow/check-duplicates/:department?` - Check for duplicates
- `DELETE /workflow/clean-duplicates/:department?` - Clean duplicates

### 3. Entity Layer (`workflowClosure.entity.ts`)

- ⚠️ Unique constraint commented out (needs cleanup first)
- TODO: Uncomment after running cleanup

## How to Fix Existing Duplicates

### Option 1: Using API Endpoints (Recommended)

1. **Check for duplicates:**
```bash
GET http://localhost:3000/workflow/check-duplicates
# Or for specific department:
GET http://localhost:3000/workflow/check-duplicates/purchase
```

2. **Clean duplicates:**
```bash
DELETE http://localhost:3000/workflow/clean-duplicates
# Or for specific department:
DELETE http://localhost:3000/workflow/clean-duplicates/purchase
```

### Option 2: Using Script

1. **Run the cleanup script:**
```bash
ts-node src/scripts/cleanDuplicateWorkflowHierarchy.ts
```

### Option 3: Manual SQL

```sql
-- Check duplicates
SELECT 
  department, 
  ancestor_id, 
  descendant_id, 
  depth, 
  COUNT(*) as count
FROM workflow_hierarchy
GROUP BY department, ancestor_id, descendant_id, depth
HAVING COUNT(*) > 1;

-- Remove duplicates (keeps oldest entry)
DELETE FROM workflow_hierarchy
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY department, ancestor_id, descendant_id, depth 
        ORDER BY "createdAt" ASC, id ASC
      ) as row_num
    FROM workflow_hierarchy
  ) t
  WHERE row_num > 1
);
```

## After Cleanup

1. **Uncomment the unique constraint** in `workflowClosure.entity.ts`:
```typescript
@Entity("workflow_hierarchy")
@Unique(["department", "ancestor", "descendant", "depth"])
export class WorkflowHierarchy extends Model {
```

2. **Restart the server** to apply the constraint

## Testing

Test the bulk endpoint with duplicate data:
```json
POST /workflow/bulk
{
  "department": "purchase",
  "relations": [
    { "manager": "user1", "subordinate": "user2" },
    { "manager": "user1", "subordinate": "user2" },  // Duplicate
    { "manager": "user1", "subordinate": "user3" }
  ]
}
```

Expected response:
```json
{
  "status": "success",
  "data": {
    "message": "Bulk workflow saved. Added: 2, Skipped: 1, Errors: 0",
    "details": {
      "added": 2,
      "skipped": 1,
      "errors": []
    }
  }
}
```

## Prevention Layers

Now protected at multiple levels:
1. **Application Level**: Duplicate check + `.orIgnore()` on inserts
2. **Database Level**: Unique constraint (after cleanup)
3. **Input Level**: Deduplication in `addBulkRelations`
4. **Logic Level**: Self-assignment prevention
