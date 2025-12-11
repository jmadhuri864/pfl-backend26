# Workflow Hierarchy System - Complete Guide

## 🎯 What This System Does

This is an **automatic organizational hierarchy builder**. You simply tell it who reports to whom, and it automatically figures out the entire chain of command.

### Super Simple Concept

👉 **You set the workflow by linking people: Manager → Subordinate**  
👉 **You do NOT set depth manually**  
👉 **The system figures it out automatically**  
👉 **After adding, the system builds the full tree of the department**

---

## ⭐ Real Life Example

If you say:
- "Hiren is boss of Sudhanshu"
- "Sudhanshu is boss of Omkar"
- "Omkar is boss of Vaibhav"

**The system automatically knows:**
- Hiren is also above Omkar (depth 2)
- Hiren is also above Vaibhav (depth 3)
- Sudhanshu is also above Vaibhav (depth 2)

You don't have to manually add these relationships!

---

## 🔧 How It Works (Technical)

This uses a **Closure Table** pattern:
- When you add a direct relationship (depth 1), the system automatically creates all indirect relationships
- It maintains self-references (depth 0) for each person
- It calculates the depth automatically based on the chain

---

## 📋 API Endpoints

### 1. Add Single Relationship
**POST** `/workflow/add`

Add one manager → subordinate relationship.

```json
{
  "department": "purchase",
  "managerId": "uuid-of-hiren",
  "subordinateId": "uuid-of-sudhanshu"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Relation added successfully. Hierarchy automatically updated."
  }
}
```

---

### 2. Add Multiple Relationships (Bulk)
**POST** `/workflow/bulk`

Add multiple relationships at once.

```json
{
  "department": "purchase",
  "relations": [
    {
      "managerId": "uuid-of-hiren",
      "subordinateId": "uuid-of-sudhanshu"
    },
    {
      "managerId": "uuid-of-sudhanshu",
      "subordinateId": "uuid-of-omkar"
    },
    {
      "managerId": "uuid-of-omkar",
      "subordinateId": "uuid-of-vaibhav"
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Bulk workflow saved successfully. Full hierarchy built automatically."
  }
}
```

---

### 3. Get Full Department Tree
**GET** `/workflow/tree/:department`

Get the complete organizational tree for a department.

