# Workflow Hierarchy - Database Schema & SQL Reference

## 📊 Database Table Structure

### Table: `workflow_hierarchy`

```sql
CREATE TABLE workflow_hierarchy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department VARCHAR NOT NULL,  -- Enum: purchase, sale, operations, etc.
  ancestor_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  descendant_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,  -- 0=self, 1=direct, 2+=indirect
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure no duplicate relationships
  UNIQUE(department, ancestor_id, descendant_id)
);

-- Indexes for performance
CREATE INDEX idx_workflow_ancestor ON workflow_hierarchy(ancestor_id, department);
CREATE INDEX idx_workflow_descendant ON workflow_hierarchy(descendant_id, department);
CREATE INDEX idx_workflow_depth ON workflow_hierarchy(depth);
CREATE INDEX idx_workflow_dept ON workflow_hierarchy(department);
```

---

## 🔍 Understanding the Closure Table Pattern

### What Gets Stored

For this hierarchy:
```
Hiren (H)
  └── Sudhanshu (S)
      └── Omkar (O)
```

The table contains:

| ancestor_id | descendant_id | depth | meaning |
|-------------|---------------|-------|---------|
| H | H | 0 | Hiren → Hiren (self) |
| S | S | 0 | Sudhanshu → Sudhanshu (self) |
| O | O | 0 | Omkar → Omkar (self) |
| H | S | 1 | Hiren → Sudhanshu (direct) |
| S | O | 1 | Sudhanshu → Omkar (direct) |
| H | O | 2 | Hiren → Omkar (indirect) ← Automatic! |

---

## 📝 SQL Queries Reference

### 1. Add a Direct Relationship

```sql
-- Step 1: Insert self-references (if not exist)
INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
VALUES ('purchase', 'manager-uuid', 'manager-uuid', 0)
ON CONFLICT DO NOTHING;

INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
VALUES ('purchase', 'subordinate-uuid', 'subordinate-uuid', 0)
ON CONFLICT DO NOTHING;

-- Step 2: Insert direct relationship
INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
VALUES ('purchase', 'manager-uuid', 'subordinate-uuid', 1);

-- Step 3: Insert all indirect relationships (closure table magic!)
INSERT INTO workflow_hierarchy (department, ancestor_id, descendant_id, depth)
SELECT 
  'purchase' AS department,
  super_anc.ancestor_id, 
  super_desc.descendant_id,
  super_anc.depth + super_desc.depth + 1
FROM workflow_hierarchy AS super_anc
CROSS JOIN workflow_hierarchy AS super_desc
WHERE super_anc.descendant_id = 'manager-uuid'
  AND super_desc.ancestor_id = 'subordinate-uuid'
  AND super_anc.department = 'purchase'
  AND super_desc.department = 'purchase'
ON CONFLICT DO NOTHING;
```

**Explanation:**
- `super_anc`: All ancestors of the manager
- `super_desc`: All descendants of the subordinate
- Cross join creates all possible paths
- Depth is sum of both depths + 1

---

### 2. Get All Subordinates (Direct + Indirect)

```sql
SELECT 
  wh.descendant_id AS id,
  CONCAT(u.firstName, ' ', u.lastName) AS name,
  wh.depth,
  CASE 
    WHEN wh.depth = 1 THEN 'Direct' 
    ELSE 'Indirect' 
  END AS relationship_type
FROM workflow_hierarchy wh
JOIN employees u ON wh.descendant_id = u.id
WHERE wh.ancestor_id = 'manager-uuid'
  AND wh.department = 'purchase'
  AND wh.depth > 0  -- Exclude self-reference
ORDER BY wh.depth ASC;
```

---

### 3. Get All Managers (Direct + Indirect)

```sql
SELECT 
  wh.ancestor_id AS id,
  CONCAT(u.firstName, ' ', u.lastName) AS name,
  wh.depth,
  CASE 
    WHEN wh.depth = 1 THEN 'Direct Manager' 
    ELSE 'Higher Management' 
  END AS relationship_type
FROM workflow_hierarchy wh
JOIN employees u ON wh.ancestor_id = u.id
WHERE wh.descendant_id = 'subordinate-uuid'
  AND wh.department = 'purchase'
  AND wh.depth > 0  -- Exclude self-reference
ORDER BY wh.depth ASC;
```

---

### 4. Get Full Department Tree

```sql
SELECT 
  wh.ancestor_id,
  wh.descendant_id,
  wh.depth,
  CONCAT(u1.firstName, ' ', u1.lastName) AS ancestor_name,
  CONCAT(u2.firstName, ' ', u2.lastName) AS descendant_name
FROM workflow_hierarchy wh
JOIN employees u1 ON wh.ancestor_id = u1.id
JOIN employees u2 ON wh.descendant_id = u2.id
WHERE wh.department = 'purchase'
  AND wh.depth > 0  -- Exclude self-references
ORDER BY wh.depth ASC;
```

---

### 5. Check if Person A is Above Person B

```sql
SELECT EXISTS (
  SELECT 1
  FROM workflow_hierarchy
  WHERE ancestor_id = 'person-a-uuid'
    AND descendant_id = 'person-b-uuid'
    AND department = 'purchase'
    AND depth > 0
) AS is_above;
```

