# Dashboard API Documentation

Base URL: `/dashboard`
Auth: Bearer token required for all endpoints.

---

## 1. Procurement Team Performance
**GET** `/dashboard/midlevel/procurement/team-performance`

**Query Params:** None
**Auth:** `res.locals.user.id` (auto from token)

**Response:**
```json
{
  "success": true,
  "message": "Procurement team performance data retrieved successfully",
  "data": { }
}
```

---

## 2. Sale Team Performance
**GET** `/dashboard/midlevel/sale/team-performance`

**Query Params:** None
**Auth:** `res.locals.user.id` (auto from token)

**Response:**
```json
{
  "success": true,
  "message": "Sale team performance data retrieved successfully",
  "data": { }
}
```

---

## 3. Procurement Source Wise (Current Month)
**GET** `/dashboard/midlevel/procurement/source-wise`

**Query Params:** None
**Auth:** `res.locals.user.id` (auto from token)

**Response:**
```json
{
  "success": true,
  "message": "Procurement source-wise data retrieved successfully",
  "data": { }
}
```

---

## 4. Procurement Team Members Performance
**GET** `/dashboard/midlevel/procurement/team-members-performance`

**Query Params:** None
**Auth:** `res.locals.user.id` (auto from token)

**Response:**
```json
{
  "success": true,
  "message": "Procurement team members performance data retrieved successfully",
  "data": { }
}
```

---

## 5. Sale Team Members Performance
**GET** `/dashboard/midlevel/sale/team-members-performance`

**Query Params:** None
**Auth:** `res.locals.user.id` (auto from token)

**Response:**
```json
{
  "success": true,
  "message": "Sale team members performance data retrieved successfully",
  "data": { }
}
```

---

## 6. Farmer Registration Overview of Team
**GET** `/dashboard/registration-insight/farmer-registration`

**Query Params:**
| Param          | Type   | Required | Description              |
|----------------|--------|----------|--------------------------|
| `teamLeaderId` | string | Yes      | UUID of the team leader  |

**Example:**
```
GET /dashboard/registration-insight/farmer-registration?teamLeaderId=uuid-here
```

**Response:**
```json
{
  "success": true,
  "message": "Farmer registration overview data retrieved successfully",
  "data": {
    "registeredThisMonth": 5,
    "totalRegistered": 42,
    "approved": 30,
    "pending": 8,
    "rejected": 4
  }
}
```

---

## 7. Vendor Registration Overview of Team
**GET** `/dashboard/registration-insight/vendor-registration`

**Query Params:**
| Param          | Type   | Required | Description              |
|----------------|--------|----------|--------------------------|
| `teamLeaderId` | string | Yes      | UUID of the team leader  |

**Example:**
```
GET /dashboard/registration-insight/vendor-registration?teamLeaderId=uuid-here
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor registration overview data retrieved successfully",
  "data": {
    "registeredThisMonth": 3,
    "totalRegistered": 20,
    "approved": 15,
    "pending": 3,
    "rejected": 2
  }
}
```

---

## 8. Customer Registration Overview of Team
**GET** `/dashboard/registration-insight/customer-registration`

**Query Params:**
| Param          | Type   | Required | Description              |
|----------------|--------|----------|--------------------------|
| `teamLeaderId` | string | Yes      | UUID of the team leader  |

**Example:**
```
GET /dashboard/registration-insight/customer-registration?teamLeaderId=uuid-here
```

**Response:**
```json
{
  "success": true,
  "message": "Customer registration overview data retrieved successfully",
  "data": {
    "registeredThisMonth": 7,
    "totalRegistered": 55,
    "approved": 40,
    "pending": 10,
    "rejected": 5
  }
}
```

---

## 9. Farmer Registration — Each Team Member Performance
**GET** `/dashboard/registration-insight/farmer-registration/team-members-performance`

**Query Params:**
| Param          | Type   | Required | Description              |
|----------------|--------|----------|--------------------------|
| `teamLeaderId` | string | Yes      | UUID of the team leader  |

**Example:**
```
GET /dashboard/registration-insight/farmer-registration/team-members-performance?teamLeaderId=uuid-here
```

**Response:**
```json
{
  "success": true,
  "message": "Farmer registration overview data retrieved successfully",
  "data": [
    {
      "employeeName": "Ramesh Patil",
      "total": 10,
      "thisMonth": 2,
      "approved": 7,
      "pending": 2,
      "rejected": 1
    }
  ]
}
```

---

## 10. Vendor Registration — Each Team Member Performance
**GET** `/dashboard/registration-insight/vendor-registration/team-members-performance`

**Query Params:**
| Param          | Type   | Required | Description              |
|----------------|--------|----------|--------------------------|
| `teamLeaderId` | string | Yes      | UUID of the team leader  |

**Example:**
```
GET /dashboard/registration-insight/vendor-registration/team-members-performance?teamLeaderId=uuid-here
```

**Response:**
```json
{
  "success": true,
  "message": "Vendor registration overview data retrieved successfully",
  "data": [
    {
      "employeeName": "Suresh Kumar",
      "total": 8,
      "thisMonth": 1,
      "approved": 5,
      "pending": 2,
      "rejected": 1
    }
  ]
}
```

---

## 11. Customer Registration — Each Team Member Performance
**GET** `/dashboard/registration-insight/customer-registration/team-members-performance`

**Query Params:**
| Param          | Type   | Required | Description              |
|----------------|--------|----------|--------------------------|
| `teamLeaderId` | string | Yes      | UUID of the team leader  |

**Example:**
```
GET /dashboard/registration-insight/customer-registration/team-members-performance?teamLeaderId=uuid-here
```

**Response:**
```json
{
  "success": true,
  "message": "Customer registration overview data retrieved successfully",
  "data": [
    {
      "employeeName": "Priya Sharma",
      "total": 12,
      "thisMonth": 3,
      "approved": 9,
      "pending": 2,
      "rejected": 1
    }
  ]
}
```

---

## 12. Employee Count By Department
**GET** `/dashboard/employee-count/by-dept`

**Query Params:**
| Param        | Type   | Required | Description                                          |
|--------------|--------|----------|------------------------------------------------------|
| `department` | string | No       | Filter by department name (e.g. `sales`, `hr`, etc.) |

**Auth:** `res.locals.user.id` (auto from token)

**Behavior:**
| userId | department | Result                                      |
|--------|------------|---------------------------------------------|
| ✅     | ✅         | Team members of that user in that dept only |
| ✅     | ❌         | All team members of that user (all depts)   |
| ❌     | ❌         | All employees globally                      |

**Example (with department):**
```
GET /dashboard/employee-count/by-dept?department=sales
```

**Example (without department):**
```
GET /dashboard/employee-count/by-dept
```

**Response:**
```json
{
  "success": true,
  "message": "Employee team stats for user uuid-here",
  "data": {
    "total": 10,
    "active": 6,
    "inactive": 4,
    "activeMembers": [
      { "id": "uuid", "name": "Ramesh Patil", "status": "active" }
    ],
    "inactiveMembers": [
      { "id": "uuid", "name": "Suresh Kumar", "status": "inactive" }
    ]
  }
}
```

---

## Error Response (All Endpoints)
```json
{
  "success": false,
  "message": "Error description here"
}
```
