# Workflow Hierarchy - Visual Example

## Simple 3-Person Hierarchy

```
    CEO
     |
  Manager
     |
  Employee
```

## What Gets Stored in Database

### Table: workflow_hierarchy

| Row | Department | Ancestor | Descendant | Depth | Explanation |
|-----|-----------|----------|------------|-------|-------------|
| 1   | sale      | CEO      | CEO        | 0     | CEO manages self |
| 2   | sale      | Manager  | Manager    | 0     | Manager manages self |
| 3   | sale      | Employee | Employee   | 0     | Employee manages self |
| 4   | sale      | CEO      | Manager    | 1     | CEO → Manager (direct) |
| 5   | sale      | Manager  | Employee   | 1     | Manager → Employee (direct) |
| 6   | sale      | CEO      | Employee   | 2     | CEO → Employee (indirect through Manager) |

**Total: 6 rows for 3 people**

---

## Complex Example: Sales Department

```
                    Alice (CEO)
                    /         \
                   /           \
              Bob (Manager)   Eve (Manager)
              /        \           |
             /          \          |
      Charlie (Sales)  Diana (Sales)  Frank (Sales)
```

## Step-by-Step Data Creation

### Step 1: Add Alice → Bob

```sql
INSERT: Alice → Alice (depth 0)
INSERT: Bob → Bob (depth 0)
INSERT: Alice → Bob (depth 1)
```

**Current State:**
| Ancestor | Descendant | Depth |
|----------|------------|-------|
| Alice    | Alice      | 0     |
| Bob      | Bob        | 0     |
| Alice    | Bob        | 1     | ← Direct relationship

---

### Step 2: Add Alice → Eve

```sql
INSERT: Eve → Eve (depth 0)
INSERT: Alice → Eve (depth 1)
```

**Current State:**
| Ancestor | Descendant | Depth |
|----------|------------|-------|
| Alice    | Alice      | 0     |
| Bob      | Bob        | 0     |
| Eve      | Eve        | 0     |
| Alice    | Bob        | 1     |
| Alice    | Eve        | 1     | ← New direct relationship

---

### Step 3: Add Bob → Charlie

```sql
INSERT: Charlie → Charlie (depth 0)
INSERT: Bob → Charlie (depth 1)
INSERT: Alice → Charlie (depth 2)  ← AUTOMATIC!
```

**Current State:**
| Ancestor | Descendant | Depth | Type |
|----------|------------|-------|------|
| Alice    | Alice      | 0     | Self |
| Bob      | Bob        | 0     | Self |
| Eve      | Eve        | 0     | Self |
| Charlie  | Charlie    | 0     | Self |
| Alice    | Bob        | 1     | Direct |
| Alice    | Eve        | 1     | Direct |
| Bob      | Charlie    | 1     | Direct |
| Alice    | Charlie    | 2     | **Indirect (Auto-created!)** |

**Why Alice → Charlie was auto-created:**
- Alice manages Bob (depth 1)
- Bob manages Charlie (depth 1)
- Therefore: Alice manages Charlie (depth 1 + 1 = 2)

---

### Step 4: Add Bob → Diana

```sql
INSERT: Diana → Diana (depth 0)
INSERT: Bob → Diana (depth 1)
INSERT: Alice → Diana (depth 2)  ← AUTOMATIC!
```

**Current State:**
| Ancestor | Descendant | Depth |
|----------|------------|-------|
| Alice    | Alice      | 0     |
| Bob      | Bob        | 0     |
| Eve      | Eve        | 0     |
| Charlie  | Charlie    | 0     |
| Diana    | Diana      | 0     |
| Alice    | Bob        | 1     |
| Alice    | Eve        | 1     |
| Bob      | Charlie    | 1     |
| Bob      | Diana      | 1     |
| Alice    | Charlie    | 2     |
| Alice    | Diana      | 2     | ← Auto-created |

---

### Step 5: Add Eve → Frank

```sql
INSERT: Frank → Frank (depth 0)
INSERT: Eve → Frank (depth 1)
INSERT: Alice → Frank (depth 2)  ← AUTOMATIC!
```

