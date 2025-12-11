# Workflow Hierarchy - API Examples

## 📝 Postman/API Testing Examples

### Example 1: Building a Purchase Department Hierarchy

#### Scenario:
```
Hiren (Head of Purchase)
  └── Sudhanshu (Purchase Manager)
      └── Omkar (Purchase Executive)
          └── Vaibhav (Purchase Assistant)
```

#### Step 1: Add Hiren → Sudhanshu
```http
POST http://localhost:3000/workflow/add
Content-Type: application/json

{
  "department": "purchase",
  "managerId": "550e8400-e29b-41d4-a716-446655440001",
  "subordinateId": "550e8400-e29b-41d4-a716-446655440002"
}
```

#### Step 2: Add Sudhanshu → Omkar
```http
POST http://localhost:3000/workflow/add
Content-Type: application/json

{
  "department": "purchase",
  "managerId": "550e8400-e29b-41d4-a716-446655440002",
  "subordinateId": "550e8400-e29b-41d4-a716-446655440003"
}
```

#### Step 3: Add Omkar → Vaibhav
```http
POST http://localhost:3000/workflow/add
Content-Type: application/json

{
  "department": "purchase",
  "managerId": "550e8400-e29b-41d4-a716-446655440003",
  "subordinateId": "550e8400-e29b-41d4-a716-446655440004"
}
```

#### Step 4: View the Complete Tree
```http
GET http://localhost:3000/workflow/tree/purchase
```