Returns `true` if A is above B in the hierarchy.

---

### 6. Get Direct Reports Only

```sql
SELECT 
  wh.descendant_id AS id,
  CONCAT(u.firstName, ' ', u.lastName) AS name
FROM workflow_hierarchy wh
JOIN employees u ON wh.descendant_id = u.id
WHERE wh.ancestor_id = 'manager-uuid'
  AND wh.department = 'purchase'
  AND wh.depth = 1;  -- Only direct reports
```

---

### 7. Get Immediate Manager Only

```sql
SELECT 
  wh.ancestor_id AS id,
  CONCAT(u.firstName, ' ', u.lastName) AS name
FROM workflow_hierarchy wh
JOIN employees u ON wh.ancestor_id = u.id
WHERE wh.descendant_id = 'subordinate-uuid'
  AND wh.department = 'purchase'
  AND wh.depth = 1;  -- Only immediate manager
```

---

### 8. Count Total Subordinates

```sql
SELECT COUNT(*) AS total_subordinates
FROM workflow_hierarchy
WHERE ancestor_id = 'manager-uuid'
  AND department = 'purchase'
  AND depth > 0;
```

---

### 9. Get Hierarchy Level (How Deep)

```sql
SELECT MAX(depth) AS max_depth
FROM workflow_hierarchy
WHERE ancestor_id = 'top-manager-uuid'
  AND department = 'purchase';
```

---

### 10. Find Root Managers (Top of Hierarchy)

```sql
SELECT DISTINCT u.id, CONCAT(u.firstName, ' ', u.lastName) AS name
FROM employees u
WHERE u.id IN (
  SELECT DISTINCT ancestor_id
  FROM workflow_hierarchy
  WHERE department = 'purchase'
    AND depth = 1
)
AND u.id NOT IN (
  SELECT DISTINCT descendant_id
  FROM workflow_hierarchy
  WHERE department = 'purchase'
    AND depth = 1
);
```

---

### 11. Remove a Relationship (and all indirect paths)

```sql
DELETE FROM workflow_hierarchy
WHERE department = 'purchase'
  AND ancestor_id IN (
    SELECT ancestor_id 
    FROM workflow_hierarchy 
    WHERE descendant_id = 'manager-uuid' 
      AND department = 'purchase'
  )
  AND descendant_id IN (
    SELECT descendant_id 
    FROM workflow_hierarchy 
    WHERE ancestor_id = 'subordinate-uuid' 
      AND department = 'purchase'
  )
  AND (ancestor_id, descendant_id) IN (
    SELECT super_anc.ancestor_id, super_desc.descendant_id
    FROM workflow_hierarchy AS super_anc
    JOIN workflow_hierarchy AS direct 
      ON direct.ancestor_id = 'manager-uuid'
      AND direct.descendant_id = 'subordinate-uuid'
      AND direct.department = 'purchase'
    JOIN workflow_hierarchy AS super_desc 
      ON super_desc.ancestor_id = 'subordinate-uuid'
    WHERE super_anc.descendant_id = 'manager-uuid'
      AND super_anc.department = 'purchase'
      AND super_desc.department = 'purchase'
  );
```

---

## 🎯 Performance Considerations

### Indexes
The following indexes are crucial for performance:

```sql
-- For finding subordinates
CREATE INDEX idx_workflow_ancestor ON workflow_hierarchy(ancestor_id, department);

-- For finding managers
CREATE INDEX idx_workflow_descendant ON workflow_hierarchy(descendant_id, department);

-- For filtering by depth
CREATE INDEX idx_workflow_depth ON workflow_hierarchy(depth);

-- For department filtering
CREATE INDEX idx_workflow_dept ON workflow_hierarchy(department);

-- Composite index for common queries
CREATE INDEX idx_workflow_composite ON workflow_hierarchy(department, ancestor_id, depth);
```

### Query Performance

| Query Type | Time Complexity | Notes |
|------------|----------------|-------|
| Get all subordinates | O(1) | Single query with index |
| Get all managers | O(1) | Single query with index |
| Check if A above B | O(1) | Single lookup |
| Get full tree | O(n) | Where n = total relationships |
| Add relationship | O(m) | Where m = existing paths |

---

## 🔧 Maintenance Queries

### Check for Orphaned Records

```sql
-- Find employees in hierarchy but not in employees table
SELECT DISTINCT wh.ancestor_id
FROM workflow_hierarchy wh
LEFT JOIN employees e ON wh.ancestor_id = e.id
WHERE e.id IS NULL;
```

### Verify Closure Table Integrity

```sql
-- Check if all self-references exist
SELECT e.id, CONCAT(e.firstName, ' ', e.lastName) AS name
FROM employees e
WHERE e.id IN (
  SELECT DISTINCT ancestor_id FROM workflow_hierarchy
  WHERE department = 'purchase'
)
AND e.id NOT IN (
  SELECT descendant_id FROM workflow_hierarchy
  WHERE ancestor_id = descendant_id
    AND department = 'purchase'
);
```