**Final State:**
| Ancestor | Descendant | Depth | Relationship |
|----------|------------|-------|--------------|
| Alice    | Alice      | 0     | Self |
| Bob      | Bob        | 0     | Self |
| Eve      | Eve        | 0     | Self |
| Charlie  | Charlie    | 0     | Self |
| Diana    | Diana      | 0     | Self |
| Frank    | Frank      | 0     | Self |
| Alice    | Bob        | 1     | Alice's direct report |
| Alice    | Eve        | 1     | Alice's direct report |
| Bob      | Charlie    | 1     | Bob's direct report |
| Bob      | Diana      | 1     | Bob's direct report |
| Eve      | Frank      | 1     | Eve's direct report |
| Alice    | Charlie    | 2     | Alice's indirect report (via Bob) |
| Alice    | Diana      | 2     | Alice's indirect report (via Bob) |
| Alice    | Frank      | 2     | Alice's indirect report (via Eve) |

**Total: 14 rows for 6 people**

---

## Query Examples with Results

### 1. Get Alice's Direct Reports (depth = 1)
```sql
SELECT descendant_id 
FROM workflow_hierarchy 
WHERE ancestor_id = 'Alice' AND depth = 1;
```
**Result:**
- Bob
- Eve

---

### 2. Get ALL of Alice's Reports (depth > 0)
```sql
SELECT descendant_id, depth 
FROM workflow_hierarchy 
WHERE ancestor_id = 'Alice' AND depth > 0
ORDER BY depth;
```
**Result:**
| Descendant | Depth | Level |
|------------|-------|-------|
| Bob        | 1     | Direct |
| Eve        | 1     | Direct |
| Charlie    | 2     | Indirect |
| Diana      | 2     | Indirect |
| Frank      | 2     | Indirect |

---

### 3. Get Charlie's Managers (depth > 0)
```sql
SELECT ancestor_id, depth 
FROM workflow_hierarchy 
WHERE descendant_id = 'Charlie' AND depth > 0
ORDER BY depth;
```
**Result:**
| Ancestor | Depth | Level |
|----------|-------|-------|
| Bob      | 1     | Direct Manager |
| Alice    | 2     | Manager's Manager |

---

### 4. Get Bob's Team (direct reports only)
```sql
SELECT descendant_id 
FROM workflow_hierarchy 
WHERE ancestor_id = 'Bob' AND depth = 1;
```
**Result:**
- Charlie
- Diana

---

## What Happens with Duplicates?

### Scenario: Call `addSingleRelation("sale", "Bob", "Charlie")` TWICE

#### Without Protection (OLD CODE):
```
First Call:
✓ Bob → Charlie (depth 1)
✓ Alice → Charlie (depth 2)

Second Call:
✗ Bob → Charlie (depth 1)  ← DUPLICATE!
✗ Alice → Charlie (depth 2) ← DUPLICATE!

Result: 4 rows instead of 2!
```

#### With Protection (NEW CODE):
```
First Call:
✓ Bob → Charlie (depth 1)
✓ Alice → Charlie (depth 2)

Second Call:
✓ Check: Bob → Charlie exists? YES
✓ Return: { skipped: true }
✓ No insert performed

Result: 2 rows (correct!)
```

---

## Bulk Insert Example

### Request:
```json
POST /workflow/bulk
{
  "department": "sale",
  "relations": [
    { "manager": "Alice", "subordinate": "Bob" },
    { "manager": "Alice", "subordinate": "Bob" },    // DUPLICATE
    { "manager": "Bob", "subordinate": "Charlie" },
    { "manager": "Bob", "subordinate": "Diana" }
  ]
}
```

### Response (NEW CODE):
```json
{
  "status": "success",
  "data": {
    "message": "Bulk workflow saved. Added: 3, Skipped: 1, Errors: 0",
    "details": {
      "added": 3,
      "skipped": 1,
      "errors": []
    }
  }
}
```

The duplicate `Alice → Bob` was automatically detected and skipped!

---

## Storage Growth Pattern

| People | Direct Relations | Total Rows (Approx) |
|--------|------------------|---------------------|
| 10     | 9                | ~30                 |
| 50     | 49               | ~150                |
| 100    | 99               | ~300                |
| 500    | 499              | ~1,500              |
| 1,000  | 999              | ~3,000              |

**Formula:** Approximately `N × (average_depth + 1)` rows

Where:
- N = number of people
- average_depth = typical hierarchy depth (usually 3-5)

---

## Key Takeaways

1. **Every person has a self-reference** (depth 0)
2. **Direct relationships** are stored explicitly (depth 1)
3. **Indirect relationships** are calculated and stored automatically (depth 2+)
4. **Queries are fast** because all paths are pre-computed
5. **Duplicates are prevented** at multiple levels:
   - Input deduplication in `addBulkRelations`
   - Existence check in `addSingleRelation`
   - `.orIgnore()` on database inserts
   - Unique constraint (after cleanup)

This pattern trades storage space for query speed - perfect for organizational hierarchies!