**Expected Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Hiren Patel",
      "children": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "Sudhanshu Kumar",
          "children": [
            {
              "id": "550e8400-e29b-41d4-a716-446655440003",
              "name": "Omkar Singh",
              "children": [
                {
                  "id": "550e8400-e29b-41d4-a716-446655440004",
                  "name": "Vaibhav Sharma",
                  "children": []
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Example 2: Bulk Add Multiple Relationships

```http
POST http://localhost:3000/workflow/bulk
Content-Type: application/json

{
  "department": "sale",
  "relations": [
    {
      "managerId": "550e8400-e29b-41d4-a716-446655440010",
      "subordinateId": "550e8400-e29b-41d4-a716-446655440011"
    },
    {
      "managerId": "550e8400-e29b-41d4-a716-446655440011",
      "subordinateId": "550e8400-e29b-41d4-a716-446655440012"
    },
    {
      "managerId": "550e8400-e29b-41d4-a716-446655440011",
      "subordinateId": "550e8400-e29b-41d4-a716-446655440013"
    },
    {
      "managerId": "550e8400-e29b-41d4-a716-446655440012",
      "subordinateId": "550e8400-e29b-41d4-a716-446655440014"
    }
  ]
}
```

This creates:
```
Sales Head (10)
  └── Sales Manager (11)
      ├── Sales Executive 1 (12)
      │   └── Sales Assistant (14)
      └── Sales Executive 2 (13)
```

---

### Example 3: Query All Subordinates

Get everyone under Sudhanshu (direct and indirect):

```http
GET http://localhost:3000/workflow/subordinates/550e8400-e29b-41d4-a716-446655440002/purchase
```

**Expected Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "Omkar Singh",
      "depth": 1,
      "relationship_type": "Direct"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440004",
      "name": "Vaibhav Sharma",
      "depth": 2,
      "relationship_type": "Indirect"
    }
  ]
}
```

---

### Example 4: Query All Managers

Get all managers above Vaibhav:

```http
GET http://localhost:3000/workflow/managers/550e8400-e29b-41d4-a716-446655440004/purchase
```

**Expected Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "name": "Omkar Singh",
      "depth": 1,
      "relationship_type": "Direct Manager"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "Sudhanshu Kumar",
      "depth": 2,
      "relationship_type": "Higher Management"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Hiren Patel",
      "depth": 3,
      "relationship_type": "Higher Management"
    }
  ]
}
```

---

### Example 5: Get Manager's Tree Structure

Get the tree structure starting from Sudhanshu:

```http
GET http://localhost:3000/workflow/manager-tree/550e8400-e29b-41d4-a716-446655440002/purchase
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "name": "Sudhanshu Kumar",
    "children": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "name": "Omkar Singh",
        "children": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440004",
            "name": "Vaibhav Sharma",
            "children": []
          }
        ]
      }
    ]
  }
}
```

**Use Case:** Perfect for showing a manager's team structure in org charts or dashboards.

---

### Example 6: Remove a Relationship

Remove Sudhanshu → Omkar relationship:

```http
DELETE http://localhost:3000/workflow/remove
Content-Type: application/json

{
  "department": "purchase",
  "managerId": "550e8400-e29b-41d4-a716-446655440002",
  "subordinateId": "550e8400-e29b-41d4-a716-446655440003"
}
```

**Result:** The system automatically removes:
- Direct relationship: Sudhanshu → Omkar (depth 1)
- Indirect relationship: Hiren → Omkar (depth 2)
- Indirect relationship: Sudhanshu → Vaibhav (depth 2)
- Indirect relationship: Hiren → Vaibhav (depth 3)

---

## 🧪 Testing Scenarios

### Scenario 1: Simple Chain
```
A → B → C
```
**What the system creates:**
- A → B (depth 1)
- B → C (depth 1)
- A → C (depth 2) ← Automatic!

### Scenario 2: Multiple Subordinates
```
A → B
A → C
```
**What the system creates:**
- A → B (depth 1)
- A → C (depth 1)

### Scenario 3: Deep Hierarchy
```
A → B → C → D → E
```
**What the system creates:**
- All direct relationships (depth 1)
- A → C (depth 2)
- A → D (depth 3)
- A → E (depth 4)
- B → D (depth 2)
- B → E (depth 3)
- C → E (depth 2)
- All automatic!

### Scenario 4: Tree Structure
```
        A
       / \
      B   C
     / \
    D   E
```
**What the system creates:**
- A → B, A → C (depth 1)
- B → D, B → E (depth 1)
- A → D, A → E (depth 2) ← Automatic!

---

## 🔍 Verification Queries

After adding relationships, verify with these queries:

### 1. Check if hierarchy is correct
```http
GET http://localhost:3000/workflow/tree/purchase
```

### 2. Verify a person's subordinates
```http
GET http://localhost:3000/workflow/subordinates/{userId}/purchase
```

### 3. Verify a person's managers
```http
GET http://localhost:3000/workflow/managers/{userId}/purchase
```

---

## 💡 Pro Tips

1. **Always use bulk add** when setting up a new department - it's faster
2. **Check the tree** after adding relationships to verify structure
3. **Use subordinates query** to see who reports to a manager (for dashboards)
4. **Use managers query** to implement approval workflows
5. **Department isolation** means you can have the same person in multiple departments with different hierarchies

---

## 🚨 Common Mistakes to Avoid

❌ **Don't manually set depth** - The system calculates it
❌ **Don't add the same relationship twice** - System will ignore duplicates
❌ **Don't forget department** - Each hierarchy is department-specific
❌ **Don't use wrong user IDs** - Make sure users exist in the employees table

✅ **Do add direct relationships only** - System builds the rest
✅ **Do use bulk add for efficiency** - Faster than multiple single adds
✅ **Do verify with tree query** - Always check your work
✅ **Do use proper department enums** - Use exact values from DepartmentEnum

---

## 📊 Real-World Use Case: Approval Workflow

When Vaibhav creates a purchase request:

1. Query his managers: `GET /workflow/managers/{vaibhav-id}/purchase`
2. Get the list: Omkar (depth 1), Sudhanshu (depth 2), Hiren (depth 3)
3. Route approval:
   - First to Omkar (direct manager)
   - If Omkar approves, send to Sudhanshu
   - If Sudhanshu approves, send to Hiren for final approval

All based on the automatic hierarchy!

---

## 🎯 Integration Examples

### Frontend Display (React/Angular)
```javascript
// Fetch tree
const response = await fetch('/workflow/tree/purchase');
const tree = await response.json();

// Render as org chart
<OrgChart data={tree.data} />
```

### Approval Routing (Backend)
```typescript
// Get all managers for approval chain
const managers = await workflowService.getManagers(userId, department);

// Send to first manager (depth 1)
const directManager = managers.find(m => m.depth === 1);
await sendApprovalRequest(directManager.id);
```

### Permission Check
```typescript
// Check if user A is above user B
const subordinates = await workflowService.getSubordinates(userA, department);
const isAbove = subordinates.some(s => s.id === userB);
```

---

## ✅ Success Checklist

- [ ] Added all direct relationships
- [ ] Verified tree structure with `/workflow/tree/:department`
- [ ] Tested subordinates query
- [ ] Tested managers query
- [ ] Verified automatic depth calculation
- [ ] Tested removal and re-verification
- [ ] Integrated with approval workflows
- [ ] Set up for all required departments

---

Happy Hierarchying! 🎉
