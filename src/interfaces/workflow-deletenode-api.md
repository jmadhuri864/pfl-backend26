# Workflow Delete Node API

---

## DELETE NODE

**DELETE** `/workflow/delete-node/:department/:nodeId`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Params:**
| Param        | Type   | Required | Description                                      |
|--------------|--------|----------|--------------------------------------------------|
| `department` | string | Yes      | Department name (e.g. `sales`, `procurement`)    |
| `nodeId`     | string | Yes      | UUID of the node (employee) to delete            |

**Request Body:** None

**Example:**
```
DELETE /workflow/delete-node/sales/uuid-of-node
```

**Success Response (200):**
```json
{
  "status": "success",
  "data": {
    "message": "Node deleted successfully from workflow hierarchy."
  }
}
```

**Error Response (400):**
```json
{
  "status": "fail",
  "message": "Department and nodeId are required"
}
```

**Error Response (500):**
```json
{
  "status": "error",
  "message": "error description"
}
```

---

## Note

- `nodeId` — `GET /workflow/getworkflow/:department` chya response madhe pratyek node cha `nodeId` field madhe milto.
- He endpoint node cha saglya entries delete karto — ancestor mhanun pn ani descendant mhanun pn.