### Count Relationships by Depth

```sql
SELECT 
  depth,
  COUNT(*) AS count
FROM workflow_hierarchy
WHERE department = 'purchase'
GROUP BY depth
ORDER BY depth;
```

---

## 📈 Statistics Queries

### Department Hierarchy Stats

```sql
SELECT 
  department,
  COUNT(DISTINCT ancestor_id) AS total_managers,
  COUNT(DISTINCT descendant_id) AS total_employees,
  MAX(depth) AS max_hierarchy_depth,
  COUNT(*) AS total_relationships
FROM workflow_hierarchy
WHERE depth > 0
GROUP BY department;
```

### Manager Span of Control

```sql
SELECT 
  wh.ancestor_id,
  CONCAT(u.firstName, ' ', u.lastName) AS manager_name,
  COUNT(DISTINCT wh.descendant_id) AS total_subordinates,
  COUNT(CASE WHEN wh.depth = 1 THEN 1 END) AS direct_reports
FROM workflow_hierarchy wh
JOIN employees u ON wh.ancestor_id = u.id
WHERE wh.department = 'purchase'
  AND wh.depth > 0
GROUP BY wh.ancestor_id, u.firstName, u.lastName
ORDER BY total_subordinates DESC;
```

---

## 🚀 Migration Script

If you need to create the table:

```sql
-- Create the workflow_hierarchy table
CREATE TABLE IF NOT EXISTS workflow_hierarchy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department VARCHAR(50) NOT NULL,
  ancestor_id UUID NOT NULL,
  descendant_id UUID NOT NULL,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_ancestor FOREIGN KEY (ancestor_id) 
    REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_descendant FOREIGN KEY (descendant_id) 
    REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT unique_relationship 
    UNIQUE(department, ancestor_id, descendant_id)
);

-- Create indexes
CREATE INDEX idx_workflow_ancestor ON workflow_hierarchy(ancestor_id, department);
CREATE INDEX idx_workflow_descendant ON workflow_hierarchy(descendant_id, department);
CREATE INDEX idx_workflow_depth ON workflow_hierarchy(depth);
CREATE INDEX idx_workflow_dept ON workflow_hierarchy(department);
CREATE INDEX idx_workflow_composite ON workflow_hierarchy(department, ancestor_id, depth);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflow_hierarchy_updated_at
BEFORE UPDATE ON workflow_hierarchy
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

---

## 💡 Advanced Use Cases

### 1. Find Common Manager

```sql
-- Find the lowest common manager for two employees
SELECT wh1.ancestor_id AS common_manager_id,
       CONCAT(u.firstName, ' ', u.lastName) AS common_manager_name,
       MIN(wh1.depth + wh2.depth) AS total_distance
FROM workflow_hierarchy wh1
JOIN workflow_hierarchy wh2 
  ON wh1.ancestor_id = wh2.ancestor_id
  AND wh1.department = wh2.department
JOIN employees u ON wh1.ancestor_id = u.id
WHERE wh1.descendant_id = 'employee-1-uuid'
  AND wh2.descendant_id = 'employee-2-uuid'
  AND wh1.department = 'purchase'
GROUP BY wh1.ancestor_id, u.firstName, u.lastName
ORDER BY total_distance ASC
LIMIT 1;
```

### 2. Get Peers (Same Manager)

```sql
-- Find all employees with the same direct manager
SELECT 
  wh2.descendant_id AS peer_id,
  CONCAT(u.firstName, ' ', u.lastName) AS peer_name
FROM workflow_hierarchy wh1
JOIN workflow_hierarchy wh2 
  ON wh1.ancestor_id = wh2.ancestor_id
  AND wh1.department = wh2.department
  AND wh1.depth = 1
  AND wh2.depth = 1
JOIN employees u ON wh2.descendant_id = u.id
WHERE wh1.descendant_id = 'employee-uuid'
  AND wh2.descendant_id != 'employee-uuid'
  AND wh1.department = 'purchase';
```

### 3. Reorganization (Move Subtree)

```sql
-- Move an entire subtree to a new manager
-- Step 1: Remove old relationships
-- Step 2: Add new relationships
-- (Use the service methods for this - it's complex!)
```

---

## ✅ Best Practices

1. **Always use transactions** when adding/removing relationships
2. **Use ON CONFLICT DO NOTHING** to prevent duplicate errors
3. **Index properly** for your query patterns
4. **Cascade deletes** ensure cleanup when employees are removed
5. **Validate department enum** at application level
6. **Monitor table size** - it grows with O(n²) in worst case
7. **Regular maintenance** - check for orphaned records

---

## 🎓 Learning Resources

### Closure Table Pattern
- Stores all paths in the hierarchy
- Trades space for query speed
- Excellent for read-heavy workloads
- Updates are more complex but manageable

### Alternative Patterns
- **Adjacency List**: Simple but slow for deep queries
- **Nested Sets**: Fast reads, slow writes
- **Path Enumeration**: Good for paths, limited flexibility
- **Closure Table**: Best balance for most use cases ✅

---

That's everything you need to know about the database structure! 🎉
