# 🎯 Workflow Hierarchy System

## What Is This?

An **automatic organizational hierarchy builder** that figures out the entire chain of command when you just tell it who reports to whom.

---

## 🚀 Quick Start

### 1. Add a Relationship
```bash
POST /workflow/add
{
  "department": "purchase",
  "managerId": "hiren-uuid",
  "subordinateId": "sudhanshu-uuid"
}
```

### 2. View the Tree
```bash
GET /workflow/tree/purchase
```

**That's it!** The system automatically builds the full hierarchy.

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **WORKFLOW_HIERARCHY_GUIDE.md** | Complete user guide with all API endpoints |
| **WORKFLOW_HIERARCHY_EXAMPLES.md** | Real-world examples and testing scenarios |
| **WORKFLOW_HIERARCHY_DATABASE.md** | Database schema and SQL queries reference |

---

## ⭐ Key Features

✅ **Automatic Depth Calculation** - You only add direct relationships  
✅ **Full Tree Building** - System creates all indirect relationships  
✅ **Fast Queries** - Get subordinates/managers in O(1) time  
✅ **Department Isolation** - Each department has independent hierarchy  
✅ **Cascading Updates** - Add/remove relationships, tree updates automatically  

---

## 🎯 Use Cases

- Assigning targets (top → down)
- Department hierarchy display
- Reporting structure tracking
- Approval workflows
- Permission-based dashboards
- Employee performance tracking

---

## 📋 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/workflow/add` | Add single relationship |
| POST | `/workflow/bulk` | Add multiple relationships |
| GET | `/workflow/tree/:department` | Get full tree |
| GET | `/workflow/subordinates/:managerId/:department` | Get all subordinates |
| GET | `/workflow/managers/:subordinateId/:department` | Get all managers |
| GET | `/workflow/manager-tree/:managerId/:department` | Get manager's tree structure |
| DELETE | `/workflow/remove` | Remove relationship |

---

## 🏢 Available Departments

```
purchase, sale, operations, quality_checking, 
business_development, Branding_&_Marketing, exports, 
farming, accounts, finance, hr, it, admin, superAdmin
```

---

## 💡 How It Works

### You Add:
```
Hiren → Sudhanshu
Sudhanshu → Omkar
```

### System Automatically Creates:
```
Hiren → Sudhanshu (depth 1)
Sudhanshu → Omkar (depth 1)
Hiren → Omkar (depth 2) ← Automatic!
```

---

## 🔧 Technical Details

- **Pattern**: Closure Table (automatic hierarchy building)
- **Entity**: `WorkflowHierarchy` (workflowClosure.entity.ts)
- **Controller**: `WorkflowHierarchyController`
- **Service**: `WorkflowHierarchyService` (uses injected repository)
- **Repository**: `WorkflowHierarchyRepository` (injected via InversifyJS)
- **Dependency Injection**: InversifyJS with TypeORM

---

## 📖 Read More

Start with **WORKFLOW_HIERARCHY_GUIDE.md** for complete documentation.

---

## ✅ Quick Test

```bash
# 1. Add Hiren → Sudhanshu
POST /workflow/add
{
  "department": "purchase",
  "managerId": "hiren-uuid",
  "subordinateId": "sudhanshu-uuid"
}

# 2. Add Sudhanshu → Omkar
POST /workflow/add
{
  "department": "purchase",
  "managerId": "sudhanshu-uuid",
  "subordinateId": "omkar-uuid"
}

# 3. View tree - You'll see Hiren is also above Omkar!
GET /workflow/tree/purchase
```

---

## 🎉 That's It!

You now have a fully automatic organizational hierarchy system.

**Just add direct relationships, and the system handles the rest!**

---

## 📞 Need Help?

- Check **WORKFLOW_HIERARCHY_GUIDE.md** for detailed API docs
- See **WORKFLOW_HIERARCHY_EXAMPLES.md** for real-world examples
- Review **WORKFLOW_HIERARCHY_DATABASE.md** for SQL queries

Happy Hierarchying! 🚀