**Example:** `GET /workflow/tree/purchase`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid-of-hiren",
      "name": "Hiren Patel",
      "children": [
        {
          "id": "uuid-of-sudhanshu",
          "name": "Sudhanshu Kumar",
          "children": [
            {
              "id": "uuid-of-omkar",
              "name": "Omkar Singh",
              "children": [
                {
                  "id": "uuid-of-vaibhav",
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

### 4. Get All Subordinates
**GET** `/workflow/subordinates/:managerId/:department`

Get all people under a manager (direct and indirect).

**Example:** `GET /workflow/subordinates/uuid-of-hiren/purchase`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid-of-sudhanshu",
      "name": "Sudhanshu Kumar",
      "depth": 1,
      "relationship_type": "Direct"
    },
    {
      "id": "uuid-of-omkar",
      "name": "Omkar Singh",
      "depth": 2,
      "relationship_type": "Indirect"
    },
    {
      "id": "uuid-of-vaibhav",
      "name": "Vaibhav Sharma",
      "depth": 3,
      "relationship_type": "Indirect"
    }
  ]
}
```

---

### 5. Get All Managers
**GET** `/workflow/managers/:subordinateId/:department`

Get all managers above a person (direct and indirect).

**Example:** `GET /workflow/managers/uuid-of-vaibhav/purchase`

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid-of-omkar",
      "name": "Omkar Singh",
      "depth": 1,
      "relationship_type": "Direct Manager"
    },
    {
      "id": "uuid-of-sudhanshu",
      "name": "Sudhanshu Kumar",
      "depth": 2,
      "relationship_type": "Higher Management"
    },
    {
      "id": "uuid-of-hiren",
      "name": "Hiren Patel",
      "depth": 3,
      "relationship_type": "Higher Management"
    }
  ]
}
```

---

### 6. Get Manager's Tree Structure
**GET** `/workflow/manager-tree/:managerId/:department`

Get the hierarchical tree starting from a specific manager.

**Example:** `GET /workflow/manager-tree/uuid-of-sudhanshu/purchase`

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid-of-sudhanshu",
    "name": "Sudhanshu Kumar",
    "children": [
      {
        "id": "uuid-of-omkar",
        "name": "Omkar Singh",
        "children": [
          {
            "id": "uuid-of-vaibhav",
            "name": "Vaibhav Sharma",
            "children": []
          }
        ]
      }
    ]
  }
}
```

### 7. Remove Relationship
**DELETE** `/workflow/remove`

Remove a manager → subordinate relationship.

```json
{
  "department": "purchase",
  "managerId": "uuid-of-sudhanshu",
  "subordinateId": "uuid-of-omkar"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Relation removed successfully. Hierarchy automatically updated."
  }
}
```

---

## 🏢 Available Departments

```typescript
enum DepartmentEnum {
  PURCHASE = "purchase",
  SALE = "sale",
  OPERATIONS = "operations",
  QUALITY_CHECKING = "quality_checking",
  BUSINESS_DEVELOPMENT = "business_development",
  BRANDING_MARKETING = "Branding_&_Marketing",
  EXPORTS = "exports",
  FARMING = "farming",
  ACCOUNTS = "accounts",
  FINANCE = "finance",
  HR = "hr",
  IT = "it",
  ADMIN = "admin",
  SUPERADMIN = "superAdmin"
}
```

---

## 💡 Use Cases

Once set up, this workflow hierarchy can be used for:

1. **Assigning Targets** - Top-down target distribution
2. **Department Hierarchy Display** - Visual org charts
3. **Reporting Structure** - Who reports to whom
4. **Assigning Responsibilities** - Task delegation based on hierarchy
5. **Permission-Based Dashboards** - Show data based on reporting structure
6. **Employee Performance Tracking** - Track performance across hierarchy levels
7. **Approval Workflows** - Route approvals through the chain of command
8. **Access Control** - Grant access based on position in hierarchy

---

## 🔍 How Depth Works

- **Depth 0**: Self-reference (every person has this)
- **Depth 1**: Direct relationship (immediate manager/subordinate)
- **Depth 2**: Skip one level (manager's manager, or subordinate's subordinate)
- **Depth 3+**: Multiple levels up or down

The system calculates this automatically when you add relationships!

---

## ⚠️ Important Notes

1. **Automatic Calculation**: Never manually set depth - the system handles it
2. **Cascading Updates**: When you add/remove a relationship, all indirect paths update automatically
3. **Self-References**: The system maintains depth 0 entries for everyone
4. **No Duplicates**: The system prevents duplicate relationships
5. **Department Isolation**: Each department has its own independent hierarchy

---

## 🚀 Quick Start Example

```bash
# Step 1: Add Hiren as Sudhanshu's manager
POST /workflow/add
{
  "department": "purchase",
  "managerId": "hiren-uuid",
  "subordinateId": "sudhanshu-uuid"
}

# Step 2: Add Sudhanshu as Omkar's manager
POST /workflow/add
{
  "department": "purchase",
  "managerId": "sudhanshu-uuid",
  "subordinateId": "omkar-uuid"
}

# Step 3: View the full tree
GET /workflow/tree/purchase

# Result: You'll see Hiren → Sudhanshu → Omkar
# And the system knows Hiren is also above Omkar!
```

---

## 🎓 Database Structure

The `workflow_hierarchy` table stores:
- `department`: Which department this belongs to
- `ancestor_id`: The manager/boss (references employees table)
- `descendant_id`: The subordinate (references employees table)
- `depth`: How many levels apart (0=self, 1=direct, 2+=indirect)

The closure table pattern ensures efficient queries for:
- Finding all subordinates (any depth)
- Finding all managers (any depth)
- Building the complete tree
- Checking if person A is above person B

---

## ✅ Testing the System

1. Add a few relationships using `/workflow/add`
2. Check the tree with `/workflow/tree/:department`
3. Query subordinates with `/workflow/subordinates/:managerId/:department`
4. Query managers with `/workflow/managers/:subordinateId/:department`
5. Remove a relationship and see the tree update automatically

---

## 🎉 That's It!

You now have a fully automatic organizational hierarchy system. Just add direct relationships, and the system handles the rest!
