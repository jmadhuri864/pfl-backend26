# Auth & Workflow API Documentation

---

## 1. LOGIN

**POST** `/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "uid": "employee_username_or_email",
  "password": "yourpassword"
}
```

**Success Response (200):**
```json
{
  "status": "success",
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "id": "uuid-of-user",
  "userName": "Ramesh Patil",
  "roles": ["admin"],
  "currentWorkLocation": "uuid-of-location",
  "employeeId": "EMP001",
  "hasWorkflow": true,
  "permissions": [
    {
      "documentDefinition": {
        "id": "uuid",
        "name": "GRN",
        "uniqueKey": "grn"
      },
      "canCreate": true,
      "canView": true,
      "canEdit": false,
      "canDelete": false,
      "canDownload": true
    }
  ]
}
```

**Error Responses:**

| Status | Message                                          |
|--------|--------------------------------------------------|
| 400    | UID and Password are required.                   |
| 401    | Wrong password                                   |
| 403    | Your account is inactive. Please contact admin.  |
| 404    | Username or email is incorrect                   |

**Error Response Format:**
```json
{
  "status": "error",
  "message": "Wrong password"
}
```

---

## 2. GET USER WORKFLOWS BY DEPARTMENT

**GET** `/workflow/user/details/:id`

> **Note:** `:id` — required URL param, user cha UUID pathavaycha.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Params:**
| Param | Type   | Required | Description       |
|-------|--------|----------|-------------------|
| `id`  | string | Yes      | UUID of the user  |

**Request Query:** None
**Request Body:** None

**Success Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "department": "sales",
      "subordinates": [
        {
          "id": "uuid-of-user",
          "firstName": "Suresh",
          "lastName": "Kumar",
          "employeeId": "EMP002",
          "depth": 1
        }
      ]
    },
    {
      "department": "procurement",
      "subordinates": [
        {
          "id": "uuid-of-user",
          "firstName": "Priya",
          "lastName": "Sharma",
          "employeeId": "EMP003",
          "depth": 1
        }
      ]
    }
  ]
}
```

**Error Responses:**

| Status | Message              |
|--------|----------------------|
| 400    | userId is required   |
| 500    | Internal server error message |

**Error Response Format:**
```json
{
  "status": "error",
  "message": "error description"
}
```

---

## Notes

- Login returns `access_token` — store it and send in `Authorization: Bearer <token>` header for all subsequent requests.
- `GET /workflow/user/details/:id` — `:id` required param, user cha UUID URL madhe pathavaycha.
